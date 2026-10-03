import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { errorText } from './api';

// Refresh when a screen regains focus; ignore stale responses after line/filter changes.
export function useLoad(loader) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const version = ++generation.current;
    setLoading(true); setError('');
    try { const value = await loader(); if (generation.current === version) setData(value); }
    catch (e) { if (generation.current === version) { setError(errorText(e)); setData(null); } }
    finally { if (generation.current === version) setLoading(false); }
  }, [loader]);
  useFocusEffect(useCallback(() => { reload(); return () => { generation.current++; }; }, [reload]));
  return { data, error, loading, reload };
}
