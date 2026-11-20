import { existsSync } from "node:fs";
import path from "node:path";
import { cx } from "./cx";

const ART_DIR = path.join(process.cwd(), "public", "art");

const EXTENSIONS = [".svg", ".webp", ".png", ".jpg"];

/**
 * Finds the file for a slot. The exact name wins, then the same name with
 * another extension (SVG first), so dropping in an SVG replaces a stand-in.
 */
function findArt(name: string): string | null {
  const base = name.replace(/\.[a-z0-9]+$/i, "");
  const candidates = [name, ...EXTENSIONS.map((ext) => base + ext)];
  for (const candidate of candidates) {
    const file = path.resolve(ART_DIR, candidate);
    // Keep lookups inside public/art.
    if (!file.startsWith(ART_DIR + path.sep)) continue;
    if (existsSync(file)) return candidate;
  }
  return null;
}

type ArtSlotProps = {
  /** File name under public/art, e.g. "hangar-empty.png". */
  name: string;
  /** CSS aspect ratio, e.g. "4/3". */
  ratio: string;
  alt?: string;
  className?: string;
};

/**
 * Server component. Shows the illustration once it's been dropped into
 * public/art, and a labelled placeholder until then.
 */
export function ArtSlot({ name, ratio, alt = "", className }: ArtSlotProps) {
  const style = { aspectRatio: ratio };
  const file = findArt(name);

  if (file) {
    return (
      // Art is arbitrary size and comes from public/, so a plain img is fine.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/art/${file}`}
        alt={alt}
        data-art-slot={name}
        style={style}
        className={cx("w-full object-contain", className)}
      />
    );
  }

  return (
    <div
      data-art-slot={name}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      style={style}
      className={cx(
        "flex w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-hc-muted/40 font-mono text-xs text-hc-muted",
        className,
      )}
    >
      <span>art: {name}</span>
      <span>{ratio}</span>
    </div>
  );
}
