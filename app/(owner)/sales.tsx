import React, { useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { DatePicker } from '@/components/ui/DatePicker';
import { getSales } from '@/services/sales';
import { getStaff } from '@/services/staff';
import { SalesFilters } from '@/components/sales/SalesFilters';
import { SalesList } from '@/components/sales/SalesList';
import { SaleDetailsModal } from '@/components/sales/SaleDetailsModal';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

export default function OwnerSales() {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [staffId, setStaffId] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const { data: salesData, isLoading, refetch } = useQuery({
    queryKey: ['sales', startDate, endDate, staffId],
    queryFn: () => getSales({
      startDate: startDate?.toISOString(),
      endDate: endDate?.toISOString(),
      staffId: staffId || undefined,
    }),
  });

  const { data: staffData } = useQuery({
    queryKey: ['staffList'],
    queryFn: () => getStaff(),
  });

  const sales = salesData?.data || [];
  const staffList = staffData?.data || [];

  const clearFilters = () => {
    setStartDate(null);
    setEndDate(null);
    setStaffId('');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sales History</Text>

      <SalesFilters
        startDate={startDate}
        endDate={endDate}
        staffId={staffId}
        staffList={staffList}
        onStartDatePress={() => setShowStartPicker(true)}
        onEndDatePress={() => setShowEndPicker(true)}
        onStaffChange={setStaffId}
        onClearFilters={clearFilters}
      />

      <SalesList
        sales={sales}
        isLoading={isLoading}
        onRefresh={refetch}
        onPressSale={(sale) => { setSelectedSale(sale); setModalVisible(true); }}
        showStaff
      />

      {showStartPicker && (
        <DatePicker
          value={startDate || new Date()}
          onChange={(date) => { setShowStartPicker(false); if (date) setStartDate(date); }}
        />
      )}
      {showEndPicker && (
        <DatePicker
          value={endDate || new Date()}
          onChange={(date) => { setShowEndPicker(false); if (date) setEndDate(date); }}
        />
      )}

      <SaleDetailsModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        sale={selectedSale}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  title: {
    fontSize: Typography.size.h2,
    fontFamily: Typography.fontFamilyBold,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    marginBottom: Spacing.md,
    color: Colors.textPrimary,
  },
});
