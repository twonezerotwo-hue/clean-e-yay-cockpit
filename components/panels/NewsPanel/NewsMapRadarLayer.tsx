"use client";

/**
 * News Map Radar Layer — Clean E-yAy port.
 *
 * Veri kaynağı: parent'tan gelen `headlines` prop (NewsPanel).
 * Liste ve radar AYNI veri setini kullanır — ayrı fetch yok.
 *
 * Döngü: her haber 10sn featured → seri bitince 10sn all-pulse → başa.
 * Aktif nokta yanında floating ticker (bölge · kaynak · başlık).
 * Karar ÜRETMEZ. PAPER_SAFE — sadece görselleştirme.
 */
import { useEffect, useState } from "react";

import { geoForRegion, type GeoPoint } from "@/lib/news-region-map";
import { WORLD_LAND_PATHS } from "@/lib/world-map-path";
import type { NewsHeadline } from "@/types/generated/api";

// ── Types ─────────────────────────────────────────────────────────────────────

type Severity = "critical" | "high" | "medium" | "low";

interface EnrichedNode {
  id:       string;
  headline: string;
  source:   string;
  severity: Severity;
  category: string;
  age_min:  number | null;
  assets:   { asset: string; up: boolean; note: string }[];
  geo:      GeoPoint;
  actor:    { name: string; short: string } | null;
  url:      string;
  raw_title:string;
}

// Backend henüz NewsHeadline.url alanı dönmüyor; varsa kullanılır, yoksa
// Google News arama URL'sine düşülür (yeni sekme).
function urlForHeadline(h: NewsHeadline): string {
  const raw = (h as unknown as { url?: string }).url;
  if (raw && /^https?:\/\//.test(raw)) return raw;
  return `https://news.google.com/search?q=${encodeURIComponent(h.title)}`;
}

const KNOWN_ACTORS: { re: RegExp; name: string; short: string }[] = [
  { re: /\btrump\b/i,                       name: "Trump",     short: "DT" },
  { re: /\bpowell\b/i,                      name: "Powell",    short: "JP" },
  { re: /\bfed\b|federal reserve|fomc/i,    name: "Fed",       short: "FED" },
  { re: /\becb\b|avrupa merkez|lagarde/i,   name: "ECB",       short: "ECB" },
  { re: /\bopec\b/i,                        name: "OPEC",      short: "OPC" },
  { re: /\bputin\b/i,                       name: "Putin",     short: "VP" },
  { re: /\bxi\b|jinping/i,                  name: "Xi",        short: "XI" },
  { re: /\bboj\b|bank of japan|ueda/i,      name: "BoJ",       short: "BOJ" },
  { re: /\bbiden\b/i,                       name: "Biden",     short: "JB" },
  { re: /\bnetanyahu\b/i,                   name: "Netanyahu", short: "BN" },
  { re: /\berdoğan\b|\berdogan\b/i,         name: "Erdoğan",   short: "RTE" },
];

function detectActor(text: string): EnrichedNode["actor"] {
  for (const a of KNOWN_ACTORS) if (a.re.test(text)) return { name: a.name, short: a.short };
  return null;
}

type CyclePhase =
  | { mode: "sequence"; idx: number }
  | { mode: "all_pulse" };

const PHASE_MS = 10_000;

// ── Adapter (Clean NewsHeadline → EnrichedNode) ───────────────────────────────

const GEO_REGIONS = new Set(["Iran", "Israel", "Russia", "China", "Middle East"]);

function deriveSeverity(h: NewsHeadline): Severity {
  const fresh = h.freshness === "FRESH";
  const hasImpact = !!h.asset_impact && Object.keys(h.asset_impact).length > 0;
  const isGeo = !!h.region && GEO_REGIONS.has(h.region);
  if (fresh && (isGeo || hasImpact)) return "critical";
  if (isGeo || hasImpact) return "high";
  if (fresh) return "medium";
  return "low";
}

function toAgeMin(ts: string): number | null {
  if (!ts) return null;
  const ms = Date.now() - new Date(ts).getTime();
  if (isNaN(ms)) return null;
  return Math.max(0, Math.round(ms / 60_000));
}

function adaptImpact(impact: Record<string, number> | undefined) {
  if (!impact) return [];
  return Object.entries(impact).map(([asset, dir]) => ({
    asset,
    up:   dir < 0,                             // negative sentiment → risk-on (red)
    note: dir > 0 ? "risk yukarı" : dir < 0 ? "baskı" : "nötr",
  }));
}

function enrichHeadlines(headlines: NewsHeadline[]): EnrichedNode[] {
  return headlines.slice(0, 8).map((h, i) => {
    const text = (h.title_tr?.trim()) || h.title;
    const assets = adaptImpact(h.asset_impact);
    return {
      id:       `n${i}-${h.id}`,
      headline: text,
      raw_title:h.title,
      source:   h.source,
      severity: deriveSeverity(h),
      category: assets[0]?.asset.toLowerCase() ?? "news",
      age_min:  toAgeMin(h.ts),
      assets,
      geo:      geoForRegion(h.region),
      actor:    detectActor(text),
      url:      urlForHeadline(h),
    };
  });
}

function deriveRisk(nodes: EnrichedNode[]): string {
  if (nodes.some(n => n.severity === "critical")) return "critical";
  if (nodes.some(n => n.severity === "high"))     return "high";
  if (nodes.some(n => n.severity === "medium"))   return "medium";
  return "low";
}

function durForNode(n: EnrichedNode | null): number {
  if (!n) return PHASE_MS;
  return Math.min(20_000, Math.max(9_000, 4_000 + n.headline.length * 85));
}

// ── Style maps ────────────────────────────────────────────────────────────────

const SEV: Record<Severity, { dot: string; badge: string; text: string; label: string }> = {
  critical: { dot: "#f87171", badge: "bg-red-950/60 border-red-600/70 text-red-200",         text: "text-red-300",    label: "KRİTİK" },
  high:     { dot: "#fb923c", badge: "bg-orange-950/50 border-orange-600/60 text-orange-200", text: "text-orange-300", label: "YÜKSEK" },
  medium:   { dot: "#fbbf24", badge: "bg-amber-950/40 border-amber-600/50 text-amber-200",   text: "text-amber-300",  label: "ORTA" },
  low:      { dot: "#22d3ee", badge: "bg-cyan-950/40 border-cyan-700/50 text-cyan-200",      text: "text-cyan-300",   label: "DÜŞÜK" },
};

const RISK_BADGE: Record<string, string> = {
  critical: "bg-red-950/70 border-red-600/70 text-red-200",
  high:     "bg-orange-950/60 border-orange-500/60 text-orange-200",
  medium:   "bg-amber-950/50 border-amber-500/50 text-amber-200",
  low:      "bg-cyan-950/40 border-cyan-600/40 text-cyan-200",
};

// ── World map sub-component ───────────────────────────────────────────────────

function WorldMap({
  nodes, phase, animate, activeNode, activeSv, fill = false, durationMs = PHASE_MS,
}: {
  nodes:      EnrichedNode[];
  phase:      CyclePhase;
  animate:    boolean;
  activeNode: EnrichedNode | null;
  activeSv:   typeof SEV["low"] | null;
  fill?:      boolean;
  durationMs?: number;
}) {
  const allPulse  = phase.mode === "all_pulse";
  const activeIdx = phase.mode === "sequence" ? phase.idx : -1;

  const [zoomed, setZoomed] = useState(false);
  const activeId = activeNode?.id ?? null;
  useEffect(() => {
    if (!animate || !activeId) { setZoomed(false); return; }
    setZoomed(true);
    const t = setTimeout(() => setZoomed(false), Math.max(2_500, durationMs - 1_600));
    return () => clearTimeout(t);
  }, [activeId, animate, durationMs]);

  // ── 3D Earth projection ──────────────────────────────────────────────────
  // Earth: cx=500, cy=250, r=220 inside viewBox 1000x500.
  // (geo.x, geo.y) ∈ [0,1000]×[0,500] (equirectangular) → orthographic sphere.
  const EARTH_CX = 500;
  const EARTH_CY = 250;
  const EARTH_R = 220;
  // Camera longitude offset (Europe/Africa/Middle East centered, USA on left).
  const VIEW_LON_OFFSET = -15;
  function projectGeo(gx: number, gy: number) {
    const lon = (gx / 1000) * 360 - 180 - VIEW_LON_OFFSET;
    const lat = 90 - (gy / 500) * 180;
    const phi = (lon * Math.PI) / 180;
    const theta = (lat * Math.PI) / 180;
    const px = EARTH_CX + EARTH_R * Math.cos(theta) * Math.sin(phi);
    const py = EARTH_CY - EARTH_R * Math.sin(theta);
    const pz = Math.cos(theta) * Math.cos(phi);
    return { px, py, pz };
  }

  const activeProj = activeNode ? projectGeo(activeNode.geo.x, activeNode.geo.y) : null;
  const activeOnFront = activeProj ? activeProj.pz > 0.05 : false;
  // Ticker over the active pin if on front; else top-center fallback.
  const tickerAnchorLeft = activeProj ? activeProj.px > EARTH_CX + 80 : false;
  const tickerAnchorLow  = activeProj ? activeProj.py < EARTH_CY - 80 : false;
  const tickerTransformX = activeOnFront
    ? (tickerAnchorLeft ? "calc(-100% - 16px)" : "16px")
    : "-50%";
  const tickerTransformY = activeOnFront
    ? (tickerAnchorLow ? "6px" : "-50%")
    : "8px";
  const tickerLeftPct = activeOnFront && activeProj ? (activeProj.px / 1000) * 100 : 50;
  const tickerTopPct  = activeOnFront && activeProj ? (activeProj.py / 500) * 100 : 6;

  return (
    <div className={fill ? "absolute inset-0 w-full h-full" : "relative w-full"}
         style={fill ? undefined : { paddingBottom: "50%" }}>
      {animate && (
        <div
          className="absolute top-0 bottom-0 pointer-events-none z-10"
          style={{
            width: "90px",
            background: "linear-gradient(90deg, transparent, rgba(34,211,238,0.06), rgba(34,211,238,0.10))",
            animation: "bnm-scan 9s linear infinite",
          }}
        />
      )}

      {!allPulse && activeNode && activeSv && (
        <div
          className="absolute pointer-events-none z-20"
          style={{
            left:      `${tickerLeftPct}%`,
            top:       `${tickerTopPct}%`,
            transform: `translate(${tickerTransformX}, ${tickerTransformY})`,
            maxWidth:  zoomed ? "60%" : "42%",
            minWidth:  "160px",
            transition: animate ? "left 1.3s cubic-bezier(.4,0,.2,1), top 1.3s cubic-bezier(.4,0,.2,1)" : undefined,
          }}
          key={activeNode.id}
        >
          <div className="flex items-end gap-2">
            {activeNode.actor && (
              <div className="flex flex-col items-center shrink-0 pb-0.5">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 overflow-hidden font-mono font-black text-[10px] text-white"
                  style={{
                    borderColor: activeSv.dot,
                    background:  `radial-gradient(circle at 35% 30%, ${activeSv.dot}55, rgba(2,10,22,0.95))`,
                    boxShadow:   `0 0 12px ${activeSv.dot}55`,
                  }}
                >
                  {activeNode.actor.short}
                </span>
                <span className="mt-0.5 text-[10px] font-mono leading-none" style={{ color: activeSv.dot }}>
                  {activeNode.actor.name}
                </span>
              </div>
            )}

            <a
              href={activeNode.url}
              target="_blank"
              rel="noopener noreferrer"
              title="Habere git"
              className="relative rounded-xl border backdrop-blur-md px-3 py-2 block hover:brightness-125 transition-[filter] duration-200"
              style={{
                background:  "rgba(2,10,22,0.92)",
                borderColor: activeSv.dot + "66",
                boxShadow:   `0 0 18px ${activeSv.dot}33, inset 0 1px 0 ${activeSv.dot}33`,
              }}
            >
              {activeNode.actor && (
                <span aria-hidden="true" className="absolute -left-1.5 bottom-3 w-3 h-3 rotate-45 border-l border-b"
                      style={{ background: "rgba(2,10,22,0.92)", borderColor: activeSv.dot + "66" }} />
              )}
              <p className="text-[10px] font-mono truncate whitespace-nowrap"
                 style={{ color: activeSv.dot, opacity: 0.85 }}>
                {activeNode.geo.region} · {activeNode.source}
                {activeNode.age_min !== null ? ` · ${activeNode.age_min}dk` : ""}
              </p>
              <div className="overflow-hidden" style={{ maxWidth: "100%" }}>
                <span
                  className="inline-block text-sm sm:text-base font-semibold whitespace-nowrap"
                  style={{
                    color:      activeSv.dot,
                    textShadow: `0 0 10px ${activeSv.dot}44`,
                    animation:  animate && activeNode.headline.length > 36
                      ? `bnm-ticker ${((durationMs - 1_200) / 1000).toFixed(1)}s ease-in-out infinite`
                      : undefined,
                  }}
                >
                  {activeNode.headline}
                </span>
              </div>
            </a>
          </div>
        </div>
      )}

      <svg
        viewBox="0 0 1000 500"
        preserveAspectRatio={fill ? "none" : "xMidYMid meet"}
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="bnm-space" cx="50%" cy="50%" r="75%">
            <stop offset="0%"   stopColor="#040716" />
            <stop offset="55%"  stopColor="#020411" />
            <stop offset="100%" stopColor="#000004" />
          </radialGradient>
          <radialGradient id="bnm-ocean" cx="38%" cy="32%" r="78%">
            <stop offset="0%"   stopColor="#1e63d6" />
            <stop offset="45%"  stopColor="#0d3a82" />
            <stop offset="80%"  stopColor="#061a3d" />
            <stop offset="100%" stopColor="#020b1d" />
          </radialGradient>
          <radialGradient id="bnm-shine" cx="32%" cy="26%" r="55%">
            <stop offset="0%"   stopColor="rgba(125,211,252,0.55)" />
            <stop offset="45%"  stopColor="rgba(125,211,252,0.06)" />
            <stop offset="100%" stopColor="rgba(125,211,252,0)" />
          </radialGradient>
          <radialGradient id="bnm-atmo" cx="50%" cy="50%" r="58%">
            <stop offset="75%" stopColor="rgba(56,189,248,0)" />
            <stop offset="90%" stopColor="rgba(56,189,248,0.42)" />
            <stop offset="98%" stopColor="rgba(56,189,248,0.10)" />
            <stop offset="100%" stopColor="rgba(56,189,248,0)" />
          </radialGradient>
          <linearGradient id="bnm-terminator" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"  stopColor="rgba(0,0,0,0)" />
            <stop offset="55%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.62)" />
          </linearGradient>
          <clipPath id="bnm-globe-clip">
            <circle cx="500" cy="250" r="220" />
          </clipPath>
          <filter id="bnm-landglow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="1" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="bnm-bloom" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* Deep-space background */}
        <rect width="1000" height="500" fill="url(#bnm-space)" />

        {/* Star field — deterministic (no React state, render-stable) */}
        <g>
          {Array.from({ length: 140 }, (_, i) => {
            // Pseudo-random but stable
            const sx = ((i * 73.31) % 1000);
            const sy = ((i * 41.19) % 500);
            const sr = 0.4 + ((i * 7) % 10) / 22;
            const op = 0.35 + ((i * 13) % 100) / 220;
            const dur = 2.4 + ((i * 11) % 50) / 12;
            return (
              <circle key={`s${i}`} cx={sx} cy={sy} r={sr} fill="#cfe7ff" opacity={op}>
                {animate ? (
                  <animate
                    attributeName="opacity"
                    values={`${op};${op * 0.25};${op}`}
                    dur={`${dur.toFixed(2)}s`}
                    repeatCount="indefinite"
                  />
                ) : null}
              </circle>
            );
          })}
        </g>

        {/* Distant orbit ring */}
        <ellipse cx={EARTH_CX} cy={EARTH_CY} rx="335" ry="76" fill="none"
                 stroke="rgba(56,189,248,0.18)" strokeWidth="0.5"
                 strokeDasharray="6 8" transform={`rotate(-18 ${EARTH_CX} ${EARTH_CY})`} />
        <ellipse cx={EARTH_CX} cy={EARTH_CY} rx="305" ry="48" fill="none"
                 stroke="rgba(56,189,248,0.12)" strokeWidth="0.4"
                 transform={`rotate(22 ${EARTH_CX} ${EARTH_CY})`} />

        {/* Atmosphere outer glow (under sphere) */}
        <circle cx={EARTH_CX} cy={EARTH_CY} r="252" fill="url(#bnm-atmo)" />
        <circle cx={EARTH_CX} cy={EARTH_CY} r="235" fill="none"
                stroke="rgba(56,189,248,0.55)" strokeWidth="2" filter="url(#bnm-bloom)" />
        <circle cx={EARTH_CX} cy={EARTH_CY} r="228" fill="none"
                stroke="rgba(125,211,252,0.6)" strokeWidth="0.8" />

        {/* Sphere body — ocean radial gradient (3D shading) */}
        <circle cx={EARTH_CX} cy={EARTH_CY} r={EARTH_R} fill="url(#bnm-ocean)" />

        {/* Continents — clipped to sphere, slow horizontal rotation illusion */}
        <g clipPath="url(#bnm-globe-clip)">
          <g style={animate ? { animation: "bnm-earth-spin 90s linear infinite" } : undefined}>
            {/* Two copies side-by-side for seamless wrap. WORLD_LAND_PATHS is
                1000×500 equirectangular → scale into sphere bbox (440×440). */}
            {[0, 1].map((wrap) => (
              <g
                key={`land-${wrap}`}
                transform={`translate(${280 + wrap * 440} 30) scale(0.44 0.44)`}
                filter="url(#bnm-landglow)"
              >
                {WORLD_LAND_PATHS.map((d, j) => (
                  <path
                    key={j}
                    d={d}
                    fill="#1f6d3a"
                    stroke="#3aa56b"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                    opacity="0.92"
                  />
                ))}
              </g>
            ))}
          </g>

          {/* Latitude lines (foreshortened ellipses) */}
          {[15, 35, 55, 75].map((a) => {
            const rad = (a * Math.PI) / 180;
            const ry = EARTH_R * Math.cos(rad);
            const yOff = EARTH_R * Math.sin(rad);
            return (
              <g key={`lat${a}`}>
                <ellipse cx={EARTH_CX} cy={EARTH_CY - yOff} rx={EARTH_R} ry={ry * 0.04}
                         fill="none" stroke="rgba(125,211,252,0.16)" strokeWidth="0.5" />
                <ellipse cx={EARTH_CX} cy={EARTH_CY + yOff} rx={EARTH_R} ry={ry * 0.04}
                         fill="none" stroke="rgba(125,211,252,0.16)" strokeWidth="0.5" />
              </g>
            );
          })}
          {/* Equator */}
          <ellipse cx={EARTH_CX} cy={EARTH_CY} rx={EARTH_R} ry="10" fill="none"
                   stroke="rgba(56,189,248,0.28)" strokeWidth="0.6" />

          {/* Longitude great circles */}
          {[-60, -30, 0, 30, 60].map((deg) => {
            const rx = EARTH_R * Math.abs(Math.cos((deg * Math.PI) / 180)) + 0.001;
            return (
              <ellipse key={`lon${deg}`} cx={EARTH_CX} cy={EARTH_CY} rx={rx} ry={EARTH_R}
                       fill="none" stroke="rgba(125,211,252,0.15)" strokeWidth="0.5" />
            );
          })}
          <line x1={EARTH_CX} y1={EARTH_CY - EARTH_R} x2={EARTH_CX} y2={EARTH_CY + EARTH_R}
                stroke="rgba(56,189,248,0.22)" strokeWidth="0.6" />

          {/* Specular highlight (sun reflection) */}
          <circle cx={EARTH_CX} cy={EARTH_CY} r={EARTH_R} fill="url(#bnm-shine)" />
          {/* Day/night terminator */}
          <rect x={EARTH_CX - EARTH_R} y={EARTH_CY - EARTH_R} width={EARTH_R * 2} height={EARTH_R * 2}
                fill="url(#bnm-terminator)" />
        </g>

        {/* Sphere rim outline (above clip) */}
        <circle cx={EARTH_CX} cy={EARTH_CY} r={EARTH_R} fill="none"
                stroke="rgba(125,211,252,0.45)" strokeWidth="0.8" />

        {/* Network arcs in all-pulse — projected onto sphere */}
        {allPulse && nodes.length > 1 && (
          <g opacity="0.6">
            {nodes.slice(0, -1).map((n, i) => {
              const a = projectGeo(n.geo.x, n.geo.y);
              const b = projectGeo(nodes[i + 1].geo.x, nodes[i + 1].geo.y);
              if (a.pz < -0.1 || b.pz < -0.1) return null;
              // Arc midpoint pulled away from center for "above surface" effect
              const mx = (a.px + b.px) / 2;
              const my = (a.py + b.py) / 2;
              const dx = mx - EARTH_CX;
              const dy = my - EARTH_CY;
              const dlen = Math.hypot(dx, dy) || 1;
              const cx = EARTH_CX + (dx / dlen) * (EARTH_R + 22);
              const cy = EARTH_CY + (dy / dlen) * (EARTH_R + 22);
              return (
                <path
                  key={`net${i}`}
                  d={`M ${a.px} ${a.py} Q ${cx} ${cy} ${b.px} ${b.py}`}
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="0.9"
                  strokeDasharray="4 6"
                  opacity="0.55"
                  style={animate ? { animation: "bnm-dash 2.4s linear infinite" } : undefined}
                />
              );
            })}
          </g>
        )}

        {/* News pins projected on globe surface */}
        {nodes.map((node, i) => {
          const proj = projectGeo(node.geo.x, node.geo.y);
          const onFront = proj.pz > 0.05;
          const sv = SEV[node.severity] ?? SEV.low;
          const isActive = allPulse || i === activeIdx;
          const strong = !allPulse && i === activeIdx;
          const depthOp = onFront ? 1 : 0.25;
          return (
            <g
              key={node.id}
              transform={`translate(${proj.px},${proj.py})`}
              style={{ transition: "opacity 0.6s ease" }}
              opacity={(isActive ? 1 : 0.55) * depthOp}
            >
              {animate && isActive && onFront && (
                <circle r={strong ? 28 : 20} fill="none" stroke={sv.dot} strokeWidth="1.2"
                  opacity="0.35"
                  style={{ animation: `bnm-pulse ${allPulse ? "1.6s" : "2s"} ease-in-out infinite` }}
                />
              )}
              {animate && strong && onFront && (
                <circle r="14" fill="none" stroke={sv.dot} strokeWidth="0.9" opacity="0.55"
                  style={{ animation: "bnm-pulse 2s ease-in-out infinite", animationDelay: "0.6s" }}
                />
              )}
              <circle r={strong ? 9 : 5.5} fill="none" stroke={sv.dot}
                strokeWidth={strong ? 1.5 : 1} opacity="0.85" />
              <circle r={strong ? 5 : 3} fill={sv.dot}
                style={{ filter: `drop-shadow(0 0 ${strong ? 12 : 6}px ${sv.dot})` }}
              />
              {!strong && isActive && onFront && (
                <text x="0" y="-11" textAnchor="middle" fontSize="7"
                  fill="rgba(203,213,225,0.7)" fontFamily="monospace">
                  {node.geo.region.toUpperCase()}
                </text>
              )}
            </g>
          );
        })}

        {/* Orbiting satellite */}
        {animate && (
          <g
            style={{
              animation: "bnm-orbit 22s linear infinite",
              transformOrigin: `${EARTH_CX}px ${EARTH_CY}px`,
            }}
          >
            <line x1={EARTH_CX} y1={EARTH_CY - 270} x2={EARTH_CX} y2={EARTH_CY - 256}
                  stroke="rgba(56,189,248,0.7)" strokeWidth="0.6" />
            <circle cx={EARTH_CX} cy={EARTH_CY - 263} r="2.5" fill="#67e8f9"
                    style={{ filter: "drop-shadow(0 0 6px rgba(103,232,249,0.9))" }} />
          </g>
        )}
      </svg>
    </div>
  );
}

function SideNewsCard({
  node, active, dimmed, onClick,
}: { node: EnrichedNode; active: boolean; dimmed: boolean; onClick: () => void }) {
  const sv = SEV[node.severity] ?? SEV.low;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <div
      className={`relative w-full rounded-xl border transition-all duration-500 ${
        active
          ? `${sv.badge} shadow-[0_0_18px_rgba(0,0,0,0.45)] scale-[1.02]`
          : dimmed
            ? "bg-white/[0.02] border-white/10 opacity-60"
            : "bg-white/[0.03] border-white/10 hover:border-white/30"
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left px-3 py-2.5 pr-8"
      >
        <div className="flex items-center gap-1.5 mb-1">
          <span className={`rounded px-1 py-0.5 text-[10px] font-mono font-black uppercase tracking-widest border ${sv.badge}`}>
            {sv.label}
          </span>
          <span className="text-[10px] font-mono text-white/50 truncate max-w-[90px]">{node.source}</span>
          {node.age_min !== null && (
            <span className="text-[10px] font-mono text-white/30 ml-auto shrink-0">
              {mounted ? `${node.age_min}dk` : "—"}
            </span>
          )}
        </div>
        <p className="text-[10px] text-white/80 leading-snug line-clamp-2">{node.headline}</p>
        <p className="text-[10px] font-mono text-white/40 mt-0.5">📍 {node.geo.region} · {node.category}</p>
      </button>
      <a
        href={node.url}
        target="_blank"
        rel="noopener noreferrer"
        title="Habere git"
        aria-label="Habere git"
        className="absolute right-1.5 top-1.5 rounded border border-white/15 bg-black/30 px-1 py-0.5 text-[10px] text-white/55 hover:border-cyan-400/60 hover:text-cyan-200"
        onClick={(e) => e.stopPropagation()}
      >
        ↗
      </a>
    </div>
  );
}

function AssetCard({ a }: { a: { asset: string; up: boolean; note: string } }) {
  const ICONS: Record<string, { icon: string; color: string }> = {
    BRENT:  { icon: "🛢", color: "text-orange-300" },
    XAUUSD: { icon: "Au", color: "text-amber-300" },
    XAGUSD: { icon: "Ag", color: "text-slate-300" },
    BTCUSD: { icon: "₿",  color: "text-purple-300" },
    ETHUSD: { icon: "Ξ",  color: "text-indigo-300" },
    DXY:    { icon: "$",  color: "text-cyan-300" },
    VIX:    { icon: "⚡", color: "text-red-300" },
  };
  const meta = ICONS[a.asset] ?? { icon: a.asset.slice(0, 2), color: "text-slate-300" };
  return (
    <div className={`rounded-xl border px-3 py-2 bg-white/[0.04] backdrop-blur-sm ${
      a.up ? "border-red-600/40" : "border-cyan-700/40"
    }`}>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-bold shrink-0 ${meta.color}`}>{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono font-bold text-white/70">{a.asset}</p>
          <p className="text-[10px] font-mono text-white/50 truncate">{a.note}</p>
        </div>
        <span className={`text-[10px] font-mono font-semibold shrink-0 ${a.up ? "text-red-300" : "text-cyan-300"}`}>
          {a.up ? "↑ risk" : "↓ baskı"}
        </span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  headlines: NewsHeadline[];
}

export function NewsMapRadarLayer({ headlines }: Props) {
  const [phase,    setPhase]   = useState<CyclePhase>({ mode: "sequence", idx: 0 });
  const [animate,  setAnimate] = useState(false);
  const [isMobile, setMobile]  = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setAnimate(!mq.matches);
    const onMQ = () => setAnimate(!mq.matches);
    mq.addEventListener?.("change", onMQ);
    setMobile(window.innerWidth < 640);
    const onResize = () => setMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => {
      mq.removeEventListener?.("change", onMQ);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const enriched  = enrichHeadlines(headlines);
  const nodeCount = enriched.length;

  const phaseDur = phase.mode === "sequence"
    ? durForNode(enriched[phase.idx % Math.max(nodeCount, 1)] ?? null)
    : PHASE_MS;

  useEffect(() => {
    if (nodeCount === 0) return;
    const t = setTimeout(() => {
      setPhase(p => {
        if (p.mode === "all_pulse")    return { mode: "sequence", idx: 0 };
        if (p.idx >= nodeCount - 1)    return nodeCount > 1 ? { mode: "all_pulse" } : { mode: "sequence", idx: 0 };
        return { mode: "sequence", idx: p.idx + 1 };
      });
    }, phaseDur);
    return () => clearTimeout(t);
  }, [phase, nodeCount, phaseDur]);

  if (enriched.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-ink-800/40 p-5">
        <p className="text-xs text-white/40 italic">Aktif son dakika haber kaydı yok.</p>
      </div>
    );
  }

  const allPulse   = phase.mode === "all_pulse";
  const safeIdx    = phase.mode === "sequence" ? phase.idx % enriched.length : 0;
  const activeNode = enriched[safeIdx];
  const sv         = SEV[activeNode.severity] ?? SEV.low;
  const riskLevel  = deriveRisk(enriched);
  const riskBadge  = RISK_BADGE[riskLevel] ?? RISK_BADGE.low;

  const impacts = allPulse
    ? enriched.flatMap(n => n.assets).slice(0, 5)
    : activeNode.assets.slice(0, 5);

  return (
    <div
      className="w-full max-w-full min-w-0 rounded-xl border border-white/10 bg-[#030e1c] overflow-hidden"
      data-testid="news-map-radar"
      data-cycle-mode={phase.mode}
    >
      <style>{`
        @keyframes bnm-pulse      { 0%,100%{opacity:.28;transform:scale(1)} 50%{opacity:.70;transform:scale(1.45)} }
        @keyframes bnm-scan       { from{left:-90px} to{left:100%} }
        @keyframes bnm-dash       { to{stroke-dashoffset:-16} }
        @keyframes bnm-breathe    { 0%,100%{transform:scale(1)} 50%{transform:scale(1.012)} }
        @keyframes bnm-fadein     { from{opacity:0;transform:translateY(3px)} to{opacity:1;transform:none} }
        @keyframes bnm-ticker     { 0%,12%{transform:translateX(0)} 78%,100%{transform:translateX(-55%)} }
        @keyframes bnm-earth-spin { from{transform:translateX(0)} to{transform:translateX(-440px)} }
        @keyframes bnm-orbit      { from{transform:rotate(0)} to{transform:rotate(360deg)} }
      `}</style>

      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/30">
        <div>
          <p className="text-[11px] font-mono font-bold text-white/70 uppercase tracking-widest">
            Son Dakika Haber Radarı
          </p>
          <p className="text-[10px] font-mono text-white/50 mt-0.5">
            {enriched.length} haber · PAPER_SAFE · sadece görselleştirme
          </p>
        </div>
        <div className="flex items-center gap-2">
          {allPulse && (
            <span className="text-[10px] font-mono text-cyan-300/80 uppercase tracking-widest">
              ◉ Global görünüm
            </span>
          )}
          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest ${riskBadge}`}>
            Risk: {riskLevel}
          </span>
        </div>
      </div>

      {!isMobile && (
        <div className="relative min-h-[440px]">
          <WorldMap
            fill
            nodes={enriched}
            phase={phase}
            animate={animate}
            activeNode={!allPulse ? activeNode : null}
            activeSv={!allPulse ? sv : null}
            durationMs={phaseDur}
          />

          <div className="relative z-10 grid grid-cols-[190px_minmax(0,1fr)_175px] min-h-[440px] pointer-events-none">
            <div className="pointer-events-auto border-r border-white/10 p-3 flex flex-col gap-2 bg-black/45 backdrop-blur-[2px] overflow-y-auto max-h-[460px]">
              <p className="text-[10px] font-mono text-white/50 uppercase tracking-widest shrink-0">
                Haberler · {enriched.length}
              </p>
              {enriched.map((n, i) => (
                <SideNewsCard
                  key={n.id} node={n}
                  active={!allPulse && i === safeIdx}
                  dimmed={allPulse}
                  onClick={() => setPhase({ mode: "sequence", idx: i })}
                />
              ))}
            </div>

            <div className="flex flex-col justify-end min-w-0">
              <div className="pointer-events-auto px-4 py-2 border-t border-white/10 bg-black/55 backdrop-blur-[2px] text-center"
                   key={allPulse ? "all" : activeNode.id}
                   style={animate ? { animation: "bnm-fadein 0.5s ease" } : undefined}>
                {allPulse ? (
                  <p className="text-[10px] font-mono text-cyan-300/90">
                    ◉ GLOBAL RİSK GÖRÜNÜMÜ · {enriched.length} aktif bölge
                  </p>
                ) : (
                  <>
                    <p className="text-[10px] font-mono">
                      <span className={`font-bold ${sv.text}`}>● {activeNode.geo.region}</span>
                      <span className="text-white/40"> · {activeNode.source}</span>
                    </p>
                    <p className="text-xs text-white/60 truncate mt-0.5 max-w-[460px] mx-auto">
                      {activeNode.headline.slice(0, 95)}{activeNode.headline.length > 95 ? "…" : ""}
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="pointer-events-auto border-l border-white/10 p-3 flex flex-col gap-2 bg-black/45 backdrop-blur-[2px]">
              <p className="text-[10px] font-mono text-white/50 uppercase tracking-widest shrink-0">
                Etkilenen Varlıklar
              </p>
              {impacts.length > 0
                ? impacts.map((a, i) => <AssetCard key={i} a={a} />)
                : <p className="text-[10px] font-mono text-white/30 italic">Varlık etkisi yok.</p>
              }
            </div>
          </div>
        </div>
      )}

      {isMobile && (
        <div className="space-y-3 p-3 bg-[#020a16]">
          <WorldMap
            nodes={enriched} phase={phase} animate={false}
            activeNode={null} activeSv={null}
          />
          <div className={`rounded-xl border p-3 ${sv.badge}`}>
            <p className="text-[10px] font-mono mb-0.5">
              {activeNode.source} · 📍 {activeNode.geo.region}
            </p>
            <p className="text-xs text-white/80 leading-snug">{activeNode.headline}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {impacts.slice(0, 4).map((a, i) => <AssetCard key={i} a={a} />)}
          </div>
          <div className="flex gap-2 flex-wrap justify-center">
            {enriched.map((n, i) => (
              <button
                key={n.id} type="button"
                onClick={() => setPhase({ mode: "sequence", idx: i })}
                aria-label={n.geo.region}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  !allPulse && i === safeIdx ? "ring-1 ring-white/60 scale-125" : "opacity-50"
                }`}
                style={{ background: (SEV[n.severity] ?? SEV.low).dot }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="px-4 py-2 border-t border-white/10 bg-black/30">
        <p className="text-[10px] font-mono text-white/40 text-center">
          Radar yalnızca haber görselleştirmesidir · karar üretmez · ham veri liste görünümünde
        </p>
      </div>
    </div>
  );
}
