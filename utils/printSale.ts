import { Sale } from '@/services/sales';
import { PUBLIC_WEB_URL } from '@/constants/config';
import { usePrinterStore } from '@/store/printerStore';
import { buildReceiptEscPos, buildTestPageEscPos } from '@/utils/escpos';
import { printBytes } from '@/utils/bluetoothPrinter';
import { printHtml } from '@/utils/printReceipt';
import { buildReceiptHtml } from '@/utils/receiptHtml';
import { PrinterError, printerErrorMessage, type SavedPrinter } from '@/utils/printerTypes';

export interface PrintSaleOptions {
  shopName: string;
  shopPhone?: string;
  currency?: string;
  servedByName?: string;
  thankYouNote?: string;
  logoUrl?: string;
  motto?: string;
}

export type PrintTarget = 'bluetooth' | 'system';

export interface PrintOutcome {
  /** Where the receipt actually went — not necessarily where it was aimed. */
  target: PrintTarget;
  printerName?: string;
  /** Set when a Bluetooth attempt failed and the system sheet took over. */
  fallbackReason?: string;
}

/**
 * Prints a sale receipt, preferring the counter's saved Bluetooth printer and
 * falling back to the system print sheet.
 *
 * The fallback is the whole point: a shopkeeper mid-queue whose printer is off,
 * out of paper or out of range should not be stuck with a failed print and no
 * receipt — they get the system sheet plus a note explaining why, and can carry
 * on. Pass `target: 'system'` to skip Bluetooth entirely.
 */
export async function printSale(
  sale: Sale,
  options: PrintSaleOptions,
  target: PrintTarget = 'bluetooth'
): Promise<PrintOutcome> {
  const printer = usePrinterStore.getState().printer;

  if (target === 'bluetooth' && printer) {
    try {
      await printBytes(printer, buildSaleBytes(sale, printer, options));
      return { target: 'bluetooth', printerName: printer.name };
    } catch (error) {
      // Fall through to the system sheet, but keep the reason so the caller can
      // tell the user why the receipt did not come out of the usual printer.
      await printSystem(sale, options);
      return {
        target: 'system',
        printerName: printer.name,
        fallbackReason: printerErrorMessage(error),
      };
    }
  }

  await printSystem(sale, options);
  return { target: 'system' };
}

const buildSaleBytes = (sale: Sale, printer: SavedPrinter, options: PrintSaleOptions) =>
  buildReceiptEscPos(sale, {
    shopName: options.shopName,
    shopPhone: options.shopPhone,
    currency: options.currency,
    servedByName: options.servedByName,
    thankYouNote: options.thankYouNote,
    motto: options.motto,
    paperWidth: printer.paperWidth,
    receiptUrl: sale.receiptToken ? `${PUBLIC_WEB_URL}/r/${sale.receiptToken}` : undefined,
  });

const printSystem = async (sale: Sale, options: PrintSaleOptions): Promise<void> => {
  const html = await buildReceiptHtml(
    sale,
    options.shopName,
    options.shopPhone,
    options.currency,
    options.servedByName,
    options.thankYouNote,
    options.logoUrl,
    options.motto
  );
  await printHtml(html);
};

/** Setup-screen self-test. Unlike `printSale` this never falls back — the whole
 *  point is to prove the Bluetooth link works. */
export async function printTestPage(printer: SavedPrinter, shopName: string): Promise<void> {
  if (!printer) {
    throw new PrinterError('not_found', 'No printer is selected.');
  }
  await printBytes(printer, buildTestPageEscPos(shopName, printer.paperWidth));
}
