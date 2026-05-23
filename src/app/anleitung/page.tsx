'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function AnleitungPage() {
  const [appUrl, setAppUrl] = useState('');

  useEffect(() => {
    setAppUrl(window.location.origin);
    // Force light theme for the print sheet
    document.documentElement.classList.remove('dark');
  }, []);

  return (
    <>
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 0;
        }
        @media print {
          html, body {
            background: #FAF9F6 !important;
          }
          .no-print { display: none !important; }
          .sheet {
            box-shadow: none !important;
            margin: 0 !important;
          }
        }
        body { background: #2a2a2a; }
      `}</style>

      {/* Print controls (hidden on print) */}
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 rounded-xl bg-[#B07D2E] text-white text-sm font-semibold shadow-lg hover:bg-[#966A24] transition-all"
        >
          Drucken
        </button>
        <a
          href="/"
          className="px-4 py-2 rounded-xl bg-white border border-[#E5E2DC] text-sm font-medium text-[#5C5C5C] shadow-lg"
        >
          Zurück
        </a>
      </div>

      {/* A4 Sheet */}
      <div className="flex justify-center py-8 print:py-0">
        <div
          className="sheet relative bg-[#FAF9F6] text-[#1A1A1A] shadow-2xl print:shadow-none"
          style={{
            width: '210mm',
            minHeight: '297mm',
            padding: '14mm 14mm 12mm',
            fontFamily: "'Inter', system-ui, sans-serif",
            overflow: 'hidden',
          }}
        >
          {/* Decorative corner accent */}
          <div
            className="absolute top-0 right-0"
            style={{
              width: '70mm',
              height: '70mm',
              background: 'radial-gradient(circle at top right, rgba(176,125,46,0.18), transparent 70%)',
              pointerEvents: 'none',
            }}
          />
          <div
            className="absolute bottom-0 left-0"
            style={{
              width: '60mm',
              height: '60mm',
              background: 'radial-gradient(circle at bottom left, rgba(176,125,46,0.10), transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          {/* ─── Header ────────────────────────── */}
          <header className="relative flex items-center justify-between" style={{ marginBottom: '8mm' }}>
            {/* Logo */}
            <div className="border-2 border-[#1A1A1A]" style={{ padding: '3mm 5mm' }}>
              <div className="flex items-baseline gap-1">
                <span className="font-extrabold tracking-tight" style={{ fontSize: '22pt', lineHeight: 1 }}>
                  KLEIN
                </span>
                <span
                  className="italic"
                  style={{ fontFamily: "'Instrument Serif', serif", fontSize: '14pt', margin: '0 -1mm' }}
                >
                  aber
                </span>
                <span className="font-light" style={{ fontSize: '22pt', letterSpacing: '0.15em', lineHeight: 1 }}>
                  FEIN
                </span>
              </div>
              <div
                className="text-right text-[#5C5C5C]"
                style={{ fontSize: '6pt', letterSpacing: '0.25em', marginTop: '1mm' }}
              >
                Das Kreativ-Kollektiv
              </div>
            </div>

            {/* Tagline */}
            <div className="text-right">
              <div
                className="italic text-[#1A1A1A]"
                style={{ fontFamily: "'Instrument Serif', serif", fontSize: '20pt', lineHeight: 1.1 }}
              >
                Getränke-Service
              </div>
              <div
                className="font-bold text-[#B07D2E] uppercase"
                style={{ fontSize: '8pt', letterSpacing: '0.3em', marginTop: '1mm' }}
              >
                App-Anleitung · Lager
              </div>
            </div>
          </header>

          {/* ─── Hero: QR + Headline ────────────── */}
          <section
            className="relative flex items-center gap-6 rounded-2xl"
            style={{
              background: '#FFFFFF',
              border: '1px solid #E5E2DC',
              padding: '6mm',
              marginBottom: '8mm',
            }}
          >
            {/* QR */}
            <div className="shrink-0 bg-white rounded-xl" style={{ padding: '3mm', border: '1px solid #EDEAE3' }}>
              {appUrl && <QRCodeSVG value={appUrl} size={130} level="M" includeMargin={false} />}
            </div>

            <div className="flex-1">
              <div
                className="font-bold uppercase text-[#B07D2E]"
                style={{ fontSize: '7pt', letterSpacing: '0.3em', marginBottom: '2mm' }}
              >
                Schritt 0 — Scanne mich
              </div>
              <h1
                className="italic"
                style={{ fontFamily: "'Instrument Serif', serif", fontSize: '28pt', lineHeight: 1, marginBottom: '2mm' }}
              >
                In 60 Sekunden bereit.
              </h1>
              <p className="text-[#5C5C5C]" style={{ fontSize: '9pt', lineHeight: 1.45, marginBottom: '3mm' }}>
                Scanne den Code mit deiner Handy-Kamera, folge den Schritten unten — und du bekommst jede
                Bestellung direkt als Benachrichtigung aufs Handy.
              </p>
              <div
                className="inline-block font-mono"
                style={{
                  fontSize: '8pt',
                  background: '#F5F3EE',
                  padding: '1.5mm 3mm',
                  borderRadius: '4mm',
                  color: '#1A1A1A',
                }}
              >
                {appUrl || '…'}
              </div>
            </div>
          </section>

          {/* ─── Two-Column Steps ───────────────── */}
          <section className="grid grid-cols-2" style={{ gap: '6mm', marginBottom: '6mm' }}>
            {/* iPhone */}
            <PlatformCard
              emoji="🍎"
              label="iPhone"
              accent="#1A1A1A"
              steps={[
                { t: 'Vorbereitung', d: 'Benachrichtigungen an, Handy auf laut.' },
                { t: 'Safari öffnen', d: 'Die Seite in Safari öffnen (nur Safari!).' },
                { t: 'Drei Punkte', d: 'Auf die drei Punkte (…) in der Adresszeile tippen.' },
                { t: 'Teilen / Share', d: 'Auf „Teilen" bzw. „Share" tippen.' },
                { t: 'Mehr anzeigen', d: 'Auf „View more / Mehr anzeigen" tippen.' },
                { t: 'Zum Startbildschirm', d: '„Zum Startbildschirm hinzufügen" wählen.' },
                { t: 'Namen eingeben', d: 'App öffnen, deinen Namen eintragen.' },
                { t: 'Lager wählen', d: 'Auf „Lager" tippen.' },
                { t: 'Benachrichtigungen zulassen', d: 'Unbedingt erlauben!' },
                { t: 'Hintergrund', d: 'App im Hintergrund geöffnet lassen.' },
              ]}
            />

            {/* Android */}
            <PlatformCard
              emoji="🤖"
              label="Android"
              accent="#B07D2E"
              steps={[
                { t: 'Vorbereitung', d: 'Benachrichtigungen für Browser an, Handy auf laut.' },
                { t: 'Chrome öffnen', d: 'Die Seite in Google Chrome öffnen.' },
                { t: 'Drei Punkte', d: 'Oben rechts auf die drei Punkte (⋮) tippen.' },
                { t: 'Zum Startbildschirm', d: '„Zum Startbildschirm hinzufügen" wählen.' },
                { t: 'Namen eingeben', d: 'App öffnen, deinen Namen eintragen.' },
                { t: 'Lager wählen', d: 'Auf „Lager" tippen.' },
                { t: 'Glocke aktivieren', d: 'Oben rechts auf die 🔔 tippen und aktivieren.' },
                { t: 'Hintergrund', d: 'App im Hintergrund geöffnet lassen.' },
              ]}
            />
          </section>

          {/* ─── Footer Notice ──────────────────── */}
          <section
            className="rounded-xl flex items-start gap-3"
            style={{
              background: 'rgba(192, 139, 29, 0.10)',
              border: '1px solid rgba(192, 139, 29, 0.30)',
              padding: '4mm 5mm',
            }}
          >
            <div style={{ fontSize: '14pt', lineHeight: 1 }}>⚠️</div>
            <div>
              <div className="font-semibold" style={{ fontSize: '9pt', marginBottom: '0.5mm' }}>
                Bitte beachten
              </div>
              <p className="text-[#1A1A1A]" style={{ fontSize: '8.5pt', lineHeight: 1.45 }}>
                Bei schlechtem Internet kommen Benachrichtigungen manchmal nicht durch.
                <strong> Bitte ab und zu die App checken und nach unten ziehen zum Aktualisieren.</strong> Danke!
              </p>
            </div>
          </section>

          {/* ─── Bottom signature ───────────────── */}
          <div
            className="absolute left-0 right-0 flex items-center justify-between px-[14mm]"
            style={{ bottom: '7mm', color: '#999999', fontSize: '7pt', letterSpacing: '0.15em' }}
          >
            <span className="uppercase">Klein aber Fein · {new Date().getFullYear()}</span>
            <span className="uppercase">Getränke-Service · Beta</span>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Platform Card ─────────────────────────────────────────
function PlatformCard({
  emoji,
  label,
  accent,
  steps,
}: {
  emoji: string;
  label: string;
  accent: string;
  steps: { t: string; d: string }[];
}) {
  return (
    <div
      className="rounded-2xl bg-white relative overflow-hidden"
      style={{ border: '1px solid #E5E2DC', padding: '5mm 5mm 4mm' }}
    >
      {/* Platform header */}
      <div className="flex items-center gap-2" style={{ marginBottom: '4mm' }}>
        <div
          className="flex items-center justify-center rounded-full"
          style={{
            width: '9mm',
            height: '9mm',
            background: accent,
            color: 'white',
            fontSize: '13pt',
          }}
        >
          {emoji}
        </div>
        <div>
          <div
            className="font-bold uppercase text-[#999999]"
            style={{ fontSize: '6.5pt', letterSpacing: '0.25em', lineHeight: 1 }}
          >
            Anleitung für
          </div>
          <div className="font-bold" style={{ fontSize: '14pt', lineHeight: 1.1, color: accent }}>
            {label}
          </div>
        </div>
      </div>

      {/* Steps */}
      <ol className="space-y-0" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2.5" style={{ padding: '1.4mm 0', borderTop: i === 0 ? 'none' : '1px solid #F0EDE8' }}>
            <div
              className="shrink-0 flex items-center justify-center rounded-full font-bold"
              style={{
                width: '5.5mm',
                height: '5.5mm',
                background: accent,
                color: 'white',
                fontSize: '7.5pt',
                marginTop: '0.3mm',
              }}
            >
              {i + 1}
            </div>
            <div className="flex-1" style={{ paddingTop: '0.2mm' }}>
              <div className="font-semibold" style={{ fontSize: '8.5pt', lineHeight: 1.25 }}>
                {s.t}
              </div>
              <div className="text-[#5C5C5C]" style={{ fontSize: '7.8pt', lineHeight: 1.35 }}>
                {s.d}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
