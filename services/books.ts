import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import api from './api';
import { API_BASE_URL } from '@/constants/config';
import { useAuthStore } from '@/store/authStore';

/**
 * Business books — the shop's financial records.
 *
 * Computed on the server (backend services/books). Nothing here recomputes a
 * figure: the preview and the downloaded file are the same BookDocument, so
 * the phone and the web app can never disagree about a number someone takes
 * to a lender.
 */

export type BookFormat = 'csv' | 'xlsx' | 'pdf';

export interface BookColumn {
  key: string;
  label: string;
  align: 'left' | 'right';
  type: 'text' | 'money' | 'number' | 'date';
}

export interface BookSection {
  label?: string;
  rows: Record<string, string | number>[];
  subtotals?: Record<string, number>;
}

export interface BookDocument {
  key: string;
  title: string;
  shop: { name: string; currency: string; ownerName: string };
  period: { from: string; to: string; label: string };
  columns: BookColumn[];
  sections: BookSection[];
  totals: Record<string, number>;
  footnotes: string[];
  meta: { generatedAt: string; estimated: boolean; version: number };
}

export interface BookCatalogueEntry {
  key: string;
  title: string;
  description: string;
}

export interface BookCatalogue {
  books: BookCatalogueEntry[];
  formats: BookFormat[];
  currency: string;
  maxPeriodDays: number;
}

export const getBookCatalogue = async (): Promise<BookCatalogue> => {
  const res = await api.get('/reports/books');
  return res.data.data;
};

export const getBook = async (
  key: string,
  period: { from: string; to: string }
): Promise<BookDocument> => {
  const res = await api.get(`/reports/books/${key}`, { params: period });
  return res.data.data;
};

const EXTENSIONS: Record<BookFormat, string> = { csv: 'csv', xlsx: 'xlsx', pdf: 'pdf' };

const MIME: Record<BookFormat, string> = {
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

/** Safe on every filesystem, and still readable in a file manager. */
const slug = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'book';

/**
 * Downloads a book and hands it to the OS share sheet, which is what "save
 * this" means on a phone — from there it goes to Files, Drive, WhatsApp or
 * an email to an accountant.
 *
 * Written to the cache directory rather than documents: the file has already
 * been shared or saved wherever the owner wanted it by the time this
 * resolves, and a second copy accumulating in app storage is just bloat the
 * system can't reclaim.
 */
export const downloadBook = async (
  key: string,
  title: string,
  format: BookFormat,
  period: { from: string; to: string },
  periodLabel: string
): Promise<void> => {
  const token = useAuthStore.getState().token;
  if (!token) throw new Error('Please sign in again to download your records.');

  const params = new URLSearchParams({ ...period, format }).toString();
  const url = `${API_BASE_URL}/reports/books/${key}/download?${params}`;
  const filename = `${slug(title)}-${slug(periodLabel)}.${EXTENSIONS[format]}`;

  const destination = new File(new Directory(Paths.cache), filename);

  let saved: File;
  try {
    saved = await File.downloadFileAsync(url, destination, {
      headers: { Authorization: `Bearer ${token}` },
      // The same book for the same period is a routine repeat request;
      // failing because yesterday's copy is still in the cache would be
      // a strange thing to show someone.
      idempotent: true,
    });
  } catch (error: any) {
    // downloadFileAsync surfaces a non-2xx as an error carrying the status,
    // but never the JSON body — so this cannot quote the server's message.
    const status = String(error?.message ?? '').match(/\b(4\d\d|5\d\d)\b/)?.[1];
    if (status === '403') throw new Error('Your plan does not include financial records.');
    if (status === '401') throw new Error('Please sign in again to download your records.');
    throw new Error('Could not prepare that download. Check your connection and try again.');
  }

  if (!(await Sharing.isAvailableAsync())) {
    // Rare — some Android builds without a share target. The file is real and
    // on disk, so say where rather than pretending it failed.
    throw new Error(`Saved to your device as ${filename}, but this device has no app to open it with.`);
  }

  await Sharing.shareAsync(saved.uri, {
    mimeType: MIME[format],
    dialogTitle: `${title} — ${periodLabel}`,
    // Only iOS uses this; harmless elsewhere.
    UTI: format === 'pdf' ? 'com.adobe.pdf' : undefined,
  });
};
