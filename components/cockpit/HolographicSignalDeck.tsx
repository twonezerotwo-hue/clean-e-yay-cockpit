"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { useTradeTickets } from "@/lib/queries/hooks";
import type {
  AgentBrief,
  AgentBriefCandidate,
  TradeTicket,
} from "@/types/generated/api";

const DIRECTION_TONE: Record<string, string> = {
  bullish: "text-signal-up border-signal-up/35 bg-signal-up/10",
  bearish: "text-signal-down border-signal-down/35 bg-signal-down/10",
  neutral: "text-amber-300 border-amber-300/35 bg-amber-300/10",
};

const DIRECTION_DOT: Record<string, string> = {
  bullish: "bg-signal-up",
  bearish: "bg-signal-down",
  neutral: "bg-amber-300",
};

const TF_ORDER = ["1m", "5m", "15m", "1h", "4h", "1d", "1w"] as const;

function score(candidate?: AgentBriefCandidate) {
  return Math.round(candidate?.score ?? 0);
}

function scoreTone(value: number) {
  if (value >= 75) return "text-signal-up";
  if (value >= 55) return "text-accent-cyan";
  if (value >= 35) return "text-amber-300";
  return "text-white/45";
}

function deckPosition(index: number, activeIndex: number): CSSProperties {
  const offset = index - activeIndex;
  const abs = Math.abs(offset);
  return {
    "--tx": `${offset * 132}px`,
    "--ty": `${abs * 20}px`,
    "--rot": `${offset * -13}deg`,
    "--scale": String(Math.max(0.72, 1 - abs * 0.12)),
    "--z": String(20 - abs),
    "--opacity": String(Math.max(0.28, 1 - abs * 0.2)),
  } as CSSProperties;
}

// Sembol başına en güçlü candidate'i seç (en yüksek score). Backend aynı
// sembolü farklı TF'ler için tekrar döndürebiliyor; carousel'da unique kart
// görmek istiyoruz, tüm TF'ler sağ panelde tabloda gösteriliyor.
function pickPerSymbol(
  candidates: AgentBriefCandidate[],
): { symbol: string; best: AgentBriefCandidate; all: AgentBriefCandidate[] }[] {
  const groups = new Map<string, AgentBriefCandidate[]>();
  for (const c of candidates) {
    const sym = c.symbol ?? "";
    if (!sym) continue;
    const list = groups.get(sym) ?? [];
    list.push(c);
    groups.set(sym, list);
  }
  const rows = [...groups.entries()].map(([symbol, all]) => {
    const best = all.reduce((a, b) => ((b.score ?? 0) > (a.score ?? 0) ? b : a));
    return { symbol, best, all };
  });
  // En yüksek score'lu sembol önce.
  rows.sort((a, b) => (b.best.score ?? 0) - (a.best.score ?? 0));
  return rows;
}

function tfIndex(tf?: string): number {
  if (!tf) return TF_ORDER.length;
  const i = TF_ORDER.indexOf(tf as (typeof TF_ORDER)[number]);
  return i === -1 ? TF_ORDER.length : i;
}

function fmtPx(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n >= 100
    ? n.toLocaleString("en-US", { maximumFractionDigits: 1 })
    : n.toLocaleString("en-US", { maximumFractionDigits: 3 });
}

function CandidateCard({
  candidate,
  active,
  index,
  activeIndex,
  onSelect,
}: {
  candidate: AgentBriefCandidate;
  active: boolean;
  index: number;
  activeIndex: number;
  onSelect: () => void;
}) {
  const value = score(candidate);
  const direction = candidate.direction ?? "neutral";
  const tone = DIRECTION_TONE[direction] ?? DIRECTION_TONE.neutral;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`holo-signal-card ${active ? "holo-signal-card-active" : ""}`}
      style={deckPosition(index, activeIndex)}
      aria-pressed={active}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="rounded bg-blue-600/80 px-1.5 py-0.5 font-display text-xs text-white">
          {candidate.symbol ?? "--"}
        </span>
        <span className={`rounded border px-1.5 py-0.5 text-[10px] uppercase ${tone}`}>
          {candidate.candidate_action ?? "WATCH"}
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-white/42">
            Signal score
          </div>
          <div className={`font-display text-4xl leading-none ${scoreTone(value)}`}>{value}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-white/42">
            Direction
          </div>
          <div className="text-xs uppercase text-white/82">{direction}</div>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full bg-accent-cyan shadow-[0_0_12px_rgba(34,211,238,0.8)]"
          style={{ width: `${Math.max(4, Math.min(value, 100))}%` }}
        />
      </div>
    </button>
  );
}

function TfBreakdown({ rows }: { rows: AgentBriefCandidate[] }) {
  if (!rows.length) {
    return (
      <p className="text-[11px] italic text-white/40">Bu sembol için TF dökümü yok.</p>
    );
  }
  const sorted = [...rows].sort((a, b) => tfIndex(a.timeframe) - tfIndex(b.timeframe));
  return (
    <div className="rounded border border-white/10 bg-black/30 overflow-hidden">
      <table className="w-full text-[11px]">
        <thead className="bg-white/[0.03] text-white/40">
          <tr>
            <th className="px-2 py-1 text-left font-medium uppercase tracking-widest">TF</th>
            <th className="px-2 py-1 text-right font-medium uppercase tracking-widest">Skor</th>
            <th className="px-2 py-1 text-right font-medium uppercase tracking-widest">Yön</th>
            <th className="px-2 py-1 text-right font-medium uppercase tracking-widest">Aksiyon</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => {
            const v = score(r);
            const d = r.direction ?? "neutral";
            return (
              <tr key={`${r.timeframe ?? "?"}-${i}`} className="border-t border-white/5">
                <td className="px-2 py-1 font-mono text-white/70">{r.timeframe ?? "—"}</td>
                <td className={`px-2 py-1 text-right font-mono font-semibold ${scoreTone(v)}`}>
                  {v}
                </td>
                <td
                  className={`px-2 py-1 text-right font-mono uppercase text-[10px] ${
                    d === "bullish"
                      ? "text-signal-up"
                      : d === "bearish"
                        ? "text-signal-down"
                        : "text-amber-300"
                  }`}
                >
                  {d}
                </td>
                <td className="px-2 py-1 text-right text-white/70">
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

function TradePlanBlock({
  ticket,
  symbol,
}: {
  ticket: TradeTicket | undefined;
  symbol: string;
}) {
  if (!ticket) {
    return (
      <div className="rounded border border-white/10 bg-white/[0.02] p-3">
        <div className="text-[10px] uppercase tracking-widest text-white/42">
          Trade plan
        </div>
        <p className="mt-1 text-[11px] text-white/50">
          {symbol} için aktif ticket yok — yeni giriş açılmıyor.
        </p>
      </div>
    );
  }
  const s = ticket.summary;
  const sideTone =
    ticket.side === "long"
      ? "text-signal-up border-signal-up/35 bg-signal-up/10"
      : ticket.side === "short"
        ? "text-signal-down border-signal-down/35 bg-signal-down/10"
        : "text-amber-300 border-amber-300/35 bg-amber-300/10";
  return (
    <div className="rounded border border-accent-cyan/25 bg-accent-cyan/[0.04] p-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest text-accent-cyan/80">
          Trade plan
        </div>
        <span className={`rounded border px-2 py-0.5 text-[10px] uppercase ${sideTone}`}>
          {ticket.side} · {ticket.timeframe}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <div className="uppercase tracking-widest text-white/42">Entry</div>
          <div className="font-mono text-white/90">{fmtPx(s.entry_price)}</div>
        </div>
        <div>
          <div className="uppercase tracking-widest text-white/42">Stop</div>
          <div className="font-mono text-signal-down">{fmtPx(s.stop_loss)}</div>
        </div>
        <div>
          <div className="uppercase tracking-widest text-white/42">Target</div>
          <div className="font-mono text-signal-up">{fmtPx(s.take_profit)}</div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-white/55">
        <span>
          R:R 1:{(s.rr_ratio ?? 0).toFixed(2)} · {s.rr_source}
        </span>
        <span className="rounded bg-white/[0.05] px-1.5 py-0.5 uppercase">
          {ticket.status}
        </span>
      </div>
    </div>
  );
}

export function HolographicSignalDeck({ brief }: { brief: AgentBrief }) {
  const { data: ticketList } = useTradeTickets();

  // Sembol başına unique kart; tüm TF'ler `all` içinde sağ panelde tabloda.
  const rows = useMemo(
    () => pickPerSymbol(brief.top_candidates ?? []).slice(0, 6),
    [brief.top_candidates],
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  // Carousel auto-rotate (4s). Reduced-motion ve hover'da durur.
  const animate = useRef(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    animate.current = !mq.matches;
    const onMQ = () => {
      animate.current = !mq.matches;
    };
    mq.addEventListener?.("change", onMQ);
    return () => mq.removeEventListener?.("change", onMQ);
  }, []);

  useEffect(() => {
    if (rows.length <= 1) return;
    if (!animate.current || paused) return;
    const t = setInterval(() => {
      setActiveIndex((i) => (i + 1) % rows.length);
    }, 4000);
    return () => clearInterval(t);
  }, [rows.length, paused]);

  // rows uzunluğu değişirse aralık dışına çıkma.
  useEffect(() => {
    if (activeIndex >= rows.length && rows.length > 0) setActiveIndex(0);
  }, [activeIndex, rows.length]);

  const activeRow = rows[activeIndex];
  const active = activeRow?.best;
  const activeSymbol = activeRow?.symbol ?? "--";
  const activeDirection = active?.direction ?? "neutral";
  const activeScore = score(active);
  const blocked = !brief.can_act;

  const activeTicket = useMemo(
    () =>
      ticketList?.tickets.find(
        (t) => t.symbol === activeSymbol && t.status === "active",
      ),
    [ticketList?.tickets, activeSymbol],
  );

  if (rows.length === 0) {
    return (
      <section
        id="layer1_holographic_signals"
        className="rounded-lg border border-accent-cyan/20 bg-[#03101b]/88 p-6 text-center text-xs text-white/45"
      >
        Aktif aday sinyal yok.
      </section>
    );
  }

  return (
    <section
      id="layer1_holographic_signals"
      data-panel="layer1_holographic_signals"
      className="relative overflow-hidden rounded-lg border border-accent-cyan/20 bg-[#03101b]/88 shadow-[0_0_36px_rgba(34,211,238,0.1)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-accent-cyan/18 bg-black/22 px-3 py-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.24em] text-accent-cyan/80">
            Holographic Command Signals
          </div>
          <div className="text-[11px] text-white/42">
            {rows.length} sembol · PAPER_SAFE / NO_EXECUTION
          </div>
        </div>
        <span className="rounded border border-amber-300/25 bg-amber-300/10 px-2 py-1 text-[10px] uppercase tracking-widest text-amber-300">
          {blocked ? "risk gated" : "gate clear"}
        </span>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="relative min-h-[380px] overflow-hidden border-r border-accent-cyan/12 bg-[radial-gradient(circle_at_50%_88%,rgba(34,211,238,0.22),transparent_28%),linear-gradient(180deg,rgba(4,14,28,0.75),rgba(2,5,13,0.95))]">
          <div className="holo-corner holo-corner-tl" />
          <div className="holo-corner holo-corner-tr" />
          <div className="holo-corner holo-corner-bl" />
          <div className="holo-corner holo-corner-br" />
          <div className="absolute inset-x-0 top-16 h-px bg-amber-300/35" />
          <div className="holo-scan" />

          <div className="absolute left-1/2 top-9 h-[210px] w-[1px] -translate-x-1/2 bg-gradient-to-b from-accent-cyan/55 to-transparent" />
          <div className="absolute left-1/2 top-[72px] h-[190px] w-[min(760px,94%)] -translate-x-1/2 [perspective:900px]">
            {rows.map((r, index) => (
              <CandidateCard
                key={r.symbol}
                candidate={r.best}
                active={index === activeIndex}
                index={index}
                activeIndex={activeIndex}
                onSelect={() => setActiveIndex(index)}
              />
            ))}
          </div>

          {/* Pagination dots */}
          <div className="absolute bottom-[148px] left-1/2 flex -translate-x-1/2 gap-1.5">
            {rows.map((r, i) => (
              <button
                key={r.symbol}
                type="button"
                onClick={() => setActiveIndex(i)}
                aria-label={r.symbol}
                className={`h-1 rounded-full transition-all ${
                  i === activeIndex
                    ? "w-6 bg-accent-cyan"
                    : "w-2 bg-white/15 hover:bg-white/30"
                }`}
              />
            ))}
          </div>

          <div className="absolute bottom-9 left-1/2 h-28 w-[min(520px,78%)] -translate-x-1/2">
            <div className="absolute inset-x-0 bottom-0 mx-auto h-20 rounded-[50%] border border-accent-cyan/50 bg-accent-cyan/8 shadow-[0_0_42px_rgba(34,211,238,0.2)]" />
            <div className="absolute inset-x-[14%] bottom-4 h-12 rounded-[50%] border border-accent-cyan/35" />
            <div className="absolute bottom-9 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-accent-cyan shadow-[0_0_18px_rgba(34,211,238,1)]" />
            <div className="holo-platform" />
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-blue-700/90 px-4 py-1 text-[10px] uppercase tracking-[0.32em] text-white">
              AI Trading Operations
            </div>
          </div>
        </div>

        <aside className="min-h-[380px] bg-black/18 p-3 space-y-4">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-accent-cyan/70">
              Signal detail
            </div>
            <div className="mt-3 flex items-start justify-between gap-3">
              <div>
                <div className="font-display text-lg text-white">{activeSymbol}</div>
                <div
                  className={`mt-1 inline-flex rounded border px-2 py-0.5 text-[10px] uppercase ${
                    DIRECTION_TONE[activeDirection] ?? DIRECTION_TONE.neutral
                  }`}
                >
                  {activeDirection}
                </div>
              </div>
              <div className={`font-display text-5xl leading-none ${scoreTone(activeScore)}`}>
                {activeScore}
              </div>
            </div>
          </div>

          {/* TF dökümü — tüm timeframe candidate'leri */}
          <div>
            <div className="mb-1.5 text-[10px] uppercase tracking-widest text-white/42">
              Timeframe dökümü
            </div>
            <TfBreakdown rows={activeRow?.all ?? []} />
          </div>

          {/* Trade plan — actionable ise SL/TP */}
          <TradePlanBlock ticket={activeTicket} symbol={activeSymbol} />

          <div className="rounded border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  DIRECTION_DOT[activeDirection] ?? DIRECTION_DOT.neutral
                }`}
              />
              <span className="text-[10px] uppercase tracking-widest text-white/42">
                Agent interpretation
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-white/66">{brief.recommended_stance}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded border border-white/10 bg-white/[0.03] p-2">
              <div className="uppercase tracking-widest text-white/35">DQS</div>
              <div className="text-accent-cyan">{Math.round(brief.dqs?.score ?? 0)}</div>
            </div>
            <div className="rounded border border-white/10 bg-white/[0.03] p-2">
              <div className="uppercase tracking-widest text-white/35">Mode</div>
              <div className="text-amber-300">{brief.data_mode}</div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
