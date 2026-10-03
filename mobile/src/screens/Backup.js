import React, { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { DatabaseBackup, FolderOpen, RotateCcw } from 'lucide-react-native';
import { Page, Title, Button, Notice } from '../components';
import { C, styles as s } from '../theme';
import { useLoad } from '../useLoad';
import { backupStatus, exportBackup, pickBackup, restoreBackup } from '../local/backup';

export function Backup({ navigation }) {
  const status = useLoad(useCallback(backupStatus, []));
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const save = async () => {
    if (busy) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      const result = await exportBackup();
      if (result) { setSuccess('Backup saved as ' + result.fileName + '. Copy it from the chosen folder to your computer with a USB cable.'); await status.reload(); }
    } catch (e) { setError(e.message || 'Could not save the backup.'); }
    finally { setBusy(false); }
  };
  const choose = async () => {
    if (busy) return;
    setError(''); setSelected(null);
    try { setSelected(await pickBackup()); }
    catch (e) { setError(e.message || 'Could not read the backup.'); }
  };
  const confirmRestore = () => {
    if (!selected || busy) return;
    Alert.alert('Replace this phone\'s records?', 'Restoring ' + selected.name + ' will replace every customer, product, sale, due, and payment currently on this phone. Export a backup first.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Restore backup', style: 'destructive', onPress: async () => {
        setBusy(true); setError('');
        try { await restoreBackup(selected.snapshot); setSelected(null); navigation.navigate('Lines'); }
        catch (e) { setError(e.message || 'Restore failed. Your existing records were kept.'); }
        finally { setBusy(false); }
      } },
    ]);
  };
  return <Page>
    <Title eyebrow="PHONE DATABASE" title="Backup & restore" subtitle="Your records live on this phone. Save a copy outside the app each month." />
    {status.data?.due && <View style={[s.card, { borderColor: C.danger }]}><Text style={[s.heading, { color: C.danger }]}>Monthly backup due</Text><Text style={s.body}>Choose a folder such as Downloads and save a new backup now.</Text></View>}
    <View style={s.card}><Text style={s.heading}>Export backup</Text><Text style={s.body}>The export contains all three lines and shared stock. Choose a folder you can find through your phone's USB connection.</Text><Text style={s.muted}>Last saved: {status.data?.last ? new Date(status.data.last).toLocaleString('en-IN') : 'Never'}</Text><Button title="Choose folder & save backup" icon={DatabaseBackup} onPress={save} busy={busy} /></View>
    <Notice text={success} success /><Notice text={error || status.error} />
    <View style={s.card}><Text style={s.heading}>Restore from a backup</Text><Text style={s.body}>Copy a NATIONAL ENTERPRISES backup file onto this phone, then select it here. A restore replaces the current phone records.</Text><Button title="Choose backup file" icon={FolderOpen} secondary onPress={choose} disabled={busy} />
      {selected && <><Text style={s.muted}>{selected.name}</Text><Text style={s.muted}>{selected.counts.customers} customers · {selected.counts.sales} sales · {selected.counts.payments} payments</Text><Button title="Restore selected backup" icon={RotateCcw} onPress={confirmRestore} disabled={busy} /></>}
    </View>
    <Text style={s.muted}>Installing a newer APK with the same package name and signing key keeps this database. Uninstalling the app or clearing its storage removes the phone copy.</Text>
  </Page>;
}
