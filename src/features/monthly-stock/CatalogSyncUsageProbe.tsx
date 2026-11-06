// ============================================================
// Tên file: src/features/monthly-stock/CatalogSyncUsageProbe.tsx
// Tên tiếng Việt: Dò các sổ đang dùng mặt hàng / loại NL — cho Hoàn tác "Đồng bộ danh mục"
// Description: Invisible component that loads the ledgers referencing products / material
//              types and hands them to the screen, so undoing a catalog sync keeps items
//              that got used meanwhile. Mounted from the first time the sync dialog opens,
//              so the monthly-stock screen does not load eleven extra tables on every visit.
// ============================================================
// Rà 2026-11-06 mục 7: Hoàn tác đồng bộ không được xóa mục vừa tạo mà trong lúc thông báo còn
// hiện đã có sổ khác dùng. Mặt hàng: 7 sổ trỏ theo id (`ProductUsageSources`, như thùng rác
// QuickProductDelete). Loại NL: sổ nhập, kỳ cân đối, bán nội địa, tồn đầu NL trỏ theo TÊN.
// Sổ nào chưa nạp xong ⇒ `ready = false` ⇒ màn giữ hết mục cho an toàn.
import { useEffect } from "react";
import {
  useBalancingOutputs,
  useBalancingPeriods,
  useDomesticSales,
  useExportItems,
  useFinishedGoodsOpeningStock,
  useMaterialImports,
  useMaterialOpeningStock,
  useOrderItems,
  usePackagings,
  useSalesItems,
  useWipProductions,
} from "@/lib/catalogRepo";
import type { CatalogSyncUsageSources } from "@/lib/monthlyStockCatalogSync";

export interface CatalogSyncUsageSnapshot {
  /** Mọi sổ đã nạp xong (sai ⇒ chưa biết chắc, giữ hết). */
  ready: boolean;
  sources: Pick<CatalogSyncUsageSources, "productSources" | "materialNamesInUse">;
}

export function CatalogSyncUsageProbe({ onSnapshot }: { onSnapshot: (snapshot: CatalogSyncUsageSnapshot | null) => void }) {
  const [wips, , wipState] = useWipProductions();
  const [packagings, , packagingState] = usePackagings();
  const [salesItems, , salesState] = useSalesItems();
  const [orderItems, , orderState] = useOrderItems();
  const [exportItems, , exportState] = useExportItems();
  const [balancingOutputs, , outputState] = useBalancingOutputs();
  const [finishedOpeningStock, , finishedState] = useFinishedGoodsOpeningStock();
  const [imports, , importState] = useMaterialImports();
  const [periods, , periodState] = useBalancingPeriods();
  const [domesticSales, , domesticState] = useDomesticSales();
  const [openingStock, , openingState] = useMaterialOpeningStock();

  const states = [
    wipState, packagingState, salesState, orderState, exportState, outputState,
    finishedState, importState, periodState, domesticState, openingState,
  ];
  const ready = states.every((s) => s.status === "ready");

  useEffect(() => {
    onSnapshot({
      ready,
      sources: {
        productSources: { wips, packagings, salesItems, orderItems, exportItems, balancingOutputs, finishedOpeningStock },
        materialNamesInUse: [
          ...imports.map((r) => r.materialTypeName),
          ...periods.map((r) => r.materialTypeName),
          ...domesticSales.map((r) => r.materialTypeName),
          ...openingStock.map((r) => r.materialTypeName),
        ].filter(Boolean),
      },
    });
  });
  useEffect(() => () => onSnapshot(null), [onSnapshot]);
  return null;
}
