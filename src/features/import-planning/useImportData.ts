// ============================================================
// Tên file: src/features/import-planning/useImportData.ts
// Tên tiếng Việt: Gom 6 bảng Nhập khẩu thành một khối dữ liệu cho màn
// Description: Loads the 6 import-planning tables (mig 0082) into one ImportData + writers
// ============================================================
import { useMemo } from "react";
import {
  isMissingTableError,
  isServerConnected,
  useImportContractLines,
  useImportContracts,
  useImportDocuments,
  useImportFiles,
  useImportReceiptLines,
  useImportReceipts,
  useImportSampleChecks,
} from "@/lib/catalogRepo";
import type { ImportData } from "@/lib/importPlanning";
import { hasImportStorage } from "@/lib/importFileStorage";

/** Hàm ghi của repo nhận mảng thường — bọc lại để màn truyền thẳng mảng chỉ-đọc của `ImportData`. */
const ro =
  <T,>(write: (rows: T[]) => boolean) =>
  (rows: readonly T[]): boolean =>
    write([...rows]);

export function useImportData() {
  const [contracts, saveContracts, contractsMeta] = useImportContracts();
  const [lines, saveLines, linesMeta] = useImportContractLines();
  const [receipts, saveReceipts, receiptsMeta] = useImportReceipts();
  const [receiptLines, saveReceiptLines] = useImportReceiptLines();
  const [documents, saveDocuments] = useImportDocuments();
  const [files, saveFiles] = useImportFiles();
  const [sampleChecks, saveSampleChecks, sampleMeta] = useImportSampleChecks();

  // R22 (ba-spec 45 v3): máy chủ chỉ trả `product_id` khi đã chạy 0084 ⇒ dò ở dòng đọc về. Chưa có
  // dòng nào thì chưa biết ⇒ coi như chưa có cột (không gửi, không bắt nối).
  const productLinkAvailable = !isServerConnected || lines.some((l) => l.productId !== undefined);
  const data: ImportData = useMemo(
    () => ({ contracts, lines, receipts, receiptLines, documents, files, sampleChecks, filesAvailable: hasImportStorage, productLinkAvailable }),
    [contracts, lines, receipts, receiptLines, documents, files, sampleChecks, productLinkAvailable],
  );
  // Thủ kho không đọc được bảng HĐ (RLS) ⇒ dò "máy chủ chưa có bảng" ở bảng lần nhập (ai cũng đọc).
  const probe = receiptsMeta;
  const isAvailable = !isServerConnected || (probe.status !== "loading" && !isMissingTableError(probe.error));

  return {
    data,
    isAvailable,
    isLoading: [contractsMeta, linesMeta, receiptsMeta].some((m) => m.status === "loading") && contracts.length + receipts.length === 0,
    loadError: isMissingTableError(probe.error) ? null : (receiptsMeta.error ?? null),
    saveContracts: ro(saveContracts),
    saveLines: ro(saveLines),
    saveReceipts: ro(saveReceipts),
    saveReceiptLines: ro(saveReceiptLines),
    saveDocuments: ro(saveDocuments),
    saveFiles: ro(saveFiles),
    saveSampleChecks: ro(saveSampleChecks),
    /** Máy chủ chưa chạy 0085 ⇒ không ghi kiểm mẫu (khỏi kẹt hàng chờ). */
    sampleChecksAvailable: !isServerConnected || (sampleMeta.status !== "loading" && !isMissingTableError(sampleMeta.error)),
  };
}

export type ImportStore = ReturnType<typeof useImportData>;
