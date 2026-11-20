// Browser-side uploads. Files go straight to storage (a presigned PUT to R2 in
// production, /api/upload -> public/uploads locally) and only the resulting
// URLs are sent to server actions, which keeps action bodies tiny.
import { MB, UPLOAD_RULES, type UploadKind } from "@/lib/upload-rules";

export type { UploadKind };

/** Same limits the server enforces, checked first so people get a clear message. */
export function checkFile(file: File, kind: UploadKind): string | null {
  const rule = UPLOAD_RULES[kind];
  if (!Object.hasOwn(rule.types, file.type)) return `${rule.label} must be ${rule.allowed}.`;
  if (file.size === 0) return `${file.name} is empty.`;
  if (file.size > rule.maxBytes) {
    return `${file.name} is over ${rule.maxBytes / MB} MB. ${rule.label} can be up to ${rule.maxBytes / MB} MB.`;
  }
  return null;
}

type Options = {
  /** 0-100 for this file. */
  onProgress?: (percentage: number) => void;
  signal?: AbortSignal;
};

type Ticket =
  | { mode: "r2"; uploadUrl: string; publicUrl: string }
  | { mode: "local" }
  | { error?: string };

function aborted(signal?: AbortSignal): unknown {
  return signal?.reason ?? new DOMException("Upload cancelled.", "AbortError");
}

/** Uploads one file and resolves to its public URL. Throws an Error with a user-facing message. */
export async function uploadFile(file: File, kind: UploadKind, opts: Options = {}): Promise<string> {
  const problem = checkFile(file, kind);
  if (problem) throw new Error(problem);

  let res: Response;
  try {
    res = await fetch("/api/upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, contentType: file.type, size: file.size, name: file.name }),
      signal: opts.signal,
    });
  } catch (err) {
    if (opts.signal?.aborted) throw err;
    throw new Error(`Couldn't upload ${file.name}. Check your connection and try again.`);
  }
  const ticket = (await res.json().catch(() => null)) as Ticket | null;
  if (!res.ok || !ticket || !("mode" in ticket)) {
    const message = ticket && "error" in ticket ? ticket.error : undefined;
    throw new Error(message ?? `Couldn't upload ${file.name}.`);
  }

  if (ticket.mode === "r2") {
    await putFile(file, ticket.uploadUrl, opts);
    opts.onProgress?.(100);
    return ticket.publicUrl;
  }
  return uploadLocal(file, kind, opts);
}

/** PUTs the file to a presigned URL. XHR rather than fetch so we get upload progress. */
function putFile(file: File, uploadUrl: string, opts: Options): Promise<void> {
  const { signal, onProgress } = opts;
  if (signal?.aborted) return Promise.reject(aborted(signal));

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const onAbort = () => xhr.abort();
    signal?.addEventListener("abort", onAbort, { once: true });

    xhr.open("PUT", uploadUrl);
    // Must match the signed ContentType or R2 rejects the request.
    xhr.setRequestHeader("Content-Type", file.type);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) onProgress((e.loaded / e.total) * 100);
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Couldn't upload ${file.name} (storage error ${xhr.status}). Try again.`));
    };
    // CORS failures look like network errors from here.
    xhr.onerror = () =>
      reject(new Error("Couldn't reach file storage. Check your connection and try again."));
    xhr.ontimeout = xhr.onerror;
    xhr.onabort = () => reject(aborted(signal));
    xhr.onloadend = () => signal?.removeEventListener("abort", onAbort);

    xhr.send(file);
  });
}

/** Local dev: multipart POST to /api/upload, which writes to public/uploads. */
async function uploadLocal(file: File, kind: UploadKind, opts: Options): Promise<string> {
  const body = new FormData();
  body.set("kind", kind);
  body.set("file", file);

  let res: Response;
  try {
    res = await fetch("/api/upload", { method: "POST", body, signal: opts.signal });
  } catch (err) {
    if (opts.signal?.aborted) throw err;
    throw new Error(`Couldn't upload ${file.name}. Check your connection and try again.`);
  }
  const json = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!res.ok || !json?.url) {
    throw new Error(json?.error ?? `Couldn't upload ${file.name}.`);
  }
  opts.onProgress?.(100);
  return json.url;
}
