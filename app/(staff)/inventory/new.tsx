import React from 'react';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { NewProductScreen } from '@/components/inventory/NewProductScreen';
import { usePermission } from '@/utils/permissions';

/**
 * The same screen the owner uses. The list only offers the button to staff
 * holding `create_product`, so this check is for a stale deep link — and the
 * server rejects the write regardless (productController).
 */
export default function StaffNewProduct() {
  const canCreate = usePermission('create_product');

  if (!canCreate) {
    return (
      // Still a pushed screen, so it needs the same way out as the form it
      // stands in for.
      <Screen edges={['left', 'right']} padded={false} tabBarSpacing>
        <ScreenHeader
          title="Add Product"
          bordered={false}
          fallbackHref="/(staff)/inventory"
        />
        <EmptyState
          title="Not available"
          subtitle="You don't have permission to add products. Ask the shop owner."
        />
      </Screen>
    );
  }

  return <NewProductScreen />;
}
