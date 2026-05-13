"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ── Types ─────────────────────────────────────────────── */

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  mass: number;
}

interface Wall {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface Settings {
  gravity: number;
  speed: number;
  ballSize: number;
  restitution: number;
  collisions: boolean;
  maxBalls: number;
}

/* ── Palette ───────────────────────────────────────────── */

const COLORS = [
  "#10b981", "#34d399", "#6ee7b7", "#059669",
  "#14b8a6", "#2dd4bf", "#0d9488", "#a7f3d0",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* ── Physics helpers ───────────────────────────────────── */

function circleCircle(a: Ball, b: Ball): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx * dx + dy * dy < (a.r + b.r) * (a.r + b.r);
}

function resolveCollision(a: Ball, b: Ball, restitution: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return;

  const nx = dx / dist;
  const ny = dy / dist;

  // Separate overlap
  const overlap = (a.r + b.r - dist) / 2;
  a.x -= nx * overlap;
  a.y -= ny * overlap;
  b.x += nx * overlap;
  b.y += ny * overlap;

  // Relative velocity along normal
  const dvx = a.vx - b.vx;
  const dvy = a.vy - b.vy;
  const dvn = dvx * nx + dvy * ny;

  if (dvn <= 0) return; // Moving apart

  const totalMass = a.mass + b.mass;
  const impulse = (2 * dvn * restitution) / totalMass;

  a.vx -= impulse * b.mass * nx;
  a.vy -= impulse * b.mass * ny;
  b.vx += impulse * a.mass * nx;
  b.vy += impulse * a.mass * ny;
}

function circleLineCollision(
  ball: Ball,
  wall: Wall,
  restitution: number
) {
  const { x1, y1, x2, y2 } = wall;
  const ex = x2 - x1;
  const ey = y2 - y1;
  const len = Math.sqrt(ex * ex + ey * ey);
  if (len === 0) return;

  const ux = ex / len;
  const uy = ey / len;

  // Project ball center onto wall line
  const dx = ball.x - x1;
  const dy = ball.y - y1;
  let t = dx * ux + dy * uy;
  t = Math.max(0, Math.min(len, t));

  const closestX = x1 + ux * t;
  const closestY = y1 + uy * t;

  const distX = ball.x - closestX;
  const distY = ball.y - closestY;
  const dist = Math.sqrt(distX * distX + distY * distY);

  if (dist < ball.r && dist > 0) {
    const nx = distX / dist;
    const ny = distY / dist;

    // Push out
    ball.x = closestX + nx * ball.r;
    ball.y = closestY + ny * ball.r;

    // Reflect velocity
    const vn = ball.vx * nx + ball.vy * ny;
    if (vn < 0) {
      ball.vx -= 2 * vn * nx * restitution;
      ball.vy -= 2 * vn * ny * restitution;
    }
  }
}

/* ── Default settings ──────────────────────────────────── */

const DEFAULT_SETTINGS: Settings = {
  gravity: 500,
  speed: 1,
  ballSize: 14,
  restitution: 0.8,
  collisions: true,
  maxBalls: 100,
};

/* ── Component ─────────────────────────────────────────── */

export function SandboxGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ballsRef = useRef<Ball[]>([]);
  const wallsRef = useRef<Wall[]>([]);
  const settingsRef = useRef<Settings>({ ...DEFAULT_SETTINGS });
  const rafRef = useRef(0);

  const [menuOpen, setMenuOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS });
  const [mode, setMode] = useState<"ball" | "wall">("ball");
  const [ballCount, setBallCount] = useState(0);
  const [wallCount, setWallCount] = useState(0);

  // Drawing state
  const drawingRef = useRef<{ x: number; y: number } | null>(null);
  const modeRef = useRef(mode);
  const pointerDownRef = useRef(false);
  const spawnThrottleRef = useRef(0);

  // Keep refs in sync
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  /* ── Canvas setup + game loop ───────────────────────── */

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    canvas.width = parent.clientWidth;
    canvas.height = Math.max(400, Math.min(parent.clientWidth * 0.65, 600));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    resize();
    window.addEventListener("resize", resize);

    // Seed with a few balls
    for (let i = 0; i < 5; i++) {
      const r = DEFAULT_SETTINGS.ballSize + (Math.random() - 0.5) * 6;
      ballsRef.current.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height * 0.4,
        vx: (Math.random() - 0.5) * 200,
        vy: (Math.random() - 0.5) * 100,
        r,
        color: pick(COLORS),
        mass: r * r,
      });
    }
    setBallCount(ballsRef.current.length);

    /* ── Pointer events ────────────────────────────────── */

    const pos = (e: MouseEvent | Touch) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onDown = (x: number, y: number) => {
      pointerDownRef.current = true;
      if (modeRef.current === "wall") {
        drawingRef.current = { x, y };
      } else {
        spawnBall(x, y);
        spawnThrottleRef.current = performance.now();
      }
    };

    const onMove = (x: number, y: number) => {
      if (!pointerDownRef.current) return;
      if (modeRef.current === "ball") {
        const now = performance.now();
        if (now - spawnThrottleRef.current > 80) {
          spawnBall(x, y);
          spawnThrottleRef.current = now;
        }
      }
    };

    const onUp = (x: number, y: number) => {
      pointerDownRef.current = false;
      if (modeRef.current === "wall" && drawingRef.current) {
        const start = drawingRef.current;
        const dx = x - start.x;
        const dy = y - start.y;
        if (Math.sqrt(dx * dx + dy * dy) > 10) {
          wallsRef.current.push({ x1: start.x, y1: start.y, x2: x, y2: y });
          setWallCount(wallsRef.current.length);
        }
        drawingRef.current = null;
      }
    };

    const spawnBall = (x: number, y: number) => {
      const s = settingsRef.current;
      if (ballsRef.current.length >= s.maxBalls) return;
      const r = s.ballSize + (Math.random() - 0.5) * 6;
      ballsRef.current.push({
        x, y,
        vx: (Math.random() - 0.5) * 200 * s.speed,
        vy: (Math.random() - 0.5) * 100 * s.speed,
        r,
        color: pick(COLORS),
        mass: r * r,
      });
      setBallCount(ballsRef.current.length);
    };

    const md = (e: MouseEvent) => { const p = pos(e); onDown(p.x, p.y); };
    const mm = (e: MouseEvent) => { const p = pos(e); onMove(p.x, p.y); };
    const mu = (e: MouseEvent) => { const p = pos(e); onUp(p.x, p.y); };
    const ts = (e: TouchEvent) => { e.preventDefault(); const p = pos(e.touches[0]); onDown(p.x, p.y); };
    const tm = (e: TouchEvent) => { const p = pos(e.touches[0]); onMove(p.x, p.y); };
    const te = (e: TouchEvent) => { e.preventDefault(); const p = pos(e.changedTouches[0]); onUp(p.x, p.y); };

    canvas.addEventListener("mousedown", md);
    canvas.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", mu);
    canvas.addEventListener("touchstart", ts, { passive: false });
    canvas.addEventListener("touchmove", tm, { passive: false });
    canvas.addEventListener("touchend", te, { passive: false });

    /* ── Game loop ─────────────────────────────────────── */

    let last = performance.now();

    const loop = (now: number) => {
      const rawDt = (now - last) / 1000;
      last = now;
      const dt = Math.min(rawDt, 0.05) * settingsRef.current.speed;
      const s = settingsRef.current;
      const balls = ballsRef.current;
      const walls = wallsRef.current;
      const W = canvas.width;
      const H = canvas.height;

      // Physics update
      for (const b of balls) {
        b.vy += s.gravity * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        // Wall bounds
        if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx) * s.restitution; }
        if (b.x + b.r > W) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * s.restitution; }
        if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy) * s.restitution; }
        if (b.y + b.r > H) { b.y = H - b.r; b.vy = -Math.abs(b.vy) * s.restitution; }
      }

      // Ball-ball collisions
      if (s.collisions) {
        for (let i = 0; i < balls.length; i++) {
          for (let j = i + 1; j < balls.length; j++) {
            if (circleCircle(balls[i], balls[j])) {
              resolveCollision(balls[i], balls[j], s.restitution);
            }
          }
        }
      }

      // Wall collisions
      for (const b of balls) {
        for (const w of walls) {
          circleLineCollision(b, w, s.restitution);
        }
      }

      /* ── Render ──────────────────────────────────────── */

      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, W, H);

      // Grid lines (subtle)
      ctx.strokeStyle = "rgba(255,255,255,0.03)";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      // Walls
      ctx.strokeStyle = "#a1a1aa";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      for (const w of walls) {
        ctx.beginPath();
        ctx.moveTo(w.x1, w.y1);
        ctx.lineTo(w.x2, w.y2);
        ctx.stroke();
      }

      // Wall being drawn
      if (drawingRef.current && pointerDownRef.current && modeRef.current === "wall") {
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(drawingRef.current.x, drawingRef.current.y);
        // We don't have the current mouse pos in the loop, so we skip the preview line
        // It will snap when the user releases
        ctx.setLineDash([]);
      }

      // Balls
      ctx.shadowBlur = 0;
      for (const b of balls) {
        // Glow
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 10;

        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // HUD
      ctx.fillStyle = "#71717a";
      ctx.font = "11px monospace";
      ctx.fillText(`Balls: ${balls.length}/${s.maxBalls}`, 8, H - 8);
      if (s.gravity === 0) ctx.fillText("Zero-G", W - 56, H - 8);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousedown", md);
      canvas.removeEventListener("mousemove", mm);
      window.removeEventListener("mouseup", mu);
      canvas.removeEventListener("touchstart", ts);
      canvas.removeEventListener("touchmove", tm);
      canvas.removeEventListener("touchend", te);
    };
  }, [resize]);

  /* ── Settings updaters ──────────────────────────────── */

  const updateSetting = <K extends keyof Settings>(key: K, val: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
  };

  const clearBalls = () => {
    ballsRef.current = [];
    setBallCount(0);
  };

  const clearWalls = () => {
    wallsRef.current = [];
    setWallCount(0);
  };

  const reset = () => {
    clearBalls();
    clearWalls();
    setSettings({ ...DEFAULT_SETTINGS });
    setMode("ball");
  };

  /* ── Render ─────────────────────────────────────────── */

  return (
    <div className="relative w-full">
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="block w-full rounded-md"
        tabIndex={0}
        aria-label="Physics sandbox canvas"
      />

      {/* Mode indicator */}
      <div className="absolute top-3 right-3 flex gap-1.5">
        <button
          onClick={() => setMode("ball")}
          className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
            mode === "ball"
              ? "bg-accent text-background"
              : "bg-card/80 text-muted border border-border hover:text-foreground"
          }`}
        >
          Ball
        </button>
        <button
          onClick={() => setMode("wall")}
          className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
            mode === "wall"
              ? "bg-accent text-background"
              : "bg-card/80 text-muted border border-border hover:text-foreground"
          }`}
        >
          Wall
        </button>
      </div>

      {/* Burger menu toggle */}
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="absolute top-3 left-3 flex flex-col gap-[3px] p-2 rounded bg-card/80 border border-border hover:border-accent/40 transition-colors"
        aria-label="Settings menu"
      >
        <span className="block w-4 h-0.5 bg-foreground" />
        <span className="block w-4 h-0.5 bg-foreground" />
        <span className="block w-4 h-0.5 bg-foreground" />
      </button>

      {/* Settings panel */}
      {menuOpen && (
        <div className="absolute top-12 left-3 w-64 rounded-lg border border-border bg-card/95 backdrop-blur-sm p-4 space-y-4 z-10 shadow-lg">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">Settings</h3>
            <button
              onClick={() => setMenuOpen(false)}
              className="text-muted hover:text-foreground text-xs"
            >
              &times;
            </button>
          </div>

          <SliderControl
            label="Gravity"
            value={settings.gravity}
            min={0}
            max={1500}
            step={50}
            onChange={(v) => updateSetting("gravity", v)}
            format={(v) => (v === 0 ? "Off" : `${v}`)}
          />
          <SliderControl
            label="Speed"
            value={settings.speed}
            min={0.1}
            max={3}
            step={0.1}
            onChange={(v) => updateSetting("speed", v)}
            format={(v) => `${v.toFixed(1)}x`}
          />
          <SliderControl
            label="Ball Size"
            value={settings.ballSize}
            min={4}
            max={40}
            step={2}
            onChange={(v) => updateSetting("ballSize", v)}
            format={(v) => `${v}px`}
          />
          <SliderControl
            label="Bounce"
            value={settings.restitution}
            min={0}
            max={1.2}
            step={0.05}
            onChange={(v) => updateSetting("restitution", v)}
            format={(v) => `${(v * 100).toFixed(0)}%`}
          />
          <SliderControl
            label="Max Balls"
            value={settings.maxBalls}
            min={10}
            max={500}
            step={10}
            onChange={(v) => updateSetting("maxBalls", v)}
            format={(v) => `${v}`}
          />

          <ToggleControl
            label="Collisions"
            checked={settings.collisions}
            onChange={(v) => updateSetting("collisions", v)}
          />

          <div className="flex gap-2 pt-1">
            <button
              onClick={clearBalls}
              className="flex-1 rounded border border-border px-2 py-1.5 text-xs text-muted hover:text-foreground hover:border-accent/40 transition-colors"
            >
              Clear Balls
            </button>
            <button
              onClick={clearWalls}
              className="flex-1 rounded border border-border px-2 py-1.5 text-xs text-muted hover:text-foreground hover:border-accent/40 transition-colors"
            >
              Clear Walls
            </button>
          </div>
          <button
            onClick={reset}
            className="w-full rounded border border-red-500/30 px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Reset All
          </button>

          <p className="text-[10px] text-muted">
            {ballCount} balls &middot; {wallCount} walls
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Shared controls ───────────────────────────────────── */

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs text-muted">{label}</span>
        <span className="text-xs font-mono text-foreground">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-border accent-accent cursor-pointer"
      />
    </div>
  );
}

function ToggleControl({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-xs text-muted">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors ${
          checked ? "bg-accent" : "bg-border"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-foreground transition-transform ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </button>
    </label>
  );
}
