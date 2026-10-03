import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Banknote, ScanLine, ArrowRight } from 'lucide-react-native';
import { useSession } from '../context';
import { errorText } from '../api';
import { C, F, money, styles as s } from '../theme';
import { Page, Title, Field, Button, Chip, Notice } from '../components';

export function Collect({ route }) {
  const { api, line } = useSession();
  const [saleId, setSaleId] = useState('');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('CASH');
  const [upiRef, setUpiRef] = useState('');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);
  useEffect(() => { if (route.params?.saleId) { setSaleId(String(route.params.saleId)); setAmount(''); setUpiRef(''); setReceipt(null); } }, [route.params?.saleId]);
  const add = value => {
    setAmount(previous => String(Math.round(((Number(previous) || 0) + value) * 100) / 100));
    setReceipt(null);
  };
  const save = async () => {
    if (saving.current) return;
    setError(''); setReceipt(null);
    if (!/^[1-9]\d*$/.test(saleId.trim())) return setError('Enter a valid Sale ID.');
    if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) return setError('Enter an amount greater than zero, with up to two decimal places.');
    if (mode === 'UPI' && !upiRef.trim()) return setError('UPI reference is required before saving.');
    saving.current = true; setBusy(true);
    try {
      const { data } = await api.post('/payments', { line_id: line.id, sale_id: Number(saleId), amount, mode, upi_ref: mode === 'UPI' ? upiRef.trim() : '' });
      setReceipt({ ...data, saleId, amount, mode }); setAmount(''); setUpiRef('');
    } catch (e) { setError(errorText(e)); } finally { saving.current = false; setBusy(false); }
  };
  return <Page>
    <Title eyebrow={line.name + ' / COLLECTIONS'} title="Record a collection" subtitle="Enter the amount received from your customer." />
    {receipt && <View style={[s.card, { borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' }]}><Notice success text={'Collected ' + money(receipt.amount) + ' by ' + receipt.mode} /><Text style={s.body}>Receipt #{receipt.payment_id} · Sale #{receipt.saleId}</Text><Text style={s.muted}>Customer balance: {money(receipt.outstanding)}</Text></View>}
    <Field label="Sale ID" value={saleId} onChangeText={v => { setSaleId(v); setReceipt(null); }} keyboardType="number-pad" placeholder="e.g. 101" editable={!busy} />
    <View style={s.card}>
      <Text style={s.eyebrow}>AMOUNT RECEIVED</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={{ fontFamily: F.head, fontSize: 32, color: C.muted }}>₹</Text><TextInput accessibilityLabel="Collection amount" value={amount} onChangeText={v => { setAmount(v); setReceipt(null); }} placeholder="0" placeholderTextColor="#94A3B8" keyboardType="decimal-pad" editable={!busy} style={{ flex: 1, minWidth: 0, minHeight: 76, fontSize: 46, fontFamily: F.head, color: C.primary, paddingVertical: 8 }} /></View>
      <View style={s.divider} />
      <View style={{ flexDirection: 'row', gap: 6 }}>{[100, 200, 500].map(value => <Chip key={value} title={'+' + value} onPress={() => !busy && add(value)} style={{ flex: 1, paddingHorizontal: 5 }} />)}<Chip title="Clear" onPress={() => !busy && setAmount('')} style={{ flex: 1, paddingHorizontal: 5 }} /></View>
      <Text style={s.muted}>Tap to add. You can also type the exact amount.</Text>
    </View>
    <View style={{ gap: 10 }}><Text style={s.label}>Payment method</Text><View style={s.row}>
      {[['CASH', 'Cash', Banknote], ['UPI', 'UPI', ScanLine]].map(([value, label, Icon]) => <Pressable key={value} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: mode === value }} disabled={busy} onPress={() => { setMode(value); setError(''); }} style={[s.card, { flex: 1, alignItems: 'center', padding: 15, backgroundColor: mode === value ? C.primary : C.card, borderColor: mode === value ? C.primary : C.border }]}><Icon size={23} color={mode === value ? 'white' : C.muted} /><Text style={[s.heading, { fontSize: 15, color: mode === value ? 'white' : C.primary }]}>{label}</Text></Pressable>)}
    </View></View>
    {mode === 'UPI' && <Field label="UPI reference" value={upiRef} onChangeText={setUpiRef} placeholder="Transaction reference ID" autoCapitalize="none" editable={!busy} />}
    <Notice text={error} />
    <Button title="Save Collection" icon={ArrowRight} onPress={save} busy={busy} />
  </Page>;
}
