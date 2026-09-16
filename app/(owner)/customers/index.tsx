import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { CustomerListScreen } from '@/components/credit/CustomerListScreen';
import type { CustomerFilter } from '@/services/customers';

const VALID_FILTERS: CustomerFilter[] = ['all', 'outstanding', 'overdue', 'paid'];

export default function OwnerCustomersScreen() {
  // Arriving from the Credit overview's overdue link carries ?filter=overdue
  // so the directory opens already narrowed, instead of landing on "All" and
  // making the owner re-select the filter they just tapped to get here.
  const { filter } = useLocalSearchParams<{ filter?: string }>();
  const initialFilter = VALID_FILTERS.includes(filter as CustomerFilter) ? (filter as CustomerFilter) : 'all';
  return <CustomerListScreen basePath="/(owner)/customers" initialFilter={initialFilter} />;
}
