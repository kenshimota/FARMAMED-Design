import type {
  MethodPaymentField,
  MethodPaymentType as LibMethodPaymentType,
  RecordId,
} from "@/lib/finance/method-payment-types-api";

export type {
  MethodPaymentFieldType,
  MethodPaymentTypeCurrency,
  MethodPaymentTypeFilters,
  RecordId,
} from "@/lib/finance/method-payment-types-api";

export type MethodPaymentTypeField = MethodPaymentField;
export type MethodPaymentType = LibMethodPaymentType;

export {
  METHOD_PAYMENT_FIELD_TYPES,
  METHOD_PAYMENT_FIELD_TYPE_LABELS,
  fetchMethodPaymentTypes,
  getMethodPaymentFieldTypeLabel,
  isMethodPaymentFieldType,
  isTextFieldType,
  parseMethodPaymentType,
  parseMethodPaymentTypeList,
} from "@/lib/finance/method-payment-types-api";

export function findMethodPaymentType(
  types: readonly MethodPaymentType[],
  id: RecordId | null,
) {
  if (id === null) return null;
  return types.find((type) => String(type.id) === String(id)) ?? null;
}
