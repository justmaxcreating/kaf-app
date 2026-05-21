'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSocket } from '@/lib/socket';
import {
  Drink, Order, DrinkCategory, CartItem,
  CATEGORY_LABELS, CATEGORY_ICONS,
  STATUS_LABELS, UNIT_LABELS, UNIT_LABELS_PLURAL,
} from '@/lib/types';

// ─── Notification Helper ──────────────────────────────────
function notify(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/icon-192.png', badge: '/icon-192.png' });
  }
  if ('vibrate' in navigator) navigator.vibrate(200);
}

function playSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    gain.gain.value = 0.15;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

// ─── Status Badge ─────────────────────────────────────────
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

// ─── Order Modal (Add to Cart) ───────────────────────────
function OrderModal({
  drink, onClose, onAddToCart,
}: {
  drink: Drink;
  onClose: () => void;
  onAddToCart: (item: CartItem) => void;
}) {
  // For Bier: force Kiste-only ordering while a full crate is in stock.
  // Once inventory drops below a crate, fall back to single bottles so the
  // last few can still be ordered.
  const availableUnits: string[] = (() => {
    if (drink.category === 'bier' && drink.units.includes('kiste')) {
      if (drink.inventory >= drink.bottlesPerCrate) return ['kiste'];
      return ['flasche'];
    }
    return drink.units;
  })();

  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState<string>(availableUnits[0]);
  const [note, setNote] = useState('');

  const bottleCount = unit === 'kiste' ? quantity * drink.bottlesPerCrate : quantity;
  const canOrder = bottleCount <= drink.inventory && drink.inventory > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 glass" onClick={onClose} />
      <div className="relative w-full max-w-md bg-kaf-surface rounded-t-3xl sm:rounded-3xl p-6 animate-slide-up safe-bottom shadow-kaf-xl border border-kaf-border">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold">{drink.name}</h3>
            <p className="text-sm text-kaf-text-secondary mt-0.5">
              {CATEGORY_ICONS[drink.category]} {CATEGORY_LABELS[drink.category]}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-kaf-surface-hover text-kaf-text-secondary">
            ✕
          </button>
        </div>

        {/* Stock info */}
        <div className="flex items-center gap-2 mb-6 px-3 py-2.5 rounded-xl bg-kaf-surface-hover">
          <span className="text-sm text-kaf-text-secondary">Auf Lager:</span>
          <span className={`font-semibold text-sm ${drink.inventory <= drink.minStock ? 'text-kaf-warning' : 'text-kaf-success'}`}>
            {drink.inventory} Flaschen
          </span>
          {drink.inventory <= drink.minStock && drink.inventory > 0 && (
            <span className="text-xs text-kaf-warning ml-auto">Niedriger Bestand</span>
          )}
          {drink.inventory === 0 && (
            <span className="text-xs text-kaf-danger ml-auto">Ausverkauft</span>
          )}
        </div>

        {/* Unit Selector */}
        {availableUnits.length > 1 && (
          <div className="mb-5">
            <label className="text-xs font-medium text-kaf-text-secondary uppercase tracking-wider mb-2 block">Einheit</label>
            <div className="grid grid-cols-2 gap-2">
              {availableUnits.map((u) => (
                <button
                  key={u}
                  onClick={() => { setUnit(u); setQuantity(1); }}
                  className={`px-4 py-3 rounded-xl text-sm font-medium border transition-all ${
                    unit === u
                      ? 'bg-kaf-accent text-white border-kaf-accent shadow-kaf'
                      : 'bg-kaf-surface border-kaf-border text-kaf-text hover:border-kaf-accent/50'
                  }`}
                >
                  {UNIT_LABELS[u as keyof typeof UNIT_LABELS]}
                  {u === 'kiste' && (
                    <span className="block text-xs opacity-70 mt-0.5">
                      ({drink.bottlesPerCrate} Flaschen)
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quantity */}
        <div className="mb-5">
          <label className="text-xs font-medium text-kaf-text-secondary uppercase tracking-wider mb-2 block">Anzahl</label>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-12 h-12 rounded-xl bg-kaf-surface-hover border border-kaf-border text-xl font-medium flex items-center justify-center hover:bg-kaf-surface-active active:scale-95 transition-all"
            >
              −
            </button>
            <span className="text-3xl font-bold w-16 text-center">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              disabled={!canOrder}
              className="w-12 h-12 rounded-xl bg-kaf-surface-hover border border-kaf-border text-xl font-medium flex items-center justify-center hover:bg-kaf-surface-active active:scale-95 transition-all disabled:opacity-30"
            >
              +
            </button>
          </div>
          <p className="text-xs text-kaf-text-secondary mt-2">
            = {bottleCount} {bottleCount === 1 ? 'Flasche' : 'Flaschen'}
          </p>
        </div>

        {/* Note */}
        <div className="mb-6">
          <label className="text-xs font-medium text-kaf-text-secondary uppercase tracking-wider mb-2 block">Notiz (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="z.B. Für Bierbar"
            className="w-full px-4 py-3 rounded-xl bg-kaf-surface-hover border border-kaf-border text-sm placeholder:text-kaf-text-tertiary focus:outline-none focus:ring-2 focus:ring-kaf-accent/30"
          />
        </div>

        {/* Add to Cart Button */}
        <button
          onClick={() => {
            if (canOrder) {
              onAddToCart({
                drinkId: drink.id,
                drinkName: drink.name,
                category: drink.category,
                quantity,
                unit: unit as any,
                bottleCount,
                note,
              });
            }
          }}
          disabled={!canOrder}
          className="w-full py-4 rounded-xl bg-kaf-accent text-white font-semibold text-base hover:bg-kaf-accent-hover active:scale-[0.98] transition-all shadow-kaf disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {canOrder
            ? `In den Warenkorb`
            : 'Nicht verfügbar'}
        </button>
      </div>
    </div>
  );
}

// ─── Cart Sheet ──────────────────────────────────────────
function CartSheet({
  cart,
  onClose,
  onRemove,
  onUpdateQty,
  onSend,
  sending,
}: {
  cart: CartItem[];
  onClose: () => void;
  onRemove: (index: number) => void;
  onUpdateQty: (index: number, delta: number) => void;
  onSend: (batchNote: string) => void;
  sending: boolean;
}) {
  const [batchNote, setBatchNote] = useState('');
  const totalBottles = cart.reduce((sum, item) => sum + item.bottleCount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 glass" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[85dvh] bg-kaf-surface rounded-t-3xl sm:rounded-3xl flex flex-col animate-slide-up safe-bottom shadow-kaf-xl border border-kaf-border">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-kaf-border">
          <div>
            <h3 className="text-xl font-bold">Warenkorb</h3>
            <p className="text-sm text-kaf-text-secondary mt-0.5">
              {cart.length} {cart.length === 1 ? 'Artikel' : 'Artikel'} · {totalBottles} Flaschen
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-kaf-surface-hover text-kaf-text-secondary">
            ✕
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-3">
          {cart.map((item, index) => (
            <div key={`${item.drinkId}-${index}`} className="flex items-center gap-3 p-3 rounded-xl bg-kaf-surface-hover border border-kaf-border">
              <span className="text-xl">{CATEGORY_ICONS[item.category]}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{item.drinkName}</div>
                <div className="text-xs text-kaf-text-secondary">
                  {item.quantity} {item.quantity === 1
                    ? UNIT_LABELS[item.unit as keyof typeof UNIT_LABELS]
                    : UNIT_LABELS_PLURAL[item.unit as keyof typeof UNIT_LABELS_PLURAL]}
                  <span className="text-kaf-text-tertiary"> · {item.bottleCount} Fl.</span>
                </div>
                {item.note && (
                  <div className="text-[10px] text-kaf-text-tertiary mt-0.5 truncate">📝 {item.note}</div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onUpdateQty(index, -1)}
                  className="w-7 h-7 rounded-lg bg-kaf-surface border border-kaf-border text-xs flex items-center justify-center hover:bg-kaf-surface-active active:scale-95 transition-all"
                >
                  −
                </button>
                <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                <button
                  onClick={() => onUpdateQty(index, 1)}
                  className="w-7 h-7 rounded-lg bg-kaf-surface border border-kaf-border text-xs flex items-center justify-center hover:bg-kaf-surface-active active:scale-95 transition-all"
                >
                  +
                </button>
              </div>
              <button
                onClick={() => onRemove(index)}
                className="w-7 h-7 rounded-lg text-kaf-danger hover:bg-kaf-danger-bg flex items-center justify-center text-xs transition-all"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 border-t border-kaf-border space-y-3">
          {/* Batch Note */}
          <input
            type="text"
            value={batchNote}
            onChange={(e) => setBatchNote(e.target.value)}
            placeholder="Notiz zur Bestellung (optional)"
            className="w-full px-4 py-3 rounded-xl bg-kaf-surface-hover border border-kaf-border text-sm placeholder:text-kaf-text-tertiary focus:outline-none focus:ring-2 focus:ring-kaf-accent/30"
          />

          {/* Send Button */}
          <button
            onClick={() => onSend(batchNote)}
            disabled={cart.length === 0 || sending}
            className="w-full py-4 rounded-xl bg-kaf-accent text-white font-semibold text-base hover:bg-kaf-accent-hover active:scale-[0.98] transition-all shadow-kaf disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {sending ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Wird gesendet...
              </>
            ) : (
              `Bestellung absenden (${cart.length} ${cart.length === 1 ? 'Artikel' : 'Artikel'})`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Drink Card ───────────────────────────────────────────
function DrinkCard({ drink, onClick }: { drink: Drink; onClick: () => void }) {
  const low = drink.inventory <= drink.minStock && drink.inventory > 0;
  const out = drink.inventory === 0;

  return (
    <button
      onClick={onClick}
      disabled={out}
      className={`relative flex flex-col p-4 rounded-2xl bg-kaf-surface border border-kaf-border hover:shadow-kaf-lg hover:border-kaf-accent/40 transition-all active:scale-[0.97] text-left cat-${drink.category} ${out ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      <span className="text-2xl mb-2">{CATEGORY_ICONS[drink.category]}</span>
      <span className="font-semibold text-sm">{drink.name}</span>
      <span className={`text-xs mt-1 ${low ? 'text-kaf-warning font-medium' : 'text-kaf-text-secondary'}`}>
        {out ? 'Ausverkauft' : `${drink.inventory} auf Lager`}
      </span>
      {low && !out && (
        <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-kaf-warning animate-pulse-dot" />
      )}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────
const CATEGORIES: DrinkCategory[] = ['bier', 'schnaps', 'sonstiges'];

function BarPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const userName = params.get('name') || localStorage.getItem('kaf-name') || 'Anonym';

  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedDrink, setSelectedDrink] = useState<Drink | null>(null);
  const [activeCategory, setActiveCategory] = useState<DrinkCategory | 'alle'>('alle');
  const [activeTab, setActiveTab] = useState<'drinks' | 'orders'>('drinks');
  const [connected, setConnected] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [sending, setSending] = useState(false);
  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const socket = getSocket();
    socketRef.current = socket;

    const fetchData = () => {
      setConnected(true);
      socket.emit('user:join', { name: userName, role: 'bar' });
      socket.emit('drinks:list', (d: Drink[]) => setDrinks(d));
      socket.emit('orders:list', (o: Order[]) => setOrders(o));
    };

    if (socket.connected) fetchData();
    socket.on('connect', fetchData);

    socket.on('disconnect', () => setConnected(false));

    socket.on('drinks:updated', (d: Drink[]) => setDrinks(d));

    socket.on('order:new', (order: Order) => {
      setOrders(prev => {
        if (prev.find(o => o.id === order.id)) return prev;
        return [order, ...prev];
      });
    });

    socket.on('order:updated', (order: Order) => {
      setOrders(prev => prev.map(o => o.id === order.id ? order : o));
      if (order.createdBy === userName && order.status === 'delivered') {
        playSound();
        notify('Bestellung geliefert! 🎉', `${order.quantity}× ${order.drinkName} ist unterwegs`);
      }
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
  }, [userName]);

  const addToCart = (item: CartItem) => {
    // Check if same drink + unit already in cart → merge
    const existingIndex = cart.findIndex(
      c => c.drinkId === item.drinkId && c.unit === item.unit
    );
    if (existingIndex >= 0) {
      setCart(prev => prev.map((c, i) => {
        if (i !== existingIndex) return c;
        const newQty = c.quantity + item.quantity;
        const newBottles = item.unit === 'kiste'
          ? newQty * (drinks.find(d => d.id === item.drinkId)?.bottlesPerCrate || 1)
          : newQty;
        return { ...c, quantity: newQty, bottleCount: newBottles, note: item.note || c.note };
      }));
    } else {
      setCart(prev => [...prev, item]);
    }
    setSelectedDrink(null);
    showToast(`${item.drinkName} zum Warenkorb hinzugefügt`);
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const updateCartQty = (index: number, delta: number) => {
    setCart(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const newQty = Math.max(1, item.quantity + delta);
      const drink = drinks.find(d => d.id === item.drinkId);
      const newBottles = item.unit === 'kiste'
        ? newQty * (drink?.bottlesPerCrate || 1)
        : newQty;
      return { ...item, quantity: newQty, bottleCount: newBottles };
    }));
  };

  const sendBatchOrder = (batchNote: string) => {
    if (!socketRef.current || cart.length === 0) return;
    setSending(true);
    socketRef.current.emit('order:create-batch', {
      items: cart,
      createdBy: userName,
      batchNote,
    }, (res: any) => {
      setSending(false);
      if (res.error) {
        showToast(`Fehler: ${res.error}`);
      } else {
        setCart([]);
        setShowCart(false);
        showToast(`Bestellung mit ${res.orders.length} Artikel${res.orders.length > 1 ? 'n' : ''} aufgegeben!`);
        setActiveTab('orders');
      }
    });
  };

  const cancelOrder = (orderId: string) => {
    socketRef.current?.emit('order:cancel', { orderId, cancelledBy: userName }, (res: any) => {
      if (res.error) showToast(`Fehler: ${res.error}`);
      else showToast('Bestellung storniert');
    });
  };

  const filteredDrinks = activeCategory === 'alle'
    ? drinks
    : drinks.filter(d => d.category === activeCategory);

  const myOrders = orders
    .filter(o => o.createdBy === userName)
    .filter(o => o.status !== 'delivered' && o.status !== 'cancelled');

  const myOrderHistory = orders
    .filter(o => o.createdBy === userName)
    .filter(o => o.status === 'delivered' || o.status === 'cancelled');

  const pendingCount = myOrders.length;
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-kaf-bg/80 glass border-b border-kaf-border safe-top">
        <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
          <button onClick={() => router.push('/')} className="text-kaf-text-secondary hover:text-kaf-text transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="text-center">
            <div className="font-bold text-sm tracking-wide">KAF</div>
            <div className="text-[10px] text-kaf-text-secondary">Bar · {userName}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-kaf-success' : 'bg-kaf-danger'}`} />
          </div>
        </div>
      </header>

      {/* Tab Bar */}
      <div className="sticky top-[57px] z-30 bg-kaf-bg border-b border-kaf-border">
        <div className="flex max-w-lg mx-auto">
          <button
            onClick={() => setActiveTab('drinks')}
            className={`flex-1 py-3 text-sm font-medium text-center transition-colors relative ${
              activeTab === 'drinks' ? 'text-kaf-accent' : 'text-kaf-text-secondary'
            }`}
          >
            Getränke
            {activeTab === 'drinks' && <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-kaf-accent rounded-full" />}
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex-1 py-3 text-sm font-medium text-center transition-colors relative ${
              activeTab === 'orders' ? 'text-kaf-accent' : 'text-kaf-text-secondary'
            }`}
          >
            Bestellungen
            {pendingCount > 0 && (
              <span className="absolute top-2 right-1/4 ml-1 w-5 h-5 rounded-full bg-kaf-accent text-white text-[10px] font-bold flex items-center justify-center">
                {pendingCount}
              </span>
            )}
            {activeTab === 'orders' && <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-kaf-accent rounded-full" />}
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 pb-24">
        {activeTab === 'drinks' && (
          <div className="animate-fade-in">
            {/* Category Filter */}
            <div className="flex gap-2 overflow-x-auto py-4 no-scrollbar">
              <button
                onClick={() => setActiveCategory('alle')}
                className={`shrink-0 px-4 py-2 rounded-full text-xs font-medium border transition-all ${
                  activeCategory === 'alle'
                    ? 'bg-kaf-accent text-white border-kaf-accent'
                    : 'bg-kaf-surface border-kaf-border text-kaf-text-secondary hover:border-kaf-accent/40'
                }`}
              >
                Alle
              </button>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`shrink-0 px-4 py-2 rounded-full text-xs font-medium border transition-all ${
                    activeCategory === cat
                      ? 'bg-kaf-accent text-white border-kaf-accent'
                      : 'bg-kaf-surface border-kaf-border text-kaf-text-secondary hover:border-kaf-accent/40'
                  }`}
                >
                  {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>

            {/* Drink Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredDrinks.map(drink => (
                <DrinkCard
                  key={drink.id}
                  drink={drink}
                  onClick={() => setSelectedDrink(drink)}
                />
              ))}
            </div>

            {filteredDrinks.length === 0 && (
              <div className="text-center py-16 text-kaf-text-secondary text-sm">
                Keine Getränke in dieser Kategorie
              </div>
            )}
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="animate-fade-in py-4">
            {myOrders.length === 0 && myOrderHistory.length === 0 && (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">🍺</div>
                <p className="text-kaf-text-secondary text-sm">Noch keine Bestellungen</p>
                <button
                  onClick={() => setActiveTab('drinks')}
                  className="mt-4 px-5 py-2.5 rounded-xl bg-kaf-accent text-white text-sm font-medium hover:bg-kaf-accent-hover transition-all"
                >
                  Getränke bestellen
                </button>
              </div>
            )}

            {/* Active Orders */}
            {myOrders.length > 0 && (
              <div className="mb-8">
                <h3 className="text-xs font-medium text-kaf-text-secondary uppercase tracking-wider mb-3">Aktive Bestellungen</h3>
                <div className="space-y-3">
                  {myOrders.map(order => (
                    <div key={order.id} className="bg-kaf-surface rounded-2xl border border-kaf-border p-4 animate-fade-in">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className="font-semibold">{order.drinkName}</span>
                          <span className="text-kaf-text-secondary text-sm ml-2">
                            {order.quantity} {order.quantity === 1
                              ? UNIT_LABELS[order.unit as keyof typeof UNIT_LABELS]
                              : UNIT_LABELS_PLURAL[order.unit as keyof typeof UNIT_LABELS_PLURAL]}
                          </span>
                        </div>
                        <StatusBadge status={order.status} />
                      </div>
                      {order.note && (
                        <p className="text-xs text-kaf-text-secondary mb-2">📝 {order.note}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-kaf-text-tertiary">
                          {new Date(order.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {order.status === 'pending' && (
                          <button
                            onClick={() => cancelOrder(order.id)}
                            className="text-xs text-kaf-danger hover:text-kaf-danger/80 font-medium transition-colors"
                          >
                            Stornieren
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Order History */}
            {myOrderHistory.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-kaf-text-secondary uppercase tracking-wider mb-3">Verlauf</h3>
                <div className="space-y-2">
                  {myOrderHistory.slice(0, 20).map(order => (
                    <div key={order.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-kaf-surface-hover/50">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{CATEGORY_ICONS[order.category]}</span>
                        <span className="text-sm">{order.drinkName}</span>
                        <span className="text-xs text-kaf-text-tertiary">
                          {order.quantity}× {UNIT_LABELS[order.unit as keyof typeof UNIT_LABELS]}
                        </span>
                      </div>
                      <StatusBadge status={order.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Cart Button */}
      {cart.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-lg px-4">
          <button
            onClick={() => setShowCart(true)}
            className="w-full py-4 px-6 rounded-2xl bg-kaf-accent text-white font-semibold text-base shadow-kaf-xl hover:bg-kaf-accent-hover active:scale-[0.98] transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
                {cartCount}
              </div>
              <span>Warenkorb anzeigen</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm opacity-80">
              <span>{cart.length} {cart.length === 1 ? 'Artikel' : 'Artikel'}</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </button>
        </div>
      )}

      {/* Order Modal */}
      {selectedDrink && (
        <OrderModal
          drink={selectedDrink}
          onClose={() => setSelectedDrink(null)}
          onAddToCart={addToCart}
        />
      )}

      {/* Cart Sheet */}
      {showCart && (
        <CartSheet
          cart={cart}
          onClose={() => setShowCart(false)}
          onRemove={removeFromCart}
          onUpdateQty={updateCartQty}
          onSend={sendBatchOrder}
          sending={sending}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl bg-kaf-text text-kaf-bg text-sm font-medium shadow-kaf-xl animate-slide-up">
          {toast}
        </div>
      )}
    </div>
  );
}

export default function BarPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh flex items-center justify-center text-kaf-text-secondary">Laden...</div>}>
      <BarPageInner />
    </Suspense>
  );
}
