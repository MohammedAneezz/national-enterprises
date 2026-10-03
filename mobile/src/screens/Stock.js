import React, { useCallback, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Package, Plus, X } from 'lucide-react-native';
import { useSession } from '../context';
import { useLoad } from '../useLoad';
import { errorText } from '../api';
import { C, money, styles as s } from '../theme';
import { Page, Title, Field, Button, Notice, Empty, Loading, Badge } from '../components';

export function Stock() {
  const { api } = useSession();
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [emi, setEmi] = useState('');
  const [cost, setCost] = useState('');
  const [sku, setSku] = useState('');
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useLoad(useCallback(async () => (await api.get('/products')).data, [api]));
  const matching = selected || load.data?.find(p => p.name.toLowerCase() === name.trim().toLowerCase());
  const save = async () => {
    if (busy) return;
    setError(''); setSuccess('');
    if (!name.trim()) return setError('Enter a product name.');
    if (!/^[1-9]\d*$/.test(qty)) return setError('Quantity must be a positive whole number.');
    if (!matching && [emi, cost].some(v => v && !/^\d+(\.\d{1,2})?$/.test(v))) return setError('Enter valid prices with up to two decimal places.');
    setBusy(true);
    try {
      if (matching) await api.post('/products/' + matching.id + '/stock-in', { qty: Number(qty) });
      else await api.post('/products', { name: name.trim(), sku: sku.trim(), stock_in: Number(qty), cost_price: cost || 0, emi_price: emi || 0 });
      setSuccess(qty + ' units added to ' + name.trim() + '.');
      setName(''); setQty(''); setEmi(''); setCost(''); setSku(''); setSelected(null);
      await load.reload();
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  return <Page refreshing={load.loading} onRefresh={load.reload}>
    <Title eyebrow="SHARED PRODUCT CATALOG" title="Stock" subtitle="Track what came in, what sold, and what's left." />
    <View style={[s.card, { backgroundColor: C.primary, borderColor: C.primary }]}><View style={s.row}><Package color="white" size={22} /><Text style={[s.heading, { color: 'white' }]}>Available inventory</Text></View><Text style={[s.metric, { color: 'white' }]}>{load.data ? load.data.reduce((sum, p) => sum + p.available, 0) : '—'} <Text style={{ fontSize: 15 }}>units</Text></Text><Text style={[s.muted, { color: '#CBD5E1' }]}>Shared across A-Line, B-Line, and C-Line</Text></View>
    <View style={s.card}><View style={s.between}><Text style={s.heading}>{matching ? 'Restock product' : 'Add new stock'}</Text>{selected && <Pressable style={s.iconButton} accessibilityLabel="Clear selected product" accessibilityRole="button" onPress={() => { setSelected(null); setName(''); }}><X size={20} color={C.primary} /></Pressable>}</View>
      <Field label="Product name" value={name} onChangeText={v => { setName(v); setSelected(null); }} placeholder="e.g. Mixer grinder" />
      <Field label="Qty came" value={qty} onChangeText={setQty} keyboardType="number-pad" placeholder="Number of units" />
      {!matching && <><View style={s.row}><Field style={{ flex: 1 }} label="Cost price (₹)" value={cost} onChangeText={setCost} keyboardType="decimal-pad" placeholder="0" /><Field style={{ flex: 1 }} label="EMI price (₹)" value={emi} onChangeText={setEmi} keyboardType="decimal-pad" placeholder="0" /></View><Field label="SKU (optional)" value={sku} onChangeText={setSku} placeholder="Product code" /></>}
      {matching && <Text style={s.muted}>Adding to {matching.name} · {matching.available} currently available</Text>}
      <Notice text={error} /><Button title="+ Stock In" icon={Plus} busy={busy} onPress={save} disabled={!load.data} />
    </View>
    <Notice text={success} success /><Notice text={load.error} />
    <Text style={s.heading}>Product inventory</Text>
    {load.loading && !load.data && <Loading />}{load.error && <Button title="Retry" secondary onPress={load.reload} />}
    {load.data?.length === 0 && <Empty title="Your inventory starts here" detail="Add a product and the quantity received." />}
    {load.data?.map(product => <Pressable key={product.id} accessibilityRole="button" accessibilityLabel={'Restock ' + product.name} style={s.card} onPress={() => { setSelected(product); setName(product.name); setSuccess(''); }}>
      <View style={s.between}><View style={{ flex: 1, gap: 4 }}><Text style={s.heading}>{product.name}</Text><Text style={s.muted}>{product.sku || 'Product #' + product.id} · EMI {money(product.emi_price)}</Text></View><Badge text={product.available ? 'IN STOCK' : 'OUT OF STOCK'} danger={!product.available} /></View>
      <View style={s.divider} /><View style={s.between}>{[['Came', product.came], ['Sold', product.sold], ['Left', product.available]].map(([label, value]) => <View key={label} style={{ gap: 3 }}><Text style={s.muted}>{label}</Text><Text style={[s.heading, { fontSize: 22 }]}>{value}</Text></View>)}</View><Text style={s.muted}>Tap to add stock</Text>
    </Pressable>)}
  </Page>;
}
