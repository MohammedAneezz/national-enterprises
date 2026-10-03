import React, { useCallback, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { ArrowRight, Building2, LockKeyhole, DatabaseBackup } from 'lucide-react-native';
import { C, F, styles as s } from '../theme';
import { Page, Title, Field, Button, Notice } from '../components';
import { useSession } from '../context';
import { useLoad } from '../useLoad';
import { backupStatus } from '../local/backup';

const pinKey = 'national-enterprises-local-pin-v1';

export function Login({ hasPin, onPinCreated }) {
  const { signIn } = useSession();
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const unlock = async () => {
    if (busy) return;
    setError('');
    if (!/^\d{6,12}$/.test(pin)) return setError('Use a 6 to 12 digit PIN.');
    if (!hasPin && pin !== confirm) return setError('The PINs do not match.');
    setBusy(true);
    try {
      if (hasPin) {
        if (pin !== await SecureStore.getItemAsync(pinKey)) throw new Error('Incorrect PIN.');
      } else {
        await SecureStore.setItemAsync(pinKey, pin);
        onPinCreated();
      }
      setPin(''); setConfirm(''); signIn();
    } catch (e) { setError(e.message || 'Could not unlock this phone.'); }
    finally { setBusy(false); }
  };
  return <Page contentStyle={{ paddingTop: 44, gap: 28 }}>
    <View style={s.row}><View style={{ padding: 12, backgroundColor: C.primary, borderRadius: 10 }}><Building2 size={25} color="white" /></View><View><Text style={{ fontFamily: F.head, fontSize: 16, letterSpacing: 1, color: C.primary }}>NATIONAL</Text><Text style={[s.eyebrow, { letterSpacing: 2.4 }]}>ENTERPRISES</Text></View></View>
    <View style={{ height: 3, width: 42, backgroundColor: C.cta }} />
    <Title eyebrow="OFFLINE COLLECTIONS" title={hasPin ? 'Open your ledger' : 'Secure this phone'} subtitle={hasPin ? 'Your records are saved on this phone.' : 'Choose a PIN for this phone before recording collections.'} />
    <View style={s.card}>
      <Text style={s.heading}>{hasPin ? 'Enter PIN' : 'Create admin PIN'}</Text>
      <Field label="PIN (6 to 12 digits)" value={pin} onChangeText={setPin} secureTextEntry keyboardType="number-pad" maxLength={12} />
      {!hasPin && <Field label="Confirm PIN" value={confirm} onChangeText={setConfirm} secureTextEntry keyboardType="number-pad" maxLength={12} onSubmitEditing={unlock} />}
      <Notice text={error} />
      <Button title={hasPin ? 'Unlock' : 'Create PIN and start'} icon={ArrowRight} busy={busy} onPress={unlock} />
    </View>
    <View style={s.row}><LockKeyhole size={17} color={C.muted} /><Text style={[s.muted, { flex: 1 }]}>No server or internet connection is needed.</Text></View>
  </Page>;
}

export function Lines({ navigation }) {
  const { api, selectLine, signOut } = useSession();
  const load = useLoad(useCallback(async () => (await api.get('/lines')).data, [api]));
  const backup = useLoad(useCallback(backupStatus, []));
  return <Page onRefresh={() => { load.reload(); backup.reload(); }} refreshing={load.loading || backup.loading}>
    <View style={s.between}><View><Text style={[s.eyebrow, { color: C.primary }]}>NATIONAL ENTERPRISES</Text><Text style={s.muted}>Offline ledger on this phone</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Lock app" style={s.iconButton} onPress={signOut}><LockKeyhole size={21} color={C.primary} /></Pressable></View>
    <View style={{ paddingTop: 25, gap: 10 }}><Title eyebrow="YOUR WORKSPACES" title="Choose a line" subtitle="Each line has its own customers, collections, and dues." /></View>
    <Notice text={load.error} />
    {load.error && <Button title="Retry" secondary onPress={load.reload} />}
    {load.data?.map((line, i) => <Pressable accessibilityRole="button" accessibilityLabel={'Open ' + line.name} key={line.id} onPress={() => { selectLine(line); navigation.navigate('Workspace'); }} style={({ pressed }) => [s.card, { padding: 22, gap: 24, opacity: pressed ? 0.7 : 1 }]}>
      <View style={s.between}><View style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: F.head, color: 'white', fontSize: 24 }}>{line.name[0]}</Text></View><Text style={s.eyebrow}>0{i+1} / WORKSPACE</Text></View>
      <View style={s.between}><View style={{ flex: 1 }}><Text style={[s.heading, { fontSize: 23 }]}>{line.name}</Text><Text style={[s.muted, { marginTop: 5 }]}>Customers, collections & reports</Text></View><ArrowRight size={23} color={C.cta} /></View>
    </Pressable>)}
    <Pressable accessibilityRole="button" accessibilityLabel="Open backup" onPress={() => navigation.navigate('Backup')} style={[s.card, { borderColor: backup.data?.due ? C.danger : C.border }]}><View style={s.row}><DatabaseBackup size={23} color={backup.data?.due ? C.danger : C.secondary} /><View style={{ flex: 1 }}><Text style={s.heading}>{backup.data?.due ? 'Monthly backup due' : 'Back up this phone'}</Text><Text style={s.muted}>{backup.data?.last ? 'Last export: ' + new Date(backup.data.last).toLocaleDateString('en-IN') : 'Save a copy outside the app'}</Text></View><ArrowRight size={20} color={C.cta} /></View></Pressable>
    <Text style={[s.muted, { textAlign: 'center' }]}>Products are shared across lines. Keep a backup on a computer or USB drive.</Text>
  </Page>;
}
