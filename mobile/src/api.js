import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export function defaultServer() {
  if (process.env.EXPO_PUBLIC_API_URL) return normalizeServer(process.env.EXPO_PUBLIC_API_URL);
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return 'http://' + (host || (Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1')) + ':8000/api/v1';
}
export function normalizeServer(value) {
  const text = value.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(text)) throw new Error('Server URL must start with http:// or https://');
  const url = new URL(text);
  if (url.search || url.hash || url.username || url.password) throw new Error('Use the server URL without credentials or query parameters');
  return text.endsWith('/api/v1') ? text : text + '/api/v1';
}
export function createApi(url, token, onExpired) {
  const api = axios.create({ baseURL: url, timeout: 15000, headers: token ? { Authorization: 'Bearer ' + token } : {} });
  api.interceptors.response.use(r => r, error => {
    if (token && error.response?.status === 401) onExpired?.();
    return Promise.reject(error);
  });
  return api;
}
export function errorText(error) {
  const detail = error.response?.data?.detail;
  if (Array.isArray(detail)) return detail.map(x => x.loc.slice(1).join(' ') + ': ' + x.msg).join('\n');
  if (typeof detail === 'string') return detail;
  if (error.code === 'ECONNABORTED') return 'The server took too long to respond. Check the connection and try again.';
  if (error.isAxiosError && !error.response) return 'Cannot reach the server. Check the URL, Wi-Fi, and that the backend is running.';
  return error.message || 'Something went wrong. Please try again.';
}
