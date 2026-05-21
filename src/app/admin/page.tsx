'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSocket } from '@/lib/socket';
import {
  Drink, Order, ConnectedUser, DrinkCategory,
  CATEGORY_LABELS, CATEGORY_ICONS, UNIT_LABELS, UNIT_LABELS_PLURAL,
} from '@/lib/types';

// ─── Add Drink Modal ──────────────────────────────────────
function AddDrinkModal({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (data: { name: string; category: DrinkCategory; units: string[]; bottlesPerCrate: number; inventory: number; minStock: number }) => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<DrinkCategory>('bier');
  const [hasKiste, setHasKiste] = useState(true);
  const [bottlesPerCrate, setBottlesPerCrate] = useState(20);
  const [inventory, setInventory] = useState(0);
  const [minStock, setMinStock] = useState(10);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 glass" onClick={onClose} />
      <div className="relative w-full max-w-md bg-kaf-surface rounded-t-3xl sm:rounded-3xl p-6 animate-slide-up safe-bottom shadow-kaf-xl border border-kaf-border max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold">Getränk hinzufügen</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-kaf-surface-hover text-kaf-text-secondary">✕</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-kaf-text-secondary uppercase tracking-wider mb-1.5 block">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="z.B. Augustiner Helles"
              className="w-full px-4 py-3 rounded-xl bg-kaf-surface-hover border border-kaf-border text-sm focus:outline-none focus:ring-2 focus:ring-kaf-accent/30"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-kaf-text-secondary uppercase tracking-wider mb-1.5 block">Kategorie</label>
            <div className="grid grid-cols-3 gap-2">
              {(['bier', 'schnaps', 'sonstiges'] as DrinkCategory[]).map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                    category === cat ? 'bg-kaf-accent text-white border-kaf-accent' : 'bg-kaf-surface border-kaf-border'
                  }`}
                >
                  {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasKiste}
                onChange={e => setHasKiste(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              Auch als Kiste bestellbar
            </label>
          </div>

          {hasKiste && (
            <div>
              <label className="text-xs font-medium text-kaf-text-secondary uppercase tracking-wider mb-1.5 block">Flaschen pro Kiste</label>
              <input
                type="number"
                value={bottlesPerCrate}
                onChange={e => setBottlesPerCrate(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-3 rounded-xl bg-kaf-surface-hover border border-kaf-border text-sm focus:outline-none focus:ring-2 focus:ring-kaf-accent/30"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-kaf-text-secondary uppercase tracking-wider mb-1.5 block">Anfangsbestand</label>
              <input
                type="number"
                value={inventory}
                onChange={e => setInventory(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-3 rounded-xl bg-kaf-surface-hover border border-kaf-border text-sm focus:outline-none focus:ring-2 focus:ring-kaf-accent/30"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-kaf-text-secondary uppercase tracking-wider mb-1.5 block">Mindestbestand</label>
              <input
                type="number"
                value={minStock}
                onChange={e => setMinStock(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-3 rounded-xl bg-kaf-surface-hover border border-kaf-border text-sm focus:outline-none focus:ring-2 focus:ring-kaf-accent/30"
              />
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            if (!name.trim()) return;
            onAdd({
              name: name.trim(),
              category,
              units: hasKiste ? ['flasche', 'kiste'] : ['flasche'],
              bottlesPerCrate: hasKiste ? bottlesPerCrate : 1,
              inventory,
              minStock,
            });
          }}
          disabled={!name.trim()}
          className="w-full mt-6 py-4 rounded-xl bg-kaf-accent text-white font-semibold text-sm hover:bg-kaf-accent-hover active:scale-[0.98] transition-all disabled:opacity-40"
        >
          Hinzufügen
        </button>
      </div>
    </div>
  );
}

// ─── Stats Section ────────────────────────────────────────
function StatsView({ stats }: { stats: any }) {
  if (!stats) return null;
  const drinkEntries = Object.entries(stats.byDrink || {}).sort((a: any, b: any) => b[1].bottles - a[1].bottles);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-kaf-surface rounded-xl border border-kaf-border p-4 text-center">
          <div className="text-2xl font-bold">{stats.totalOrders}</div>
          <div className="text-xs text-kaf-text-secondary mt-1">Gesamt</div>
        </div>
        <div className="bg-kaf-success-bg rounded-xl border border-kaf-success/20 p-4 text-center">
          <div className="text-2xl font-bold text-kaf-success">{stats.deliveredOrders}</div>
          <div className="text-xs text-kaf-text-secondary mt-1">Geliefert</div>
        </div>
        <div className="bg-kaf-warning-bg rounded-xl border border-kaf-warning/20 p-4 text-center">
          <div className="text-2xl font-bold text-kaf-warning">{stats.pendingOrders}</div>
          <div className="text-xs text-kaf-text-secondary mt-1">Offen</div>
        </div>
        <div className="bg-kaf-danger-bg rounded-xl border border-kaf-danger/20 p-4 text-center">
          <div className="text-2xl font-bold text-kaf-danger">{stats.cancelledOrders}</div>
          <div className="text-xs text-kaf-text-secondary mt-1">Storniert</div>
        </div>
      </div>

      {drinkEntries.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-kaf-text-secondary uppercase tracking-wider mb-3">Top Getränke</h4>
          <div className="space-y-2">
            {drinkEntries.map(([name, data]: [string, any]) => (
              <div key={name} className="flex items-center justify-between py-2 px-3 rounded-lg bg-kaf-surface border border-kaf-border">
                <span className="text-sm font-medium">{name}</span>
                <span className="text-xs text-kaf-text-secondary">{data.bottles} Flaschen</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Password Gate ────────────────────────────────────────
const ADMIN_PASSWORD = 'kaf2026';

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState(false);

  const submit = () => {
    if (pw === ADMIN_PASSWORD) {
      sessionStorage.setItem('kaf-admin-auth', 'true');
      onUnlock();
    } else {
      setError(true);
      setPw('');
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xs flex flex-col items-center gap-6">
        <div className="text-4xl">🔒</div>
        <div className="text-center">
          <h1 className="font-serif italic text-2xl">Verwaltung</h1>
          <p className="text-sm text-kaf-text-secondary mt-1">Passwort eingeben um fortzufahren</p>
        </div>
        <div className="w-full">
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Passwort"
            className={`w-full px-4 py-3.5 rounded-xl bg-kaf-surface border text-center text-base tracking-widest focus:outline-none focus:ring-2 focus:ring-kaf-accent/30 transition-all ${
              error ? 'border-kaf-danger shake' : 'border-kaf-border'
            }`}
            autoFocus
          />
          {error && <p className="text-xs text-kaf-danger text-center mt-2 animate-fade-in">Falsches Passwort</p>}
        </div>
        <button
          onClick={submit}
          className="w-full py-3.5 rounded-xl bg-kaf-accent text-white font-semibold hover:bg-kaf-accent-hover active:scale-[0.98] transition-all"
        >
          Anmelden
        </button>
      </div>
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────
function AdminPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const userName = params.get('name') || localStorage.getItem('kaf-name') || 'Admin';

  const [authed, setAuthed] = useState(false);
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [users, setUsers] = useState<ConnectedUser[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<'inventory' | 'stats' | 'settings'>('inventory');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDrink, setEditingDrink] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem('kaf-admin-auth') === 'true') setAuthed(true);
  }, []);

  useEffect(() => {
    if (!authed) return;
    const socket = getSocket();
    socketRef.current = socket;

    const fetchData = () => {
      setConnected(true);
      socket.emit('user:join', { name: userName, role: 'admin' });
      socket.emit('drinks:list', (d: Drink[]) => setDrinks(d));
      socket.emit('users:list', (u: ConnectedUser[]) => setUsers(u));
      socket.emit('stats:get', (s: any) => setStats(s));
    };

    if (socket.connected) fetchData();
    socket.on('connect', fetchData);

    socket.on('disconnect', () => setConnected(false));
    socket.on('drinks:updated', (d: Drink[]) => setDrinks(d));
    socket.on('users:updated', (u: ConnectedUser[]) => setUsers(u));

    const statsInterval = setInterval(() => {
      socket.emit('stats:get', (s: any) => setStats(s));
    }, 5000);

    return () => {
      clearInterval(statsInterval);
      socket.off('connect');
      socket.off('disconnect');
      socket.off('drinks:updated');
      socket.off('users:updated');
    };
  }, [userName, authed]);

  if (!authed) return <PasswordGate onUnlock={() => setAuthed(true)} />;

  const setInventory = (drinkId: string, quantity: number) => {
    socketRef.current?.emit('inventory:set', { drinkId, quantity: Math.max(0, quantity) });
  };

  const confirmEdit = (drinkId: string) => {
    const val = parseInt(editValue);
    if (!isNaN(val)) setInventory(drinkId, val);
    setEditingDrink(null);
    setEditValue('');
  };

  const addDrink = (data: any) => {
    socketRef.current?.emit('drink:add', data, (res: any) => {
      if (res.ok) showToast('Getränk hinzugefügt');
      setShowAddModal(false);
    });
  };

  const removeDrink = (drinkId: string, name: string) => {
    if (!confirm(`"${name}" wirklich entfernen?`)) return;
    socketRef.current?.emit('drink:remove', { drinkId }, (res: any) => {
      if (res.ok) showToast('Getränk entfernt');
    });
  };

  const clearDelivered = () => {
    if (!confirm('Alle gelieferten und stornierten Bestellungen löschen?')) return;
    socketRef.current?.emit('orders:clear-delivered', (res: any) => {
      if (res.ok) showToast('Verlauf bereinigt');
    });
  };

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('kaf-theme', isDark ? 'dark' : 'light');
  };

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
            <div className="text-[10px] text-kaf-text-secondary">Verwaltung · {userName}</div>
          </div>
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-kaf-success' : 'bg-kaf-danger'}`} />
        </div>
      </header>

      {/* Tabs */}
      <div className="sticky top-[57px] z-30 bg-kaf-bg border-b border-kaf-border">
        <div className="flex max-w-lg mx-auto">
          {(['inventory', 'stats', 'settings'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium text-center transition-colors relative ${
                activeTab === tab ? 'text-kaf-accent' : 'text-kaf-text-secondary'
              }`}
            >
              {{ inventory: 'Inventar', stats: 'Statistik', settings: 'Einstellungen' }[tab]}
              {activeTab === tab && <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-kaf-accent rounded-full" />}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 pb-8">
        {/* ── Inventory Tab ── */}
        {activeTab === 'inventory' && (
          <div className="animate-fade-in py-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif italic text-xl">Bestand verwalten</h2>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 rounded-xl bg-kaf-accent text-white text-xs font-semibold hover:bg-kaf-accent-hover active:scale-95 transition-all"
              >
                + Getränk
              </button>
            </div>

            <p className="text-xs text-kaf-text-secondary mb-4">
              Tippe auf die Zahl um den Bestand direkt zu ändern. Werte werden in Flaschen angegeben.
            </p>

            {(['bier', 'schnaps', 'sonstiges'] as DrinkCategory[]).map(cat => {
              const catDrinks = drinks.filter(d => d.category === cat);
              if (!catDrinks.length) return null;
              return (
                <div key={cat} className="mb-6">
                  <h3 className="text-xs font-medium text-kaf-text-secondary uppercase tracking-wider mb-2">
                    {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
                  </h3>
                  <div className="space-y-2">
                    {catDrinks.map(drink => (
                      <div key={drink.id} className="flex items-center gap-3 p-3 rounded-xl bg-kaf-surface border border-kaf-border">
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-sm">{drink.name}</span>
                          {drink.units.includes('kiste') && (
                            <span className="text-[10px] text-kaf-text-tertiary ml-2">
                              ({drink.bottlesPerCrate}/Kiste)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setInventory(drink.id, Math.max(0, drink.inventory - 1))}
                            className="w-8 h-8 rounded-lg bg-kaf-surface-hover border border-kaf-border text-sm flex items-center justify-center hover:bg-kaf-surface-active active:scale-95"
                          >
                            −
                          </button>
                          {editingDrink === drink.id ? (
                            <input
                              type="number"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={() => confirmEdit(drink.id)}
                              onKeyDown={e => e.key === 'Enter' && confirmEdit(drink.id)}
                              className="w-16 text-center py-1 rounded-lg border border-kaf-accent bg-kaf-surface text-sm font-mono font-bold focus:outline-none"
                              autoFocus
                            />
                          ) : (
                            <button
                              onClick={() => { setEditingDrink(drink.id); setEditValue(String(drink.inventory)); }}
                              className={`w-16 text-center py-1 rounded-lg text-sm font-mono font-bold ${
                                drink.inventory === 0 ? 'text-kaf-danger' :
                                drink.inventory <= drink.minStock ? 'text-kaf-warning' :
                                'text-kaf-text'
                              }`}
                            >
                              {drink.inventory}
                            </button>
                          )}
                          <button
                            onClick={() => setInventory(drink.id, drink.inventory + 1)}
                            className="w-8 h-8 rounded-lg bg-kaf-surface-hover border border-kaf-border text-sm flex items-center justify-center hover:bg-kaf-surface-active active:scale-95"
                          >
                            +
                          </button>
                          <button
                            onClick={() => removeDrink(drink.id, drink.name)}
                            className="w-8 h-8 rounded-lg text-kaf-danger/60 hover:text-kaf-danger hover:bg-kaf-danger-bg text-sm flex items-center justify-center transition-colors"
                            title="Entfernen"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Quick set */}
            <div className="mt-6 p-4 rounded-xl bg-kaf-surface-hover border border-kaf-border">
              <h4 className="text-xs font-medium text-kaf-text-secondary uppercase tracking-wider mb-3">Schnell-Aktionen</h4>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    if (!confirm('Alle Bestände auf Beispielwerte setzen (20-100)?')) return;
                    drinks.forEach(d => {
                      const val = d.category === 'schnaps' ? 10 : d.category === 'bier' ? 48 : 24;
                      setInventory(d.id, val);
                    });
                    showToast('Beispielbestand gesetzt');
                  }}
                  className="px-3 py-2.5 rounded-xl bg-kaf-surface border border-kaf-border text-xs font-medium hover:bg-kaf-surface-active transition-all"
                >
                  Beispielbestand laden
                </button>
                <button
                  onClick={() => {
                    if (!confirm('ALLE Bestände auf 0 setzen?')) return;
                    drinks.forEach(d => setInventory(d.id, 0));
                    showToast('Alle Bestände zurückgesetzt');
                  }}
                  className="px-3 py-2.5 rounded-xl bg-kaf-danger-bg border border-kaf-danger/20 text-xs font-medium text-kaf-danger hover:opacity-80 transition-all"
                >
                  Alles zurücksetzen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Stats Tab ── */}
        {activeTab === 'stats' && (
          <div className="animate-fade-in py-4">
            <h2 className="font-serif italic text-xl mb-4">Statistiken</h2>
            <StatsView stats={stats} />

            {/* Connected Users */}
            <div className="mt-6">
              <h4 className="text-xs font-medium text-kaf-text-secondary uppercase tracking-wider mb-3">Verbundene Nutzer</h4>
              {users.length === 0 ? (
                <p className="text-sm text-kaf-text-tertiary">Keine Nutzer verbunden</p>
              ) : (
                <div className="space-y-2">
                  {users.map(user => (
                    <div key={user.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-kaf-surface border border-kaf-border">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-kaf-success" />
                        <span className="text-sm font-medium">{user.name}</span>
                      </div>
                      <span className="text-xs text-kaf-text-secondary capitalize px-2 py-0.5 rounded-full bg-kaf-surface-hover">
                        {user.role}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Settings Tab ── */}
        {activeTab === 'settings' && (
          <div className="animate-fade-in py-4">
            <h2 className="font-serif italic text-xl mb-4">Einstellungen</h2>

            <div className="space-y-3">
              <button
                onClick={toggleTheme}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-kaf-surface border border-kaf-border hover:bg-kaf-surface-hover transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">🎨</span>
                  <span className="text-sm font-medium">Dark Mode</span>
                </div>
                <div className="w-10 h-6 rounded-full bg-kaf-surface-hover border border-kaf-border flex items-center px-0.5 transition-all">
                  <div className={`w-5 h-5 rounded-full bg-kaf-accent transition-transform ${
                    typeof window !== 'undefined' && document.documentElement.classList.contains('dark') ? 'translate-x-4' : ''
                  }`} />
                </div>
              </button>

              <button
                onClick={clearDelivered}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-kaf-surface border border-kaf-border hover:bg-kaf-surface-hover transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">🗑️</span>
                  <div className="text-left">
                    <span className="text-sm font-medium block">Bestellverlauf bereinigen</span>
                    <span className="text-xs text-kaf-text-secondary">Gelieferte & stornierte Bestellungen entfernen</span>
                  </div>
                </div>
              </button>
            </div>

            {/* Deployment Info */}
            <div className="mt-8 p-4 rounded-xl bg-kaf-surface-hover border border-kaf-border">
              <h4 className="text-xs font-medium text-kaf-text-secondary uppercase tracking-wider mb-2">App-Info</h4>
              <div className="space-y-1 text-xs text-kaf-text-secondary">
                <p>KAF Getränke-Service v1.0</p>
                <p>Verbundene Nutzer: {users.length}</p>
                <p>Status: {connected ? '🟢 Verbunden' : '🔴 Getrennt'}</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Add Drink Modal */}
      {showAddModal && (
        <AddDrinkModal
          onClose={() => setShowAddModal(false)}
          onAdd={addDrink}
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

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh flex items-center justify-center text-kaf-text-secondary">Laden...</div>}>
      <AdminPageInner />
    </Suspense>
  );
}
