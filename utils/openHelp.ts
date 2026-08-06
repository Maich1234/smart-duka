import { HELP_CENTER_URL } from '@/constants/config';
import { openWebPage } from '@/utils/openWebPage';

/**
 * Opens a Help & Learning Center article in an in-app browser tab.
 *
 * The Help Center lives entirely on the marketing site now — no help content
 * ships in this bundle on any platform. It used to exist twice: the written
 * content in this repo served from the Expo web export, plus a stub page on
 * the Next.js site. Consolidating onto one host removed the duplicate, cut the
 * bundle, and made every article server-rendered and indexable.
 *
 * Native already behaved this way (the in-app /help routes were just browser
 * redirects), so this is not a change in what users experience beyond staying
 * inside the app rather than switching to an external browser.
 */
export function openHelp(slug?: string) {
  const path = slug ? `/help/${slug}` : '/help';
  openWebPage(`${HELP_CENTER_URL}${path}`);
}
