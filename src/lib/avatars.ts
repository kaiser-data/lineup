import { createAvatar } from "@dicebear/core";
import {
  lorelei,
  notionists,
  bottts,
  shapes,
} from "@dicebear/collection";

export const AVATAR_STYLES = ["lorelei", "notionists", "bottts", "shapes"] as const;
export type AvatarStyle = (typeof AVATAR_STYLES)[number];
export const DEFAULT_AVATAR_STYLE: AvatarStyle = "lorelei";

const STYLES = { lorelei, notionists, bottts, shapes };

export function generateAvatarSvg(
  seed: string,
  style: AvatarStyle = DEFAULT_AVATAR_STYLE,
): string {
  // DiceBear style types are mutually exclusive per-style; cast to bypass the
  // strict union check when we want to pick by name at runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = STYLES[style] as any;
  return createAvatar(def, {
    seed,
    size: 256,
    backgroundColor: ["transparent"],
  }).toString();
}
