'use client';
import { useCallback, useEffect, useState } from 'react';

export async function apiCall<T = any>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const r = await fetch(url, { method, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && typeof window !== 'undefined') location.href = '/login';
  if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
  return data;
}

export function useData<T = any>(url: string | null) {
  // data is stored together with the URL it came from, so a view never renders another request's shape
  const [state, setState] = useState<{ url: string | null; data: T | null }>({ url: null, data: null });
  const [error, setError] = useState('');
  const reload = useCallback(() => {
    if (url) apiCall<T>(url).then(d => { setState({ url, data: d }); setError(''); }).catch(e => setError(e.message));
  }, [url]);
  useEffect(reload, [reload]);
  return { data: state.url === url ? state.data : null, error, reload };
}

export const inr = (v: unknown, dec = 0) =>
  (Number(v) < 0 ? '−₹' : '₹') + Math.abs(Number(v ?? 0)).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
export const inr2 = (v: unknown) => inr(v, 2);
export const fmtDate = (v?: string | null) => (v ? new Date(v.length === 10 ? v + 'T00:00:00' : v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const todayStr = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const monthStart = () => todayStr().slice(0, 8) + '01';
export const fyStart = () => { const t = todayStr(); const y = +t.slice(0, 4) - (+t.slice(5, 7) < 4 ? 1 : 0); return `${y}-04-01`; };

/** Read an image/PDF file as a data URL, downscaling large photos to keep uploads small */
export async function fileToDataUrl(file: File): Promise<{ url: string; mime: string }> {
  const raw: string = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file); });
  if (!file.type.startsWith('image/') || file.size < 400_000) return { url: raw, mime: file.type };
  const img = new Image(); img.src = raw; await img.decode();
  const scale = Math.min(1, 1400 / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = img.width * scale; c.height = img.height * scale;
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return { url: c.toDataURL('image/jpeg', 0.75), mime: 'image/jpeg' };
}
