// ============================================================
// Tên file: src/features/sales/SalesTab.tsx
// Tên tiếng Việt: Trang Bán hàng — hai tab Sổ bán hàng · Báo cáo
// Description: Sales page shell (route /sales): ledger tab (SalesScreen) + report tab
//              (SalesReport, totals per customer × channel). Tab lives in `?tab=` so a link can
//              open the report and the guided tour can switch tabs (it restores the URL on exit).
// ============================================================
import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/design-system";
import { useCan } from "@/features/shared/PermissionProvider";
import { usePageTour } from "@/features/shared/PageTourProvider";
import { useSalesInvoices } from "@/lib/catalogRepo";
import SalesScreen from "./SalesScreen";
import SalesReport from "./SalesReport";
import { buildSalesTour, type SalesTabId } from "./salesTour";

export default function SalesTab() {
  const [params, setParams] = useSearchParams();
  const tab: SalesTabId = params.get("tab") === "report" ? "report" : "ledger";
  const setTab = useCallback(
    (next: SalesTabId, replace = false) =>
      setParams(
        (p) => {
          const n = new URLSearchParams(p);
          if (next === "ledger") n.delete("tab");
          else n.set("tab", next);
          return n;
        },
        { replace },
      ),
    [setParams],
  );

  // Hướng dẫn thao tác (ba-spec 43): đăng ký ở cấp trang để đi được cả hai tab; chỉ dẫn, không ghi.
  const allowed = useCan("sales");
  const [salesInvoices, , { status }] = useSalesInvoices();
  const isLoading = status === "loading" && salesInvoices.length === 0;
  const tour = useMemo(
    () =>
      buildSalesTour({
        can: { create: allowed.create, update: allowed.update, viewPrice: allowed["view-price"] },
        showTab: (t) => setTab(t, true),
      }),
    [allowed, setTab],
  );
  usePageTour(isLoading ? null : tour);

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as SalesTabId)} className="space-y-6">
      <TabsList data-tour="sales-tabs">
        <TabsTrigger value="ledger">Sổ bán hàng</TabsTrigger>
        <TabsTrigger value="report">Báo cáo</TabsTrigger>
      </TabsList>
      <TabsContent value="ledger">
        <SalesScreen />
      </TabsContent>
      <TabsContent value="report">
        <SalesReport />
      </TabsContent>
    </Tabs>
  );
}
