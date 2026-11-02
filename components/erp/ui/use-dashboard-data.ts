"use client";

import { useCallback } from "react";
import {
  useAsyncResource,
  type AsyncResource,
} from "@/components/erp/ui/use-async-resource";
import {
  fetchCustomerCount,
  fetchDraftPurchaseCount,
  fetchDraftPurchases,
  fetchExpiredLots,
  fetchExpiringLots,
  fetchInStockCount,
  fetchProductCount,
  fetchStocksInStock,
  type CountedRows,
  type DraftPurchase,
  type LotRow,
  type StockRow,
} from "@/lib/dashboard";
import { canReadModule } from "@/lib/permissions";

export type DashboardData = {
  products: AsyncResource<number>;
  customers: AsyncResource<number>;
  purchases: AsyncResource<CountedRows<DraftPurchase>>;
  purchaseCount: AsyncResource<number>;
  expiredLots: AsyncResource<CountedRows<LotRow>>;
  expiringLots: AsyncResource<CountedRows<LotRow>>;
  stocks: AsyncResource<CountedRows<StockRow>>;
  stockCount: AsyncResource<number>;
};

export function useDashboardData(role: string): DashboardData {
  const loadProducts = useCallback(() => fetchProductCount(), []);
  const loadCustomers = useCallback(() => fetchCustomerCount(), []);
  const loadPurchases = useCallback(() => fetchDraftPurchases(), []);
  const loadPurchaseCount = useCallback(() => fetchDraftPurchaseCount(), []);
  const loadExpiredLots = useCallback(() => fetchExpiredLots(), []);
  const loadExpiringLots = useCallback(() => fetchExpiringLots(), []);
  const loadStocks = useCallback(() => fetchStocksInStock(), []);
  const loadStockCount = useCallback(() => fetchInStockCount(), []);

  const readsCustomers = canReadModule(role, "clientes");
  const readsPurchases = canReadModule(role, "compras");
  const readsLots = canReadModule(role, "lotes");
  const readsStocks = canReadModule(role, "existencias");

  const products = useAsyncResource(loadProducts);
  const customers = useAsyncResource(loadCustomers, { enabled: readsCustomers });
  const purchases = useAsyncResource(loadPurchases, { enabled: readsPurchases });
  const purchaseCount = useAsyncResource(loadPurchaseCount, {
    enabled: readsPurchases,
  });
  const expiredLots = useAsyncResource(loadExpiredLots, { enabled: readsLots });
  const expiringLots = useAsyncResource(loadExpiringLots, { enabled: readsLots });
  const stocks = useAsyncResource(loadStocks, { enabled: readsStocks });
  const stockCount = useAsyncResource(loadStockCount, { enabled: readsStocks });

  return {
    products,
    customers,
    purchases,
    purchaseCount,
    expiredLots,
    expiringLots,
    stocks,
    stockCount,
  };
}
