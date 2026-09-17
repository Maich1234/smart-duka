import React from 'react';
import { QuotationsListScreen } from '@/components/quotations/QuotationsListScreen';

export default function OwnerQuotationsScreen() {
  return <QuotationsListScreen basePath="/(owner)/quotations" />;
}
