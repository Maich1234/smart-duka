import React from 'react';
import { Modal, ScrollView, View, Text, StyleSheet } from 'react-native';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

interface StaffFormData {
  name: string;
  email: string;
  password: string;
  phone: string;
}

interface StaffFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  form: StaffFormData;
  setForm: (form: StaffFormData) => void;
  isEditing: boolean;
  loading?: boolean;
}

export const StaffFormModal: React.FC<StaffFormModalProps> = ({
  visible,
  onClose,
  onSave,
  form,
  setForm,
  isEditing,
  loading = false,
}) => {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <ScrollView style={styles.modalContent}>
          <Text style={styles.title}>{isEditing ? 'Edit Staff' : 'Add Staff'}</Text>
          <Input label="Full Name" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} />
          <Input label="Email" value={form.email} onChangeText={(t) => setForm({ ...form, email: t })} autoCapitalize="none" />
          {!isEditing && (
            <Input label="Password" value={form.password} onChangeText={(t) => setForm({ ...form, password: t })} secureTextEntry />
          )}
          <Input label="Phone (optional)" value={form.phone} onChangeText={(t) => setForm({ ...form, phone: t })} />
          <View style={styles.buttonRow}>
            <Button title="Cancel" variant="outline" onPress={onClose} />
            <Button title="Save" onPress={onSave} loading={loading} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.md },
  modalContent: { backgroundColor: Colors.surface, borderRadius: 24, padding: Spacing.lg, maxHeight: '80%' },
  title: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, marginBottom: Spacing.md, color: Colors.textPrimary },
  buttonRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
});