"use client";

import { useSyncExternalStore } from "react";
import { cartStorageKey, readCart, type CartLine } from "@/lib/cart";
import { CART_CHANGE_EVENT } from "@/lib/cart-events";

const EMPTY_CART: CartLine[] = [];
const cache = new Map<string, { raw: string | null; lines: CartLine[] }>();

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("storage", callback);
  window.addEventListener("focus", callback);
  window.addEventListener(CART_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("focus", callback);
    window.removeEventListener(CART_CHANGE_EVENT, callback);
  };
}

function getServerSnapshot() {
  return null;
}

function getSnapshot(customerId: string | null): CartLine[] {
  if (customerId === null || typeof window === "undefined") return EMPTY_CART;

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(cartStorageKey(customerId));
  } catch {
    return EMPTY_CART;
  }

  const cached = cache.get(customerId);
  if (cached && cached.raw === raw) return cached.lines;

  const lines = readCart(customerId);
  cache.set(customerId, { raw, lines });
  return lines;
}

export function useCart(customerId: number | string | null): CartLine[] | null {
  const key = customerId === null ? null : String(customerId);
  return useSyncExternalStore(
    subscribe,
    () => getSnapshot(key),
    getServerSnapshot,
  );
}
