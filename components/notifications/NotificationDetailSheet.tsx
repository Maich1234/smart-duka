import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button } from '../ui/Button';
import { BottomSheet } from '../ui/BottomSheet';
import { iconForType, labelForType } from './notificationMeta';
import type { AppNotification } from '@/services/notificationInbox';
import { formatDateTime } from '@/utils/formatters';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

interface NotificationDetailSheetProps {
  visible: boolean;
  onClose: () => void;
  notification: AppNotification | null;
}

/**
 * Full-text view for one inbox notification. List rows clamp the title to a
 * line and the body to two, so this sheet is the only place a long campaign
 * message or daily summary can actually be read end to end — which is the
 * whole reason tapping a row opens this instead of just marking it read.
 *
 * Body text is selectable so promo codes and amounts can be copied out.
 */
export const NotificationDetailSheet: React.FC<NotificationDetailSheetProps> = ({
  visible,
  onClose,
  notification,
}) => {
  if (!notification) return null;

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeightPercent={80}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Ionicons name={iconForType(notification.type)} size={20} color={Colors.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.typeLabel}>{labelForType(notification.type)}</Text>
            <Text style={styles.time}>{formatDateTime(notification.createdAt)}</Text>
          </View>
        </View>

        <Text style={styles.title} selectable>{notification.title}</Text>
        <Text style={styles.body} selectable>{notification.body}</Text>

        <Button title="Close" variant="outline" onPress={onClose} style={styles.closeBtn} />
      </ScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  typeLabel: {
    color: Colors.primary,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
  },
  time: {
    color: Colors.textTertiary,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    marginTop: 2,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.size.h3,
    lineHeight: Typography.lineHeight.h3,
    fontFamily: Typography.fontFamilyBold,
    marginBottom: Spacing.sm,
  },
  body: {
    color: Colors.textSecondary,
    fontSize: Typography.size.body,
    lineHeight: Typography.lineHeight.body,
    fontFamily: Typography.fontFamily,
  },
  closeBtn: { marginTop: Spacing.lg },
});
