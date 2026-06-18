import React from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../ui/Button';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

interface Permission {
  value: string;
  label: string;
  category: string;
}

interface PermissionsModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  permissions: Permission[];
  selectedPermissions: string[];
  onTogglePermission: (permissionValue: string) => void;
  staffName: string;
  loading?: boolean;
}

export const PermissionsModal: React.FC<PermissionsModalProps> = ({
  visible,
  onClose,
  onSave,
  permissions,
  selectedPermissions,
  onTogglePermission,
  staffName,
  loading = false,
}) => {
  // Group permissions by category
  const grouped = permissions.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>Permissions</Text>
          <Text style={styles.staffName}>{staffName}</Text>
          <ScrollView style={styles.scrollView}>
            {Object.entries(grouped).map(([category, perms]) => (
              <View key={category} style={styles.category}>
                <Text style={styles.categoryTitle}>{category}</Text>
                {perms.map((perm) => (
                  <TouchableOpacity
                    key={perm.value}
                    style={styles.permissionItem}
                    onPress={() => onTogglePermission(perm.value)}
                  >
                    <Ionicons
                      name={selectedPermissions.includes(perm.value) ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={Colors.primary}
                    />
                    <Text style={styles.permissionLabel}>{perm.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </ScrollView>
          <View style={styles.buttonRow}>
            <Button title="Cancel" variant="outline" onPress={onClose} />
            <Button title="Save" onPress={onSave} loading={loading} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.md },
  modalContent: { backgroundColor: Colors.surface, borderRadius: 24, padding: Spacing.lg, maxHeight: '90%' },
  title: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, marginBottom: Spacing.xs, textAlign: 'center', color: Colors.textPrimary },
  staffName: { fontSize: Typography.size.body, textAlign: 'center', marginBottom: Spacing.md, color: Colors.textSecondary },
  scrollView: { maxHeight: '70%' },
  category: { marginBottom: Spacing.md },
  categoryTitle: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.primary, marginBottom: Spacing.xs },
  permissionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xs, gap: Spacing.sm },
  permissionLabel: { fontSize: Typography.size.body, color: Colors.textPrimary },
  buttonRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
});