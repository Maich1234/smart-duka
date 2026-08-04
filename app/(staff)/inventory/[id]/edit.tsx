import React from 'react';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EditProductScreen } from '@/components/inventory/EditProductScreen';
import { usePermission } from '@/utils/permissions';

/**
 * The same screen the owner uses — see the sibling new.tsx for why the check
 * is here as well as on the list.
 */
export default function StaffEditProduct() {
  const canEdit = usePermission('edit_product');

  if (!canEdit) {
    return (
      // Still a pushed screen, so it needs the same way out as the form it
      // stands in for.
      <Screen edges={['left', 'right']} padded={false} tabBarSpacing>
        <ScreenHeader
          title="Edit Product"
          bordered={false}
          fallbackHref="/(staff)/inventory"
        />
        <EmptyState
          title="Not available"
          subtitle="You don't have permission to edit products. Ask the shop owner."
        />
      </Screen>
    );
  }

  return <EditProductScreen />;
}
