"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import {
  useDataSnapshot,
  useRegimeReport,
  useTradeTickets,
} from "@/lib/queries/hooks";
import type {
  AgentBrief,
  AgentBriefCandidate,
  AssetSignal,
  LivePrice,
  TechnicalTf,
  Timeframe,
  TradeTicket,
} from "@/types/generated/api";

// ── Config ────────────────────────────────────────────────────────────────────

const PRIMARY: Array<{ code: string; icon: string; name: string; unit: string }> = [
  { code: "BTCUSD", icon: "₿",  name: "Bitcoin",  unit: "usd" },
  { code: "ETHUSD", icon: "Ξ",  name: "Ethereum", unit: "usd" },
  { code: "XAUUSD", icon: "◆",  name: "Altın",    unit: "usd/oz" },
  { code: "XAGUSD", icon: "Ag", name: "Gümüş",    unit: "usd/oz" },
  { code: "BRENT",  icon: "●",  name: "Brent",    unit: "usd/bbl" },
];

const TF_ORDER: Timeframe[] = ["15m", "1h", "4h", "1d", "1w"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function round(n: number | null | undefined): number {
  return Math.round(n ?? 0);
}

function scoreTone(value: number): string {
  if (value >= 75) return "text-emerald-300";
  if (value >= 55) return "text-cyan-300";
  if (value >= 35) return "text-amber-300";
  return "text-slate-400";
}

function fmtPx(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 100)  return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 3 });
}

function tfIndex(tf?: Timeframe | string | null): number {
  if (!tf) return TF_ORDER.length;
  const i = TF_ORDER.indexOf(tf as Timeframe);
  return i === -1 ? TF_ORDER.length : i;
}

type Direction = "bullish" | "bearish" | "neutral";

type DeckRow = {
  symbol: string;
  icon: string;
  name: string;
  unit: string;
  best: AgentBriefCandidate;
  perTf: AgentBriefCandidate[];   // tüm TF adayları
  price: number | null;
};

function pickDeckRows(
  candidates: AgentBriefCandidate[],
  prices: LivePrice[] | undefined,
): DeckRow[] {
  const priceBy = new Map<string, number>();
  for (const p of prices ?? []) {
    if (p.price != null && Number.isFinite(p.price)) priceBy.set(p.symbol, p.price);
  }
  // Sembol → tüm adaylar
  const groups = new Map<string, AgentBriefCandidate[]>();
  for (const c of candidates) {
    const sym = c.symbol ?? "";
    if (!sym) continue;
    const list = groups.get(sym) ?? [];
    list.push(c);
    groups.set(sym, list);
  }
  const rows: DeckRow[] = [];
  // PRIMARY sırası tercihi
  for (const p of PRIMARY) {
    const all = groups.get(p.code);
    if (!all || !all.length) continue;
    const best = all.reduce((a, b) => ((b.score ?? 0) > (a.score ?? 0) ? b : a));
    rows.push({
      symbol: p.code,
      icon: p.icon,
      name: p.name,
      unit: p.unit,
      best,
      perTf: all,
      price: priceBy.get(p.code) ?? null,
    });
    groups.delete(p.code);
  }
  // Geriye kalan semboller (skor sırasıyla)
  const remaining = [...groups.entries()].map(([symbol, all]) => {
    const best = all.reduce((a, b) => ((b.score ?? 0) > (a.score ?? 0) ? b : a));
    return {
      symbol,
      icon: "◇",
      name: symbol,
      unit: "usd",
      best,
      perTf: all,
      price: priceBy.get(symbol) ?? null,
    };
  });
  remaining.sort((a, b) => (b.best.score ?? 0) - (a.best.score ?? 0));
  return [...rows, ...remaining].slice(0, 6);
}

function pickSupports(assets: AssetSignal[] | undefined, prices: LivePrice[] | undefined): {
  symbol: string;
  unit: string;
  price: number | null;
  direction: Direction;
}[] {
  const primaryCodes = new Set(PRIMARY.map((p) => p.code));
  const priceBy = new Map<string, number>();
  for (const p of prices ?? []) {
    if (p.price != null && Number.isFinite(p.price)) priceBy.set(p.symbol, p.price);
  }
  const out: { symbol: string; unit: string; price: number | null; direction: Direction }[] = [];
  for (const a of assets ?? []) {
    if (primaryCodes.has(a.symbol)) continue;
    out.push({
      symbol: a.symbol,
      unit: "idx",
      price: priceBy.get(a.symbol) ?? null,
      direction: (a.direction ?? "neutral") as Direction,
    });
  }
  return out;
}

// ── Score ring (animated) ────────────────────────────────────────────────────

function ScoreRing({
  score,
  size = 56,
  active = false,
}: {
  score: number;
  size?: number;
  active?: boolean;
}) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const tone =
    pct >= 75 ? "#34d399" : pct >= 55 ? "#22d3ee" : pct >= 35 ? "#fbbf24" : "#94a3b8";
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      style={{ filter: active ? `drop-shadow(0 0 8px ${tone}aa)` : undefined }}
    >
      <defs>
        <linearGradient id={`ring-grad-${size}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={tone} stopOpacity="1" />
          <stop offset="100%" stopColor={tone} stopOpacity="0.45" />
        </linearGradient>
      </defs>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(148,163,184,0.18)"
        strokeWidth="3"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={`url(#ring-grad-${size})`}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 0.9s cubic-bezier(0.22, 1, 0.36, 1)" }}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fontSize={size * 0.36}
        fontFamily="ui-sans-serif, system-ui"
        fontWeight={600}
        fill="rgba(241,245,249,0.96)"
      >
        {Math.round(pct)}
      </text>
    </svg>
  );
}

// ── Action badges ─────────────────────────────────────────────────────────────

function statusBadge(c: AgentBriefCandidate): { label: string; cls: string } {
  const dir = (c.direction ?? "neutral") as Direction;
  const act = (c.candidate_action ?? "").toUpperCase();
  if (act.includes("ACTIONABLE") || c.actionable) {
    if (dir === "bullish") return { label: "ONAYLI", cls: "bg-emerald-500/15 border-emerald-400/40 text-emerald-200" };
    if (dir === "bearish") return { label: "ONAYLI", cls: "bg-rose-500/15 border-rose-400/40 text-rose-200" };
  }
  if (act === "AVOID" || act.includes("BLOCK"))
    return { label: "BLOKE", cls: "bg-rose-500/15 border-rose-400/40 text-rose-200" };
  if (dir === "bullish") return { label: "BEKLİYOR", cls: "bg-amber-400/15 border-amber-300/40 text-amber-200" };
  if (dir === "bearish") return { label: "BEKLİYOR", cls: "bg-amber-400/15 border-amber-300/40 text-amber-200" };
  return { label: "NÖTR", cls: "bg-slate-500/15 border-slate-400/40 text-slate-300" };
}

function actionBadge(c: AgentBriefCandidate): { label: string; cls: string } {
  const dir = (c.direction ?? "neutral") as Direction;
  const actionable = c.actionable;
  if (actionable && dir === "bullish") return { label: "▲ LONG", cls: "bg-emerald-500/20 text-emerald-100 border-emerald-400/50" };
  if (actionable && dir === "bearish") return { label: "▼ SHORT", cls: "bg-rose-500/20 text-rose-100 border-rose-400/50" };
  if (dir === "bullish") return { label: "▲ LONG SETUP", cls: "bg-emerald-500/10 text-emerald-200/90 border-emerald-400/30" };
  if (dir === "bearish") return { label: "▼ SHORT SETUP", cls: "bg-rose-500/10 text-rose-200/90 border-rose-400/30" };
  return { label: "● WATCH", cls: "bg-cyan-500/10 text-cyan-200/90 border-cyan-400/30" };
}

// ── 3D card ───────────────────────────────────────────────────────────────────

function deckTransform(offset: number): CSSProperties {
  const abs = Math.abs(offset);
  // 3D fan-out: center büyük, kenarda küçük + döndürülmüş + uzakta
  const tx = offset === 0 ? 0 : (abs === 1 ? 200 : abs === 2 ? 360 : 480) * (offset > 0 ? 1 : -1);
  const tz = -abs * 80;
  const ry = offset * -10;
  const scale = abs === 0 ? 1.04 : abs === 1 ? 0.88 : abs === 2 ? 0.74 : 0.62;
  const op = abs === 0 ? 1 : abs === 1 ? 0.82 : abs === 2 ? 0.5 : 0.22;
  return {
    transform: `translateX(${tx}px) translateZ(${tz}px) rotateY(${ry}deg) scale(${scale})`,
    opacity: op,
    zIndex: 200 - abs,
    pointerEvents: abs > 2 ? "none" : "auto",
    filter: abs >= 2 ? "blur(1px)" : "none",
  };
}

function DeckCard({
  row,
  active,
  offset,
  onSelect,
}: {
  row: DeckRow;
  active: boolean;
  offset: number;
  onSelect: () => void;
}) {
  const value = round(row.best.score);
  const status = statusBadge(row.best);
  const action = actionBadge(row.best);
  const glow =
    value >= 75 ? "rgba(52,211,153,0.55)"
    : value >= 55 ? "rgba(34,211,238,0.55)"
    : value >= 35 ? "rgba(251,191,36,0.45)"
    : "rgba(148,163,184,0.35)";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className="absolute top-1/2 left-1/2 w-[228px] -translate-x-1/2 -translate-y-1/2 rounded-xl border backdrop-blur-md text-left transition-all duration-700"
      style={{
        ...deckTransform(offset),
        transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
        transformStyle: "preserve-3d",
        background:
          active
            ? "linear-gradient(150deg, rgba(15,23,42,0.94), rgba(2,8,23,0.96))"
            : "linear-gradient(155deg, rgba(15,23,42,0.78), rgba(2,8,23,0.88))",
        borderColor: active ? "rgba(34,211,238,0.55)" : "rgba(71,85,105,0.35)",
        boxShadow: active
          ? `0 18px 50px -12px ${glow}, 0 0 0 1px rgba(34,211,238,0.18), inset 0 1px 0 rgba(255,255,255,0.05)`
          : "0 6px 18px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      {/* top accent line */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${active ? "rgba(34,211,238,0.95)" : "rgba(148,163,184,0.5)"}, transparent)`,
        }}
      />
      <div className="p-3 space-y-2">
        {/* Header row */}
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-slate-700/40 text-sm text-slate-100">
            {row.icon}
          </span>
          <span className="font-display text-[13px] font-semibold tracking-wide text-slate-100">
            {row.symbol}
          </span>
          <span
            aria-hidden="true"
            className="ml-auto h-2 w-2 rounded-full"
            style={{ background: glow, boxShadow: `0 0 8px ${glow}` }}
          />
        </div>

        {/* Price */}
        <div>
          <p className="font-display text-[17px] font-semibold leading-tight text-slate-100">
            {fmtPx(row.price)} <span className="text-[10px] text-slate-400">{row.unit}</span>
          </p>
        </div>

        {/* Status badge */}
        <div>
          <span className={`inline-block rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-widest ${status.cls}`}>
            {status.label}
          </span>
        </div>

        {/* Ring + action */}
        <div className="flex items-center justify-between pt-1.5 border-t border-white/5">
          <ScoreRing score={value} size={42} active={active} />
          <span className={`rounded border px-2 py-1 text-[10px] font-medium uppercase tracking-wider ${action.cls}`}>
            {action.label}
          </span>
        </div>
      </div>
    </button>
  );
}

// ── Right detail panel ───────────────────────────────────────────────────────

function TfMatrix({ rows }: { rows: AgentBriefCandidate[] }) {
  if (!rows.length) {
    return <p className="text-[11px] italic text-slate-500">Bu sembol için TF dökümü yok.</p>;
  }
  const sorted = [...rows].sort((a, b) => tfIndex(a.timeframe) - tfIndex(b.timeframe));
  return (
    <div className="rounded-md border border-slate-700/40 bg-black/40 overflow-hidden">
      <table className="w-full text-[11px]">
        <thead className="bg-white/[0.03] text-slate-500">
          <tr>
            <th className="px-2 py-1 text-left font-medium uppercase tracking-widest">TF</th>
            <th className="px-2 py-1 text-right font-medium uppercase tracking-widest">Skor</th>
            <th className="px-2 py-1 text-right font-medium uppercase tracking-widest">Yön</th>
            <th className="px-2 py-1 text-right font-medium uppercase tracking-widest">Aksiyon</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => {
            const v = round(r.score);
            const d = (r.direction ?? "neutral") as Direction;
            return (
              <tr key={`${r.timeframe ?? "?"}-${i}`} className="border-t border-white/5">
                <td className="px-2 py-1 font-mono text-slate-300">{r.timeframe ?? "—"}</td>
                <td className={`px-2 py-1 text-right font-mono font-semibold ${scoreTone(v)}`}>{v}</td>
                <td
                  className={`px-2 py-1 text-right font-mono text-[10px] uppercase ${
                    d === "bullish" ? "text-emerald-300" : d === "bearish" ? "text-rose-300" : "text-amber-200"
                  }`}
                >
                  {d}
                </td>
                <td className="px-2 py-1 text-right text-slate-300/90">
                  {r.candidate_action ?? "WATCH"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TechnicalsBlock({ tech }: { tech: TechnicalTf | undefined }) {
  if (!tech) {
    return (
      <p className="text-[11px] italic text-slate-500">Teknik veri yok.</p>
    );
  }
  const rows: Array<[string, string, string]> = [
    ["RSI 14", String(tech.rsi != null ? Math.round(tech.rsi) : "—"), tech.rsi != null && tech.rsi >= 60 ? "text-emerald-300" : tech.rsi != null && tech.rsi <= 40 ? "text-rose-300" : "text-slate-200"],
    ["MACD", tech.macd != null ? tech.macd.toFixed(2) : "—", "text-slate-200"],
    ["ATR", tech.atr != null ? tech.atr.toFixed(2) : "—", "text-slate-200"],
    ["EMA Dizilim", tech.ema_stack ?? "—", tech.ema_stack === "bullish" ? "text-emerald-300" : tech.ema_stack === "bearish" ? "text-rose-300" : "text-slate-300"],
    ["Skor", `${round(tech.score)}/100`, scoreTone(round(tech.score))],
  ];
  return (
    <div className="rounded-md border border-slate-700/40 bg-black/40 overflow-hidden">
      <table className="w-full text-[11px]">
        <tbody>
          {rows.map(([k, v, cls], i) => (
            <tr key={k} className={i ? "border-t border-white/5" : ""}>
              <td className="px-2 py-1 text-slate-500">{k}</td>
              <td className={`px-2 py-1 text-right font-mono ${cls}`}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TradePlanBlock({ ticket, symbol }: { ticket: TradeTicket | undefined; symbol: string }) {
  if (!ticket) {
    return (
      <div className="rounded-md border border-slate-700/40 bg-black/30 p-2.5">
        <p className="text-[10px] uppercase tracking-widest text-slate-500">Trade plan</p>
        <p className="mt-1 text-[11px] text-slate-500">
          {symbol} için aktif ticket yok — yeni giriş açılmıyor.
        </p>
      </div>
    );
  }
  const s = ticket.summary;
  const sideTone =
    ticket.side === "long" ? "text-emerald-300 border-emerald-500/40"
    : ticket.side === "short" ? "text-rose-300 border-rose-500/40"
    : "text-amber-300 border-amber-500/40";
  return (
    <div className="rounded-md border border-cyan-500/30 bg-cyan-500/[0.04] p-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-cyan-300/85">
          Trade plan
        </span>
        <span className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${sideTone}`}>
          {ticket.side} · {ticket.timeframe}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <p className="uppercase tracking-widest text-slate-500 text-[9px]">Entry</p>
          <p className="font-mono text-slate-100">{fmtPx(s.entry_price)}</p>
        </div>
        <div>
          <p className="uppercase tracking-widest text-slate-500 text-[9px]">Stop</p>
          <p className="font-mono text-rose-300">{fmtPx(s.stop_loss)}</p>
        </div>
        <div>
          <p className="uppercase tracking-widest text-slate-500 text-[9px]">Target</p>
          <p className="font-mono text-emerald-300">{fmtPx(s.take_profit)}</p>
        </div>
      </div>
      <div className="flex items-center justify-between text-[10px] text-slate-400">
        <span>R:R 1:{(s.rr_ratio ?? 0).toFixed(2)} · {s.rr_source}</span>
        <span className="rounded bg-white/[0.05] px-1.5 py-0.5 uppercase">{ticket.status}</span>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function HolographicSignalDeck({ brief }: { brief: AgentBrief }) {
  const { data: snap } = useDataSnapshot();
  const { data: regime } = useRegimeReport();
  const { data: ticketList } = useTradeTickets();

  const rows = useMemo(
    () => pickDeckRows(brief.top_candidates ?? [], snap?.prices),
    [brief.top_candidates, snap?.prices],
  );
  const supports = useMemo(
    () => pickSupports(regime?.assets, snap?.prices),
    [regime?.assets, snap?.prices],
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [selectedTf, setSelectedTf] = useState<Timeframe | null>(null);
  const animateRef = useRef(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    animateRef.current = !mq.matches;
    const onMQ = () => { animateRef.current = !mq.matches; };
    mq.addEventListener?.("change", onMQ);
    return () => mq.removeEventListener?.("change", onMQ);
  }, []);

  // Auto-rotate
  useEffect(() => {
    if (rows.length <= 1 || paused || !animateRef.current) return;
    const t = setInterval(() => {
      setActiveIndex((i) => (i + 1) % rows.length);
    }, 5000);
    return () => clearInterval(t);
  }, [rows.length, paused]);

  // rows shrink / sembol değişimi → index ve TF reset
  useEffect(() => {
    if (activeIndex >= rows.length && rows.length > 0) setActiveIndex(0);
  }, [activeIndex, rows.length]);
  useEffect(() => {
    setSelectedTf(null);
  }, [activeIndex]);

  const activeRow = rows[activeIndex];
  const active = activeRow?.best;
  const activeSymbol = activeRow?.symbol ?? "—";
  const activeDirection = (active?.direction ?? "neutral") as Direction;
  const activeAction = active ? actionBadge(active) : { label: "—", cls: "" };

  const techForSymbol = snap?.technicals_by_tf?.[activeSymbol];
  const effectiveTf: Timeframe | null =
    selectedTf ?? (active?.timeframe as Timeframe | undefined) ?? null;
  const tech = effectiveTf ? techForSymbol?.[effectiveTf] : undefined;

  const activeTicket = useMemo(
    () => ticketList?.tickets.find((t) => t.symbol === activeSymbol && t.status === "active"),
    [ticketList?.tickets, activeSymbol],
  );

  const blocked = !brief.can_act;

  if (rows.length === 0) {
    return (
      <section className="rounded-lg border border-cyan-500/20 bg-[#03101b]/88 p-6 text-center text-xs text-slate-400">
        Aktif aday sinyal yok.
      </section>
    );
  }

  return (
    <section
      id="layer1_holographic_signals"
      data-panel="layer1_holographic_signals"
      className="relative overflow-hidden rounded-lg border border-cyan-500/20 bg-[#03101b]/90 shadow-[0_0_42px_rgba(34,211,238,0.10)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <style>{`
        @keyframes hsd-scan { 0%{transform:translateY(-20%);opacity:0} 12%{opacity:.7} 88%{opacity:.7} 100%{transform:translateY(120%);opacity:0} }
        @keyframes hsd-grid-pulse { 0%,100%{opacity:.18} 50%{opacity:.32} }
        @keyframes hsd-orb { 0%,100%{transform:translate(-50%,0) scale(1);opacity:.85} 50%{transform:translate(-50%,-4px) scale(1.05);opacity:1} }
        @keyframes hsd-ring-1 { 0%{transform:translate(-50%,-50%) scale(.85);opacity:.6} 100%{transform:translate(-50%,-50%) scale(1.4);opacity:0} }
        @keyframes hsd-ring-2 { 0%{transform:translate(-50%,-50%) scale(.85);opacity:.4} 100%{transform:translate(-50%,-50%) scale(1.6);opacity:0} }
        @keyframes hsd-ticker { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @keyframes hsd-corner-glow { 0%,100%{opacity:.6} 50%{opacity:1} }
      `}</style>

      {/* Header */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/15 bg-black/30 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="w-1 h-3.5 rounded-full bg-cyan-400/70" aria-hidden="true" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/85">
              Holographic Command Signals
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {rows.length} ana asset · {supports.length} destek göstergesi · PAPER_SAFE
            </p>
          </div>
        </div>
        <span className={`rounded border px-2 py-1 text-[10px] uppercase tracking-widest ${
          blocked
            ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
            : "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
        }`}>
          {blocked ? "RISK GATED" : "GATE CLEAR"}
        </span>
      </div>

      {/* Body grid */}
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Left — 3D deck */}
        <div
          className="relative min-h-[440px] overflow-hidden border-r border-cyan-500/12"
          style={{
            background:
              "radial-gradient(circle at 50% 92%, rgba(34,211,238,0.22), transparent 38%), linear-gradient(180deg, rgba(4,14,28,0.78), rgba(2,5,13,0.96))",
          }}
        >
          {/* Holographic grid background */}
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(rgba(34,211,238,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.07) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
              maskImage: "radial-gradient(ellipse at 50% 55%, black 25%, transparent 78%)",
              WebkitMaskImage: "radial-gradient(ellipse at 50% 55%, black 25%, transparent 78%)",
              animation: "hsd-grid-pulse 6s ease-in-out infinite",
            }}
          />
          {/* Dot grid overlay */}
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none opacity-30"
            style={{
              backgroundImage: "radial-gradient(circle, rgba(148,163,184,0.22) 1px, transparent 1px)",
              backgroundSize: "26px 26px",
              maskImage: "radial-gradient(ellipse at 50% 60%, black 25%, transparent 75%)",
              WebkitMaskImage: "radial-gradient(ellipse at 50% 60%, black 25%, transparent 75%)",
            }}
          />
          {/* Scan line */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 h-[2px] pointer-events-none"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(34,211,238,0.55), transparent)",
              boxShadow: "0 0 18px rgba(34,211,238,0.6)",
              animation: "hsd-scan 7s linear infinite",
            }}
          />
          {/* Corner brackets */}
          {(["tl", "tr", "bl", "br"] as const).map((corner) => {
            const pos: CSSProperties = {
              top: corner.startsWith("t") ? 10 : "auto",
              bottom: corner.startsWith("b") ? 10 : "auto",
              left: corner.endsWith("l") ? 10 : "auto",
              right: corner.endsWith("r") ? 10 : "auto",
            };
            return (
              <div
                key={corner}
                aria-hidden="true"
                className="absolute h-5 w-5 border-cyan-400/60"
                style={{
                  ...pos,
                  borderTopWidth: corner.startsWith("t") ? 1.5 : 0,
                  borderBottomWidth: corner.startsWith("b") ? 1.5 : 0,
                  borderLeftWidth: corner.endsWith("l") ? 1.5 : 0,
                  borderRightWidth: corner.endsWith("r") ? 1.5 : 0,
                  animation: "hsd-corner-glow 3.4s ease-in-out infinite",
                }}
              />
            );
          })}

          {/* 3D deck stage */}
          <div
            className="relative mx-auto h-[280px] mt-10"
            style={{ perspective: "2000px", perspectiveOrigin: "50% 48%" }}
          >
            {rows.map((r, i) => {
              const n = rows.length;
              let offset = i - activeIndex;
              if (offset > n / 2) offset -= n;
              if (offset < -n / 2) offset += n;
              return (
                <DeckCard
                  key={r.symbol}
                  row={r}
                  active={i === activeIndex}
                  offset={offset}
                  onSelect={() => setActiveIndex(i)}
                />
              );
            })}
          </div>

          {/* Pagination dots */}
          <div className="relative z-10 mt-4 flex justify-center gap-1.5">
            {rows.map((r, i) => (
              <button
                key={r.symbol}
                type="button"
                onClick={() => setActiveIndex(i)}
                aria-label={r.symbol}
                className={`h-1 rounded-full transition-all duration-500 ${
                  i === activeIndex ? "w-8 bg-cyan-300" : "w-2 bg-slate-600/60 hover:bg-slate-500"
                }`}
              />
            ))}
          </div>

          {/* AI Trading Operations podium */}
          <div className="relative z-10 mt-3 mb-5 mx-auto h-[110px] w-[min(560px,82%)]">
            {/* expanding rings */}
            <div
              aria-hidden="true"
              className="absolute left-1/2 top-1/2 h-20 w-40 rounded-[50%] border border-cyan-400/30"
              style={{ animation: "hsd-ring-1 2.6s ease-out infinite" }}
            />
            <div
              aria-hidden="true"
              className="absolute left-1/2 top-1/2 h-20 w-40 rounded-[50%] border border-cyan-400/22"
              style={{ animation: "hsd-ring-2 2.6s ease-out infinite 0.6s" }}
            />
            {/* base disc */}
            <div className="absolute inset-x-0 bottom-0 mx-auto h-20 rounded-[50%] border border-cyan-400/50 bg-cyan-400/[0.06] shadow-[0_0_42px_rgba(34,211,238,0.22)]" />
            <div className="absolute inset-x-[16%] bottom-4 h-12 rounded-[50%] border border-cyan-400/35" />
            <div className="absolute inset-x-[30%] bottom-8 h-6 rounded-[50%] border border-cyan-400/25" />
            {/* orb */}
            <div
              aria-hidden="true"
              className="absolute bottom-10 left-1/2 h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-cyan-300"
              style={{
                boxShadow: "0 0 14px rgba(34,211,238,0.9), 0 0 28px rgba(34,211,238,0.4)",
                animation: "hsd-orb 2.4s ease-in-out infinite",
              }}
            />
            {/* label */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded border border-cyan-400/35 bg-slate-950/70 px-4 py-1 text-[10px] uppercase tracking-[0.32em] text-cyan-100">
              ◆ AI Trading Operations ◆
            </div>
          </div>
        </div>

        {/* Right — Sinyal Detayı */}
        <aside className="relative min-h-[440px] bg-black/25 p-3">
          <div className="space-y-3.5">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-200/85">
                Sinyal detayı
              </p>
            </div>

            {/* Symbol header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-base font-semibold text-slate-100">
                  {activeRow?.icon} {activeSymbol}
                </p>
                <span className={`mt-1 inline-block rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider ${activeAction.cls}`}>
                  {activeAction.label}
                </span>
              </div>
              <ScoreRing score={round(active?.score)} size={58} active />
            </div>

            {/* Price */}
            <div className="rounded-md border border-slate-700/40 bg-black/30 p-2.5">
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Fiyat</p>
              <p className="mt-0.5 font-display text-xl font-semibold text-slate-100">
                {fmtPx(activeRow?.price)} <span className="text-[10px] text-slate-400">{activeRow?.unit}</span>
              </p>
            </div>

            {/* All TFs */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-widest text-slate-500">
                  Tüm timeframeler
                </p>
                <p className="text-[9px] text-slate-600">
                  {activeRow?.perTf.length ?? 0} TF
                </p>
              </div>
              <TfMatrix rows={activeRow?.perTf ?? []} />
            </div>

            {/* TF chips + teknik */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-widest text-slate-500">
                  Teknik {effectiveTf ? `· ${effectiveTf}` : ""}
                </p>
                <div className="flex gap-1">
                  {TF_ORDER.filter((tf) => techForSymbol?.[tf]).map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => setSelectedTf(tf)}
                      className={`rounded px-1.5 py-0.5 text-[9px] font-mono uppercase border transition-colors ${
                        effectiveTf === tf
                          ? "border-cyan-400/55 bg-cyan-400/15 text-cyan-100"
                          : "border-slate-600/40 bg-slate-800/40 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>
              <TechnicalsBlock tech={tech} />
            </div>

            {/* Trade plan */}
            <TradePlanBlock ticket={activeTicket} symbol={activeSymbol} />

            {/* Footer mini stats */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded border border-slate-700/40 bg-black/30 p-2">
                <p className="uppercase tracking-widest text-slate-500 text-[9px]">DQS</p>
                <p className="font-mono text-cyan-300">{Math.round(brief.dqs?.score ?? 0)}</p>
              </div>
              <div className="rounded border border-slate-700/40 bg-black/30 p-2">
                <p className="uppercase tracking-widest text-slate-500 text-[9px]">Mode</p>
                <p className="font-mono text-amber-200">{brief.data_mode}</p>
              </div>
            </div>

            <div className="rounded border border-slate-700/40 bg-white/[0.02] p-2.5">
              <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${
                  activeDirection === "bullish" ? "bg-emerald-300" :
                  activeDirection === "bearish" ? "bg-rose-300" : "bg-amber-300"
                }`} />
                <span className="text-[10px] uppercase tracking-widest text-slate-500">
                  Agent interpretation
                </span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-300/90">
                {brief.recommended_stance}
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* Bottom — Piyasa göstergeleri ticker */}
      {supports.length > 0 && (
        <div className="border-t border-cyan-500/15 bg-black/30 px-4 py-2.5">
          <p className="text-[9px] font-medium uppercase tracking-[0.22em] text-slate-500 mb-1.5">
            Piyasa Göstergeleri
          </p>
          <div
            className="relative overflow-hidden"
            style={{
              maskImage: "linear-gradient(90deg, transparent, black 6%, black 94%, transparent)",
              WebkitMaskImage: "linear-gradient(90deg, transparent, black 6%, black 94%, transparent)",
            }}
          >
            <div
              className="flex gap-2 w-max"
              style={{
                animation: `hsd-ticker ${Math.max(24, supports.length * 6)}s linear infinite`,
                animationPlayState: paused ? "paused" : "running",
              }}
            >
              {[...supports, ...supports].map((s, i) => {
                const tone =
                  s.direction === "bullish" ? "border-emerald-500/35 text-emerald-200"
                  : s.direction === "bearish" ? "border-rose-500/35 text-rose-200"
                  : "border-slate-600/40 text-slate-300";
                return (
                  <div
                    key={`${s.symbol}-${i}`}
                    className={`shrink-0 flex items-center gap-2 rounded border bg-slate-900/40 px-2 py-1 ${tone}`}
                  >
                    <span aria-hidden="true" className="h-1 w-1 rounded-full bg-current" />
                    <span className="text-[10px] font-medium">{s.symbol}</span>
                    <span className="text-[10px] font-mono text-slate-100">
                      {fmtPx(s.price)} {s.unit}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-cyan-500/15 bg-black/30 px-4 py-1.5 text-center">
        <p className="text-[9px] text-slate-500">
          Yalnız görselleştirme · karar üretmez · final karar deterministik engine + RiskGate
        </p>
      </div>
    </section>
  );
}
