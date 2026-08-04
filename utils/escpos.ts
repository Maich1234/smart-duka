import { Sale } from '@/services/sales';
import { formatCurrency, formatDateTime } from '@/utils/formatters';
import { saleMethodLabel } from '@/constants/paymentMethods';

/** Physical paper roll width. 58mm is the near-universal duka printer. */
export type PaperWidth = 58 | 80;

/** Printable characters per line in Font A at each roll width. */
const COLUMNS: Record<PaperWidth, number> = { 58: 32, 80: 48 };

const ESC = 0x1b;
const GS = 0x1d;

/**
 * Builds an ESC/POS byte stream — the command language every thermal receipt
 * printer speaks over Bluetooth. This is the raw-bytes counterpart to
 * `receiptHtml.ts`: same receipt, but laid out in fixed-width columns for an
 * 8-dot-per-mm print head instead of HTML for the system print service.
 *
 * Deliberately not printed here: the shop logo. Rasterising a remote image into
 * ESC/POS bitmap commands needs pixel access we don't have in JS, and a failed
 * fetch mid-checkout would stall the sale. Logos still appear on the HTML/PDF
 * receipt; on paper the shop name prints double-height in its place.
 */
class EscPosBuilder {
  private readonly bytes: number[] = [];

  constructor(private readonly cols: number) {}

  raw(...values: number[]): this {
    this.bytes.push(...values);
    return this;
  }

  /** Resets the printer and selects code page 437 (US/Latin). */
  init(): this {
    return this.raw(ESC, 0x40).raw(ESC, 0x74, 0x00);
  }

  text(value: string): this {
    this.bytes.push(...encodeAscii(value));
    return this;
  }

  line(value = ''): this {
    return this.text(value).raw(0x0a);
  }

  align(mode: 'left' | 'center' | 'right'): this {
    return this.raw(ESC, 0x61, mode === 'center' ? 1 : mode === 'right' ? 2 : 0);
  }

  bold(on: boolean): this {
    return this.raw(ESC, 0x45, on ? 1 : 0);
  }

  /**
   * Only ever doubles the height, never the width — width magnification halves
   * the usable columns and would silently wrap every line we laid out to 32.
   */
  tall(on: boolean): this {
    return this.raw(GS, 0x21, on ? 0x01 : 0x00);
  }

  /** Left label, right value, padded apart; the label truncates when tight. */
  columns(left: string, right: string): this {
    const room = this.cols - right.length - 1;
    const label = left.length > room ? left.slice(0, Math.max(room, 0)) : left;
    const gap = Math.max(this.cols - label.length - right.length, 1);
    return this.line(label + ' '.repeat(gap) + right);
  }

  /** Word-wrapped paragraph; long unbroken words are hard-split. */
  wrapped(value: string, indent = ''): this {
    const width = this.cols - indent.length;
    for (const word of value.split(/\s+/).filter(Boolean)) {
      const current = this.pendingLine;
      if (!current) {
        this.pendingLine = word;
      } else if (current.length + 1 + word.length <= width) {
        this.pendingLine = `${current} ${word}`;
      } else {
        this.line(indent + current);
        this.pendingLine = word;
      }
      while (this.pendingLine.length > width) {
        this.line(indent + this.pendingLine.slice(0, width));
        this.pendingLine = this.pendingLine.slice(width);
      }
    }
    if (this.pendingLine) {
      this.line(indent + this.pendingLine);
      this.pendingLine = '';
    }
    return this;
  }

  private pendingLine = '';

  divider(char = '-'): this {
    return this.line(char.repeat(this.cols));
  }

  feed(lines: number): this {
    return this.raw(ESC, 0x64, lines);
  }

  /**
   * Native QR via GS ( k. Printers without QR support ignore these commands
   * silently, which is why the verification URL is also printed as text.
   */
  qr(data: string, moduleSize = 6): this {
    const payload = encodeAscii(data);
    const length = payload.length + 3;
    return this
      .raw(GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00) // model 2
      .raw(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, moduleSize) // module size
      .raw(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31) // error correction M
      .raw(GS, 0x28, 0x6b, length & 0xff, (length >> 8) & 0xff, 0x31, 0x50, 0x30)
      .raw(...payload)
      .raw(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30); // print
  }

  /** Partial cut. Cutter-less printers treat this as a no-op. */
  cut(): this {
    return this.raw(GS, 0x56, 0x42, 0x00);
  }

  build(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

/**
 * Code page 437 covers little beyond ASCII, and printers render unmapped bytes
 * as random glyphs. Strip accents where possible ("Wanjiku Mũrĩithi" stays
 * readable) and drop anything still unmappable.
 */
function encodeAscii(value: string): number[] {
  let normalized = value;
  try {
    normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  } catch {
    // Older JS engines without full Unicode normalization — use the raw string.
  }
  const out: number[] = [];
  for (let i = 0; i < normalized.length; i += 1) {
    const code = normalized.charCodeAt(i);
    if (code >= 0x20 && code <= 0x7e) {
      out.push(code);
    } else if (code === 0x0a) {
      out.push(0x0a);
    } else if (code >= 0x2018 && code <= 0x2019) {
      out.push(0x27); // curly single quote → '
    } else if (code >= 0x201c && code <= 0x201d) {
      out.push(0x22); // curly double quote → "
    } else if (code === 0x2013 || code === 0x2014) {
      out.push(0x2d); // en/em dash → -
    } else if (code === 0x2026) {
      out.push(0x2e, 0x2e, 0x2e); // ellipsis
    }
  }
  return out;
}

/** Amounts inside the item table drop the currency code to save columns. */
const amount = (value: number): string =>
  value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface EscPosReceiptOptions {
  shopName: string;
  shopPhone?: string;
  currency?: string;
  servedByName?: string;
  thankYouNote?: string;
  motto?: string;
  paperWidth?: PaperWidth;
  /** Public verification link encoded into the QR code, when the sale has a token. */
  receiptUrl?: string;
}

export function buildReceiptEscPos(sale: Sale, options: EscPosReceiptOptions): Uint8Array {
  const {
    shopName,
    shopPhone,
    currency,
    servedByName,
    thankYouNote,
    motto,
    paperWidth = 58,
    receiptUrl,
  } = options;

  const cols = COLUMNS[paperWidth] ?? COLUMNS[58];
  const doc = new EscPosBuilder(cols).init();

  doc.align('center').bold(true).tall(true).wrapped(shopName).tall(false).bold(false);
  if (motto?.trim()) doc.wrapped(motto.trim());
  if (shopPhone?.trim()) doc.line(shopPhone.trim());
  doc.line('Dukana POS');

  doc.align('left').divider();
  doc.columns('Invoice', sale.invoiceNumber);
  doc.columns('Date', formatDateTime(sale.createdAt));
  doc.columns('Served By', sale.staff?.name ?? servedByName ?? '-');
  doc.columns('Payment', saleMethodLabel(sale).toUpperCase());

  if (sale.paymentMethod === 'mpesa' && sale.mpesaReceiptNumber) {
    doc.divider();
    doc.align('center').bold(true).line('LIPA NA M-PESA CONFIRMED').bold(false).align('left');
    doc.columns('Receipt', sale.mpesaReceiptNumber);
    const payerPhone = (sale as unknown as { mpesaPhoneNumber?: string }).mpesaPhoneNumber;
    if (payerPhone) doc.columns('Customer', payerPhone);
  }

  doc.divider();
  doc.columns('Item', 'Amount');
  doc.divider();

  for (const item of sale.items) {
    doc.wrapped(item.variantName ? `${item.productName} (${item.variantName})` : item.productName);
    doc.columns(`  ${item.quantity} x ${amount(item.unitPrice)}`, amount(item.subtotal));
    if (item.discountAmount && item.discountAmount > 0 && item.appliedPromotionLabel) {
      doc.wrapped(item.appliedPromotionLabel, '  ');
    }
  }

  doc.divider();
  doc.bold(true).tall(true).columns('TOTAL', formatCurrency(sale.totalAmount, currency)).tall(false).bold(false);
  doc.divider();

  doc.feed(1).align('center').wrapped(thankYouNote?.trim() || 'Thank you, dear customer!');

  if (receiptUrl) {
    doc.feed(1).qr(receiptUrl);
    doc.line('Scan to verify & rate us');
    doc.wrapped(receiptUrl);
  }

  doc.align('left').feed(4).cut();
  return doc.build();
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Hand-rolled because Hermes ships no `btoa` and no `Buffer` — both native
 * transports take the payload as base64 across the JS bridge.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += BASE64_ALPHABET[b0 >> 2];
    out += BASE64_ALPHABET[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? '=' : BASE64_ALPHABET[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? '=' : BASE64_ALPHABET[b2 & 0x3f];
  }
  return out;
}

/** Short self-test page used by "Print test receipt" in printer setup. */
export function buildTestPageEscPos(shopName: string, paperWidth: PaperWidth = 58): Uint8Array {
  const cols = COLUMNS[paperWidth] ?? COLUMNS[58];
  const doc = new EscPosBuilder(cols).init();

  doc.align('center').bold(true).tall(true).wrapped(shopName).tall(false).bold(false);
  doc.line('Dukana POS').divider();
  doc.wrapped('Printer connected successfully.');
  doc.line().align('left');
  doc.columns('Paper width', `${paperWidth}mm`);
  doc.columns('Characters', `${cols} per line`);
  doc.columns('Date', formatDateTime(new Date()));
  doc.divider();
  // A full-width ruler makes a wrong paper-width setting obvious at a glance:
  // if this line wraps, the printer is narrower than the selected size.
  doc.line('1234567890'.repeat(Math.ceil(cols / 10)).slice(0, cols));
  doc.feed(4).cut();
  return doc.build();
}
