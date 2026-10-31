"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useSession } from "@/components/erp/session-context";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { useCurrencyStatusContext } from "@/components/erp/ui/currency-status-context";
import {
  getCurrencyNoticeSnapshot,
  subscribeCurrencyNotice,
} from "@/lib/currency-notice";
import { CURRENCY_NOT_CONFIGURED_DETAIL } from "@/lib/feedback";

export function CurrencyNoticeBanner() {
  const { user } = useSession();
  const currencyStatus = useCurrencyStatusContext();
  const flagged = useSyncExternalStore(
    subscribeCurrencyNotice,
    getCurrencyNoticeSnapshot,
    getCurrencyNoticeSnapshot,
  );

  const missingFromCheck =
    currencyStatus?.status === "ready" && !currencyStatus.defaultCurrency;
  if (!flagged && !missingFromCheck) return null;

  return (
    <NoticeBanner
      action={
        user.role === "admin" ? (
          <Link
            className="font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
            href="/app/monedas"
          >
            Administrar monedas
          </Link>
        ) : undefined
      }
      role="status"
      tone="warning"
    >
      {CURRENCY_NOT_CONFIGURED_DETAIL}
    </NoticeBanner>
  );
}
