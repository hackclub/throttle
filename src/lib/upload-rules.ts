// Shared by the upload route, the server actions and the browser helper.
// No server-only imports here.

export type UploadKind = "photo" | "video";

export const MB = 1024 * 1024;

export const UPLOAD_RULES: Record<
  UploadKind,
  {
    /** Accepted MIME type -> file extension used for the stored file. */
    types: Record<string, string>;
    maxBytes: number;
    label: string;
    allowed: string;
  }
> = {
  photo: {
    types: {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "image/heic": "heic",
    },
    maxBytes: 10 * MB,
    label: "Photos",
    allowed: "JPEG, PNG, WebP, GIF or HEIC",
  },
  video: {
    types: {
      "video/mp4": "mp4",
      "video/quicktime": "mov",
      "video/webm": "webm",
    },
    maxBytes: 100 * MB,
    label: "Videos",
    allowed: "MP4, MOV or WebM",
  },
};

export function isUploadKind(value: unknown): value is UploadKind {
  return value === "photo" || value === "video";
}

const UUID = "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}";
const LOCAL_PATH = new RegExp(`^/uploads/${UUID}\\.([a-z0-9]+)$`);
const R2_PATH = new RegExp(`^/(photos|videos)/${UUID}\\.([a-z0-9]+)$`);

function extOk(kinds: UploadKind[], ext: string): boolean {
  return kinds.some((k) => Object.values(UPLOAD_RULES[k].types).includes(ext));
}

function r2Hostname(): string | null {
  const base = process.env.R2_PUBLIC_URL;
  if (!base) return null;
  try {
    return new URL(base).hostname;
  } catch {
    return null;
  }
}

/**
 * True for URLs our own upload paths produce: "/uploads/<uuid>.<ext>" from the
 * local fallback, or "https://<R2_PUBLIC_URL host>/<kind>s/<uuid>.<ext>" from
 * R2. Pass a kind to also check it's a photo or a video.
 *
 * Reads R2_PUBLIC_URL, so only call it on the server (actions and server
 * components). In the browser the variable is unset and only local URLs pass.
 */
export function isUploadUrl(value: string, kind?: UploadKind): boolean {
  const kinds: UploadKind[] = kind ? [kind] : ["photo", "video"];

  const local = LOCAL_PATH.exec(value);
  if (local) return extOk(kinds, local[1]);

  const host = r2Hostname();
  if (!host) return false;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password) return false;
  if (url.hostname !== host || url.search || url.hash) return false;

  const match = R2_PATH.exec(url.pathname);
  if (!match) return false;
  const folderKind: UploadKind = match[1] === "photos" ? "photo" : "video";
  if (!kinds.includes(folderKind)) return false;
  return extOk([folderKind], match[2]);
}

/** Whether a stored video URL can play in a <video> tag (vs. an external link). */
export function isPlayableVideo(value: string): boolean {
  if (!isUploadUrl(value, "video")) return false;
  const path = value.startsWith("/") ? value : new URL(value).pathname;
  return /\.(mp4|webm|mov)$/i.test(path);
}
