import type { Application } from './types';

const KEY = 'lane_applications';

export async function getApplications(): Promise<Application[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(KEY, (result) => {
      resolve(result[KEY] ?? []);
    });
  });
}

export async function saveApplication(app: Application): Promise<void> {
  const apps = await getApplications();
  const idx = apps.findIndex((a) => a.id === app.id);
  if (idx >= 0) {
    apps[idx] = app;
  } else {
    apps.push(app);
  }
  return new Promise((resolve) => {
    chrome.storage.local.set({ [KEY]: apps }, resolve);
  });
}

export async function findByUrl(url: string): Promise<Application | null> {
  const apps = await getApplications();
  const normalize = (u: string) => {
    try {
      const p = new URL(u);
      return p.hostname + p.pathname.replace(/\/$/, '');
    } catch {
      return u;
    }
  };
  const target = normalize(url);
  return apps.find((a) => normalize(a.job_url) === target) ?? null;
}

export async function updateApplication(id: string, updates: Partial<Application>): Promise<void> {
  const apps = await getApplications();
  const idx = apps.findIndex((a) => a.id === id);
  if (idx < 0) return;
  apps[idx] = { ...apps[idx], ...updates, updated_at: new Date().toISOString() };
  return new Promise((resolve) => {
    chrome.storage.local.set({ [KEY]: apps }, resolve);
  });
}
