// ============================================================
// Tên file: src/features/export-planning/useExportData.ts
// Tên tiếng Việt: Gom 9 bảng Xuất khẩu thành một khối dữ liệu cho màn
// Description: Loads the 9 export-planning tables (mig 0075 + 0079 activity log) into one ExportData + writers
// ============================================================
import { useMemo } from "react";
import {
  useExportActivityStore,
  useExportContractApprovals,
  useExportContractRevisions,
  useExportContracts,
  useExportDeadlineExtensions,
  useExportFiles,
  useExportPayments,
  useExportShipments,
  useExportStepItems,
} from "@/lib/catalogRepo";
import type { ExportData } from "@/lib/exportPlanning";

/** Hàm ghi của repo nhận mảng thường — bọc lại để màn truyền thẳng mảng chỉ-đọc của `ExportData`. */
const ro =
  <T,>(write: (rows: T[]) => boolean) =>
  (rows: readonly T[]): boolean =>
    write([...rows]);

export function useExportData() {
  const [contracts, saveContracts, contractsMeta] = useExportContracts();
  const [revisions, saveRevisions, revisionsMeta] = useExportContractRevisions();
  const [approvals, saveApprovals] = useExportContractApprovals();
  const [extensions, saveExtensions] = useExportDeadlineExtensions();
  const [shipments, saveShipments, shipmentsMeta] = useExportShipments();
  const [items, saveItems] = useExportStepItems();
  const [files, saveFiles] = useExportFiles();
  const [payments, savePayments] = useExportPayments();
  const { activities, setActivities: saveActivities, canLog } = useExportActivityStore();

  const data: ExportData = useMemo(
    () => ({ contracts, revisions, approvals, extensions, shipments, items, files, payments, activities }),
    [contracts, revisions, approvals, extensions, shipments, items, files, payments, activities],
  );

  return {
    data,
    isLoading: [contractsMeta, revisionsMeta, shipmentsMeta].some((m) => m.status === "loading") && contracts.length + shipments.length === 0,
    loadError: contractsMeta.error ?? shipmentsMeta.error ?? null,
    saveContracts: ro(saveContracts),
    saveRevisions: ro(saveRevisions),
    saveApprovals: ro(saveApprovals),
    saveExtensions: ro(saveExtensions),
    saveShipments: ro(saveShipments),
    saveItems: ro(saveItems),
    saveFiles: ro(saveFiles),
    savePayments: ro(savePayments),
    saveActivities: ro(saveActivities),
    canLog,
  };
}

export type ExportStore = ReturnType<typeof useExportData>;
