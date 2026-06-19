import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

interface ShopSettingsFormProps {
  shop: {
    name: string;
    address: string;
    phone: string;
    email: string;
    taxRate: number;
    currency: string;
  };
  onChange: (field: keyof ShopSettingsFormProps['shop'], value: string | number) => void;
  onSave: () => void;
  loading?: boolean;
}

export const ShopSettingsForm: React.FC<ShopSettingsFormProps> = ({
  shop,
  onChange,
  onSave,
  loading = false,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Shop Information</Text>
      <Input label="Shop Name" value={shop.name} onChangeText={(t) => onChange('name', t)} />
      <Input label="Address" value={shop.address} onChangeText={(t) => onChange('address', t)} />
      <Input label="Phone" value={shop.phone} onChangeText={(t) => onChange('phone', t)} />
      <Input label="Email" value={shop.email} onChangeText={(t) => onChange('email', t)} />
      <Input label="Tax Rate (%)" value={String(shop.taxRate)} onChangeText={(t) => onChange('taxRate', parseFloat(t) || 0)} keyboardType="numeric" />
      <Input
        label="Currency Code"
        value={shop.currency}
        onChangeText={(t) => onChange('currency', t.toUpperCase())}
        placeholder="KES"
        autoCapitalize="characters"
        maxLength={8}
      />
      <Button title="Update Shop" onPress={onSave} loading={loading} style={styles.button} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.lg },
  title: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilySemiBold, marginBottom: Spacing.md, color: Colors.textPrimary },
  button: { marginTop: Spacing.md },
});