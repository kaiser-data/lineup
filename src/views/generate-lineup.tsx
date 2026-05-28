import "../index.css";
import { useMemo, useState } from "react";
import { useDownload, useLayout, useViewState } from "skybridge/web";
import { useToolInfo } from "../helpers.js";

type Badge = {
  name: string;
  role: string;
  avatarSvg: string;
  vcardQrSvg: string;
};

type EventInfo = {
  title: string;
  dateISO: string;
  venue: string | null;
  accentHex: string;
  rsvpUrl: string | null;
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

export default function GenerateLineup() {
  const { output, isPending } = useToolInfo<"generate-lineup">();
  const { theme } = useLayout();
  const isDark = theme === "dark";

  const [{ selectedBadge }, setViewState] = useViewState<{
    selectedBadge: string | null;
  }>({ selectedBadge: null });

  if (isPending || !output) {
    return (
      <div className="p-6 text-sm opacity-70">
        Generating your Lineup…
      </div>
    );
  }

  const data = output as Output;
  return (
    <LineupCard
      data={data}
      isDark={isDark}
      selectedBadge={selectedBadge}
      onSelect={(name) =>
        setViewState((prev) => ({
          ...prev,
          selectedBadge: prev.selectedBadge === name ? null : name,
        }))
      }
    />
  );
}

function LineupCard({
  data,
  isDark,
  selectedBadge,
  onSelect,
}: {
  data: Output;
  isDark: boolean;
  selectedBadge: string | null;
  onSelect: (name: string) => void;
}) {
  const { event, badges } = data;
  const { day, time } = useMemo(() => formatDate(event.dateISO), [event.dateISO]);
  const accent = event.accentHex;
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
        .join(", ")}.${
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
      />
      <BadgeGrid
        event={event}
        badges={badges}
        accent={accent}
        cardBg={cardBg}
        border={border}
        subtext={subtext}
        selectedBadge={selectedBadge}
        onSelect={onSelect}
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
}: {
  event: EventInfo;
  day: string;
  time: string;
  cardBg: string;
  border: string;
  subtext: string;
  accent: string;
}) {
  const { download } = useDownload();

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
  onSelect,
}: {
  event: EventInfo;
  badges: Badge[];
  accent: string;
  cardBg: string;
  border: string;
  subtext: string;
  selectedBadge: string | null;
  onSelect: (name: string) => void;
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
          Tap a badge to focus · scan QR to save contact
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
            selected={selectedBadge === badge.name}
            onSelect={() => onSelect(badge.name)}
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
  selected,
  onSelect,
}: {
  badge: Badge;
  event: EventInfo;
  accent: string;
  cardBg: string;
  border: string;
  subtext: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const { download } = useDownload();
  const [hover, setHover] = useState(false);
  const firstName = badge.name.split(" ")[0];

  const downloadBadge = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const composed = composeBadgeSvg(badge, event, accent);
    await download({
      contents: [
        {
          type: "resource",
          resource: {
            uri: `file:///${slugify(badge.name)}-badge.svg`,
            mimeType: "image/svg+xml",
            text: composed,
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
        transform: lift ? "translateY(-2px)" : "translateY(0)",
        boxShadow: lift
          ? `0 12px 32px -12px ${rgba(accent, 0.55)}`
          : "0 1px 2px rgba(0,0,0,0.06)",
        transition: "transform 160ms ease, box-shadow 160ms ease",
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
            style={{
              width: 92,
              height: 92,
              borderRadius: "50%",
              background: rgba(accent, 0.18),
              padding: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={svgToDataUrl(badge.avatarSvg)}
              alt={`${badge.name} avatar`}
              style={{ width: "100%", height: "100%" }}
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
            style={{
              background: "transparent",
              border: `1px solid ${border}`,
              color: subtext,
              padding: "5px 9px",
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Download
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

function composeBadgeSvg(badge: Badge, event: EventInfo, accent: string): string {
  const w = 480;
  const h = 640;
  const firstName = badge.name.split(" ")[0];
  const avatarInner = stripSvgOuter(badge.avatarSvg);
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
