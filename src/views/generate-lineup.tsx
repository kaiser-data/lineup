import "../index.css";
import { useMemo, useState, useEffect, useRef } from "react";
import {
  useDownload,
  useLayout,
  useViewState,
  useRequestSize,
  useOpenExternal,
} from "skybridge/web";
import { QRCodeSVG } from "qrcode.react";
import { createAvatar } from "@dicebear/core";
import { lorelei, notionists, bottts, shapes } from "@dicebear/collection";
import { useToolInfo, useCallTool } from "../helpers.js";

const SHARE_BASE = "https://kaiser-data.github.io/lineup/";

const STYLE_OPTIONS = ["notionists", "lorelei", "bottts", "shapes"] as const;
type StyleOption = (typeof STYLE_OPTIONS)[number];
const STYLE_LABELS: Record<StyleOption, string> = {
  lorelei: "Lorelei",
  notionists: "Notionists",
  bottts: "Bottts",
  shapes: "Shapes",
};
/**
 * Resolve a DiceBear collection by name **at call time**, not at module-eval
 * time. The previous `const STYLE_DEFS = { lorelei, … }` captured the collection
 * bindings during module init — and under the production bundler (Vite 8 /
 * Rolldown) those bindings can still be `undefined` at that point due to
 * module-initialization ordering, so `createAvatar(undefined, …)` threw
 * "Cannot read properties of undefined (reading 'schema')" and crashed the
 * whole view. Reading the imports inside the function defers the lookup until
 * after all modules have initialized.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function styleDef(style: StyleOption): any {
  const defs: Record<StyleOption, unknown> = { lorelei, notionists, bottts, shapes };
  return defs[style] ?? defs.lorelei;
}

/**
 * Generate an avatar SVG client-side for instant style flipping. Falls back to
 * the server-rendered SVG (`fallbackSvg`) if the collection can't be resolved
 * or DiceBear throws, so the badge always renders something valid.
 */
function generateAvatar(
  seed: string,
  style: StyleOption,
  fallbackSvg = "",
  gender?: Gender | null,
): string {
  try {
    const def = styleDef(style);
    if (def) {
      return createAvatar(def, {
        seed,
        size: 256,
        backgroundColor: ["transparent"],
        ...genderOptions(gender),
      }).toString();
    }
  } catch {
    // fall through to the server-provided SVG
  }
  return fallbackSvg;
}

function base64FromDataUrl(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeSharePayload(p: unknown): string {
  return bytesToB64url(new TextEncoder().encode(JSON.stringify(p)));
}

/**
 * Compress the payload with deflate-raw (≈40% shorter link / denser QR) and
 * mark it with a leading "z" so the share page knows to inflate it. Falls back
 * to the plain (uncompressed) encoding when CompressionStream is unavailable,
 * so the link always works. The whole pack still rides in the URL fragment —
 * nothing is stored.
 */
async function encodeSharePayloadCompressed(p: unknown): Promise<string> {
  const json = JSON.stringify(p);
  try {
    if (typeof CompressionStream === "undefined") throw new Error("no CompressionStream");
    const input = new Blob([json]).stream().pipeThrough(
      new CompressionStream("deflate-raw"),
    );
    const buf = new Uint8Array(await new Response(input).arrayBuffer());
    return "z" + bytesToB64url(buf);
  } catch {
    return encodeSharePayload(p); // plain fallback (decoded as legacy)
  }
}

async function buildShareUrl(input: {
  title: string;
  dateISO: string;
  venue?: string | null;
  accentHex?: string | null;
  rsvpUrl?: string | null;
  avatarStyle?: string | null;
  durationHours?: number;
  attendees: { name: string; role?: string; seed?: string; gender?: Gender | null }[];
}): Promise<string> {
  // Short keys keep the link (and therefore the QR) compact. Schema v2:
  // t=title d=dateISO v=venue a=accentHex u=rsvpUrl y=avatarStyle h=durationHours
  // p=attendees [{ n=name r=role s=seed g=gender }]. Omitted fields fall back to
  // defaults on the share page. The share page also still reads legacy long keys.
  const payload = {
    t: input.title,
    d: input.dateISO,
    ...(input.venue ? { v: input.venue } : {}),
    ...(input.accentHex ? { a: input.accentHex } : {}),
    ...(input.rsvpUrl ? { u: input.rsvpUrl } : {}),
    ...(input.avatarStyle ? { y: input.avatarStyle } : {}),
    ...(input.durationHours ? { h: input.durationHours } : {}),
    p: input.attendees.map((a) => ({
      n: a.name,
      ...(a.role ? { r: a.role } : {}),
      // only include when a re-roll changed it, to keep the link short
      ...(a.seed && a.seed !== a.name ? { s: a.seed } : {}),
      ...(a.gender && a.gender !== "x" ? { g: a.gender } : {}),
    })),
  };
  return `${SHARE_BASE}#${await encodeSharePayloadCompressed(payload)}`;
}

type Gender = "m" | "f" | "x";

type Badge = {
  name: string;
  role: string;
  gender?: Gender | null;
  avatarSvg: string;
  vcardQrSvg: string;
};

/**
 * DiceBear option overrides for a gender hint — kept in sync with the server's
 * `genderOptions` (src/lib/avatars.ts) and the share page so a face looks the
 * same everywhere. Only affects lorelei & notionists.
 */
function genderOptions(gender?: Gender | null): Record<string, number> {
  if (gender === "m") return { beardProbability: 100, earringsProbability: 0 };
  if (gender === "f") return { beardProbability: 0, earringsProbability: 100 };
  return {};
}

type EventInfo = {
  title: string;
  dateISO: string;
  venue: string | null;
  accentHex: string;
  rsvpUrl: string | null;
  avatarStyle?: string;
  icsString: string;
  qrSvg: string;
};

type Output = { event: EventInfo; badges: Badge[] };

function svgToDataUrl(svg: string): string {
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, "%27")
    .replace(/"/g, "%22");
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Compact UTC stamp Google Calendar wants: 20260528T160000Z. */
function gcalStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Build a Google Calendar "add event" template URL. Opened via the host's
 * openExternal bridge, this works inside ChatGPT's sandboxed iframe where the
 * `download()` bridge (and therefore an .ics file) is a no-op. Returns null for
 * an unparseable date so the caller can hide the button.
 */
function buildGCalUrl(event: EventInfo): string | null {
  const start = new Date(event.dateISO);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${gcalStamp(start)}/${gcalStamp(end)}`,
  });
  if (event.venue) params.set("location", event.venue);
  params.set(
    "details",
    event.rsvpUrl ? `RSVP: ${event.rsvpUrl}` : "Created with Lineup",
  );
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Shared outline "pill" button style for the header's secondary actions. */
function pillBtn(border: string): React.CSSProperties {
  return {
    background: "transparent",
    color: "inherit",
    border: `1px solid ${border}`,
    borderRadius: 999,
    padding: "10px 18px",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  };
}

function formatDate(dateISO: string): { day: string; time: string } {
  try {
    const d = new Date(dateISO);
    const day = d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const time = d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
    return { day, time };
  } catch {
    return { day: dateISO, time: "" };
  }
}

/**
 * Report the rendered content height to the host. Skybridge does NOT auto-size
 * the widget iframe — without this, hosts that start the iframe collapsed
 * (e.g. the Alpic playground) leave the view at ~0px tall and nothing is
 * visible, not even the loading skeleton. Pairs `useRequestSize` with a
 * `ResizeObserver` per the documented pattern.
 */
function useAutoSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const requestSize = useRequestSize();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const report = () => requestSize({ height: el.scrollHeight });
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [requestSize]);
  return ref;
}

/** Honour the user's reduced-motion preference for the showy bits. */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(m.matches);
    on();
    m.addEventListener?.("change", on);
    return () => m.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

/**
 * One-shot celebration burst in the event accent when the pack first lands —
 * the "tada" moment for the live demo. Self-contained (no dependency), fixed
 * overlay, pointer-transparent, and auto-unmounts. Skipped under reduced motion.
 */
function Confetti({ accent }: { accent: string }) {
  const reduced = useReducedMotion();
  const [done, setDone] = useState(false);
  const pieces = useMemo(() => {
    const colors = [accent, rgba(accent, 0.65), "#fbbf24", "#34d399", "#f472b6", "#60a5fa"];
    return Array.from({ length: 44 }, (_, i) => ({
      left: ((i * 2.27) % 100),
      cx: ((i * 37) % 140) - 70,
      cr: ((i * 97) % 720) + 200,
      delay: (i * 23) % 260,
      dur: 1300 + ((i * 61) % 800),
      color: colors[i % colors.length],
      w: 6 + (i % 3) * 2,
      h: 10 + (i % 4) * 2,
    }));
  }, [accent]);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), 2400);
    return () => clearTimeout(t);
  }, []);
  if (reduced || done) return null;
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 50,
      }}
    >
      {pieces.map((p, i) => (
        <span
          key={i}
          style={
            {
              position: "absolute",
              top: -18,
              left: `${p.left}%`,
              width: p.w,
              height: p.h,
              background: p.color,
              borderRadius: 2,
              "--cx": `${p.cx}px`,
              "--cr": `${p.cr}deg`,
              animation: `lineup-confetti ${p.dur}ms cubic-bezier(0.4,0.1,0.7,1) ${p.delay}ms forwards`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

export default function GenerateLineup() {
  const { output, isPending } = useToolInfo<"generate-lineup">();
  const { theme } = useLayout();
  const isDark = theme === "dark";
  const rootRef = useAutoSize<HTMLDivElement>();

  const data = output as Output | undefined;
  const initialStyle: StyleOption =
    data?.event?.avatarStyle && STYLE_OPTIONS.includes(data.event.avatarStyle as StyleOption)
      ? (data.event.avatarStyle as StyleOption)
      : "notionists";

  const [{ selectedBadge, selectedStyle, seedBumps }, setViewState] = useViewState<{
    selectedBadge: string | null;
    selectedStyle: StyleOption;
    seedBumps: Record<string, number>;
  }>({ selectedBadge: null, selectedStyle: initialStyle, seedBumps: {} });

  return (
    <div ref={rootRef}>
      {isPending || !output || !data ? (
        <LineupSkeleton isDark={isDark} />
      ) : (
        <LineupCard
          data={data}
          isDark={isDark}
          selectedBadge={selectedBadge}
          selectedStyle={selectedStyle}
          seedBumps={seedBumps ?? {}}
          onSelect={(name) =>
            setViewState((prev) => ({
              ...prev,
              selectedBadge: prev.selectedBadge === name ? null : name,
            }))
          }
          onStyle={(s) =>
            setViewState((prev) => ({ ...prev, selectedStyle: s }))
          }
          onShuffle={(name) =>
            setViewState((prev) => ({
              ...prev,
              seedBumps: {
                ...(prev.seedBumps ?? {}),
                [name]: ((prev.seedBumps ?? {})[name] ?? 0) + 1,
              },
            }))
          }
        />
      )}
    </div>
  );
}

/**
 * Effective DiceBear seed for an attendee. Re-rolling ("dice") bumps a counter
 * so the same person gets a fresh face while keeping the crew's shared style.
 * Bump 0 = the canonical name (matches the server-rendered avatar).
 */
function seedFor(name: string, bump: number): string {
  return bump > 0 ? `${name} ${bump + 1}` : name;
}

function LineupSkeleton({ isDark }: { isDark: boolean }) {
  const surface = isDark ? "#0b0b0f" : "#fafaf7";
  const block = isDark ? "#1f1f27" : "#ececea";
  const card = isDark ? "#15151c" : "#ffffff";
  const shimmer: React.CSSProperties = {
    background: `linear-gradient(90deg, ${block} 25%, ${
      isDark ? "#2a2a34" : "#f4f4f2"
    } 37%, ${block} 63%)`,
    backgroundSize: "400% 100%",
    animation: "gradient-flow 1.4s ease infinite",
  };
  return (
    <div style={{ background: surface, padding: 20 }} className="space-y-5">
      <div
        style={{
          background: card,
          borderRadius: 24,
          padding: 28,
          display: "flex",
          gap: 24,
          alignItems: "center",
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ ...shimmer, height: 14, width: 70, borderRadius: 6 }} />
          <div style={{ ...shimmer, height: 30, width: "70%", borderRadius: 8, marginTop: 14 }} />
          <div style={{ ...shimmer, height: 14, width: "45%", borderRadius: 6, marginTop: 16 }} />
        </div>
        <div style={{ ...shimmer, width: 132, height: 132, borderRadius: 18 }} />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 16,
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{ ...shimmer, aspectRatio: "3 / 4", borderRadius: 18 }}
          />
        ))}
      </div>
    </div>
  );
}

function LineupCard({
  data,
  isDark,
  selectedBadge,
  selectedStyle,
  seedBumps,
  onSelect,
  onStyle,
  onShuffle,
}: {
  data: Output;
  isDark: boolean;
  selectedBadge: string | null;
  selectedStyle: StyleOption;
  seedBumps: Record<string, number>;
  onSelect: (name: string) => void;
  onStyle: (s: StyleOption) => void;
  onShuffle: (name: string) => void;
}) {
  const { event, badges } = data;
  const { day, time } = useMemo(() => formatDate(event.dateISO), [event.dateISO]);
  const accent = event.accentHex;
  const [shareUrl, setShareUrl] = useState(SHARE_BASE);
  useEffect(() => {
    let live = true;
    buildShareUrl({
      title: event.title,
      dateISO: event.dateISO,
      venue: event.venue,
      accentHex: event.accentHex,
      rsvpUrl: event.rsvpUrl,
      avatarStyle: selectedStyle,
      attendees: badges.map((b) => ({
        name: b.name,
        role: b.role,
        seed: seedFor(b.name, seedBumps[b.name] ?? 0),
        gender: b.gender,
      })),
    }).then((url) => {
      if (live) setShareUrl(url);
    });
    return () => {
      live = false;
    };
  }, [event, badges, selectedStyle, seedBumps]);
  const surface = isDark ? "#0b0b0f" : "#fafaf7";
  const cardBg = isDark ? "#15151c" : "#ffffff";
  const subtext = isDark ? "#a1a1aa" : "#52525b";
  const border = isDark ? "#27272a" : "#e4e4e7";

  return (
    <div
      data-llm={`Lineup for "${event.title}"${
        event.venue ? ` at ${event.venue}` : ""
      } on ${day} ${time}. ${badges.length} attendees: ${badges
        .map((b) => `${b.name} (${b.role})`)
        .join(", ")}. Avatar style: ${selectedStyle}.${
        selectedBadge ? ` Currently focused on ${selectedBadge}'s badge.` : ""
      }`}
      style={{
        background: surface,
        color: isDark ? "#fafafa" : "#111111",
        padding: "20px",
        fontFamily:
          "'Inter', ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
      className="space-y-5"
    >
      <Confetti accent={accent} />
      <EventHeader
        event={event}
        day={day}
        time={time}
        cardBg={cardBg}
        border={border}
        subtext={subtext}
        accent={accent}
        shareUrl={shareUrl}
        selectedStyle={selectedStyle}
        onStyle={onStyle}
      />
      <BadgeGrid
        event={event}
        badges={badges}
        accent={accent}
        cardBg={cardBg}
        border={border}
        subtext={subtext}
        shareUrl={shareUrl}
        selectedBadge={selectedBadge}
        selectedStyle={selectedStyle}
        seedBumps={seedBumps}
        onSelect={onSelect}
        onShuffle={onShuffle}
      />
    </div>
  );
}

function EventHeader({
  event,
  day,
  time,
  cardBg,
  border,
  subtext,
  accent,
  shareUrl,
  selectedStyle,
  onStyle,
}: {
  event: EventInfo;
  day: string;
  time: string;
  cardBg: string;
  border: string;
  subtext: string;
  accent: string;
  shareUrl: string;
  selectedStyle: StyleOption;
  onStyle: (s: StyleOption) => void;
}) {
  const openExternal = useOpenExternal();
  const [copied, setCopied] = useState<null | "ok" | "fail">(null);
  const gcalUrl = useMemo(() => buildGCalUrl(event), [event]);

  // Clipboard is blocked in the sandboxed iframe, so try the API, then fall
  // back to a hidden-textarea execCommand copy (often works under the click
  // gesture). Either way the link is rendered as selectable text below.
  const copyShare = async () => {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        ok = true;
      }
    } catch {
      /* fall through to execCommand */
    }
    if (!ok) {
      try {
        const ta = document.createElement("textarea");
        ta.value = shareUrl;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        /* selectable text below is the final fallback */
      }
    }
    setCopied(ok ? "ok" : "fail");
    setTimeout(() => setCopied(null), 2400);
  };

  return (
    <div
      className="lineup-anim-drop"
      style={{
        background: cardBg,
        border: `1px solid ${border}`,
        borderRadius: 24,
        padding: 28,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(120% 80% at 0% 0%, ${rgba(
            accent,
            0.18,
          )} 0%, transparent 55%), radial-gradient(80% 60% at 100% 100%, ${rgba(
            accent,
            0.1,
          )} 0%, transparent 60%)`,
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative", display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 280px", minWidth: 260 }}>
          <div
            style={{
              display: "inline-block",
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: accent,
              fontWeight: 600,
              marginBottom: 12,
            }}
          >
            Lineup
          </div>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 700,
              lineHeight: 1.1,
              margin: 0,
              marginBottom: 14,
              letterSpacing: "-0.02em",
            }}
          >
            {event.title}
          </h1>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, color: subtext, fontSize: 14 }}>
            <div>
              <span style={{ fontWeight: 600, color: "inherit" }}>{day}</span>
              {time ? <span> · {time}</span> : null}
            </div>
            {event.venue ? <div>{event.venue}</div> : null}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
            <button
              onClick={() => openExternal(shareUrl)}
              style={{
                background: accent,
                color: "#fff",
                border: "none",
                borderRadius: 999,
                padding: "10px 18px",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Open live page →
            </button>
            {gcalUrl ? (
              <button onClick={() => openExternal(gcalUrl)} style={pillBtn(border)}>
                Add to calendar
              </button>
            ) : null}
            {event.rsvpUrl ? (
              <button onClick={() => openExternal(event.rsvpUrl!)} style={pillBtn(border)}>
                RSVP
              </button>
            ) : null}
            <button onClick={copyShare} style={pillBtn(border)}>
              {copied === "ok"
                ? "Copied ✓"
                : copied === "fail"
                  ? "Select link ↓"
                  : "Copy link"}
            </button>
          </div>
          <div
            style={{
              marginTop: 12,
              fontSize: 12,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              color: subtext,
              userSelect: "all",
              wordBreak: "break-all",
              cursor: "text",
            }}
            title="Tap to select, then copy"
          >
            {shareUrl}
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: subtext }}>
            Scan the QR or open the live page — the whole pack rides in the link,
            nothing is stored.
          </div>
        </div>
        <div
          style={{
            position: "relative",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: -10,
              borderRadius: 28,
              background: rgba(accent, 0.25),
              filter: "blur(18px)",
              zIndex: 0,
            }}
          />
          <div
            style={{
              position: "relative",
              zIndex: 1,
              width: 140,
              height: 140,
              borderRadius: 18,
              background: "#fff",
              padding: 12,
              border: `1px solid ${border}`,
              lineHeight: 0,
            }}
            title="Scan to open the live page"
          >
            <QRCodeSVG value={shareUrl} size={116} level="L" />
          </div>
          <div
            style={{
              position: "relative",
              zIndex: 1,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.04em",
              color: subtext,
            }}
          >
            Scan → live page
          </div>
        </div>
      </div>

      <div
        style={{
          position: "relative",
          marginTop: 22,
          paddingTop: 20,
          borderTop: `1px solid ${border}`,
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 13, color: subtext, marginRight: 4 }}>
          Style
        </div>
        {STYLE_OPTIONS.map((s) => {
          const active = s === selectedStyle;
          return (
            <button
              key={s}
              onClick={() => onStyle(s)}
              style={{
                background: active ? accent : "transparent",
                color: active ? "#fff" : "inherit",
                border: `1px solid ${active ? accent : border}`,
                borderRadius: 999,
                padding: "6px 14px",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                transition:
                  "background 160ms ease, color 160ms ease, border-color 160ms ease",
              }}
            >
              {STYLE_LABELS[s]}
            </button>
          );
        })}
      </div>

    </div>
  );
}

function BadgeGrid({
  event,
  badges,
  accent,
  cardBg,
  border,
  subtext,
  shareUrl,
  selectedBadge,
  selectedStyle,
  seedBumps,
  onSelect,
  onShuffle,
}: {
  event: EventInfo;
  badges: Badge[];
  accent: string;
  cardBg: string;
  border: string;
  subtext: string;
  shareUrl: string;
  selectedBadge: string | null;
  selectedStyle: StyleOption;
  seedBumps: Record<string, number>;
  onSelect: (name: string) => void;
  onShuffle: (name: string) => void;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 14 }}>
          The crew · {badges.length}
        </div>
        <div style={{ color: subtext, fontSize: 12 }}>
          Click a face to shuffle it · scan QR to save contact
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 16,
        }}
      >
        {badges.map((badge, i) => (
          <BadgeCard
            key={badge.name}
            index={i}
            badge={badge}
            event={event}
            accent={accent}
            cardBg={cardBg}
            border={border}
            subtext={subtext}
            shareUrl={shareUrl}
            selectedStyle={selectedStyle}
            seedBump={seedBumps[badge.name] ?? 0}
            selected={selectedBadge === badge.name}
            onSelect={() => onSelect(badge.name)}
            onShuffle={() => onShuffle(badge.name)}
          />
        ))}
      </div>
    </div>
  );
}

function BadgeCard({
  index,
  badge,
  event,
  accent,
  cardBg,
  border,
  subtext,
  shareUrl,
  selectedStyle,
  seedBump,
  selected,
  onSelect,
  onShuffle,
}: {
  index: number;
  badge: Badge;
  event: EventInfo;
  accent: string;
  cardBg: string;
  border: string;
  subtext: string;
  shareUrl: string;
  selectedStyle: StyleOption;
  seedBump: number;
  selected: boolean;
  onSelect: () => void;
  onShuffle: () => void;
}) {
  const { download } = useDownload();
  const openExternal = useOpenExternal();
  const { callToolAsync, isPending: isRendering } = useCallTool("render-badge-png");
  const [hover, setHover] = useState(false);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const reduced = useReducedMotion();
  const firstName = badge.name.split(" ")[0];
  // ChatGPT's Apps SDK host has no working download() bridge — detect it so we
  // can route "save" to the live page (a real browser) instead of a no-op.
  const onAppsSdk =
    typeof window !== "undefined" && Boolean((window as { openai?: unknown }).openai);

  // Pointer-tracking 3D tilt — the "trading card in your hand" feel.
  const handleTilt = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduced) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ rx: -py * 9, ry: px * 11 });
  };
  // Re-rollable seed: bump 0 reuses the server avatar; >0 generates a fresh face.
  const seed = seedFor(badge.name, seedBump);
  const avatarSvg = useMemo(
    () => generateAvatar(seed, selectedStyle, seedBump > 0 ? "" : badge.avatarSvg, badge.gender),
    [seed, selectedStyle, seedBump, badge.avatarSvg, badge.gender],
  );

  const downloadBadge = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // In ChatGPT the file download bridge is a no-op, so open the live page
    // where this badge can be saved in a real browser.
    if (onAppsSdk) {
      openExternal(shareUrl);
      return;
    }
    try {
      const res = await callToolAsync({
        name: badge.name,
        role: badge.role,
        accentHex: accent,
        eventTitle: event.title,
        avatarStyle: selectedStyle,
        seed,
        ...(badge.gender ? { gender: badge.gender } : {}),
      });
      const pngDataUrl = res.structuredContent?.pngDataUrl;
      if (pngDataUrl) {
        await download({
          contents: [
            {
              type: "resource",
              resource: {
                uri: `file:///${slugify(badge.name)}-badge.png`,
                mimeType: "image/png",
                blob: base64FromDataUrl(pngDataUrl),
              },
            },
          ],
        });
        return;
      }
    } catch {
      // fall through to SVG
    }
    await download({
      contents: [
        {
          type: "resource",
          resource: {
            uri: `file:///${slugify(badge.name)}-badge.svg`,
            mimeType: "image/svg+xml",
            text: composeBadgeSvg(badge, event, accent, avatarSvg),
          },
        },
      ],
    });
  };

  const lift = hover || selected;
  const transform = `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateY(${
    lift ? -6 : 0
  }px) scale(${lift ? 1.02 : 1})`;

  return (
    <div
      className={reduced ? undefined : "lineup-anim-rise"}
      style={reduced ? undefined : { animationDelay: `${80 + index * 70}ms` }}
    >
      <div
        onClick={onSelect}
        onMouseEnter={() => setHover(true)}
        onMouseMove={handleTilt}
        onMouseLeave={() => {
          setHover(false);
          setTilt({ rx: 0, ry: 0 });
        }}
        style={{
          cursor: "pointer",
          borderRadius: 18,
          padding: 2,
          background: `linear-gradient(140deg, ${accent} 0%, ${rgba(
            accent,
            0.35,
          )} 50%, ${accent} 100%)`,
          transform,
          transformStyle: "preserve-3d",
          willChange: "transform",
          boxShadow: lift
            ? `0 18px 40px -12px ${rgba(accent, 0.55)}`
            : "0 1px 2px rgba(0,0,0,0.06)",
          transition: "transform 180ms cubic-bezier(0.2,0.7,0.2,1), box-shadow 180ms ease",
        }}
      >
      <div
        style={{
          background: cardBg,
          borderRadius: 16,
          aspectRatio: "3 / 4",
          padding: 14,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: -40,
            left: -40,
            width: 160,
            height: 160,
            borderRadius: "50%",
            background: rgba(accent, 0.12),
            filter: "blur(2px)",
          }}
        />
        {lift && !reduced && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 16,
              overflow: "hidden",
              pointerEvents: "none",
              zIndex: 3,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "-60%",
                left: 0,
                width: "55%",
                height: "220%",
                background:
                  "linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)",
                filter: "blur(2px)",
                animation: "lineup-foil 720ms ease-out forwards",
              }}
            />
          </div>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShuffle();
          }}
          title="Shuffle this face"
          aria-label={`Shuffle ${firstName}'s avatar`}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: `1px solid ${border}`,
            background: cardBg,
            color: subtext,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            lineHeight: 1,
            padding: 0,
            opacity: lift ? 1 : 0,
            transition: "opacity 160ms ease",
            zIndex: 2,
          }}
        >
          ⟳
        </button>
        <div
          style={{
            position: "relative",
            width: "100%",
            display: "flex",
            justifyContent: "center",
            marginTop: 4,
            marginBottom: 8,
          }}
        >
          <div
            onClick={(e) => {
              e.stopPropagation();
              onShuffle();
            }}
            title="Click the face to shuffle it"
            style={{
              width: 92,
              height: 92,
              borderRadius: "50%",
              background: rgba(accent, 0.18),
              padding: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transform: hover ? "scale(1.06)" : "scale(1)",
              transition: "transform 160ms cubic-bezier(0.2,0.7,0.2,1)",
            }}
          >
            <img
              key={`${selectedStyle}-${seedBump}`}
              src={svgToDataUrl(avatarSvg)}
              alt={`${badge.name} avatar`}
              style={{
                width: "100%",
                height: "100%",
                animation: "lineup-fade 240ms ease",
              }}
            />
          </div>
        </div>
        <div
          style={{
            textAlign: "center",
            fontWeight: 700,
            fontSize: 17,
            letterSpacing: "-0.01em",
            lineHeight: 1.1,
            marginBottom: 6,
          }}
        >
          {firstName}
        </div>
        <div style={{ textAlign: "center", marginBottom: "auto" }}>
          <span
            style={{
              display: "inline-block",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: accent,
              background: rgba(accent, 0.12),
              padding: "3px 10px",
              borderRadius: 999,
            }}
          >
            {badge.role}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 8,
            marginTop: 10,
          }}
        >
          <button
            onClick={downloadBadge}
            disabled={isRendering}
            title={onAppsSdk ? "Opens the live page where you can save this badge" : "Download this badge as a PNG"}
            style={{
              background: "transparent",
              border: `1px solid ${border}`,
              color: subtext,
              padding: "5px 9px",
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 600,
              cursor: isRendering ? "wait" : "pointer",
              opacity: isRendering ? 0.6 : 1,
            }}
          >
            {onAppsSdk ? "Save →" : isRendering ? "Rendering…" : "Download"}
          </button>
          <div
            style={{
              width: 75,
              height: 75,
              background: "#fff",
              borderRadius: 8,
              padding: 5,
              border: `1px solid ${border}`,
            }}
            title="vCard QR — scan to save contact"
          >
            <img
              src={svgToDataUrl(badge.vcardQrSvg)}
              alt={`${badge.name} vCard QR`}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "lineup";
}

function composeBadgeSvg(
  badge: Badge,
  event: EventInfo,
  accent: string,
  avatarSvg: string,
): string {
  const w = 480;
  const h = 640;
  const firstName = badge.name.split(" ")[0];
  const avatarInner = stripSvgOuter(avatarSvg);
  const qrInner = stripSvgOuter(badge.vcardQrSvg);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="border" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${accent}"/>
      <stop offset="50%" stop-color="${accent}" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="${accent}"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${w}" height="${h}" rx="32" fill="url(#border)"/>
  <rect x="6" y="6" width="${w - 12}" height="${h - 12}" rx="28" fill="#ffffff"/>
  <circle cx="80" cy="80" r="120" fill="${accent}" fill-opacity="0.12"/>
  <g transform="translate(144,80)">
    <circle cx="96" cy="96" r="96" fill="${accent}" fill-opacity="0.18"/>
    <g transform="translate(20,20) scale(0.59)">${avatarInner}</g>
  </g>
  <text x="${w / 2}" y="370" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="42" font-weight="700" fill="#111111" letter-spacing="-1">${escapeXml(firstName)}</text>
  <g transform="translate(${w / 2 - 90},395)">
    <rect x="0" y="0" width="180" height="32" rx="16" fill="${accent}" fill-opacity="0.14"/>
    <text x="90" y="21" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="13" font-weight="700" letter-spacing="1.5" fill="${accent}">${escapeXml(badge.role.toUpperCase())}</text>
  </g>
  <g transform="translate(40,500)">
    <text x="0" y="0" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="600" letter-spacing="1.2" fill="#71717a">SCAN TO SAVE</text>
    <text x="0" y="22" font-family="Inter, system-ui, sans-serif" font-size="13" font-weight="600" fill="#111111">${escapeXml(event.title)}</text>
  </g>
  <g transform="translate(340,490)">
    <rect x="0" y="0" width="100" height="100" rx="10" fill="#ffffff" stroke="#e4e4e7"/>
    <g transform="translate(8,8) scale(${84 / 100})">${qrInner}</g>
  </g>
</svg>`;
}

function stripSvgOuter(svg: string): string {
  return svg
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "");
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
