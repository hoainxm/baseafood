import { describe, expect, it } from "vitest";
import type { ImportShipment, MaterialImportItem, Packaging, WipProductionItem } from "@/types";
import { banGhiIn, dsLoDeIn, nhanLoNl, nutLo, tomTatIn, type DuLieuTruyXuat } from "./truyXuatLo";
import type { LabelPrint } from "@/types";

const chuyen = (id: string, ngay: string, xuong: ImportShipment["workshop"], lotCode = ""): ImportShipment => ({
  id, deliveryDate: ngay, postingDate: ngay, backdateReason: "", workshop: xuong,
  supplierName: "Hồng Phú", driverName: "", licensePlate: "", note: "", lotCode,
});
const dong = (shipmentId: string, ngay: string, kg: number, loai: string): MaterialImportItem =>
  ({ id: `${shipmentId}-${loai}`, shipmentId, deliveryDate: ngay, workshop: "Đông", quantityKg: kg, materialTypeName: loai, category: loai }) as MaterialImportItem;
const me = (id: string, ngay: string, xuong: WipProductionItem["workshop"]): WipProductionItem => ({
  id, productionDate: ngay, postingDate: ngay, backdateReason: "", workshop: xuong, productId: "mh1",
  spec: "", quantityKg: 100, blocksCount: 0, warehouse: "", status: "cho-nhap" as WipProductionItem["status"], note: "",
});
const phieu = (id: string, ngay: string): Packaging => ({
  id, date: ngay, workshop: "Đông", fromProductId: "mh1", fromSpec: "", inputKg: 50, inputBlocks: 0,
  toProductId: "mh2", toSpec: "", outputKg: 48, outputUnits: 4, warehouse: "", note: "",
});

const dl: DuLieuTruyXuat = {
  shipments: [chuyen("s1", "2026-09-01", "Đông", "Đ-260901-01"), chuyen("s2", "2026-09-03", "Cá"), chuyen("s3", "2026-08-20", "Đông")],
  imports: [dong("s1", "2026-09-01", 1000, "Mực ống"), dong("s1", "2026-09-01", 200, "Bạch tuộc")],
  wips: [me("w1", "2026-09-02", "Đông")],
  packagings: [phieu("p1", "2026-09-02")],
  lotInputs: [], exportItems: [], exportOrders: [], salesOrders: [], products: [], customers: [],
};

describe("dsLoDeIn", () => {
  it("lọc theo khoảng ngày + loại, mới trước, cùng ngày theo NL→BTP→TP", () => {
    const ds = dsLoDeIn(dl, { tu: "2026-09-01", den: "2026-09-30", xuong: "", loai: ["S", "W", "P"] });
    expect(ds.map((n) => `${n.kind}:${n.id}`)).toEqual(["S:s2", "W:w1", "P:p1", "S:s1"]);
  });
  it("lọc theo xưởng và loại", () => {
    expect(dsLoDeIn(dl, { tu: "2026-08-01", den: "2026-09-30", xuong: "Đông", loai: ["S"] }).map((n) => n.id)).toEqual(["s1", "s3"]);
    expect(dsLoDeIn(dl, { tu: "2026-08-01", den: "2026-09-30", xuong: "", loai: [] })).toEqual([]);
  });
  it("tem NL mang loại hàng + tổng kg của chuyến", () => {
    const [s1] = dsLoDeIn(dl, { tu: "2026-09-01", den: "2026-09-01", xuong: "", loai: ["S"] });
    expect(s1!.nhan).toBe("Đ-260901-01");
    expect(s1!.kg).toBe(1200);
    expect(s1!.moTa).toBe("Mực ống, Bạch tuộc");
  });
});

describe("nhanLoNl", () => {
  it("chuyến chưa có mã lô thì suy từ xưởng + ngày + đuôi id", () => {
    expect(nhanLoNl({ ...chuyen("1787820268862-288016", "2026-08-26", "Đông") })).toBe("NĐ-260826-8016");
  });
});

describe("sổ in tem", () => {
  it("banGhiIn: mỗi lô một dòng, nhãn đông cứng, bỏ lô đã mất", () => {
    let i = 0;
    const ds = banGhiIn([nutLo("S", "s1", dl), nutLo("W", "w1", dl), nutLo("W", "khong-co", dl)], "Trúc", "2026-10-02T08:00:00Z", () => `id${++i}`);
    expect(ds).toEqual([
      { id: "id1", lotKind: "S", lotId: "s1", label: "Đ-260901-01", copies: 1, operator: "Trúc", printedAt: "2026-10-02T08:00:00Z" },
      { id: "id2", lotKind: "W", lotId: "w1", label: ds[1]!.label, copies: 1, operator: "Trúc", printedAt: "2026-10-02T08:00:00Z" },
    ]);
  });
  it("tomTatIn: gom theo lô, lấy lần in gần nhất", () => {
    const p = (id: string, lotId: string, luc: string, label = "A"): LabelPrint =>
      ({ id, lotKind: "S", lotId, label, copies: 1, operator: "", printedAt: luc });
    const m = tomTatIn([p("1", "s1", "2026-10-01", "cũ"), p("2", "s1", "2026-10-02", "mới"), p("3", "s2", "2026-10-01")]);
    expect(m.get("S:s1")).toMatchObject({ lan: 2, tem: 2, cuoi: { label: "mới" } });
    expect(m.get("S:s2")?.lan).toBe(1);
    expect(m.has("W:s1")).toBe(false);
  });
});
