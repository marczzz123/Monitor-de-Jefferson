import { useEffect, useState } from "react";

export const ADMIN_PASSWORD = "70590321";
export const UNLOCK_DURATION_MS = 5 * 60 * 1000;

let unlockedUntil = 0;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function isAdminUnlocked(): boolean {
  return Date.now() < unlockedUntil;
}

export function getAdminUnlockedUntil(): number {
  return unlockedUntil;
}

export function unlockAdmin(): number {
  unlockedUntil = Date.now() + UNLOCK_DURATION_MS;
  notify();
  return unlockedUntil;
}

export function lockAdmin(): void {
  unlockedUntil = 0;
  notify();
}

export function useAdminLock() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((t) => t + 1);
    listeners.add(fn);
    const interval = setInterval(() => {
      if (unlockedUntil > 0 && Date.now() >= unlockedUntil) {
        unlockedUntil = 0;
        setTick((t) => t + 1);
      } else if (unlockedUntil > 0) {
        // tick to update countdown
        setTick((t) => t + 1);
      }
    }, 1000);
    return () => {
      listeners.delete(fn);
      clearInterval(interval);
    };
  }, []);
  const now = Date.now();
  const msLeft = Math.max(0, unlockedUntil - now);
  return {
    unlocked: msLeft > 0,
    msLeft,
    unlock: unlockAdmin,
    lock: lockAdmin,
  };
}
