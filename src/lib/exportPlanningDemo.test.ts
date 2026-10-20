// Bộ demo Xuất khẩu (R14, AC-29 phần chạy được không cần DB): đủ 7 ca của buổi audit để trình diễn, file chỉ là
// đường dẫn giữ chỗ (không chép file thật), id không trùng, chạy lại ra cùng bộ.
import { describe, expect, it } from "vitest";
import { buildExportDemo } from "./exportPlanningDemo";
import {
  DEMO_PLACEHOLDER_PREFIX,
  contractClosure,
  contractState,
  contractTotals,
  effectiveRevision,
  isShipmentClosed,
  isShipmentLate,
  revisionApprovalLabelState,
  stepState,
  unmappedLines,
} from "./exportPlanning";

const CUSTOMERS = [
  { id: "dm-kh-0", code: "1", name: "KH 0", market: "Nhật Bản" },
  { id: "dm-kh-1", code: "2", name: "KH 1", market: "Nhật Bản" },
  { id: "dm-kh-2", code: "3", name: "KH 2", market: "Hàn Quốc" },
];
const TODAY = "2026-10-20";
const PRODUCTS = Array.from({ length: 12 }, (_, i) => ({ id: `sp-${i}` }));

describe("bộ demo Xuất khẩu", () => {
  const d = buildExportDemo(CUSTOMERS, TODAY, PRODUCTS);

  it("đủ 7 ca của buổi audit hồ sơ SCM", () => {
    expect(d.contracts.map((c) => c.contractNo)).toHaveLength(7);
    const st = Object.fromEntries(d.contracts.map((c) => [c.contractNo, contractState(d, c.id)]));
    expect(st).toEqual({
      "18.26/BSF-SCM.2026": "closed",
      "21.26/BSF-SCM.2026": "closed",
      "02.26/BSF-SCM.2026": "approved",
      "07.26/BSF-HTC.2026": "approved",
      "11.26/BSF-MTD.2026": "pending",
      "05.26/BSF-PC.2026": "cancelled",
      "99.26/BSF-LK.2026": "pending",
    });
    const byNo = (no: string) => d.contracts.find((c) => c.contractNo === no)!;
    // 1. HĐ 18.26: tổng đúng HĐ giấy, lô 165 đủ hồ sơ, ngoài dung sai ⇒ chốt TAY (không phải tự xuất đủ)
    const c1 = byNo("18.26/BSF-SCM.2026");
    expect(c1.status).toBe("closed");
    const r1 = effectiveRevision(d, c1.id)!;
    expect(contractTotals(r1.lines)).toMatchObject({ units: 1900, cartons: 2000, kg: 19000, amount: 172445 });
    const s165 = d.shipments.find((s) => s.lotCode === "165")!;
    expect(isShipmentClosed(d, s165)).toBe(true);
    expect(contractClosure(d, c1.id).kgDeviationPct).toBeGreaterThan(16.9);
    expect(revisionApprovalLabelState(d, r1)).toBe("approved");
    // 2. Lô 181 tự xuất đủ; bản sửa 1 bị từ chối, bản 0 vẫn hiệu lực
    const c2 = byNo("21.26/BSF-SCM.2026");
    expect(c2.status).toBe("open");
    expect(contractClosure(d, c2.id).closed).toBe(true);
    expect(effectiveRevision(d, c2.id)!.revisionNo).toBe(0);
    // 3. Cont 20 dùng chung Lệnh SX + bao bì của cont 40 cùng booking
    const s20 = d.shipments.find((s) => s.kind === "20RF")!;
    expect(stepState(d, s20, 2)).toBe("done");
    expect(stepState(d, s20, 3)).toBe("done");
    // 4. CIF ⇒ có mục bảo hiểm; 1 dòng chưa nối ⇒ Lệnh SX bị chặn; xe tải trễ hạn
    const c4 = byNo("07.26/BSF-HTC.2026");
    const truck = d.shipments.find((s) => s.kind === "truck")!;
    expect(d.items.some((i) => i.shipmentId === truck.id && i.docKind === "insurance")).toBe(true);
    expect(unmappedLines(effectiveRevision(d, c4.id)!.lines)).toHaveLength(1);
    expect(isShipmentLate(d, truck)).toBe(true);
    // 6. Bị từ chối ⇒ chuyến kế hoạch hủy theo
    expect(d.shipments.filter((s) => s.contractId === byNo("05.26/BSF-PC.2026").id).every((s) => s.status === "cancelled")).toBe(true);
    // Không ghi tên người thật vào bộ demo
    expect(new Set(d.approvals.map((a) => a.approverName))).toEqual(new Set(["Giám đốc (demo)"]));
  });

  it("file chỉ là đường dẫn giữ chỗ — không trỏ tới file thật", () => {
    const paths = [...d.files.map((f) => f.path), ...d.revisions.map((r) => r.filePath), ...d.approvals.map((a) => a.filePath)].filter(Boolean);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.every((p) => p.startsWith(DEMO_PLACEHOLDER_PREFIX))).toBe(true);
  });

  it("id không trùng trong từng bảng; tất định", () => {
    for (const rows of Object.values(d)) {
      const ids = (rows as { id: string }[]).map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
    expect(buildExportDemo(CUSTOMERS, TODAY, PRODUCTS)).toEqual(d);
  });

  it("không có khách ⇒ bộ rỗng", () => {
    expect(buildExportDemo([], TODAY).contracts).toEqual([]);
  });
});
