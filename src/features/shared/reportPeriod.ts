// ============================================================
// Tên file: src/features/shared/reportPeriod.ts
// Tên tiếng Việt: Chữ gọi kỳ báo cáo (tháng / quý / năm) dùng chung các tab Báo cáo
// Description: Period nouns shared by report tabs (ReportPeriodBar, Import / Production order reports).
// ============================================================
import type { ReportPeriodKind } from "@/lib/exportReports";

export const PERIOD_NOUN: Record<ReportPeriodKind, string> = { month: "tháng", quarter: "quý", year: "năm" };
