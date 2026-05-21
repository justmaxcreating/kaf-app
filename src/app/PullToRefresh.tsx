'use client';

import { useEffect, useRef, useState } from 'react';

const THRESHOLD = 80;
const MAX = 140;

// Force-refresh — clears all SW caches and reloads so the user picks up
// the latest deploy without reinstalling the PWA.
async function hardRefresh() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.update().catch(() => {})));
    }
  } catch {}
  window.location.reload();
}

export default function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullRef = useRef(0);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      // Only start gesture at top of page, single finger
      if (window.scrollY > 0) return;
      if (e.touches.length !== 1) return;
      startYRef.current = e.touches[0].clientY;
      pullingRef.current = true;
    };

    const onMove = (e: TouchEvent) => {
      if (!pullingRef.current) return;
      if (window.scrollY > 0) {
        pullingRef.current = false;
        pullRef.current = 0;
        setPull(0);
        return;
      }
      const delta = e.touches[0].clientY - startYRef.current;
      if (delta <= 0) {
        if (pullRef.current !== 0) { pullRef.current = 0; setPull(0); }
        return;
      }
      // Dampened pull
      const dampened = Math.min(MAX, delta * 0.5);
      pullRef.current = dampened;
      setPull(dampened);
      // Prevent iOS rubber-band only while we're actively pulling
      if (delta > 8 && e.cancelable) e.preventDefault();
    };

    const onEnd = () => {
      if (!pullingRef.current) return;
      pullingRef.current = false;
      if (pullRef.current >= THRESHOLD) {
        setRefreshing(true);
        hardRefresh();
      } else {
        pullRef.current = 0;
        setPull(0);
      }
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  const visible = pull > 0 || refreshing;
  const triggered = pull >= THRESHOLD || refreshing;
  const height = refreshing ? 60 : Math.min(80, pull);

  if (!visible) return null;

  return (
    <div
      aria-hidden={!visible}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: `${height}px`,
        overflow: 'hidden',
        zIndex: 60,
        pointerEvents: 'none',
        transition: refreshing ? 'height 0.2s ease-out' : 'none',
        background: 'var(--c-bg, #18120c)',
        borderBottom: '1px solid var(--c-border, rgba(255,255,255,0.08))',
      }}
    >
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          color: 'var(--c-text-secondary, #b8a690)',
          fontSize: '13px',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            transform: `rotate(${triggered ? 180 : 0}deg)`,
            transition: 'transform 0.2s',
            fontSize: '16px',
          }}
        >
          {refreshing ? '⟳' : '↓'}
        </span>
        <span className={refreshing ? 'animate-pulse' : ''}>
          {refreshing
            ? 'Aktualisiere…'
            : triggered
              ? 'Loslassen zum Aktualisieren'
              : 'Weiter ziehen zum Aktualisieren'}
        </span>
      </div>
    </div>
  );
}
