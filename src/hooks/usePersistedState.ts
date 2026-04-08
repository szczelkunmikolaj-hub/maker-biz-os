import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Like useState but persists to localStorage.
 * Reads initial value from localStorage (falls back to defaultValue).
 * Writes on every change with optional debounce.
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T,
  debounceMs = 0,
): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (debounceMs > 0) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        localStorage.setItem(key, JSON.stringify(value));
      }, debounceMs);
      return () => clearTimeout(timeoutRef.current);
    }
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value, debounceMs]);

  return [value, setValue];
}
