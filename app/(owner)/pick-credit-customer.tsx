import React from 'react';
import { router } from 'expo-router';
import { CustomerPickerScreen } from '@/components/credit/CustomerPickerScreen';
import { useCartStore } from '@/store/staffCartStore';
import { useAuthStore } from '@/store/authStore';

export default function OwnerPickCreditCustomerScreen() {
  const setCreditCustomer = useCartStore((s) => s.setCreditCustomer);
  const currency = useAuthStore((s) => s.user?.shop?.currency);

  return (
    <CustomerPickerScreen
      currency={currency}
      onSelect={(customer) => {
        setCreditCustomer({ _id: customer._id, name: customer.name });
        router.back();
      }}
    />
  );
}
