import { createAvatar } from "@dicebear/core";
import {
  lorelei,
  notionists,
  bottts,
  shapes,
} from "@dicebear/collection";

export const AVATAR_STYLES = ["notionists", "lorelei", "bottts", "shapes"] as const;
export type AvatarStyle = (typeof AVATAR_STYLES)[number];
export const DEFAULT_AVATAR_STYLE: AvatarStyle = "notionists";

export const GENDERS = ["m", "f", "x"] as const;
export type Gender = (typeof GENDERS)[number];

const STYLES = { lorelei, notionists, bottts, shapes };

/**
 * DiceBear option overrides that bias a face toward a gender hint. `lorelei`
 * and `notionists` expose `beard`/`earrings` probabilities; the other styles
 * (robots, shapes) have no human features so the hint is a no-op there.
 * Keep this in sync with the copies in the view and the share page.
 */
export function genderOptions(gender?: Gender): Record<string, number> {
  // These styles have no real gender control, so we use the strongest available
  // levers deterministically for a clear read: "m" always gets a beard and no
  // earrings; "f" the reverse. Intentionally on/off (not probabilistic) so a
  // single seed visibly reflects the hint. "x"/unset keeps DiceBear's defaults.
  if (gender === "m") return { beardProbability: 100, earringsProbability: 0 };
  if (gender === "f") return { beardProbability: 0, earringsProbability: 100 };
  return {};
}

export function generateAvatarSvg(
  seed: string,
  style: AvatarStyle = DEFAULT_AVATAR_STYLE,
  gender?: Gender,
): string {
  // DiceBear style types are mutually exclusive per-style; cast to bypass the
  // strict union check when we want to pick by name at runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = STYLES[style] as any;
  return createAvatar(def, {
    seed,
    size: 256,
    backgroundColor: ["transparent"],
    ...genderOptions(gender),
  }).toString();
}
