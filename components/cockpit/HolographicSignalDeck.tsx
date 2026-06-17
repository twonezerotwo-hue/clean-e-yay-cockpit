"use client";

import { useMemo, useState, type CSSProperties } from "react";

import type { AgentBrief, AgentBriefCandidate } from "@/types/generated/api";

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

function FallbackCandidate({ index }: { index: number }): AgentBriefCandidate {
  return {
    symbol: ["BTCUSD", "XAUUSD", "XAGUSD", "XCUUSD", "BRENT"][index] ?? "ASSET",
    direction: index % 3 === 0 ? "bullish" : index % 3 === 1 ? "neutral" : "bearish",
    score: [61, 48, 56, 85, 37][index] ?? 42,
    candidate_action: index % 2 ? "WATCH" : "LONG SETUP",
    final_action: "WAIT",
    actionable: false,
  };
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

export function HolographicSignalDeck({ brief }: { brief: AgentBrief }) {
  const candidates = useMemo(() => {
    const real = (brief.top_candidates ?? []).slice(0, 5);
    if (real.length) return real;
    return Array.from({ length: 5 }, (_, index) => FallbackCandidate({ index }));
  }, [brief.top_candidates]);
  const [activeIndex, setActiveIndex] = useState(() => Math.min(1, candidates.length - 1));
  const active = candidates[activeIndex] ?? candidates[0];
  const activeDirection = active?.direction ?? "neutral";
  const activeScore = score(active);
  const blocked = !brief.can_act;

  return (
    <section
      id="layer1_holographic_signals"
      data-panel="layer1_holographic_signals"
      className="relative overflow-hidden rounded-lg border border-accent-cyan/20 bg-[#03101b]/88 shadow-[0_0_36px_rgba(34,211,238,0.1)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-accent-cyan/18 bg-black/22 px-3 py-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.24em] text-accent-cyan/80">
            Holographic Command Signals
          </div>
          <div className="text-[11px] text-white/42">
            {candidates.length} asset signal layer / PAPER_SAFE / NO_EXECUTION
          </div>
        </div>
        <span className="rounded border border-amber-300/25 bg-amber-300/10 px-2 py-1 text-[10px] uppercase tracking-widest text-amber-300">
          {blocked ? "risk gated" : "gate clear"}
        </span>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="relative min-h-[380px] overflow-hidden border-r border-accent-cyan/12 bg-[radial-gradient(circle_at_50%_88%,rgba(34,211,238,0.22),transparent_28%),linear-gradient(180deg,rgba(4,14,28,0.75),rgba(2,5,13,0.95))]">
          <div className="holo-corner holo-corner-tl" />
          <div className="holo-corner holo-corner-tr" />
          <div className="holo-corner holo-corner-bl" />
          <div className="holo-corner holo-corner-br" />
          <div className="absolute inset-x-0 top-16 h-px bg-amber-300/35" />
          <div className="holo-scan" />

          <div className="absolute left-1/2 top-9 h-[210px] w-[1px] -translate-x-1/2 bg-gradient-to-b from-accent-cyan/55 to-transparent" />
          <div className="absolute left-1/2 top-[72px] h-[190px] w-[min(760px,94%)] -translate-x-1/2 [perspective:900px]">
            {candidates.map((candidate, index) => (
              <CandidateCard
                key={`${candidate.symbol ?? "candidate"}-${index}`}
                candidate={candidate}
                active={index === activeIndex}
                index={index}
                activeIndex={activeIndex}
                onSelect={() => setActiveIndex(index)}
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

        <aside className="min-h-[380px] bg-black/18 p-3">
          <div className="text-[10px] uppercase tracking-widest text-accent-cyan/70">
            Signal detail
          </div>
          <div className="mt-4 flex items-start justify-between gap-3">
            <div>
              <div className="font-display text-lg text-white">{active?.symbol ?? "--"}</div>
              <div className={`mt-1 inline-flex rounded border px-2 py-0.5 text-[10px] uppercase ${DIRECTION_TONE[activeDirection] ?? DIRECTION_TONE.neutral}`}>
                {activeDirection}
              </div>
            </div>
            <div className={`font-display text-5xl leading-none ${scoreTone(activeScore)}`}>
              {activeScore}
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {[
              ["Candidate", active?.candidate_action ?? "--"],
              ["Final", active?.final_action ?? "--"],
              ["Timeframe", active?.timeframe ?? "--"],
              ["Status", active?.actionable ? "ACTIONABLE" : "RAW / WATCH"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 border-b border-white/8 pb-2 text-xs">
                <span className="uppercase tracking-widest text-white/38">{label}</span>
                <span className="truncate text-white/78">{value}</span>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${DIRECTION_DOT[activeDirection] ?? DIRECTION_DOT.neutral}`} />
              <span className="text-[10px] uppercase tracking-widest text-white/42">
                Agent interpretation
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-white/66">{brief.recommended_stance}</p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
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
