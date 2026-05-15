'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function InstallPage() {
  const router = useRouter();
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('android');
  const [notifPermission, setNotifPermission] = useState<string>('default');

  useEffect(() => {
    // Detect platform
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) setPlatform('ios');
    else if (/android/.test(ua)) setPlatform('android');
    else setPlatform('desktop');

    if ('Notification' in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  const requestNotifications = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
      if (perm === 'granted') {
        new Notification('KAF Benachrichtigungen aktiv! 🎉', {
          body: 'Du bekommst jetzt Benachrichtigungen für Bestellungen.',
          icon: '/icon-192.png',
        });
      }
    }
  };

  return (
    <div className="min-h-dvh bg-kaf-bg">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-kaf-bg/80 glass border-b border-kaf-border">
        <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
          <button onClick={() => router.push('/')} className="text-kaf-text-secondary hover:text-kaf-text transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="font-bold text-sm tracking-wide">Installation</div>
          <div className="w-5" />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-8">
        {/* Intro */}
        <div className="text-center">
          <div className="text-5xl mb-3">📲</div>
          <h1 className="font-serif italic text-2xl">App installieren</h1>
          <p className="text-sm text-kaf-text-secondary mt-2 max-w-xs mx-auto">
            Die KAF App läuft im Browser, kann aber wie eine echte App auf deinem Handy installiert werden.
          </p>
        </div>

        {/* Platform tabs */}
        <div className="flex gap-2 justify-center">
          {[
            { id: 'ios' as const, label: 'iPhone', icon: '🍎' },
            { id: 'android' as const, label: 'Android', icon: '🤖' },
            { id: 'desktop' as const, label: 'Desktop', icon: '💻' },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setPlatform(p.id)}
              className={`px-4 py-2 rounded-xl text-xs font-medium border transition-all ${
                platform === p.id
                  ? 'bg-kaf-accent text-white border-kaf-accent'
                  : 'bg-kaf-surface border-kaf-border text-kaf-text-secondary'
              }`}
            >
              {p.icon} {p.label}
            </button>
          ))}
        </div>

        {/* iOS Instructions */}
        {platform === 'ios' && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-kaf-surface rounded-2xl border border-kaf-border p-5">
              <h3 className="font-semibold mb-4">So geht&apos;s auf dem iPhone:</h3>
              <div className="space-y-5">
                <Step n={1} title="Safari öffnen">
                  Öffne diese Seite in <strong>Safari</strong> (nicht Chrome oder Firefox — nur Safari unterstützt die Installation auf iOS).
                </Step>
                <Step n={2} title="Teilen-Button antippen">
                  Tippe unten in Safari auf das <strong>Teilen-Symbol</strong> (das Quadrat mit dem Pfeil nach oben ⬆️).
                </Step>
                <Step n={3} title='„Zum Home-Bildschirm"'>
                  Scrolle in der Liste nach unten und tippe auf <strong>„Zum Home-Bildschirm"</strong>.
                </Step>
                <Step n={4} title="Fertig!">
                  Tippe auf <strong>„Hinzufügen"</strong>. Die App erscheint auf deinem Home-Bildschirm wie eine echte App — ohne Browser-Leiste!
                </Step>
              </div>
            </div>
            <div className="bg-kaf-warning-bg rounded-xl p-4 border border-kaf-warning/20">
              <p className="text-xs text-kaf-text-secondary">
                <strong className="text-kaf-warning">⚠️ Wichtig:</strong> Auf dem iPhone funktionieren Benachrichtigungen nur, wenn die App über Safari zum Home-Bildschirm hinzugefügt wurde.
              </p>
            </div>
          </div>
        )}

        {/* Android Instructions */}
        {platform === 'android' && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-kaf-surface rounded-2xl border border-kaf-border p-5">
              <h3 className="font-semibold mb-4">So geht&apos;s auf Android:</h3>
              <div className="space-y-5">
                <Step n={1} title="Chrome öffnen">
                  Öffne diese Seite in <strong>Google Chrome</strong>.
                </Step>
                <Step n={2} title="Menü öffnen">
                  Tippe oben rechts auf die <strong>drei Punkte</strong> (⋮).
                </Step>
                <Step n={3} title='„App installieren"'>
                  Tippe auf <strong>„App installieren"</strong> oder <strong>„Zum Startbildschirm hinzufügen"</strong>.
                </Step>
                <Step n={4} title="Bestätigen">
                  Tippe auf <strong>„Installieren"</strong>. Die App erscheint auf deinem Startbildschirm!
                </Step>
              </div>
            </div>
          </div>
        )}

        {/* Desktop Instructions */}
        {platform === 'desktop' && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-kaf-surface rounded-2xl border border-kaf-border p-5">
              <h3 className="font-semibold mb-4">So geht&apos;s am Computer:</h3>
              <div className="space-y-5">
                <Step n={1} title="Chrome oder Edge öffnen">
                  Öffne diese Seite in <strong>Chrome</strong> oder <strong>Edge</strong>.
                </Step>
                <Step n={2} title="Installieren">
                  Klicke in der Adressleiste auf das <strong>Installations-Symbol</strong> (📥) oder gehe ins Menü → <strong>„App installieren"</strong>.
                </Step>
                <Step n={3} title="Fertig!">
                  Die App öffnet sich in einem eigenen Fenster ohne Browser-Leiste.
                </Step>
              </div>
            </div>
          </div>
        )}

        {/* Notifications Section */}
        <div className="bg-kaf-surface rounded-2xl border border-kaf-border p-5">
          <h3 className="font-semibold mb-2">🔔 Benachrichtigungen</h3>
          <p className="text-sm text-kaf-text-secondary mb-4">
            Damit du mitbekommst, wenn neue Bestellungen reinkommen oder deine Bestellung fertig ist, brauchst du Benachrichtigungen.
          </p>

          {notifPermission === 'granted' ? (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-kaf-success-bg">
              <span className="text-lg">✅</span>
              <span className="text-sm font-medium text-kaf-success">Benachrichtigungen sind aktiviert!</span>
            </div>
          ) : notifPermission === 'denied' ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-kaf-danger-bg">
                <span className="text-lg">❌</span>
                <span className="text-sm font-medium text-kaf-danger">Benachrichtigungen wurden blockiert</span>
              </div>
              <p className="text-xs text-kaf-text-secondary">
                Gehe in deine Browser-Einstellungen und erlaube Benachrichtigungen für diese Seite.
              </p>
            </div>
          ) : (
            <button
              onClick={requestNotifications}
              className="w-full py-3.5 rounded-xl bg-kaf-accent text-white font-semibold text-sm hover:bg-kaf-accent-hover active:scale-[0.98] transition-all"
            >
              Benachrichtigungen aktivieren
            </button>
          )}
        </div>

        {/* Back button */}
        <button
          onClick={() => router.push('/')}
          className="w-full py-3 rounded-xl bg-kaf-surface border border-kaf-border text-sm font-medium text-kaf-text-secondary hover:bg-kaf-surface-hover transition-all"
        >
          ← Zurück zum Start
        </button>
      </main>
    </div>
  );
}

// ─── Step Component ───────────────────────────────────────
function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-7 h-7 rounded-full bg-kaf-accent text-white text-xs font-bold flex items-center justify-center mt-0.5">
        {n}
      </div>
      <div>
        <div className="font-medium text-sm">{title}</div>
        <p className="text-sm text-kaf-text-secondary mt-0.5">{children}</p>
      </div>
    </div>
  );
}
