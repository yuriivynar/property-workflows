"use client";

import { useEffect, useState } from "react";

/** Пошук «під час набору» (рішення власника 2026-11-26, ADR 0012): значення оновлюється, коли людина на мить зупинилась. */
export const SEARCH_DEBOUNCE_MS = 200;

export function useDebouncedValue<T>(value: T, delay = SEARCH_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
