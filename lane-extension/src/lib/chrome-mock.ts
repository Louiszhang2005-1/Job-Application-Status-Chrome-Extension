// Polyfill chrome.* APIs with localStorage so the dashboard works as a standalone web app.
// Injected only in the web build (vite.web.config.ts), never in the extension build.

const PREFIX = 'lane_storage::';

function storageGet(keys: string | string[] | null, callback: (result: Record<string, unknown>) => void) {
  const result: Record<string, unknown> = {};
  const keyList: string[] =
    keys === null
      ? Object.keys(localStorage)
          .filter((k) => k.startsWith(PREFIX))
          .map((k) => k.slice(PREFIX.length))
      : typeof keys === 'string'
      ? [keys]
      : keys;
  for (const key of keyList) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw !== null) result[key] = JSON.parse(raw);
    } catch {
      // corrupt entry — skip
    }
  }
  setTimeout(() => callback(result), 0);
}

function storageSet(items: Record<string, unknown>, callback?: () => void) {
  for (const [key, value] of Object.entries(items)) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // storage full — ignore
    }
  }
  setTimeout(() => callback?.(), 0);
}

function storageRemove(keys: string | string[], callback?: () => void) {
  const keyList = typeof keys === 'string' ? [keys] : keys;
  for (const key of keyList) {
    localStorage.removeItem(PREFIX + key);
  }
  setTimeout(() => callback?.(), 0);
}

if (typeof window !== 'undefined' && (typeof chrome === 'undefined' || !chrome?.storage?.local)) {
  (window as unknown as Record<string, unknown>).chrome = {
    storage: {
      local: { get: storageGet, set: storageSet, remove: storageRemove },
    },
    identity: {
      getAuthToken: (_: unknown, cb?: (token?: string) => void) => {
        cb?.(undefined);
      },
      removeCachedAuthToken: (_: unknown, cb?: () => void) => cb?.(),
      clearAllCachedAuthTokens: (cb?: () => void) => cb?.(),
    },
    runtime: {
      id: 'web-demo',
      getManifest: () => ({ oauth2: { client_id: '' }, version: '1.0.0' }),
      lastError: null,
    },
  };
}
