const OFFLINE_QUEUE_KEY = "zpos-offline-sync-queue";
const OFFLINE_READ_CACHE_KEY = "zpos-offline-read-cache";
const MAX_CACHED_READS = 120;

export type QueuedOperation = {
  id: string;
  createdAt: string;
  label: string;
  request?: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  };
};

type CachedRead = {
  url: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  cachedAt: string;
};

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    return JSON.parse(localStorage.getItem(key) || "") as T;
  } catch (_) {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (!isBrowser()) return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function readOfflineQueue() {
  return readJson<QueuedOperation[]>(OFFLINE_QUEUE_KEY, []);
}

export function writeOfflineQueue(queue: QueuedOperation[]) {
  writeJson(OFFLINE_QUEUE_KEY, queue);
  window.dispatchEvent(new Event("zpos-offline-queue-change"));
}

export function queueOfflineRequest(operation: Omit<QueuedOperation, "id" | "createdAt">) {
  const queue = readOfflineQueue();
  queue.push({
    ...operation,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  });
  writeOfflineQueue(queue);
}

function getRequestBody(init?: RequestInit) {
  if (typeof init?.body === "string") {
    try {
      return JSON.parse(init.body);
    } catch (_) {
      return init.body;
    }
  }
  return undefined;
}

function getRequestHeaders(init?: RequestInit) {
  const headers: Record<string, string> = {};
  new Headers(init?.headers).forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}

function cacheKey(input: RequestInfo | URL) {
  const url = typeof input === "string" || input instanceof URL ? String(input) : input.url;
  return url;
}

function readCache() {
  return readJson<Record<string, CachedRead>>(OFFLINE_READ_CACHE_KEY, {});
}

function writeCachedRead(key: string, response: Response, body: string) {
  if (!isBrowser()) return;
  const cache = readCache();
  const headers: Record<string, string> = {};
  response.headers.forEach((value, header) => {
    headers[header] = value;
  });
  cache[key] = {
    url: key,
    status: response.status,
    statusText: response.statusText,
    headers,
    body,
    cachedAt: new Date().toISOString(),
  };

  const entries = Object.entries(cache).sort(
    ([, a], [, b]) => new Date(b.cachedAt).getTime() - new Date(a.cachedAt).getTime(),
  );
  writeJson(OFFLINE_READ_CACHE_KEY, Object.fromEntries(entries.slice(0, MAX_CACHED_READS)));
}

function getCachedResponse(key: string) {
  const cached = readCache()[key];
  if (!cached) return null;
  return new Response(cached.body, {
    status: cached.status,
    statusText: cached.statusText || "OK",
    headers: {
      ...cached.headers,
      "x-zpos-offline-cache": "true",
    },
  });
}

function isSupabaseRestRequest(url: string) {
  return url.includes("/rest/v1/");
}

function queuedResponse(init?: RequestInit) {
  const accept = new Headers(init?.headers).get("accept") || "";
  const body = accept.includes("application/vnd.pgrst.object+json") ? "{}" : "[]";
  return new Response(body, {
    status: 202,
    statusText: "Queued offline",
    headers: {
      "content-type": "application/json",
      "x-zpos-offline-queued": "true",
    },
  });
}

export function createOfflineFetch(baseFetch: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const method = String(
      init?.method || (input instanceof Request ? input.method : "GET"),
    ).toUpperCase();
    const key = cacheKey(input);
    const isRead = method === "GET" || method === "HEAD";
    const isRestMutation = isSupabaseRestRequest(key) && !isRead;

    if (isBrowser() && isRestMutation && !navigator.onLine) {
      queueOfflineRequest({
        label: `${method} ${new URL(key).pathname.replace("/rest/v1/", "")}`,
        request: {
          url: key,
          method,
          headers: getRequestHeaders(init),
          body: getRequestBody(init),
        },
      });
      return queuedResponse(init);
    }

    try {
      const response = await baseFetch(input, init);
      if (isBrowser() && isRead && response.ok && isSupabaseRestRequest(key)) {
        const copy = response.clone();
        const body = await copy.text();
        writeCachedRead(key, response, body);
      }
      return response;
    } catch (error) {
      if (isBrowser() && isRead) {
        const cached = getCachedResponse(key);
        if (cached) return cached;
      }
      if (isBrowser() && isRestMutation) {
        queueOfflineRequest({
          label: `${method} ${new URL(key).pathname.replace("/rest/v1/", "")}`,
          request: {
            url: key,
            method,
            headers: getRequestHeaders(init),
            body: getRequestBody(init),
          },
        });
        return queuedResponse(init);
      }
      throw error;
    }
  };
}

export async function syncQueuedRequests() {
  if (!isBrowser() || !navigator.onLine) return;
  const queue = readOfflineQueue();
  const remaining: QueuedOperation[] = [];

  for (const operation of queue) {
    if (!operation.request) {
      remaining.push(operation);
      continue;
    }

    try {
      const response = await fetch(operation.request.url, {
        method: operation.request.method || "POST",
        headers: {
          "content-type": "application/json",
          ...(operation.request.headers || {}),
        },
        body:
          operation.request.body === undefined ? undefined : JSON.stringify(operation.request.body),
      });
      if (!response.ok) remaining.push(operation);
    } catch (_) {
      remaining.push(operation);
    }
  }

  writeOfflineQueue(remaining);
}
