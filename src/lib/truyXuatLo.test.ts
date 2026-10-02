import { describe, expect, it } from "vitest";
import type { ImportShipment, MaterialImportItem, Packaging, WipProductionItem } from "@/types";
import { dsLoDeIn, nhanLoNl, type DuLieuTruyXuat } from "./truyXuatLo";

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
