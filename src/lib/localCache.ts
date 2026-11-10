// Device-side cache of the user's data (localStorage).
//
// localStorage is small (about 5 MB, less in Safari) and setItem THROWS when it is full.
// Every write therefore goes through these helpers, which never throw, so a full
// device cache can never block a cloud save or a cloud load again.
import type { Project } from '@/types';

export const DATA_CACHE_KEYS = [
  'pt_projects',
  'pt_expenses',
  'pt_templates',
  'pt_filament_purchases',
  'pt_settings',
  'pt_customer_notes',
] as const;

const OWNER_KEY = 'pt_cache_owner';

/** localStorage.setItem that reports failure instead of throwing. */
export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`[cache] could not write ${key}:`, err);
    return false;
  }
}

export function cacheJSON(key: string, value: unknown): boolean {
  return safeSetItem(key, JSON.stringify(value));
}

/** Copy of the projects without embedded preview images (they are ~95% of the size). */
export function stripThumbnails(projects: Project[]): Project[] {
  return projects.map(p => {
    const { coverThumbnail: _cover, ...rest } = p;
    return {
      ...rest,
      prints: (p.prints || []).map(pr => {
        const { thumbnail: _thumb, ...printRest } = pr;
        return printRest;
      }),
    } as Project;
  });
}

/**
 * Cache projects on this device.
 * 'full' = stored with previews, 'lite' = stored without previews (device storage is full),
 * 'none' = nothing could be stored.
 */
export function cacheProjects(projects: Project[]): 'full' | 'lite' | 'none' {
  if (cacheJSON('pt_projects', projects)) return 'full';
  // Free the old copy first so the smaller one has room.
  try { localStorage.removeItem('pt_projects'); } catch { /* ignore */ }
  if (cacheJSON('pt_projects', stripThumbnails(projects))) return 'lite';
  return 'none';
}

/** Which signed-in account the cached data belongs to (null = guest data or unknown). */
export function getCacheOwner(): string | null {
  try { return localStorage.getItem(OWNER_KEY); } catch { return null; }
}

export function setCacheOwner(userId: string): void {
  safeSetItem(OWNER_KEY, userId);
}

/** Remove all cached account data from this device (used on sign-out). */
export function clearDataCache(): void {
  try {
    DATA_CACHE_KEYS.forEach(k => localStorage.removeItem(k));
    localStorage.removeItem(OWNER_KEY);
  } catch { /* ignore */ }
}
