import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Typography } from '@/constants/Typography';

const PRODUCTS = [
  { name: 'Fresh milk', detail: '2 × KSh 60', value: 'KSh 120', icon: 'water-outline' },
  { name: 'White bread', detail: '1 × KSh 65', value: 'KSh 65', icon: 'basket-outline' },
  { name: 'Sugar · 1 kg', detail: '1 × KSh 170', value: 'KSh 170', icon: 'cube-outline' },
] as const;

export function IntroPreview({ page }: { page: number }) {
  return (
    <View style={styles.card} accessible accessibilityLabel={page === 0
      ? 'Sample sale: milk, bread and sugar. Total KSh 355.'
      : page === 1 ? 'Sample inventory: fresh milk, 12 remaining; sugar, 4 remaining, running low.'
      : 'Sample daily summary: sales KSh 8,450, expenses KSh 1,200, estimated profit KSh 2,140.'}>
      <View style={styles.header}>
        <View style={styles.shop}>
          <Ionicons name="storefront-outline" size={18} color="#0F766E" />
          <Text style={styles.shopName}>Duka la Amani</Text>
        </View>
        <Text style={styles.sample}>SAMPLE</Text>
      </View>
      {page === 0 ? <>
        <Text style={styles.label}>NEW SALE</Text>
        {PRODUCTS.map(product => <View key={product.name} style={styles.row}>
          <View style={styles.productIcon}><Ionicons name={product.icon} size={18} color="#0F766E" /></View>
          <View style={styles.rowBody}><Text style={styles.name}>{product.name}</Text><Text style={styles.detail}>{product.detail}</Text></View>
          <Text style={styles.value}>{product.value}</Text>
        </View>)}
        <View style={styles.total}><Text style={styles.detail}>4 items</Text><Text style={styles.amount}>KSh 355</Text></View>
        <View style={styles.confirm}><Ionicons name="receipt-outline" size={16} color="#FFFFFF" /><Text style={styles.confirmText}>Complete sale · Share receipt</Text></View>
      </> : page === 1 ? <>
        <Text style={styles.label}>STOCK AT A GLANCE</Text>
        {[{ name: 'Fresh milk', count: '12 remaining', percent: '70%' as const }, { name: 'Sugar · 1 kg', count: '4 remaining', percent: '24%' as const }].map((item, index) => <View key={item.name} style={styles.stockItem}>
          <View style={styles.stockRow}><Text style={styles.name}>{item.name}</Text><Text style={styles.detail}>{item.count}</Text></View>
          <View style={styles.track}><View style={[styles.fill, { width: item.percent, backgroundColor: index ? '#B7791F' : '#0F766E' }]} /></View>
          <Text style={styles.detail}>{index ? 'Running low · Plan your next purchase' : 'Stock available'}</Text>
        </View>)}
        <View style={styles.offline}><Ionicons name="cloud-upload-outline" size={18} color="#0F766E" /><Text style={styles.offlineText}>Offline sales stay queued for sync</Text></View>
      </> : <>
        <Text style={styles.label}>YOUR DAY, AT A GLANCE</Text>
        <Text style={styles.detail}>Total sales</Text><Text style={styles.summary}>KSh 8,450</Text>
        <View style={styles.bars} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {[28, 45, 36, 62, 52, 82, 100].map((height, index) => <View key={index} style={[styles.bar, { height, backgroundColor: index === 6 ? '#C8932A' : '#B4D8CC' }]} />)}
        </View>
        <View style={styles.metrics}><View><Text style={styles.detail}>Expenses</Text><Text style={styles.value}>KSh 1,200</Text></View><View><Text style={styles.detail}>Est. profit</Text><Text style={styles.value}>KSh 2,140</Text></View></View>
      </>}
    </View>
  );
}
const styles = StyleSheet.create({
  card: { backgroundColor: '#F8FAF7', borderRadius: 24, padding: 20, minHeight: 320, width: '100%', maxWidth: 400, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', borderBottomWidth: 1, borderBottomColor: '#DEE7E0', paddingBottom: 14 },
  shop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shopName: { fontFamily: Typography.fontFamilySemiBold, fontSize: 13, color: '#183E32' },
  sample: { fontFamily: Typography.fontFamilySemiBold, fontSize: 9, letterSpacing: 1, color: '#596B62' },
  label: { fontFamily: Typography.fontFamilySemiBold, fontSize: 10, letterSpacing: 1.2, color: '#596B62', marginVertical: 16 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 14 },
  productIcon: { backgroundColor: '#E7EFE9', borderRadius: 10, padding: 9 },
  rowBody: { flex: 1 },
  name: { fontFamily: Typography.fontFamilySemiBold, fontSize: 13, color: '#183E32', flexShrink: 1 },
  detail: { fontFamily: Typography.fontFamily, fontSize: 11, color: '#596B62', lineHeight: 18 },
  value: { fontFamily: Typography.fontFamilySemiBold, fontSize: 13, color: '#183E32', marginTop: 3 },
  total: { borderTopWidth: 1, borderTopColor: '#DEE7E0', paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amount: { fontFamily: Typography.fontFamilyBold, fontSize: 25, color: '#183E32' },
  confirm: { backgroundColor: '#0F766E', borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12 },
  confirmText: { color: '#FFFFFF', fontFamily: Typography.fontFamilySemiBold, fontSize: 11, flexShrink: 1 },
  stockItem: { marginBottom: 22 },
  stockRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' },
  track: { height: 7, borderRadius: 4, backgroundColor: '#E4EAE5', marginVertical: 10, overflow: 'hidden' },
  fill: { height: 7, borderRadius: 4 },
  offline: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  offlineText: { fontFamily: Typography.fontFamily, fontSize: 12, color: '#285C49', flex: 1 },
  summary: { fontFamily: Typography.fontFamilyBold, fontSize: 32, color: '#183E32', marginTop: 4 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 9, height: 105, marginVertical: 16 },
  bar: { flex: 1, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  metrics: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#DEE7E0', paddingTop: 12 },
});
