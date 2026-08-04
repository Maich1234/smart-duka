import React from 'react';
import { PosScreen } from '@/components/sales/PosScreen';

/**
 * The owner's till — the same component staff sell from.
 *
 * Most Kenyan dukas are owner-operated with no employees, so the owner *is*
 * the person behind the counter. Before this route existed the dashboard's
 * "New Sale" button opened the read-only sales history and there was no way
 * for an owner to record a sale anywhere in the app.
 */
export default function OwnerPos() {
  // Pushed from the dashboard and from Sales, so unlike the cashier's Sales
  // tab this one needs a way back.
  return <PosScreen showBack />;
}
