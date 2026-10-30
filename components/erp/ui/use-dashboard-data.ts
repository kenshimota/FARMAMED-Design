"use client";

import { useCallback } from "react";
import {
  useAsyncResource,
  type AsyncResource,
} from "@/components/erp/ui/use-async-resource";
import {
  fetchCustomerCount,
  fetchDraftPurchases,
  fetchExpiredLots,
  fetchExpiringLots,
  fetchProductCount,
  fetchStocksInStock,
  fetchSuppliers,
  type CountedRows,
  type DraftPurchase,
  type LotRow,
  type StockRow,
  type SupplierRow,
} from "@/lib/dashboard";
import { canReadModule, type Role } from "@/lib/permissions";

export type DashboardData = {
  products: AsyncResource<number>;
  customers: AsyncResource<number>;
  purchases: AsyncResource<CountedRows<DraftPurchase>>;
  expiredLots: AsyncResource<CountedRows<LotRow>>;
  expiringLots: AsyncResource<CountedRows<LotRow>>;
  stocks: AsyncResource<CountedRows<StockRow>>;
  suppliers: AsyncResource<SupplierRow[]>;
};

export function useDashboardData(role: Role): DashboardData {
  const loadProducts = useCallback(() => fetchProductCount(), []);
  const loadCustomers = useCallback(() => fetchCustomerCount(), []);
  const loadPurchases = useCallback(() => fetchDraftPurchases(), []);
  const loadExpiredLots = useCallback(() => fetchExpiredLots(), []);
  const loadExpiringLots = useCallback(() => fetchExpiringLots(), []);
  const loadStocks = useCallback(() => fetchStocksInStock(), []);
  const loadSuppliers = useCallback(() => fetchSuppliers(), []);

  const readsCustomers = canReadModule(role, "clientes");
  const readsPurchases = canReadModule(role, "compras");
  const readsLots = canReadModule(role, "lotes");
  const readsStocks = canReadModule(role, "existencias");

  const products = useAsyncResource(loadProducts);
  const customers = useAsyncResource(loadCustomers, { enabled: readsCustomers });
  const purchases = useAsyncResource(loadPurchases, { enabled: readsPurchases });
  const expiredLots = useAsyncResource(loadExpiredLots, { enabled: readsLots });
  const expiringLots = useAsyncResource(loadExpiringLots, { enabled: readsLots });
  const stocks = useAsyncResource(loadStocks, { enabled: readsStocks });
  const suppliers = useAsyncResource(loadSuppliers, { enabled: readsPurchases });

  return { products, customers, purchases, expiredLots, expiringLots, stocks, suppliers };
}
