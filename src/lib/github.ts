export type RepoRef = { owner: string; repo: string };

// GitHub's own rules: owners are 1-39 alphanumerics or single hyphens,
// repos are letters, digits, ".", "_" and "-".
const OWNER = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
const REPO = /^[\w.-]{1,100}$/;

// First path segments that are GitHub pages, not accounts.
const RESERVED = new Set([
  "orgs",
  "settings",
  "marketplace",
  "topics",
  "explore",
  "features",
  "sponsors",
  "login",
  "notifications",
]);

/** "https://github.com/owner/repo[/anything]" -> { owner, repo }, otherwise null. */
export function parseRepoUrl(input: string): RepoRef | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;

  const host = url.hostname.toLowerCase();
  if (host !== "github.com" && host !== "www.github.com") return null;

  const [owner, rawRepo] = url.pathname.split("/").filter(Boolean);
  if (!owner || !rawRepo) return null;

  const repo = rawRepo.replace(/\.git$/i, "");
  if (!OWNER.test(owner) || RESERVED.has(owner.toLowerCase())) return null;
  if (!REPO.test(repo) || repo === "." || repo === "..") return null;

  return { owner, repo };
}

/** Canonical web URL: https://github.com/owner/repo */
export function repoWebUrl({ owner, repo }: RepoRef): string {
  return `https://github.com/${owner}/${repo}`;
}

/** URL of a file on the default branch, for linking (not fetching). */
export function repoFileUrl({ owner, repo }: RepoRef, file: string): string {
  return `https://github.com/${owner}/${repo}/blob/HEAD/${file}`;
}

/** Raw file contents on the default branch. */
export function rawFileUrl({ owner, repo }: RepoRef, file: string): string {
  return `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${file}`;
}
