'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSocket } from '@/lib/socket';
import {
  Drink, Order, DrinkCategory,
  CATEGORY_LABELS, CATEGORY_ICONS,
  STATUS_LABELS, UNIT_LABELS, UNIT_LABELS_PLURAL,
} from '@/lib/types';

interface BatchGroup {
  batchId: string;
  orders: Order[];
  createdBy: string;
  createdAt: string;
  batchNote: string;
}

// VAPID public key for Web Push subscription
// Set NEXT_PUBLIC_VAPID_PUBLIC_KEY in env; fallback for local dev
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BJ1RBITYGxTcUuQXuWpSw4p0Vdh8T3VVlrPwDkqpAP50Uh0lI4Rkb5zDt7QkDDKxR0WQOcSWrIeOkiv0PKcduto';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function subscribeToPush(socket: ReturnType<typeof getSocket>) {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

    const registration = await navigator.serviceWorker.ready;

    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    // Send subscription to server
    socket.emit('push:subscribe', subscription.toJSON());
    console.log('[KAF] Push subscription active');
    return true;
  } catch (err) {
    console.warn('[KAF] Push subscription failed:', err);
    return false;
  }
}

// ─── Alert Sound via <audio> element ──────────────────────
// Uses a real audio file — much more reliable on iOS than AudioContext.
// The audio element must be "unlocked" by a user tap first (iOS requirement).
function playAlertSound(audioRef: React.RefObject<HTMLAudioElement | null>) {
  const audio = audioRef.current;
  if (!audio) return;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

function notify(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, icon: '/icon-192.png', badge: '/icon-192.png' });
    } catch {
      // iOS PWA may not support Notification constructor, try service worker
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          title,
          body,
        });
      }
    }
  }
  if ('vibrate' in navigator) navigator.vibrate([300, 100, 300, 100, 300]);
}

function StatusBadge({ status }: { status: Order['status'] }) {
  const colors: Record<string, string> = {
    pending: 'bg-kaf-warning-bg text-kaf-warning',
    preparing: 'bg-kaf-info-bg text-kaf-info',
    ready: 'bg-kaf-success-bg text-kaf-success',
    delivered: 'bg-kaf-surface text-kaf-text-tertiary',
    cancelled: 'bg-kaf-danger-bg text-kaf-danger',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colors[status]}`}>
      {(status === 'pending' || status === 'preparing') && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-dot" />
      )}
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── Order Card (Lager View) ──────────────────────────────
function OrderCard({
  order,
  onDeliver,
}: {
  order: Order;
  onDeliver: () => void;
}) {
  return (
    <div className="bg-kaf-surface rounded-2xl border border-kaf-border p-4 animate-fade-in border-l-4 border-l-kaf-warning">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">{CATEGORY_ICONS[order.category]}</span>
            <span className="font-bold text-lg">{order.drinkName}</span>
          </div>
          <div className="text-sm text-kaf-text-secondary mt-0.5">
            {order.quantity} {order.quantity === 1
              ? UNIT_LABELS[order.unit as keyof typeof UNIT_LABELS]
              : UNIT_LABELS_PLURAL[order.unit as keyof typeof UNIT_LABELS_PLURAL]}
            <span className="text-kaf-text-tertiary"> · {order.bottleCount} Fl.</span>
          </div>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {order.note && (
        <p className="text-sm text-kaf-text-secondary mb-3 px-2 py-1.5 rounded-lg bg-kaf-surface-hover">
          📝 {order.note}
        </p>
      )}

      <div className="flex items-center justify-between mt-3">
        <div className="text-xs text-kaf-text-tertiary">
          <span className="font-medium text-kaf-text-secondary">{order.createdBy}</span>
          {' · '}
          {new Date(order.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </div>

        {order.status === 'pending' && (
          <button
            onClick={onDeliver}
            className="px-5 py-2.5 rounded-xl bg-kaf-success-bg text-kaf-success text-xs font-semibold hover:opacity-80 active:scale-95 transition-all"
          >
            Erledigt ✓
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Inventory Item ───────────────────────────────────────
function InventoryItem({
  drink,
  onAdjust,
}: {
  drink: Drink;
  onAdjust: (delta: number) => void;
}) {
  const low = drink.inventory <= drink.minStock && drink.inventory > 0;
  const out = drink.inventory === 0;
  const pct = drink.minStock > 0 ? Math.min(100, (drink.inventory / (drink.minStock * 4)) * 100) : 100;

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl bg-kaf-surface border border-kaf-border ${out ? 'opacity-50' : ''}`}>
      <span className="text-xl w-8 text-center">{CATEGORY_ICONS[drink.category]}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{drink.name}</span>
          {low && <span className="text-[10px] text-kaf-warning font-medium">Niedrig</span>}
          {out && <span className="text-[10px] text-kaf-danger font-medium">Leer</span>}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1.5 rounded-full bg-kaf-surface-hover overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${out ? 'bg-kaf-danger' : low ? 'bg-kaf-warning' : 'bg-kaf-success'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-mono text-kaf-text-secondary w-14 text-right">{drink.inventory} Fl.</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onAdjust(-1)}
          disabled={drink.inventory === 0}
          className="w-8 h-8 rounded-lg bg-kaf-surface-hover border border-kaf-border text-sm flex items-center justify-center hover:bg-kaf-surface-active active:scale-95 transition-all disabled:opacity-30"
        >
          −
        </button>
        <button
          onClick={() => onAdjust(1)}
          className="w-8 h-8 rounded-lg bg-kaf-surface-hover border border-kaf-border text-sm flex items-center justify-center hover:bg-kaf-surface-active active:scale-95 transition-all"
        >
          +
        </button>
      </div>
    </div>
  );
}

// ─── Notification Permission Banner ──────────────────────
function NotificationBanner({ onDismiss, socket }: { onDismiss: () => void; socket: ReturnType<typeof getSocket> | null }) {
  const [status, setStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [pushStatus, setPushStatus] = useState<string>('');

  const handleEnable = async () => {
    if (!('Notification' in window)) {
      setStatus('denied');
      return;
    }
    const result = await Notification.requestPermission();
    setStatus(result as 'granted' | 'denied');
    if (result === 'granted') {
      // Subscribe to Web Push for background notifications
      if (socket) {
        setPushStatus('Push wird aktiviert...');
        const pushOk = await subscribeToPush(socket);
        setPushStatus(pushOk ? 'Push aktiv! ✅' : 'Push nicht verfügbar — Sound-Alerts aktiv');
      }
      // Show a test notification via service worker
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification('KAF Benachrichtigungen aktiv! ✅', {
          body: 'Du wirst jetzt über neue Bestellungen informiert — auch im Hintergrund.',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
        });
      } catch {}
      setTimeout(onDismiss, 3000);
    }
  };

  if (status === 'granted') {
    return (
      <div className="mx-4 mt-3 p-3 rounded-xl bg-kaf-success-bg border border-kaf-success/20 flex items-center gap-2 animate-fade-in">
        <span>✅</span>
        <span className="text-xs font-medium text-kaf-success">Benachrichtigungen aktiviert!</span>
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="mx-4 mt-3 p-3 rounded-xl bg-kaf-warning-bg border border-kaf-warning/20 animate-fade-in">
        <p className="text-xs text-kaf-text-secondary">
          ⚠️ Benachrichtigungen blockiert. Du bekommst trotzdem <strong>Sound-Alerts</strong> wenn neue Bestellungen reinkommen.
        </p>
        <button onClick={onDismiss} className="text-xs text-kaf-accent font-medium mt-1">OK, verstanden</button>
      </div>
    );
  }

  return (
    <div className="mx-4 mt-3 p-3 rounded-xl bg-kaf-accent-bg border border-kaf-accent/20 animate-fade-in">
      <div className="flex items-start gap-2">
        <span className="text-lg">🔔</span>
        <div className="flex-1">
          <p className="text-xs font-semibold text-kaf-text">Benachrichtigungen aktivieren</p>
          <p className="text-xs text-kaf-text-secondary mt-0.5">
            Push-Benachrichtigungen für neue Bestellungen — auch wenn das Handy in der Tasche ist.
          </p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleEnable}
              className="px-4 py-2 rounded-lg bg-kaf-accent text-white text-xs font-semibold active:scale-95 transition-transform"
            >
              Aktivieren
            </button>
            <button
              onClick={onDismiss}
              className="px-3 py-2 rounded-lg text-kaf-text-secondary text-xs hover:text-kaf-text transition-colors"
            >
              Später
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────
function LagerPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const userName = params.get('name') || localStorage.getItem('kaf-name') || 'Anonym';

  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'orders' | 'inventory'>('orders');
  const [connected, setConnected] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showNotifBanner, setShowNotifBanner] = useState(false);
  const [notifPermission, setNotifPermission] = useState<string>('default');
  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wakeLockRef = useRef<any>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Check notification permission state
  useEffect(() => {
    if ('Notification' in window) {
      setNotifPermission(Notification.permission);
      if (Notification.permission === 'default') {
        setShowNotifBanner(true);
      }
    }
  }, []);

  // Screen Wake Lock — keeps phone screen on so alerts are heard
  useEffect(() => {
    async function requestWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        }
      } catch {}
    }
    requestWakeLock();

    // Re-acquire on visibility change (e.g., switching back to app)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') requestWakeLock();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, []);

  // Initialize audio element + unlock on first user tap (iOS requirement)
  useEffect(() => {
    const audio = new Audio('/alert.wav');
    audio.preload = 'auto';
    audio.volume = 1.0;
    audioRef.current = audio;

    // iOS requires a user gesture to "unlock" audio playback.
    // Play a silent snippet on first tap to unlock it.
    const unlockAudio = () => {
      audio.volume = 0;
      audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 1.0;
      }).catch(() => {});
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('click', unlockAudio);
    };
    document.addEventListener('touchstart', unlockAudio);
    document.addEventListener('click', unlockAudio);
    return () => {
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('click', unlockAudio);
    };
  }, []);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    const fetchData = () => {
      setConnected(true);
      socket.emit('user:join', { name: userName, role: 'lager' });
      socket.emit('drinks:list', (d: Drink[]) => setDrinks(d));
      socket.emit('orders:list', (o: Order[]) => setOrders(o));
    };

    if (socket.connected) fetchData();
    socket.on('connect', fetchData);

    socket.on('disconnect', () => setConnected(false));
    socket.on('drinks:updated', (d: Drink[]) => setDrinks(d));

    // Auto-subscribe to push if permission already granted
    if ('Notification' in window && Notification.permission === 'granted') {
      subscribeToPush(socket);
    }

    socket.on('order:new', (order: Order) => {
      setOrders(prev => {
        if (prev.find(o => o.id === order.id)) return prev;
        return [order, ...prev];
      });
      // Alert lager team — sound + notification + vibration
      if (soundEnabled) playAlertSound(audioRef);
      notify('Neue Bestellung! 📦', `${order.quantity}× ${order.drinkName} von ${order.createdBy}`);
    });

    socket.on('order:updated', (order: Order) => {
      setOrders(prev => prev.map(o => o.id === order.id ? order : o));
    });

    socket.on('orders:cleared', (o: Order[]) => setOrders(o));

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('drinks:updated');
      socket.off('order:new');
      socket.off('order:updated');
      socket.off('orders:cleared');
    };
  }, [userName, soundEnabled]);

  const handleDeliver = (orderId: string) => {
    socketRef.current?.emit('order:deliver', { orderId }, (res: any) => {
      if (res.error) showToast(`Fehler: ${res.error}`);
      else showToast('Erledigt! ✓');
    });
  };

  const handleAdjust = (drinkId: string, delta: number) => {
    socketRef.current?.emit('inventory:adjust', { drinkId, delta });
  };

  // Test alert button — also unlocks audio on iOS (user gesture!)
  const handleTestAlert = () => {
    // This tap counts as a user gesture, so it will unlock audio on iOS
    const audio = audioRef.current;
    if (audio) {
      audio.volume = 1.0;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
    if ('vibrate' in navigator) navigator.vibrate([300, 100, 300]);
    showToast('🔊 Sound-Test!');
  };

  const activeOrders = orders.filter(o => o.status === 'pending');
  const pendingCount = orders.filter(o => o.status === 'pending').length;

  // Group active orders by batchId
  const groupedOrders: (Order | BatchGroup)[] = (() => {
    const batches = new Map<string, Order[]>();
    const singles: Order[] = [];

    for (const order of activeOrders) {
      if (order.batchId) {
        if (!batches.has(order.batchId)) batches.set(order.batchId, []);
        batches.get(order.batchId)!.push(order);
      } else {
        singles.push(order);
      }
    }

    const result: (Order | BatchGroup)[] = [];
    batches.forEach((batchOrders, batchId) => {
      if (batchOrders.length === 1) {
        result.push(batchOrders[0]);
      } else {
        result.push({
          batchId,
          orders: batchOrders,
          createdBy: batchOrders[0].createdBy,
          createdAt: batchOrders[0].createdAt,
          batchNote: batchOrders[0].batchNote || '',
        });
      }
    });
    result.push(...singles);
    result.sort((a, b) => {
      const aTime = 'orders' in a ? a.createdAt : a.createdAt;
      const bTime = 'orders' in b ? b.createdAt : b.createdAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
    return result;
  })();

  const lowStockDrinks = drinks.filter(d => d.inventory <= d.minStock && d.inventory > 0);
  const outOfStockDrinks = drinks.filter(d => d.inventory === 0);

  const groupedCategories = Object.groupBy
    ? Object.groupBy(drinks, (d: Drink) => d.category)
    : drinks.reduce((acc, d) => {
        (acc[d.category] = acc[d.category] || []).push(d);
        return acc;
      }, {} as Record<string, Drink[]>);

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-kaf-bg/80 glass border-b border-kaf-border">
        <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
          <button onClick={() => router.push('/')} className="text-kaf-text-secondary hover:text-kaf-text transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="text-center">
            <div className="font-bold text-sm tracking-wide">KAF</div>
            <div className="text-[10px] text-kaf-text-secondary">Lager · {userName}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleTestAlert}
              className="text-xs px-2 py-1 rounded-lg bg-kaf-surface-hover border border-kaf-border active:scale-95 transition-transform"
              title="Sound testen"
            >
              🔊
            </button>
            <button
              onClick={async () => {
                // Debug info
                const hasNotif = 'Notification' in window;
                const hasSW = 'serviceWorker' in navigator;
                const hasPush = 'PushManager' in window;
                const perm = hasNotif ? Notification.permission : 'no API';
                const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;

                console.log('[KAF Debug]', { hasNotif, hasSW, hasPush, perm, isStandalone });

                if (!hasNotif) {
                  showToast(`Notification API nicht verfügbar. Standalone: ${isStandalone}, SW: ${hasSW}`);
                  return;
                }

                if (perm === 'denied') {
                  showToast(`Blockiert. Gehe zu Einstellungen → Apps → suche nach der IP oder KAF → Mitteilungen erlauben`);
                  return;
                }

                if (perm !== 'granted') {
                  try {
                    const result = await Notification.requestPermission();
                    setNotifPermission(result);
                    if (result === 'granted' && socketRef.current) {
                      await subscribeToPush(socketRef.current);
                      showToast('Push aktiviert! ✅');
                      try {
                        const reg = await navigator.serviceWorker.ready;
                        await reg.showNotification('KAF Push aktiv! ✅', {
                          body: 'Benachrichtigungen auch im Hintergrund.',
                          icon: '/icon-192.png',
                        });
                      } catch {}
                    } else if (result === 'denied') {
                      showToast(`Blockiert (${result}). Standalone: ${isStandalone}`);
                    }
                  } catch (err: any) {
                    showToast(`Fehler: ${err.message}`);
                  }
                } else {
                  setSoundEnabled(!soundEnabled);
                }
              }}
              className={`text-xs px-2 py-1 rounded-lg border active:scale-95 transition-transform ${
                notifPermission === 'granted'
                  ? 'bg-kaf-surface-hover border-kaf-border'
                  : 'bg-kaf-accent text-white border-kaf-accent animate-pulse-dot'
              }`}
              title={notifPermission === 'granted' ? (soundEnabled ? 'Ton aus' : 'Ton an') : 'Push aktivieren'}
            >
              {notifPermission === 'granted'
                ? (soundEnabled ? '🔔' : '🔕')
                : '🔔 Push an'
              }
            </button>
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-kaf-success' : 'bg-kaf-danger'}`} />
          </div>
        </div>
      </header>

      {/* Notification Permission Banner */}
      {showNotifBanner && (
        <NotificationBanner onDismiss={() => setShowNotifBanner(false)} socket={socketRef.current} />
      )}

      {/* Tab Bar */}
      <div className="sticky top-[57px] z-30 bg-kaf-bg border-b border-kaf-border">
        <div className="flex max-w-lg mx-auto">
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex-1 py-3 text-sm font-medium text-center transition-colors relative ${
              activeTab === 'orders' ? 'text-kaf-accent' : 'text-kaf-text-secondary'
            }`}
          >
            Bestellungen
            {pendingCount > 0 && (
              <span className="absolute top-2 right-1/4 w-5 h-5 rounded-full bg-kaf-warning text-white text-[10px] font-bold flex items-center justify-center animate-pulse-dot">
                {pendingCount}
              </span>
            )}
            {activeTab === 'orders' && <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-kaf-accent rounded-full" />}
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex-1 py-3 text-sm font-medium text-center transition-colors relative ${
              activeTab === 'inventory' ? 'text-kaf-accent' : 'text-kaf-text-secondary'
            }`}
          >
            Inventar
            {(lowStockDrinks.length > 0 || outOfStockDrinks.length > 0) && (
              <span className="absolute top-2 right-1/4 w-2 h-2 rounded-full bg-kaf-warning" />
            )}
            {activeTab === 'inventory' && <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-kaf-accent rounded-full" />}
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 pb-8">
        {activeTab === 'orders' && (
          <div className="animate-fade-in py-4">
            {/* Low stock warning */}
            {lowStockDrinks.length > 0 && (
              <div className="mb-4 p-3 rounded-xl bg-kaf-warning-bg border border-kaf-warning/20 flex items-start gap-2">
                <span className="text-sm mt-0.5">⚠️</span>
                <div>
                  <p className="text-xs font-medium text-kaf-warning">Niedriger Bestand</p>
                  <p className="text-xs text-kaf-text-secondary mt-0.5">
                    {lowStockDrinks.map(d => d.name).join(', ')}
                  </p>
                </div>
              </div>
            )}

            {activeOrders.length === 0 && (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">📦</div>
                <p className="text-kaf-text-secondary text-sm">Keine offenen Bestellungen</p>
                <p className="text-kaf-text-tertiary text-xs mt-1">Neue Bestellungen erscheinen hier automatisch</p>
              </div>
            )}

            <div className="space-y-3">
              {groupedOrders.map(item => {
                if ('orders' in item) {
                  const batch = item as BatchGroup;
                  return (
                    <div key={batch.batchId} className="bg-kaf-surface rounded-2xl border-2 border-kaf-accent/30 overflow-hidden animate-fade-in">
                      {/* Batch Header */}
                      <div className="px-4 py-2.5 bg-kaf-accent-bg border-b border-kaf-accent/20 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">📦</span>
                          <span className="text-xs font-semibold text-kaf-accent">Sammelbestellung</span>
                          <span className="text-xs text-kaf-text-secondary">· {batch.orders.length} Artikel</span>
                        </div>
                        <div className="text-xs text-kaf-text-secondary">
                          <span className="font-medium text-kaf-text-secondary">{batch.createdBy}</span>
                          {' · '}
                          {new Date(batch.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      {batch.batchNote && (
                        <div className="px-4 py-2 bg-kaf-surface-hover border-b border-kaf-border">
                          <p className="text-xs text-kaf-text-secondary">📝 {batch.batchNote}</p>
                        </div>
                      )}
                      {/* Batch Items */}
                      <div className="divide-y divide-kaf-border">
                        {batch.orders.map(order => (
                          <div key={order.id} className="p-4">
                            <div className="flex items-start justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{CATEGORY_ICONS[order.category]}</span>
                                <span className="font-bold">{order.drinkName}</span>
                                <span className="text-sm text-kaf-text-secondary">
                                  {order.quantity} {order.quantity === 1
                                    ? UNIT_LABELS[order.unit as keyof typeof UNIT_LABELS]
                                    : UNIT_LABELS_PLURAL[order.unit as keyof typeof UNIT_LABELS_PLURAL]}
                                  <span className="text-kaf-text-tertiary"> · {order.bottleCount} Fl.</span>
                                </span>
                              </div>
                              <StatusBadge status={order.status} />
                            </div>
                            {order.note && (
                              <p className="text-xs text-kaf-text-secondary ml-8 mb-2">📝 {order.note}</p>
                            )}
                            <div className="flex justify-end gap-2 mt-2">
                              {order.status === 'pending' && (
                                <button
                                  onClick={() => handleDeliver(order.id)}
                                  className="px-5 py-2.5 rounded-xl bg-kaf-success-bg text-kaf-success text-xs font-semibold hover:opacity-80 active:scale-95 transition-all"
                                >
                                  Erledigt ✓
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                } else {
                  const order = item as Order;
                  return (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onDeliver={() => handleDeliver(order.id)}
                    />
                  );
                }
              })}
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="animate-fade-in py-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              <div className="bg-kaf-surface rounded-xl border border-kaf-border p-3 text-center">
                <div className="text-xl font-bold">{drinks.length}</div>
                <div className="text-[10px] text-kaf-text-secondary">Getränke</div>
              </div>
              <div className="bg-kaf-surface rounded-xl border border-kaf-border p-3 text-center">
                <div className={`text-xl font-bold ${lowStockDrinks.length > 0 ? 'text-kaf-warning' : ''}`}>
                  {lowStockDrinks.length}
                </div>
                <div className="text-[10px] text-kaf-text-secondary">Niedrig</div>
              </div>
              <div className="bg-kaf-surface rounded-xl border border-kaf-border p-3 text-center">
                <div className={`text-xl font-bold ${outOfStockDrinks.length > 0 ? 'text-kaf-danger' : ''}`}>
                  {outOfStockDrinks.length}
                </div>
                <div className="text-[10px] text-kaf-text-secondary">Leer</div>
              </div>
            </div>

            {/* Drinks by category */}
            {(['bier', 'schnaps', 'sonstiges'] as DrinkCategory[]).map(cat => {
              const catDrinks = (groupedCategories as Record<string, Drink[]>)[cat];
              if (!catDrinks?.length) return null;
              return (
                <div key={cat} className="mb-6">
                  <h3 className="text-xs font-medium text-kaf-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
                  </h3>
                  <div className="space-y-2">
                    {catDrinks.map(drink => (
                      <InventoryItem
                        key={drink.id}
                        drink={drink}
                        onAdjust={(delta) => handleAdjust(drink.id, delta)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl bg-kaf-text text-kaf-bg text-sm font-medium shadow-kaf-xl animate-slide-up">
          {toast}
        </div>
      )}
    </div>
  );
}

export default function LagerPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh flex items-center justify-center text-kaf-text-secondary">Laden...</div>}>
      <LagerPageInner />
    </Suspense>
  );
}
