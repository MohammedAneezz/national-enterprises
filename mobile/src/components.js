import React from 'react';
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, RefreshControl } from 'react-native';
import { AlertCircle, CheckCircle2, Inbox } from 'lucide-react-native';
import { C, F, styles as s } from './theme';

export function Page({ children, refreshing = false, onRefresh, contentStyle }) {
  return <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.page, contentStyle]} refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} /> : undefined}>{children}</ScrollView>
  </KeyboardAvoidingView>;
}
export function Title({ eyebrow, title, subtitle, action }) {
  return <View style={{ gap: 8 }}><View style={s.between}><Text style={s.eyebrow}>{eyebrow}</Text>{action}</View><Text style={s.title}>{title}</Text>{subtitle && <Text style={s.muted}>{subtitle}</Text>}</View>;
}
export function Field({ label, style, ...props }) {
  return <View style={style}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor="#64748B" style={s.input} {...props} /></View>;
}
export function Button({ title, onPress, icon: Icon, busy, secondary, disabled, style }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled || busy} onPress={onPress} style={({ pressed }) => [s.button, secondary && { backgroundColor: C.primary }, style, (pressed || busy || disabled) && { opacity: 0.6 }]}>
    {busy ? <ActivityIndicator size="small" color={C.card} /> : Icon && <Icon size={18} color={C.card} />}
    <Text style={s.buttonText}>{busy ? 'Please wait…' : title}</Text>
  </Pressable>;
}
export function Chip({ title, selected, onPress, style }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [s.chip, selected && s.chipOn, style, pressed && { opacity: 0.7 }]}><Text style={[s.chipText, selected && { color: C.card }]}>{title}</Text></Pressable>;
}
export function Notice({ text, success }) {
  if (!text) return null;
  const Icon = success ? CheckCircle2 : AlertCircle;
  const color = success ? C.success : C.danger;
  return <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: success ? '#F0FDF4' : '#FEF2F2', padding: 13, borderRadius: 8 }}><Icon size={19} color={color} /><Text style={[s.body, { color, flex: 1, fontSize: 14 }]}>{text}</Text></View>;
}
export function Empty({ title, detail }) {
  return <View style={s.empty}><Inbox size={26} color={C.muted} /><Text style={s.heading}>{title}</Text>{detail && <Text style={[s.muted, { textAlign: 'center' }]}>{detail}</Text>}</View>;
}
export function Loading() {
  return <View style={s.empty}><ActivityIndicator color={C.primary} /><Text style={s.muted}>Loading…</Text></View>;
}
export function Badge({ text, danger }) {
  return <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, backgroundColor: danger ? '#FEF2F2' : C.blueTint, alignSelf: 'flex-start' }}><Text style={{ fontFamily: F.bold, fontSize: 11, color: danger ? C.danger : C.secondary }}>{text}</Text></View>;
}
