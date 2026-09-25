'use client';

import { useSyncExternalStore } from 'react';

/**
 * A shared clock for countdowns. The server's time is used while hydrating so the
 * markup matches; afterwards the value follows the browser clock, updated every
 * `TICK_MS`. One interval serves every component on the page.
 */
const TICK_MS = 15_000;
let current = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  if (!timer) {
    current = Date.now();
    timer = setInterval(() => {
      current = Date.now();
      listeners.forEach((l) => l());
    }, TICK_MS);
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function useNow(serverNow: number): number {
  return useSyncExternalStore(subscribe, () => current, () => serverNow);
}
