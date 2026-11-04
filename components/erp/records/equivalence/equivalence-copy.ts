import type { UiError } from "@/lib/api-errors";
export const EQUIVALENCE_COPY = {
  heading: "Equivalencia en otra moneda",
  intro:
    "La conversión es informativa y usa la tasa vigente. El documento conserva su moneda.",
  currencyLabel: "Ver en otra moneda",
  documentCurrency: "Moneda del documento",
  refresh: "Actualizar",
  reset: "Ver en moneda del documento",
  noConversion: "Sin conversión",
  noConversionHelp: "El documento ya está en",
  totalOrder: "Total del pedido",
  invoiceBalance: "Saldo de la factura",
  equivalentIn: "Equivalente en",
  rate: "Tasa aplicada",
  rateUpdatedAt: "Última actualización de la tasa",
  rateSourceUpdatedAt: "Última actualización · origen",
  rateTargetUpdatedAt: "Última actualización · destino",
  calculatedAt: "Calculado el",
  rounding: "Ajuste por redondeo",
  noLines: "Este documento no tiene líneas.",
  noLinesTitle: "Sin líneas",
  cashAmountPrefix: "Monto a pagar en",
  cashHelp:
    "Este es el monto de referencia para procesar la factura de contado. No descuenta ni bloquea la billetera.",
  creditPrefix: "Crédito:",
  termPending: "Término de pago por definir",
  rateMayChange: "La tasa puede cambiar. Actualiza para recalcular.",
  fallbackHelp:
    "Mostramos el bolívar y la moneda del documento porque tu perfil no puede consultar el listado completo de monedas.",
  rateUpdated: "Tasa actualizada.",
  linesHeading: "Líneas con importes originales y equivalentes",
} as const;

export type EquivalenceErrorCopy = {
  title: string;
  description: string;
  canRetry: boolean;
};

export function equivalenceErrorCopy(
  error: UiError | null,
): EquivalenceErrorCopy {
  if (!error) {
    return {
      title: "No pudimos calcular el equivalente",
      description: "No pudimos calcular el equivalente. Intenta de nuevo.",
      canRetry: true,
    };
  }

  switch (error.status) {
    case 401:
      return {
        title: "Tu sesión venció",
        description: "Tu sesión venció. Vuelve a iniciar sesión.",
        canRetry: false,
      };
    case 403:
      return {
        title: "Sin permiso",
        description: "No tienes permiso para ver esta conversión.",
        canRetry: false,
      };
    case 404:
      return {
        title: "No encontramos el registro",
        description: "No encontramos el pedido, la factura o la moneda.",
        canRetry: true,
      };
    case 422:
      return {
        title: "Moneda no disponible",
        description: "La moneda seleccionada no está disponible.",
        canRetry: true,
      };
    case 503:
      return {
        title: "Configuración de monedas incompleta",
        description: "La configuración de monedas está incompleta.",
        canRetry: true,
      };
    default:
      return {
        title: "No pudimos calcular el equivalente",
        description: "No pudimos calcular el equivalente. Intenta de nuevo.",
        canRetry: true,
      };
  }
}
