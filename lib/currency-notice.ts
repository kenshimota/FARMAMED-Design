let currencyNotConfigured = false;

const listeners = new Set<() => void>();

export function subscribeCurrencyNotice(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getCurrencyNoticeSnapshot() {
  return currencyNotConfigured;
}

export function flagCurrencyNotConfigured() {
  if (currencyNotConfigured) return;
  currencyNotConfigured = true;
  for (const listener of listeners) listener();
}

export function clearCurrencyNotConfigured() {
  if (!currencyNotConfigured) return;
  currencyNotConfigured = false;
  for (const listener of listeners) listener();
}
