package expo.modules.bluetoothprinter

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.util.Base64
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.OutputStream
import java.util.UUID

/**
 * Classic Bluetooth (RFCOMM / Serial Port Profile) printing for Android.
 *
 * The budget 58mm thermal printers dukas actually own — POS58, Goojprt PT-210,
 * XPrinter clones — speak ESC/POS over Classic SPP, which neither expo-print
 * nor any BLE library can reach. BLE-capable printers are handled in JS by
 * react-native-ble-plx; this module covers the rest.
 *
 * There is deliberately no iOS counterpart: iOS cannot open an RFCOMM socket to
 * an uncertified accessory at all (MFi program), so iOS falls back to BLE or
 * the system print sheet. `expo-module.config.json` restricts this module to
 * Android, so `requireOptionalNativeModule` returns null everywhere else.
 */
class BluetoothPrinterModule : Module() {
  companion object {
    /** Well-known Serial Port Profile UUID — what every ESC/POS printer advertises. */
    private val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

    /**
     * Printers have tiny receive buffers (often 1–4KB) and no flow control on
     * the SPP link, so a whole receipt written in one go silently overruns and
     * prints garbage. Feed it in small chunks with a breather instead.
     */
    private const val CHUNK_SIZE = 256
    private const val CHUNK_DELAY_MS = 20L
  }

  private var socket: BluetoothSocket? = null
  private var output: OutputStream? = null
  private var connectedAddress: String? = null
  private var discoveryReceiver: BroadcastReceiver? = null

  private val context: Context
    get() = appContext.reactContext
      ?: throw CodedException("ERR_NO_CONTEXT", "React context is unavailable", null)

  private val adapter: BluetoothAdapter?
    get() = (context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter

  override fun definition() = ModuleDefinition {
    Name("BluetoothPrinter")

    Events("onDeviceFound", "onScanFinished")

    Function("isSupported") { adapter != null }

    Function("isEnabled") { adapter?.isEnabled == true }

    Function("getConnectedAddress") { connectedAddress }

    AsyncFunction("getPairedDevices") {
      bondedDevices()
    }

    AsyncFunction("startScan") {
      val bluetooth = requireEnabledAdapter()
      startDiscovery(bluetooth)
    }

    AsyncFunction("stopScan") {
      stopDiscovery()
    }

    AsyncFunction("connect") Coroutine { address: String ->
      withContext(Dispatchers.IO) { openSocket(address) }
    }

    AsyncFunction("write") Coroutine { base64: String ->
      withContext(Dispatchers.IO) { writeBytes(Base64.decode(base64, Base64.DEFAULT)) }
    }

    AsyncFunction("disconnect") Coroutine {
      withContext(Dispatchers.IO) { closeSocket() }
    }

    OnDestroy {
      stopDiscovery()
      closeSocket()
    }
  }

  // ---------------------------------------------------------------- discovery

  @SuppressLint("MissingPermission")
  private fun bondedDevices(): List<Map<String, Any?>> {
    val bluetooth = requireEnabledAdapter()
    return try {
      bluetooth.bondedDevices.orEmpty().map(::serializeDevice)
    } catch (e: SecurityException) {
      throw CodedException("ERR_BT_PERMISSION", "Bluetooth permission was denied", e)
    }
  }

  @SuppressLint("MissingPermission")
  private fun startDiscovery(bluetooth: BluetoothAdapter) {
    stopDiscovery()

    val receiver = object : BroadcastReceiver() {
      override fun onReceive(ctx: Context?, intent: Intent?) {
        when (intent?.action) {
          BluetoothDevice.ACTION_FOUND -> {
            val device: BluetoothDevice? =
              intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
            device?.let {
              try {
                sendEvent("onDeviceFound", serializeDevice(it))
              } catch (_: SecurityException) {
                // Permission revoked mid-scan — drop the device rather than crash.
              }
            }
          }
          BluetoothAdapter.ACTION_DISCOVERY_FINISHED -> sendEvent("onScanFinished")
        }
      }
    }

    val filter = IntentFilter().apply {
      addAction(BluetoothDevice.ACTION_FOUND)
      addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED)
    }
    // Android 13+ requires the export flag. Both actions are protected system
    // broadcasts (only the OS can send them), so EXPORTED carries no risk and is
    // what makes them get delivered at all.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
    } else {
      context.registerReceiver(receiver, filter)
    }
    discoveryReceiver = receiver

    try {
      if (bluetooth.isDiscovering) bluetooth.cancelDiscovery()
      if (!bluetooth.startDiscovery()) {
        stopDiscovery()
        throw CodedException("ERR_BT_SCAN", "Bluetooth scan could not be started", null)
      }
    } catch (e: SecurityException) {
      stopDiscovery()
      throw CodedException("ERR_BT_PERMISSION", "Bluetooth scan permission was denied", e)
    }
  }

  @SuppressLint("MissingPermission")
  private fun stopDiscovery() {
    discoveryReceiver?.let {
      try {
        context.unregisterReceiver(it)
      } catch (_: IllegalArgumentException) {
        // Already unregistered.
      }
    }
    discoveryReceiver = null
    try {
      adapter?.takeIf { it.isDiscovering }?.cancelDiscovery()
    } catch (_: SecurityException) {
      // Nothing to cancel without permission.
    }
  }

  // --------------------------------------------------------------- connection

  @SuppressLint("MissingPermission")
  private fun openSocket(address: String) {
    val bluetooth = requireEnabledAdapter()

    if (connectedAddress == address && socket?.isConnected == true) return
    closeSocket()

    val device = try {
      bluetooth.getRemoteDevice(address)
    } catch (e: IllegalArgumentException) {
      throw CodedException("ERR_BT_ADDRESS", "\"$address\" is not a valid printer address", e)
    }

    // Discovery starves the radio and is the most common cause of a connect
    // that hangs then times out, so always cancel it first.
    try {
      if (bluetooth.isDiscovering) bluetooth.cancelDiscovery()
    } catch (_: SecurityException) {
    }

    try {
      val opened = try {
        device.createRfcommSocketToServiceRecord(SPP_UUID).also { it.connect() }
      } catch (primaryFailure: Exception) {
        // Plenty of clone printers publish a broken/empty SDP record, so the
        // service-record lookup finds nothing. They all listen on RFCOMM
        // channel 1 regardless, reachable only via this reflective call.
        fallbackSocket(device, primaryFailure)
      }

      socket = opened
      output = opened.outputStream
      connectedAddress = address
    } catch (e: SecurityException) {
      closeSocket()
      throw CodedException("ERR_BT_PERMISSION", "Bluetooth connect permission was denied", e)
    } catch (e: CodedException) {
      closeSocket()
      throw e
    } catch (e: Exception) {
      closeSocket()
      throw CodedException(
        "ERR_BT_CONNECT",
        "Could not connect to the printer. Check that it is switched on, has paper, and is in range.",
        e
      )
    }
  }

  @SuppressLint("MissingPermission")
  private fun fallbackSocket(device: BluetoothDevice, primaryFailure: Exception): BluetoothSocket {
    return try {
      val method = device.javaClass.getMethod("createRfcommSocket", Int::class.javaPrimitiveType)
      (method.invoke(device, 1) as BluetoothSocket).also { it.connect() }
    } catch (_: Exception) {
      // Surface the real (SDP) failure, not the reflection noise.
      throw CodedException(
        "ERR_BT_CONNECT",
        "Could not connect to the printer. Check that it is switched on, has paper, and is in range.",
        primaryFailure
      )
    }
  }

  private fun writeBytes(bytes: ByteArray) {
    val stream = output
    if (stream == null || socket?.isConnected != true) {
      throw CodedException("ERR_BT_NOT_CONNECTED", "No printer is connected", null)
    }

    try {
      var offset = 0
      while (offset < bytes.size) {
        val length = minOf(CHUNK_SIZE, bytes.size - offset)
        stream.write(bytes, offset, length)
        stream.flush()
        offset += length
        if (offset < bytes.size) Thread.sleep(CHUNK_DELAY_MS)
      }
    } catch (e: Exception) {
      // A broken pipe means the printer went away; drop the socket so the next
      // print reconnects instead of writing into a dead stream forever.
      closeSocket()
      throw CodedException("ERR_BT_WRITE", "Lost connection to the printer while printing", e)
    }
  }

  private fun closeSocket() {
    try {
      output?.flush()
    } catch (_: Exception) {
    }
    try {
      socket?.close()
    } catch (_: Exception) {
    }
    output = null
    socket = null
    connectedAddress = null
  }

  // ------------------------------------------------------------------ helpers

  private fun requireEnabledAdapter(): BluetoothAdapter {
    val bluetooth = adapter
      ?: throw CodedException("ERR_BT_UNSUPPORTED", "This device has no Bluetooth radio", null)
    if (!bluetooth.isEnabled) {
      throw CodedException("ERR_BT_DISABLED", "Bluetooth is switched off", null)
    }
    return bluetooth
  }

  @SuppressLint("MissingPermission")
  private fun serializeDevice(device: BluetoothDevice): Map<String, Any?> = mapOf(
    "address" to device.address,
    "name" to (device.name ?: device.address),
    "paired" to (device.bondState == BluetoothDevice.BOND_BONDED)
  )
}
