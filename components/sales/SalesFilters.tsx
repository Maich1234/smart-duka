import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Button } from '../ui/Button';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { formatDate } from '@/utils/formatters';

interface SalesFiltersProps {
  startDate: Date | null;
  endDate: Date | null;
  staffId: string;
  staffList: { _id: string; name: string }[];
  onStartDatePress: () => void;
  onEndDatePress: () => void;
  onStaffChange: (staffId: string) => void;
  onClearFilters: () => void;
}

export const SalesFilters: React.FC<SalesFiltersProps> = ({
  startDate,
  endDate,
  staffId,
  staffList,
  onStartDatePress,
  onEndDatePress,
  onStaffChange,
  onClearFilters,
}) => {
  const hasFilters = startDate || endDate || staffId;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TouchableOpacity style={styles.dateButton} onPress={onStartDatePress}>
          <Text style={styles.dateText}>{startDate ? formatDate(startDate.toISOString()) : 'Start Date'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dateButton} onPress={onEndDatePress}>
          <Text style={styles.dateText}>{endDate ? formatDate(endDate.toISOString()) : 'End Date'}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.row}>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={staffId}
            onValueChange={onStaffChange}
            style={styles.picker}
            dropdownIconColor={Colors.textSecondary}
          >
            <Picker.Item label="All Staff" value="" />
            {staffList.map((staff) => (
              <Picker.Item key={staff._id} label={staff.name} value={staff._id} />
            ))}
          </Picker>
        </View>
        {hasFilters && (
          <Button title="Clear" variant="ghost" onPress={onClearFilters} size="sm" />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: Spacing.md, marginBottom: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  dateButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  dateText: { fontSize: Typography.size.small, color: Colors.textPrimary },
  pickerContainer: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, overflow: 'hidden' },
  picker: { width: '100%', backgroundColor: Colors.surface },
});