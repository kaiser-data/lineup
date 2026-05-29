import "../index.css";
import { useMemo, useState, useEffect, useRef } from "react";
import {
  useDownload,
  useLayout,
  useViewState,
  useRequestSize,
} from "skybridge/web";
import { QRCodeSVG } from "qrcode.react";
import { createAvatar } from "@dicebear/core";
import { lorelei, notionists, bottts, shapes } from "@dicebear/collection";
import { useToolInfo, useCallTool } from "../helpers.js";

const SHARE_BASE = "https://kaiser-data.github.io/lineup/";

const STYLE_OPTIONS = ["lorelei", "notionists", "bottts", "shapes"] as const;
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
  const payload = {
    title: input.title,
    dateISO: input.dateISO,
    venue: input.venue || undefined,
    accentHex: input.accentHex || undefined,
    rsvpUrl: input.rsvpUrl || undefined,
    avatarStyle: input.avatarStyle || undefined,
    durationHours: input.durationHours,
    attendees: input.attendees.map((a) => ({
      name: a.name,
      role: a.role,
      // only include when a re-roll changed it, to keep the link short
      ...(a.seed && a.seed !== a.name ? { seed: a.seed } : {}),
      ...(a.gender && a.gender !== "x" ? { gender: a.gender } : {}),
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

export default function GenerateLineup() {
  const { output, isPending } = useToolInfo<"generate-lineup">();
  const { theme } = useLayout();
  const isDark = theme === "dark";
  const rootRef = useAutoSize<HTMLDivElement>();

  const data = output as Output | undefined;
  const initialStyle: StyleOption =
    data?.event?.avatarStyle && STYLE_OPTIONS.includes(data.event.avatarStyle as StyleOption)
      ? (data.event.avatarStyle as StyleOption)
      : "lorelei";

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
  const { download } = useDownload();
  const [copied, setCopied] = useState(false);

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard may be blocked in the iframe — the QR + visible link still work
    }
  };

  const downloadIcs = async () => {
    await download({
      contents: [
        {
          type: "resource",
          resource: {
            uri: `file:///${slugify(event.title)}.ics`,
            mimeType: "text/calendar",
            text: event.icsString,
          },
        },
      ],
    });
  };

  const downloadQr = async () => {
    await download({
      contents: [
        {
          type: "resource",
          resource: {
            uri: `file:///${slugify(event.title)}-rsvp-qr.svg`,
            mimeType: "image/svg+xml",
            text: event.qrSvg,
          },
        },
      ],
    });
  };

  return (
    <div
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
              onClick={downloadIcs}
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
              Add to calendar
            </button>
            <button
              onClick={downloadQr}
              style={{
                background: "transparent",
                color: "inherit",
                border: `1px solid ${border}`,
                borderRadius: 999,
                padding: "10px 18px",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Download RSVP QR
            </button>
          </div>
        </div>
        <div
          style={{
            width: 132,
            height: 132,
            borderRadius: 18,
            background: "#fff",
            padding: 12,
            border: `1px solid ${border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
          title={event.rsvpUrl ?? "Event QR"}
        >
          <img
            src={svgToDataUrl(event.qrSvg)}
            alt="Event RSVP QR"
            style={{ width: "100%", height: "100%" }}
          />
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

      <div
        style={{
          position: "relative",
          marginTop: 18,
          paddingTop: 18,
          borderTop: `1px solid ${border}`,
          display: "flex",
          gap: 16,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            background: "#fff",
            padding: 8,
            borderRadius: 12,
            border: `1px solid ${border}`,
            flexShrink: 0,
            lineHeight: 0,
          }}
        >
          <QRCodeSVG value={shareUrl} size={96} level="M" />
        </div>
        <div style={{ flex: "1 1 220px", minWidth: 200 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
            Share this page
          </div>
          <div style={{ color: subtext, fontSize: 13, marginBottom: 10 }}>
            Scan to open the live event page on a phone — or copy the link. The
            whole pack rides in the link; nothing is stored.
          </div>
          <button
            onClick={copyShare}
            style={{
              background: "transparent",
              color: "inherit",
              border: `1px solid ${border}`,
              borderRadius: 999,
              padding: "8px 16px",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {copied ? "Copied ✓" : "Copy share link"}
          </button>
        </div>
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
        {badges.map((badge) => (
          <BadgeCard
            key={badge.name}
            badge={badge}
            event={event}
            accent={accent}
            cardBg={cardBg}
            border={border}
            subtext={subtext}
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
  badge,
  event,
  accent,
  cardBg,
  border,
  subtext,
  selectedStyle,
  seedBump,
  selected,
  onSelect,
  onShuffle,
}: {
  badge: Badge;
  event: EventInfo;
  accent: string;
  cardBg: string;
  border: string;
  subtext: string;
  selectedStyle: StyleOption;
  seedBump: number;
  selected: boolean;
  onSelect: () => void;
  onShuffle: () => void;
}) {
  const { download } = useDownload();
  const { callToolAsync, isPending: isRendering } = useCallTool("render-badge-png");
  const [hover, setHover] = useState(false);
  const firstName = badge.name.split(" ")[0];
  // Re-rollable seed: bump 0 reuses the server avatar; >0 generates a fresh face.
  const seed = seedFor(badge.name, seedBump);
  const avatarSvg = useMemo(
    () => generateAvatar(seed, selectedStyle, seedBump > 0 ? "" : badge.avatarSvg, badge.gender),
    [seed, selectedStyle, seedBump, badge.avatarSvg, badge.gender],
  );

  const downloadBadge = async (e: React.MouseEvent) => {
    e.stopPropagation();
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

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        cursor: "pointer",
        borderRadius: 18,
        padding: 2,
        background: `linear-gradient(140deg, ${accent} 0%, ${rgba(
          accent,
          0.35,
        )} 50%, ${accent} 100%)`,
        transform: lift ? "translateY(-4px) scale(1.015)" : "translateY(0) scale(1)",
        boxShadow: lift
          ? `0 16px 36px -12px ${rgba(accent, 0.55)}`
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
            {isRendering ? "Rendering…" : "Download"}
          </button>
          <div
            style={{
              width: 50,
              height: 50,
              background: "#fff",
              borderRadius: 6,
              padding: 4,
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
