'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('kaf-theme', next ? 'dark' : 'light');
  };

  return (
    <button
      onClick={toggle}
      className="fixed top-5 right-5 z-50 w-11 h-11 rounded-xl bg-kaf-surface border border-kaf-border shadow-kaf flex items-center justify-center text-lg transition-all hover:shadow-kaf-lg active:scale-95"
      aria-label="Theme wechseln"
    >
      {dark ? '☀️' : '🌙'}
    </button>
  );
}

function Logo() {
  return (
    <div className="flex flex-col items-center">
      <div className="relative border-2 border-kaf-text px-6 py-3 sm:px-8 sm:py-4">
        <span className="absolute -top-2.5 -right-2.5 px-2 py-0.5 rounded-full bg-kaf-accent text-white text-[10px] font-bold tracking-widest uppercase shadow-kaf">
          Beta
        </span>
        <div className="flex items-baseline gap-1 sm:gap-2">
          <span className="text-3xl sm:text-5xl font-extrabold tracking-tight">KLEIN</span>
          <span className="font-serif italic text-xl sm:text-3xl -mx-1">aber</span>
          <span className="text-3xl sm:text-5xl font-light tracking-[0.15em]">FEIN</span>
        </div>
        <div className="text-[10px] sm:text-xs tracking-[0.2em] text-right mt-0.5 text-kaf-text-secondary">
          Das Kreativ-Kollektiv
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [appUrl, setAppUrl] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('kaf-name');
    if (saved) setName(saved);

    // Set current URL for QR code
    setAppUrl(window.location.origin);

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  const enter = (role: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Bitte gib deinen Namen ein');
      return;
    }
    localStorage.setItem('kaf-name', trimmed);
    localStorage.setItem('kaf-role', role);

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    router.push(`/${role}?name=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6 sm:p-8">
      <ThemeToggle />

      <div className="w-full max-w-sm flex flex-col items-center gap-10">
        {/* Logo */}
        <Logo />

        {/* Subtitle */}
        <div className="text-center">
          <h1 className="font-serif italic text-2xl sm:text-3xl text-kaf-text">
            Getränke-Service
          </h1>
          <p className="text-sm text-kaf-text-secondary mt-2">
            Wähle deine Rolle für den heutigen Abend
          </p>
        </div>

        {/* Name Input */}
        <div className="w-full">
          <label className="text-xs font-medium text-kaf-text-secondary uppercase tracking-wider mb-2 block">
            Dein Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            placeholder="z.B. Max"
            className="w-full px-4 py-3.5 rounded-xl bg-kaf-surface border border-kaf-border text-kaf-text placeholder:text-kaf-text-tertiary focus:outline-none focus:ring-2 focus:ring-kaf-accent/30 focus:border-kaf-accent transition-all text-base"
            onKeyDown={(e) => e.key === 'Enter' && name.trim() && enter('bar')}
          />
          {error && (
            <p className="text-sm text-kaf-danger mt-2 animate-fade-in">{error}</p>
          )}
        </div>

        {/* Role Cards */}
        <div className="w-full grid grid-cols-2 gap-3">
          <button
            onClick={() => enter('bar')}
            className="group relative flex flex-col items-center gap-3 p-6 rounded-2xl bg-kaf-surface border border-kaf-border hover:border-kaf-accent hover:shadow-kaf-lg transition-all active:scale-[0.97]"
          >
            <div className="text-4xl">🍺</div>
            <div>
              <div className="font-semibold text-base">Bar</div>
              <div className="text-xs text-kaf-text-secondary mt-0.5">Getränke bestellen</div>
            </div>
            <div className="absolute inset-0 rounded-2xl bg-kaf-accent/0 group-hover:bg-kaf-accent-bg transition-colors" />
          </button>

          <button
            onClick={() => enter('lager')}
            className="group relative flex flex-col items-center gap-3 p-6 rounded-2xl bg-kaf-surface border border-kaf-border hover:border-kaf-accent hover:shadow-kaf-lg transition-all active:scale-[0.97]"
          >
            <div className="text-4xl">📦</div>
            <div>
              <div className="font-semibold text-base">Lager</div>
              <div className="text-xs text-kaf-text-secondary mt-0.5">Bestellungen liefern</div>
            </div>
            <div className="absolute inset-0 rounded-2xl bg-kaf-accent/0 group-hover:bg-kaf-accent-bg transition-colors" />
          </button>
        </div>

        {/* Install Guide */}
        <button
          onClick={() => router.push('/install')}
          className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl bg-kaf-surface border border-kaf-border hover:border-kaf-accent/40 hover:shadow-kaf transition-all"
        >
          <span className="text-2xl">📲</span>
          <div className="text-left">
            <div className="font-medium text-sm">App installieren</div>
            <div className="text-xs text-kaf-text-secondary">Auf dem Homescreen speichern & Benachrichtigungen aktivieren</div>
          </div>
          <svg className="w-4 h-4 ml-auto text-kaf-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>

        {/* QR Code */}
        <button
          onClick={() => setShowQR(true)}
          className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl bg-kaf-surface border border-kaf-border hover:border-kaf-accent/40 hover:shadow-kaf transition-all"
        >
          <span className="text-2xl">📷</span>
          <div className="text-left">
            <div className="font-medium text-sm">QR-Code teilen</div>
            <div className="text-xs text-kaf-text-secondary">Andere Geräte können den Code scannen</div>
          </div>
          <svg className="w-4 h-4 ml-auto text-kaf-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>

        {/* Admin Link */}
        <button
          onClick={() => enter('admin')}
          className="flex items-center gap-2 text-sm text-kaf-text-secondary hover:text-kaf-accent transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
          Verwaltung
        </button>

        {/* Version */}
        <p className="text-[10px] text-kaf-text-tertiary text-center">
          KAF Getränke-Service · Beta
          <br />
          <span className="text-kaf-text-tertiary/70">Noch im Test — Fehler bitte melden 🙏</span>
        </p>
      </div>

      {/* QR Code Modal */}
      {showQR && appUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 glass" onClick={() => setShowQR(false)} />
          <div className="relative w-full max-w-sm mx-4 bg-kaf-surface rounded-3xl p-8 animate-slide-up shadow-kaf-xl border border-kaf-border">
            <button
              onClick={() => setShowQR(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-kaf-surface-hover text-kaf-text-secondary"
            >
              ✕
            </button>

            <div className="text-center mb-6">
              <h3 className="text-xl font-bold">QR-Code</h3>
              <p className="text-sm text-kaf-text-secondary mt-1">
                Scannen um die App zu öffnen
              </p>
            </div>

            <div className="flex justify-center mb-6">
              <div className="bg-white p-4 rounded-2xl">
                <QRCodeSVG
                  value={appUrl}
                  size={200}
                  level="M"
                  includeMargin={false}
                />
              </div>
            </div>

            <div className="text-center">
              <p className="text-xs text-kaf-text-tertiary font-mono bg-kaf-surface-hover px-3 py-2 rounded-lg break-all">
                {appUrl}
              </p>
              <p className="text-[10px] text-kaf-text-tertiary mt-3">
                Alle Geräte müssen im gleichen Netzwerk sein
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
