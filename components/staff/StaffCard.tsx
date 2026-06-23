import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { ListRow } from '../ui/ListRow';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';

interface StaffCardProps {
  staff: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    isActive: boolean;
  };
  onPress: () => void;
  isLast?: boolean;
}

export const StaffCard: React.FC<StaffCardProps> = ({ staff, onPress, isLast = false }) => {
  return (
    <ListRow
      title={staff.name}
      subtitle={staff.phone ? `${staff.email} · ${staff.phone}` : staff.email}
      chevron
      isLast={isLast}
      onPress={onPress}
      trailing={
        <Text style={[styles.status, { color: staff.isActive ? Colors.success : Colors.danger }]}>
          {staff.isActive ? 'Active' : 'Inactive'}
        </Text>
      }
    />
  );
};

const styles = StyleSheet.create({
  status: { fontSize: Typography.size.caption, fontFamily: Typography.fontFamilySemiBold, marginRight: 4 },
});
