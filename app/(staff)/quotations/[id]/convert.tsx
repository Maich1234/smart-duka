import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ConvertQuotationScreen } from '@/components/quotations/ConvertQuotationScreen';

export default function StaffConvertQuotationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ConvertQuotationScreen quotationId={id} basePath="/(staff)/quotations" />;
}
