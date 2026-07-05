import api from '../api/axiosInstance';

// Web Push (browser notifications). Registers the service worker, subscribes via the PushManager
// using the server's VAPID public key, and stores the subscription on the backend so it can push.

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

async function getVapidPublicKey(): Promise<string | null> {
  try {
    const res = await api.get<{ publicKey: string | null; enabled: boolean }>('/api/push/vapid-public-key');
    return res.data.enabled ? res.data.publicKey : null;
  } catch {
    return null;
  }
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

function extractKeys(sub: PushSubscription): { endpoint: string; p256dh: string; auth: string } | null {
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null;
  return { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth };
}

// Full subscribe flow. Returns 'subscribed' | 'denied' | 'unsupported' | 'error'.
export async function enablePush(): Promise<'subscribed' | 'denied' | 'unsupported' | 'error'> {
  if (!isPushSupported()) return 'unsupported';

  const publicKey = await getVapidPublicKey();
  if (!publicKey) return 'error';

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';

  const reg = await registerServiceWorker();
  if (!reg) return 'error';
  await navigator.serviceWorker.ready;

  try {
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }
    const payload = extractKeys(sub);
    if (!payload) return 'error';
    await api.post('/api/push/subscribe', payload);
    return 'subscribed';
  } catch {
    return 'error';
  }
}

export async function disablePush(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await api.post('/api/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
      await sub.unsubscribe();
    }
  } catch { /* ignore */ }
}

export function currentPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}
