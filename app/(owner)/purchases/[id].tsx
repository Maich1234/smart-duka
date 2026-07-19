import React from 'react';
import { ComingSoonScreen } from '@/components/purchases/ComingSoonScreen';

export default function PurchaseDetails() {
  return (
    <ComingSoonScreen
      icon="receipt-outline"
      title="Purchase Details"
      subtitle="The full breakdown of this purchase will show up here soon."
    />
  );
}
