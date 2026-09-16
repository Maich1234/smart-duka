import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { CustomerAccountScreen } from '@/components/credit/CustomerAccountScreen';

export default function OwnerCustomerAccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CustomerAccountScreen customerId={id} />;
}
