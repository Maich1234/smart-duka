import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { CustomerListScreen } from '@/components/credit/CustomerListScreen';
import type { CustomerFilter } from '@/services/customers';

const VALID_FILTERS: CustomerFilter[] = ['all', 'outstanding', 'overdue', 'paid'];

export default function StaffCustomersScreen() {
  const { filter } = useLocalSearchParams<{ filter?: string }>();
  const initialFilter = VALID_FILTERS.includes(filter as CustomerFilter) ? (filter as CustomerFilter) : 'all';
  return <CustomerListScreen basePath="/(staff)/customers" initialFilter={initialFilter} />;
}
