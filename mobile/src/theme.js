import { StyleSheet } from 'react-native';

export const C = { primary: '#0F172A', secondary: '#1E3A8A', cta: '#A16207', bg: '#F8FAFC', card: '#FFFFFF', text: '#020617', muted: '#475569', border: '#E2E8F0', danger: '#DC2626', success: '#166534', goldTint: '#FFFBEB', blueTint: '#EFF6FF' };
export const F = { head: 'Lexend_600SemiBold', body: 'SourceSans3_400Regular', bold: 'SourceSans3_600SemiBold' };
export const money = value => '₹' + Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const today = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-'); };
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  page: { padding: 20, gap: 20, width: '100%', maxWidth: 680, alignSelf: 'center', paddingBottom: 32 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { fontFamily: F.head, fontSize: 27, letterSpacing: -0.7, color: C.primary },
  heading: { fontFamily: F.head, fontSize: 17, color: C.primary },
  body: { fontFamily: F.body, fontSize: 16, lineHeight: 23, color: C.text },
  muted: { fontFamily: F.body, fontSize: 14, lineHeight: 20, color: C.muted },
  label: { fontFamily: F.bold, fontSize: 14, color: C.primary, marginBottom: 7 },
  eyebrow: { fontFamily: F.bold, fontSize: 11, letterSpacing: 1.8, color: C.muted, textTransform: 'uppercase' },
  card: { backgroundColor: C.card, padding: 18, borderWidth: 1, borderColor: C.border, borderRadius: 14, gap: 12 },
  input: { minHeight: 48, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 13, paddingVertical: 11, color: C.text, fontFamily: F.body, fontSize: 16 },
  button: { minHeight: 48, borderRadius: 8, backgroundColor: C.cta, paddingVertical: 13, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  buttonText: { fontFamily: F.bold, fontSize: 16, color: C.card },
  chip: { minHeight: 42, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { fontFamily: F.bold, fontSize: 14, color: C.primary },
  divider: { height: 1, backgroundColor: C.border },
  empty: { paddingVertical: 30, alignItems: 'center', gap: 10 },
  metric: { fontFamily: F.head, fontSize: 29, letterSpacing: -0.8, color: C.primary },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
});
