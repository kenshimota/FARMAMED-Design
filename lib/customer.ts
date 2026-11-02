import { ApiError } from "@/lib/api";

export type CustomerAccessIssue = "vinculo" | "lista";

export const CUSTOMER_PROFILE_NOT_LINKED = "Customer profile is not linked";
export const CUSTOMER_PRICE_LIST_NOT_ASSIGNED =
  "Customer price list is not assigned";

function normalizeMessage(message: string) {
  return message.trim().toLowerCase();
}

export function getCustomerAccessIssue(
  error: unknown,
): CustomerAccessIssue | null {
  if (!(error instanceof ApiError) || error.status !== 403) return null;

  const message = normalizeMessage(error.message);
  if (message === normalizeMessage(CUSTOMER_PRICE_LIST_NOT_ASSIGNED)) {
    return "lista";
  }
  if (message === normalizeMessage(CUSTOMER_PROFILE_NOT_LINKED)) {
    return "vinculo";
  }
  return null;
}

export function hasCustomerLink(user: {
  customer_id: number | string | null;
}) {
  return user.customer_id !== null;
}
