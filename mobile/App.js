import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import axios from 'axios';

// Set with: EXPO_PUBLIC_API_URL=https://xxxx.ngrok-free.app/api/v1  npx expo start --tunnel
// Falls back to your home WiFi IP. No code change needed to share.
const API = process.env.EXPO_PUBLIC_API_URL || 'http://172.20.10.3:8000/api/v1';
const C = { primary: '#0F172A', secondary: '#1E3A8A', cta: '#A16207', bg: '#F8FAFC', card: '#FFFFFF', text: '#020617', muted: '#475569', border: '#E2E8F0', danger: '#DC2626', green: '#16A34A' };
let AUTH = '', LINE = null;

function Lines({ nav }) {
  const [lines, setLines] = useState([]);
  useEffect(() => { axios.get(`${API}/lines`, { headers: { Authorization: AUTH } }).then(r => setLines(r.data)).catch(() => {}); }, []);
  return (
    <View style={s.page}>
      <Text style={s.h1}>NATIONAL ENTERPRISES</Text>
      <Text style={s.sub}>Select Line</Text>
      {lines.map(l => (
        <TouchableOpacity key={l.id} style={s.card} onPress={() => { LINE = l; nav.navigate('Tabs'); }}>
          <Text style={s.cardT}>{l.name}</Text>
          <Text style={s.mut}>Tap to open dashboard, customers, collect, stock, reports</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Login({ nav }) {
  const [u, setU] = useState('admin'); const [p, setP] = useState('admin123');
  const go = async () => {
    try {
      const r = await axios.post(`${API}/auth/login`, { username: u, password: p });
      AUTH = `Bearer ${r.data.access_token}`; nav.navigate('Lines');
    } catch { Alert.alert('Login failed'); }
  };
  return (
    <View style={s.page}>
      <Text style={s.h1}>NATIONAL ENTERPRISES</Text>
      <TextInput style={s.in} value={u} onChangeText={setU} placeholder="Username" />
      <TextInput style={s.in} value={p} onChangeText={setP} placeholder="Password" secureTextEntry />
      <TouchableOpacity style={s.btn} onPress={go}><Text style={s.btnT}>Login as Admin</Text></TouchableOpacity>
    </View>
  );
}

function Customers() {
  const [list, setList] = useState([]); const [area, setArea] = useState(''); const [areas, setAreas] = useState([]);
  const [name, setName] = useState(''); const [phone, setPhone] = useState('');
  const load = async () => {
    const r = await axios.get(`${API}/customers`, { headers: { Authorization: AUTH }, params: { line_id: LINE.id, area: area || undefined } });
    setList(r.data);
    const a = await axios.get(`${API}/areas`, { headers: { Authorization: AUTH }, params: { line_id: LINE.id } });
    setAreas(a.data);
  };
  useEffect(() => { load(); }, [area]);
  const add = async () => {
    if (!name.trim()) return Alert.alert('Enter name');
    await axios.post(`${API}/customers`, { line_id: LINE.id, name, phone, area, notes: '' }, { headers: { Authorization: AUTH } });
    setName(''); setPhone(''); load();
  };
  return (
    <View style={s.page}>
      <Text style={s.h1}>{LINE?.name} • Customers</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <TouchableOpacity style={s.chip} onPress={() => setArea('')}><Text>All</Text></TouchableOpacity>
        {areas.map(a => <TouchableOpacity key={a} style={[s.chip, area === a && s.chipOn]} onPress={() => setArea(a)}><Text>{a}</Text></TouchableOpacity>)}
      </View>
      <TextInput style={s.in} value={area} onChangeText={setArea} placeholder="Area (e.g. Kovilpatti)" />
      <TextInput style={s.in} value={name} onChangeText={setName} placeholder="Customer name" />
      <TextInput style={s.in} value={phone} onChangeText={setPhone} placeholder="Phone" keyboardType="phone-pad" />
      <TouchableOpacity style={s.btn} onPress={add}><Text style={s.btnT}>+ Add Customer</Text></TouchableOpacity>
      <FlatList data={list} keyExtractor={i => String(i.id)} renderItem={({ item }) => (
        <View style={s.card}><Text style={s.cardT}>{item.name}</Text><Text style={s.mut}>{item.area} • {item.phone} • Bal ₹{item.outstanding}</Text></View>
      )} />
    </View>
  );
}

// Collect: +100/+200/+500 chips ADD to total, total editable manually. Cash|UPI only.
function Collect() {
  const [saleId, setSaleId] = useState(''); const [amt, setAmt] = useState(''); const [mode, setMode] = useState('CASH'); const [ref, setRef] = useState('');
  const add = v => setAmt(String((parseInt(amt || '0', 10) || 0) + v));
  const save = async () => {
    const amount = parseFloat(amt);
    if (!saleId || !(amount > 0)) return Alert.alert('Enter sale ID + amount');
    if (mode === 'UPI' && !ref.trim()) return Alert.alert('UPI ref required');
    try {
      await axios.post(`${API}/payments`, { line_id: LINE.id, sale_id: parseInt(saleId, 10), amount, mode, upi_ref: ref }, { headers: { Authorization: AUTH } });
      Alert.alert(`Collected ₹${amount} (${mode})`); setAmt(''); setRef('');
    } catch (e) { Alert.alert(e?.response?.data?.detail || 'Failed'); }
  };
  return (
    <View style={s.page}>
      <Text style={s.h1}>{LINE?.name} • Collect</Text>
      <TextInput style={s.in} value={saleId} onChangeText={setSaleId} placeholder="Sale ID" keyboardType="numeric" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[100, 200, 500].map(v => <TouchableOpacity key={v} style={s.chip} onPress={() => add(v)}><Text style={s.chipT}>+{v}</Text></TouchableOpacity>)}
        <TouchableOpacity style={s.chip} onPress={() => setAmt('')}><Text>Clear</Text></TouchableOpacity>
      </View>
      <TextInput style={s.big} value={amt} onChangeText={setAmt} placeholder="Total amount (editable)" keyboardType="numeric" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {['CASH', 'UPI'].map(m => <TouchableOpacity key={m} style={[s.chip, mode === m && s.chipOn]} onPress={() => setMode(m)}><Text style={s.chipT}>{m}</Text></TouchableOpacity>)}
      </View>
      {mode === 'UPI' && <TextInput style={s.in} value={ref} onChangeText={setRef} placeholder="UPI Ref ID" />}
      <TouchableOpacity style={s.btn} onPress={save}><Text style={s.btnT}>Save Collection</Text></TouchableOpacity>
    </View>
  );
}

function Stock() {
  const [list, setList] = useState([]); const [nm, setNm] = useState(''); const [qty, setQty] = useState('');
  const load = () => axios.get(`${API}/products`, { headers: { Authorization: AUTH } }).then(r => setList(r.data)).catch(() => {});
  useEffect(load, []);
  const add = async () => {
    await axios.post(`${API}/products`, { name: nm, emi_price: 0, stock_in: parseInt(qty || '0', 10) || 0 }, { headers: { Authorization: AUTH } });
    setNm(''); setQty(''); load();
  };
  return (
    <View style={s.page}><Text style={s.h1}>{LINE?.name} • Stock (came vs sold)</Text>
      <TextInput style={s.in} value={nm} onChangeText={setNm} placeholder="Product name" />
      <TextInput style={s.in} value={qty} onChangeText={setQty} placeholder="Qty came" keyboardType="numeric" />
      <TouchableOpacity style={s.btn} onPress={add}><Text style={s.btnT}>+ Stock In</Text></TouchableOpacity>
      <FlatList data={list} keyExtractor={i => String(i.id)} renderItem={({ item }) => (
        <View style={s.card}><Text style={s.cardT}>{item.name}</Text><Text style={s.mut}>Came {item.came} • Sold {item.sold} • Left {item.available}</Text></View>
      )} />
    </View>
  );
}

function Reports() {
  const [r, setR] = useState(null);
  useEffect(() => { axios.get(`${API}/reports/daily`, { headers: { Authorization: AUTH }, params: { line_id: LINE.id } }).then(x => setR(x.data)).catch(() => {}); }, []);
  if (!r) return <View style={s.page}><Text>Loading daily report…</Text></View>;
  return (
    <View style={s.page}><Text style={s.h1}>{LINE?.name} • Daily Report {r.day}</Text>
      <View style={s.card}><Text style={s.cardT}>Sales ₹{r.sales_amount} ({r.sales_count})</Text></View>
      <View style={s.card}><Text style={s.cardT}>Collected ₹{r.collected_amount} (Cash ₹{r.cash} + UPI ₹{r.upi})</Text></View>
      <View style={s.card}><Text style={[s.cardT, { color: C.danger }]}>Left-outs: {r.left_out_count} • Overdue: {r.overdue_count}</Text></View>
      <FlatList data={r.left_outs} keyExtractor={i => String(i.due_id)} renderItem={({ item }) => (
        <View style={s.card}><Text>Sale {item.sale_id} • Due ₹{item.due_amt} • Paid ₹{item.paid_amt} • {item.status}</Text></View>
      )} />
    </View>
  );
}

const Tab = createBottomTabNavigator();
function Tabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Customers" component={Customers} />
      <Tab.Screen name="Collect" component={Collect} />
      <Tab.Screen name="Stock" component={Stock} />
      <Tab.Screen name="Reports" component={Reports} />
    </Tab.Navigator>
  );
}

import { createNativeStackNavigator } from '@react-navigation/native-stack';
const Stack = createNativeStackNavigator();
export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login">{p => <Login nav={p.navigation} />}</Stack.Screen>
        <Stack.Screen name="Lines">{p => <Lines nav={p.navigation} />}</Stack.Screen>
        <Stack.Screen name="Tabs" component={Tabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg, padding: 16, gap: 10 },
  h1: { fontSize: 20, fontWeight: '700', color: C.primary },
  sub: { color: C.muted },
  in: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12 },
  big: { backgroundColor: '#fff', borderWidth: 2, borderColor: C.primary, borderRadius: 10, padding: 14, fontSize: 22, fontWeight: '700' },
  btn: { backgroundColor: C.cta, borderRadius: 10, padding: 14, alignItems: 'center' },
  btnT: { color: '#fff', fontWeight: '700' },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12 },
  cardT: { fontWeight: '700', color: C.text },
  mut: { color: C.muted },
  chip: { borderWidth: 1, borderColor: C.border, backgroundColor: '#fff', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  chipOn: { borderColor: C.primary, backgroundColor: '#E8ECF1' },
  chipT: { fontWeight: '700' },
});
