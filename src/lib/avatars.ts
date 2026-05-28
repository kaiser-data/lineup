import { createAvatar } from "@dicebear/core";
import { lorelei } from "@dicebear/collection";

export function generateAvatarSvg(seed: string): string {
  return createAvatar(lorelei, {
    seed,
    size: 256,
    backgroundColor: ["transparent"],
  }).toString();
}
