const LOCALE = "es-VE";
const TIME_ZONE = "America/Caracas";
const EMPTY_VALUE = "—";

type NumericValue = number | string;

function toNumber(value: NumericValue) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function formatWith(
  value: NumericValue,
  options: Intl.NumberFormatOptions,
  { trimTrailingZeros = false }: { trimTrailingZeros?: boolean } = {},
) {
  const parsed = toNumber(value);
  if (parsed === null) return EMPTY_VALUE;
  const formatted = new Intl.NumberFormat(LOCALE, options).format(parsed);
  if (!trimTrailingZeros) return formatted;
  return formatted.replace(/,(\d*?)0+$/, ",$1").replace(/,$/, "");
}

export function formatInteger(value: NumericValue) {
  return formatWith(value, { maximumFractionDigits: 0 });
}

export function formatRate(value: NumericValue) {
  return formatWith(
    value,
    { minimumFractionDigits: 0, maximumFractionDigits: 6 },
    { trimTrailingZeros: true },
  );
}

export function formatCoordinate(value: NumericValue) {
  return formatWith(
    value,
    { minimumFractionDigits: 0, maximumFractionDigits: 7 },
    { trimTrailingZeros: true },
  );
}

export function formatPercent(value: NumericValue) {
  const formatted = formatWith(value, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    useGrouping: true,
  });
  return formatted === EMPTY_VALUE ? formatted : `${formatted} %`;
}

export function formatUnits(value: NumericValue) {
  const parsed = toNumber(value);
  if (parsed === null) return EMPTY_VALUE;
  return parsed === 1 ? "1 unidad" : `${formatInteger(parsed)} unidades`;
}

export type CurrencyDisplay = {
  code?: string | null;
  symbol?: string | null;
};

export function formatMoney(value: NumericValue, currency: CurrencyDisplay = {}) {
  const amount = formatWith(value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (amount === EMPTY_VALUE) return amount;
  const suffix = currency.code?.trim() || currency.symbol?.trim();
  return suffix ? `${amount} ${suffix}` : amount;
}

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

export function formatDateOnly(value: string | number | Date) {
  if (typeof value === "string") {
    const match = DATE_ONLY_PATTERN.exec(value.trim());
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return EMPTY_VALUE;

  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(date);
}

export function formatDateTime(value: string | number | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return EMPTY_VALUE;

  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(date);
}

export function formatCurrentDate() {
  return formatDateOnly(new Date());
}

export function formatDuration(seconds: number) {
  const total = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function formatWaitPhrase(seconds: number) {
  const total = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  const parts: string[] = [];
  if (minutes > 0) parts.push(minutes === 1 ? "1 minuto" : `${minutes} minutos`);
  if (rest > 0 || minutes === 0) parts.push(rest === 1 ? "1 segundo" : `${rest} segundos`);
  return parts.join(" y ");
}
