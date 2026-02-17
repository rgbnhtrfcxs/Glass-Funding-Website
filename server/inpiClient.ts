type PatentListItem = {
  title: string;
  url: string;
  year: number | null;
  doi: null;
};

const DEFAULT_INPI_BASE_URL = "https://api-gateway.inpi.fr";
const DEFAULT_INPI_SEARCH_PATH = "/services/apidiffusion/api/brevets/search";

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const firstString = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        const resolved = asNonEmptyString(entry);
        if (resolved) return resolved;
      }
      continue;
    }
    const resolved = asNonEmptyString(value);
    if (resolved) return resolved;
  }
  return null;
};

const parseYear = (value: unknown): number | null => {
  const input = firstString(value);
  if (!input) return null;
  const match = input.match(/(19|20)\d{2}/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const resolveRows = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];

  const directCandidates = [
    payload.results,
    payload.result,
    payload.items,
    payload.documents,
    payload.brevets,
    payload.patents,
    payload.content,
    payload.data,
    isRecord(payload.hits) ? payload.hits.hits : undefined,
    isRecord(payload.results) ? payload.results.hits : undefined,
    isRecord(payload.response) ? payload.response.docs : undefined,
  ];

  for (const candidate of directCandidates) {
    const rows = asArray(candidate);
    if (rows.length > 0) return rows;
  }

  for (const value of Object.values(payload)) {
    const rows = asArray(value);
    if (rows.length > 0) return rows;
  }

  return [];
};

const normalizeInpiUrl = () => {
  const base = (process.env.INPI_API_BASE_URL || DEFAULT_INPI_BASE_URL).trim();
  const path = (process.env.INPI_API_SEARCH_PATH || DEFAULT_INPI_SEARCH_PATH).trim();
  if (!base) return `${DEFAULT_INPI_BASE_URL}${DEFAULT_INPI_SEARCH_PATH}`;
  if (/^https?:\/\//i.test(path)) return path;
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
};

const buildCandidateInpiUrls = () => {
  const primary = normalizeInpiUrl();
  const candidates = [primary];
  const enablePathFallback = (process.env.INPI_ENABLE_PATH_FALLBACK || "").toLowerCase() === "true";
  if (!enablePathFallback) {
    return candidates;
  }

  // Some INPI environments expose PI endpoints without the /services/apidiffusion prefix.
  const withoutServicePrefix = primary.replace("/services/apidiffusion/", "/");
  if (withoutServicePrefix !== primary) {
    candidates.push(withoutServicePrefix);
  }

  // Some deployments require a trailing slash for GET search routing.
  const withTrailingSlash = candidates
    .filter(candidate => !candidate.endsWith("/"))
    .map(candidate => `${candidate}/`);
  candidates.push(...withTrailingSlash);

  // Keep unique URLs only.
  return Array.from(new Set(candidates));
};

const getCollections = () => {
  const raw = process.env.INPI_COLLECTIONS || "FR,EP,CCP";
  const parsed = raw
    .split(",")
    .map(entry => entry.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : ["FR", "EP", "CCP"];
};

const getCookieAuthTokens = () => {
  const xsrfToken = process.env.INPI_XSRF_TOKEN?.trim() || "";
  const accessToken = process.env.INPI_ACCESS_TOKEN?.trim() || "";
  const sessionToken = process.env.INPI_SESSION_TOKEN?.trim() || "";
  const refreshToken = process.env.INPI_REFRESH_TOKEN?.trim() || "";
  return { xsrfToken, accessToken, sessionToken, refreshToken };
};

const isCookieAuthConfigured = () => {
  const { xsrfToken, accessToken, sessionToken, refreshToken } = getCookieAuthTokens();
  return Boolean(xsrfToken && accessToken && (sessionToken || refreshToken));
};

const isBearerAuthConfigured = () => Boolean(process.env.INPI_BEARER_TOKEN || process.env.INPI_API_KEY);

export const isInpiConfigured = () => isCookieAuthConfigured() || isBearerAuthConfigured();

const buildAuthHeaders = (): HeadersInit => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (isCookieAuthConfigured()) {
    const { xsrfToken, accessToken, sessionToken, refreshToken } = getCookieAuthTokens();
    const cookieParts = [`XSRF-TOKEN=${xsrfToken}`, `access_token=${accessToken}`];
    if (sessionToken) cookieParts.push(`session_token=${sessionToken}`);
    if (refreshToken) cookieParts.push(`refresh_token=${refreshToken}`);
    headers["X-XSRF-TOKEN"] = xsrfToken;
    headers.Cookie = cookieParts.join("; ");
    return headers;
  }

  const bearerToken = process.env.INPI_BEARER_TOKEN?.trim();
  const apiKey = process.env.INPI_API_KEY?.trim();
  if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
  } else if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  if (apiKey) {
    // Some API gateways expect one of these key headers.
    headers["X-API-Key"] = apiKey;
    headers.apikey = apiKey;
  }

  if (!headers.Authorization && !headers["X-API-Key"]) {
    throw new Error(
      "INPI API credentials are missing. Set INPI_API_KEY or INPI_BEARER_TOKEN, or cookie auth vars.",
    );
  }

  return headers;
};

const rowToPatentItem = (row: unknown): PatentListItem | null => {
  const candidate = isRecord(row) && isRecord(row._source) ? row._source : row;
  if (!isRecord(candidate)) return null;

  const publicationNumber = firstString(
    candidate.PUBN,
    candidate.publicationNumber,
    candidate.publication_number,
    candidate.publication_no,
    candidate.number,
  );

  const title =
    firstString(
      candidate.TITM,
      candidate.TIT,
      candidate.title,
      candidate.title_fr,
      candidate.inventionTitle,
      candidate.intitule,
    ) ||
    (publicationNumber ? `Patent ${publicationNumber}` : null) ||
    "Untitled patent";

  const url =
    firstString(
      candidate.url,
      candidate.uri,
      candidate.link,
      candidate.documentUrl,
      candidate.document_url,
      candidate.sourceUrl,
    ) || "";

  const year = parseYear(
    firstString(
      candidate.PUBD,
      candidate.publicationDate,
      candidate.publication_date,
      candidate.PUBLICATION_DATE,
      candidate.DATD,
      candidate.date,
    ),
  );

  return {
    title,
    url,
    year,
    doi: null,
  };
};

export const toSirenFromSiretOrSiren = (value: string | null | undefined): string | null => {
  const digits = (value || "").replace(/\D/g, "");
  if (digits.length === 14) return digits.slice(0, 9);
  if (digits.length === 9) return digits;
  return null;
};

export async function fetchInpiPatentsBySiren(siren: string): Promise<PatentListItem[]> {
  const normalizedSiren = toSirenFromSiretOrSiren(siren);
  if (!normalizedSiren) {
    throw new Error("Invalid SIREN/SIRET. Expected 9 or 14 digits.");
  }

  const size = Number.parseInt(process.env.INPI_PAGE_SIZE || "50", 10);
  const body = {
    collections: getCollections(),
    query: `([DESI=${normalizedSiren}] OU [TISI=${normalizedSiren}])`,
    sort: "PUBLICATION_DATE desc",
    size: Number.isFinite(size) && size > 0 ? Math.min(size, 200) : 50,
    position: 0,
  };
  const headers = buildAuthHeaders();
  const timeoutMs = Number.parseInt(process.env.INPI_TIMEOUT_MS || "15000", 10);
  const resolvedTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15000;

  const getSearchUrl = (baseUrl: string) => {
    const url = new URL(baseUrl);
    url.searchParams.set("query", body.query);
    url.searchParams.set("collections", body.collections.join(","));
    url.searchParams.set("size", String(body.size));
    url.searchParams.set("position", String(body.position));
    url.searchParams.set("sortList", body.sort);
    return url.toString();
  };

  const sendRequest = async (method: "POST" | "GET", url: string) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), resolvedTimeoutMs);
    try {
      const response = await fetch(method === "GET" ? getSearchUrl(url) : url, {
        method,
        headers,
        body: method === "POST" ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const raw = await response.text();
      return { response, raw, method, url };
    } finally {
      clearTimeout(timeout);
    }
  };

  const candidates = buildCandidateInpiUrls();
  const failures: string[] = [];
  let successfulRaw: string | null = null;

  for (const url of candidates) {
    const postAttempt = await sendRequest("POST", url);
    if (postAttempt.response.ok) {
      successfulRaw = postAttempt.raw;
      break;
    }

    failures.push(`${postAttempt.method} ${url} -> ${postAttempt.response.status}`);
    const shouldTryGetFallback =
      postAttempt.response.status === 405 ||
      postAttempt.response.headers.get("Allow")?.includes("GET");

    if (!shouldTryGetFallback) {
      continue;
    }

    const getAttempt = await sendRequest("GET", url);
    if (getAttempt.response.ok) {
      successfulRaw = getAttempt.raw;
      break;
    }
    failures.push(`${getAttempt.method} ${url} -> ${getAttempt.response.status}`);
  }

  if (successfulRaw === null) {
    throw new Error(`INPI search failed after fallback attempts (${failures.join(", ")})`);
  }

  let payload: unknown = null;
  try {
    payload = successfulRaw ? JSON.parse(successfulRaw) : null;
  } catch {
    payload = null;
  }

  const rows = resolveRows(payload);
  const items = rows
    .map(rowToPatentItem)
    .filter((item): item is PatentListItem => Boolean(item))
    .filter(item => Boolean(item.title));

  const deduped = new Map<string, PatentListItem>();
  for (const item of items) {
    const key = `${item.title.toLowerCase()}::${item.url.toLowerCase()}::${item.year ?? ""}`;
    if (!deduped.has(key)) deduped.set(key, item);
  }
  return Array.from(deduped.values());
}
