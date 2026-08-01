'use client';

import { useEffect, useRef } from 'react';

const PRICES = [318, 375, 480, 540, 690, 810, 940, 1230, 1560, 2050, 2480];

function tokenColor(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#2563eb';
}

interface Plane {
  id: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  start: number;
  dur: number;
  price: number;
  angle: number;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export default function RadarEmptyState() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = window.devicePixelRatio || 1;
    let planes: Plane[] = [];
    let nextId = 0;
    let lastSpawn = 0;
    let rafId = 0;
    const spawnEvery = 1500;
    const maxPlanes = 5;

    function box() {
      return canvas!.getBoundingClientRect();
    }

    function resize() {
      const rect = box();
      canvas!.width = rect.width * dpr;
      canvas!.height = rect.height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    function spawnPlane(now: number) {
      const rect = box();
      const w = rect.width;
      const h = rect.height;
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(w, h) / 2;
      const entryAngle = Math.random() * Math.PI * 2;
      const spawnR = R + 22;
      const x0 = cx + Math.cos(entryAngle) * spawnR;
      const y0 = cy + Math.sin(entryAngle) * spawnR;
      const jitter = (Math.random() - 0.5) * 1.3;
      const exitAngle = entryAngle + Math.PI + jitter;
      const exitR = R + 36;
      const x1 = cx + Math.cos(exitAngle) * exitR;
      const y1 = cy + Math.sin(exitAngle) * exitR;
      const dx = x1 - x0;
      const dy = y1 - y0;
      const dist = Math.hypot(dx, dy);
      const speed = 9 + Math.random() * 6;
      const dur = (dist / speed) * 1000;
      planes.push({
        id: nextId++,
        x0,
        y0,
        x1,
        y1,
        start: now,
        dur,
        price: PRICES[Math.floor(Math.random() * PRICES.length)],
        angle: Math.atan2(dy, dx),
      });
    }

    function bestId() {
      if (!planes.length) return null;
      return planes.reduce((a, b) => (b.price < a.price ? b : a)).id;
    }

    function drawPlaneShape(scale: number) {
      const pts: [number, number][] = [
        [10, 0], [3, 1.1], [1, 8], [-3.5, 1.6],
        [-8, 3.2], [-7, 0.8], [-10, 0], [-7, -0.8],
        [-8, -3.2], [-3.5, -1.6], [1, -8], [3, -1.1],
      ];
      ctx!.beginPath();
      pts.forEach(([px, py], i) => {
        const x = px * scale;
        const y = py * scale;
        if (i === 0) ctx!.moveTo(x, y);
        else ctx!.lineTo(x, y);
      });
      ctx!.closePath();
      ctx!.fill();
    }

    function drawPlane(x: number, y: number, angle: number, price: number, isBest: boolean, t: number) {
      const amber = tokenColor('--radar-amber');
      const teal = tokenColor('--radar-teal');
      const ink = tokenColor('--radar-ink');
      const card = tokenColor('--radar-card');
      const line = tokenColor('--radar-line');
      const blinkAlpha = 0.5 + Math.sin(t / 170) * 0.5;

      ctx!.save();
      ctx!.translate(x, y);
      ctx!.rotate(angle);
      ctx!.globalAlpha = isBest ? Math.max(0.25, blinkAlpha) : 0.95;
      ctx!.fillStyle = isBest ? teal : amber;
      drawPlaneShape(0.85);
      if (isBest) {
        ctx!.beginPath();
        ctx!.arc(0, 0, 9 + blinkAlpha * 3, 0, Math.PI * 2);
        ctx!.strokeStyle = teal;
        ctx!.globalAlpha = blinkAlpha * 0.5;
        ctx!.lineWidth = 1;
        ctx!.stroke();
      }
      ctx!.restore();

      const label = 'R$ ' + price.toLocaleString('pt-BR');
      ctx!.save();
      ctx!.font = (isBest ? '700 9.5px ' : '600 9px ') + 'ui-monospace, monospace';
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'middle';
      const tw = ctx!.measureText(label).width;
      const boxW = tw + 8;
      const boxH = 13;
      const bx = x - boxW / 2;
      const by = y + 9;
      ctx!.globalAlpha = isBest ? Math.max(0.55, blinkAlpha) : 0.92;
      ctx!.fillStyle = card;
      ctx!.strokeStyle = isBest ? teal : line;
      ctx!.lineWidth = isBest ? 1.4 : 1;
      roundRect(ctx!, bx, by, boxW, boxH, 3.5);
      ctx!.fill();
      ctx!.stroke();
      ctx!.fillStyle = isBest ? teal : ink;
      ctx!.fillText(label, x, by + boxH / 2 + 0.5);
      ctx!.restore();
    }

    function frame(t: number) {
      const rect = box();
      ctx!.clearRect(0, 0, rect.width, rect.height);

      if (t - lastSpawn > spawnEvery && planes.length < maxPlanes) {
        spawnPlane(t);
        lastSpawn = t;
      }
      planes = planes.filter((p) => t - p.start < p.dur);
      const best = bestId();

      for (const p of planes) {
        const progress = (t - p.start) / p.dur;
        const x = p.x0 + (p.x1 - p.x0) * progress;
        const y = p.y0 + (p.y1 - p.y0) * progress;
        drawPlane(x, y, p.angle, p.price, p.id === best, t);
      }

      if (!reduceMotion) rafId = requestAnimationFrame(frame);
    }

    if (reduceMotion) {
      const t0 = performance.now();
      for (let i = 0; i < 4; i++) {
        spawnPlane(t0);
        planes[planes.length - 1].start = t0 - planes[planes.length - 1].dur * 0.4;
      }
      frame(t0);
    } else {
      rafId = requestAnimationFrame(frame);
    }

    return () => {
      window.removeEventListener('resize', resize);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-paper-card p-10 text-center">
      <style>{`
        :root {
          --radar-amber: var(--color-terracotta);
          --radar-teal: var(--color-teal);
          --radar-ink: var(--color-ink-muted);
          --radar-card: var(--color-paper-card);
          --radar-line: var(--color-border);
        }
      `}</style>
      <div className="relative mb-5" style={{ width: 220, height: 220 }}>
        <div
          className="absolute inset-0 rounded-full border border-border"
          style={{
            background:
              'radial-gradient(circle, transparent 0 30%, var(--color-border) 30% 30.6%, transparent 30.6%),' +
              'radial-gradient(circle, transparent 0 60%, var(--color-border) 60% 60.6%, transparent 60.6%),' +
              'radial-gradient(circle, transparent 0 84%, var(--color-border) 84% 84.6%, transparent 84.6%)',
          }}
        />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
      </div>
      <h3 className="font-serif text-base font-semibold">Nenhum voo no radar ainda</h3>
      <p className="mt-1 max-w-xs text-xs font-medium text-ink-muted">
        Já estamos vigiando o mercado. LATAM, GOL, Azul, Decolar e Skyscanner. Cadastre sua
        primeira rota no painel ao lado para começar a receber alertas.
      </p>
    </div>
  );
}
