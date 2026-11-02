// ============================================================
// Tên file: src/features/shared/activityLog.ts
// Tên tiếng Việt: Ghi + đọc nhật ký thao tác trong hồ sơ — mỗi nhóm trang một bảng
// Description: Hooks of ba-spec 56 (mig 0092): one writer per page-group table — Kế hoạch (export_activity_log,
//              shared by Nhập khẩu · Lệnh sản xuất · Xuất khẩu), Nhập hàng (imports_activity_log), Sản xuất
//              (production_activity_log) — plus the "entries of one dossier" selector. A row is a business sentence
//              written by the screen right after a successful write (R3). Missing table / columns ⇒ silently skip.
// ============================================================
import { useEffect, useRef } from "react";
import { useImportsActivityStore, usePlanningActivityStore, useProductionActivityStore } from "@/lib/catalogRepo";
import { newId } from "@/lib/store";
import type { ActivityLogEntry, ActivityRecordType, ExportActivity, ExportActivityAction } from "@/types";

/** Nhóm trang (= `group` của tài nguyên quyền, = nhóm trên thanh bên) → bảng nhật ký. MỘT bảng mỗi nhóm (R1). */
export const ACTIVITY_LOG_TABLES = {
  planning: "export_activity_log",
  imports: "imports_activity_log",
  production: "production_activity_log",
} as const;
export type ActivityGroup = keyof typeof ACTIVITY_LOG_TABLES;

export interface ActivityInput {
  recordType: ActivityRecordType;
  recordId: string;
  parentType?: ActivityRecordType;
  parentId?: string;
  action: ExportActivityAction;
  summary: string;
  /** Dòng của HĐ xuất: chuyến (cột shipment_id cũ của 0079). */
  shipmentId?: string;
}

/** Hồ sơ của sổ theo ngày (Q3): ngày × phân xưởng. */
export const dayRecordId = (date: string, workshop: string) => `${date}|${workshop}`;

/** Dòng của một hồ sơ: chính nó hoặc hồ sơ con (parent) — mới nhất trước. */
export function entriesOf<T extends { recordType?: string; recordId?: string; parentType?: string; parentId?: string; createdAt: string }>(
  entries: readonly T[],
  recordType: ActivityRecordType,
  recordId: string,
): T[] {
  return entries
    .filter((e) => (e.recordType === recordType && e.recordId === recordId) || (e.parentType === recordType && e.parentId === recordId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Ghi thêm vào CUỐI bản mới nhất (ref): nhiều dòng trong một lần bấm / Hoàn tác từ toast cũ không đè nhau. */
function useAppender<T>(rows: readonly T[], save: (rows: T[]) => boolean) {
  const latest = useRef<readonly T[]>(rows);
  useEffect(() => {
    latest.current = rows;
  }, [rows]);
  return (add: T[]) => {
    if (!add.length) return;
    const next = [...latest.current, ...add];
    latest.current = next;
    save(next);
  };
}

const toEntry = (x: ActivityInput, actor: string, at: string): ActivityLogEntry => ({
  id: newId(),
  recordType: x.recordType,
  recordId: x.recordId,
  parentType: x.parentType ?? "",
  parentId: x.parentId ?? "",
  action: x.action,
  summary: x.summary,
  actor,
  createdAt: at,
});

/**
 * Nhóm Kế hoạch: HĐ xuất ghi dạng cũ (contractId / shipmentId); hồ sơ khác chỉ ghi khi máy chủ đã chạy 0092
 * (`canLogRecords`). `entries` có `recordType` / `recordId` đã điền (dòng cũ = HĐ xuất).
 */
export function usePlanningActivityLog(actor: string) {
  const { activities, setActivities, canLog, canLogRecords } = usePlanningActivityStore();
  const append = useAppender<ExportActivity>(activities, setActivities);
  const log = (items: readonly ActivityInput[]) => {
    const at = new Date().toISOString();
    const rows = items
      .filter((x) => x.recordId && (x.recordType === "export-contract" ? canLog : canLogRecords))
      .map((x): ExportActivity =>
        x.recordType === "export-contract"
          ? { id: newId(), contractId: x.recordId, shipmentId: x.shipmentId ?? "", action: x.action, summary: x.summary, actor, createdAt: at }
          : { ...toEntry(x, actor, at), contractId: "", shipmentId: x.shipmentId ?? "" },
      );
    append(rows);
  };
  return { entries: activities, log };
}

function useGroupLog(store: { entries: ActivityLogEntry[]; setEntries: (rows: ActivityLogEntry[]) => boolean; canLog: boolean }, actor: string) {
  const append = useAppender<ActivityLogEntry>(store.entries, store.setEntries);
  const log = (items: readonly ActivityInput[]) => {
    if (!store.canLog) return;
    const at = new Date().toISOString();
    append(items.filter((x) => x.recordId).map((x) => toEntry(x, actor, at)));
  };
  return { entries: store.entries, log };
}

/** Nhóm Nhập hàng. */
export function useImportsActivityLog(actor: string) {
  return useGroupLog(useImportsActivityStore(), actor);
}

/** Nhóm Sản xuất. */
export function useProductionActivityLog(actor: string) {
  return useGroupLog(useProductionActivityStore(), actor);
}
