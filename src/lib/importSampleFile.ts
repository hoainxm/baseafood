// ============================================================
// Tên file: src/lib/importSampleFile.ts
// Tên tiếng Việt: Đọc file Excel báo cáo kiểm mẫu của kho (trình duyệt)
// Description: Browser loader for ba-spec 45 v4 R24 — .xlsx/.xls via SheetJS (lazy) into the cell grid
//              + merges that lib/importSampleChecks.parseSampleReport reads. Images / PDF are not read (Q1).
// ============================================================
import { parseSampleReport, type SampleCell, type SampleMerge, type SampleReportParse } from "./importSampleChecks";

/** Q1 (chủ dự án 2026-10-29): chỉ đọc Excel; ảnh / PDF chỉ đính kèm, số nhập tay. */
export const isReadableSampleFile = (fileName: string) => /\.(xlsx|xls)$/i.test(fileName);

export async function readSampleReportFile(file: Blob): Promise<SampleReportParse> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellNF: true });
  let best: SampleReportParse | null = null;
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws["!ref"]) continue;
    const range = XLSX.utils.decode_range(ws["!ref"]);
    const grid: SampleCell[][] = [];
    for (let r = range.s.r; r <= range.e.r; r++) {
      const row: SampleCell[] = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })] as { v?: SampleCell["v"]; z?: string } | undefined;
        row.push({ v: cell?.v ?? null, z: typeof cell?.z === "string" ? cell.z : undefined });
      }
      grid.push(row);
    }
    const merges: SampleMerge[] = (ws["!merges"] ?? []).map((m) => ({
      s: { r: m.s.r - range.s.r, c: m.s.c - range.s.c },
      e: { r: m.e.r - range.s.r, c: m.e.c - range.s.c },
    }));
    const parsed = parseSampleReport(grid, merges);
    // Nhiều sheet ⇒ lấy sheet ra nhiều mẫu nhất.
    if (!best || parsed.samples.length > best.samples.length) best = parsed;
  }
  return best ?? { reportDate: "", samples: [], failure: "File không có sheet nào." };
}
