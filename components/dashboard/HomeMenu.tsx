import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';

export interface HomeMenuGroup {
  title: string;
  items: { title: string; route: string; icon: string }[];
}

/** Secondary directory. Daily work stays visible on Home and the bottom tabs. */
export function HomeMenu({ visible, onClose, shopName, groups }: {
  visible: boolean;
  onClose: () => void;
  shopName: string;
  groups: HomeMenuGroup[];
}) {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close menu" />
        <View accessibilityViewIsModal style={[styles.drawer, { width: Math.min(width - 24, fontScale > 1.3 ? 440 : 360), paddingTop: insets.top + 12, paddingBottom: insets.bottom }]}>
          <View style={styles.heading}>
            <View style={styles.identity}>
              <Text accessibilityRole="header" style={styles.title}>Menu</Text>
              <Text style={styles.shop}>{shopName}</Text>
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close menu" style={styles.close}>
              <Ionicons name="close-outline" size={26} color={Colors.textPrimary} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            {groups.filter(group => group.items.length > 0).map(group => (
              <View key={group.title} style={styles.group}>
                <Text accessibilityRole="header" style={styles.groupTitle}>{group.title}</Text>
                {group.items.map(item => (
                  <Pressable key={item.route} accessibilityRole="button" accessibilityLabel={item.title}
                    style={({ pressed }) => [styles.item, pressed && styles.pressed]}
                    onPress={() => { onClose(); router.push(item.route as never); }}>
                    <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={22} color={Colors.primary} />
                    <Text style={styles.label}>{item.title}</Text>
                    <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                  </Pressable>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  drawer: { flex: 1, backgroundColor: Colors.surface },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  identity: { flex: 1 },
  title: { fontFamily: Typography.fontFamilyBold, fontSize: 24, color: Colors.textPrimary },
  shop: { fontFamily: Typography.fontFamily, fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  close: { minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 12, paddingBottom: 24 },
  group: { marginBottom: 18 },
  groupTitle: { fontFamily: Typography.fontFamilySemiBold, fontSize: 13, color: Colors.textSecondary, padding: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, padding: 12, borderRadius: 12 },
  pressed: { backgroundColor: Colors.primarySubtle },
  label: { flex: 1, fontFamily: Typography.fontFamilySemiBold, fontSize: 16, color: Colors.textPrimary },
});
