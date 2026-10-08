import { describe, expect, it } from "vitest";
import type { ImportShipment, MaterialImportItem, Packaging, WipProductionItem } from "@/types";
import { banGhiIn, dsLoDeIn, ganLoChoPhien, loNlDeChon, meThieuLo, nhanLoNl, nutLo, soTemMacDinh, tomTatIn, type DuLieuTruyXuat } from "./truyXuatLo";
import type { LabelPrint, LotInput, LotWaiver } from "@/types";

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

describe("đợt 2b — chọn lô, chốt ngày, tem, gắn phiên", () => {
  const vao = (id: string, outputId: string, inputId: string, kg: number | null, luc: string) =>
    ({ id, outputKind: "W", outputId, inputKind: "S", inputId, inputLabel: "", material: "", quantityKg: kg, method: "chon", operator: "", recordedAt: luc }) as LotInput;

  it("loNlDeChon: lô cũ quá 45 ngày vẫn hiện nếu còn kg và đã vào thời truy xuất; lô cũ chưa từng theo dõi thì không", () => {
    const d: DuLieuTruyXuat = {
      ...dl,
      shipments: [chuyen("moi", "2026-10-01", "Đông"), chuyen("dong", "2026-07-10", "Đông"), chuyen("xua", "2026-06-01", "Đông")],
      imports: [dong("moi", "2026-10-01", 100, "Bạch tuộc"), dong("dong", "2026-07-10", 500, "Bạch tuộc"), dong("xua", "2026-06-01", 300, "Bạch tuộc")],
      lotInputs: [vao("a", "w1", "dong", 200, "2026-07-11T08:00:00Z")],
    };
    expect(loNlDeChon(d, "Đông", "2026-10-05").map((n) => n.id)).toEqual(["moi", "dong"]);
    // dùng hết lô đông ⇒ thôi gợi ý
    const het = { ...d, lotInputs: [...d.lotInputs, vao("b", "w2", "dong", 300, "2026-08-01T08:00:00Z")] };
    expect(loNlDeChon(het, "Đông", "2026-10-05").map((n) => n.id)).toEqual(["moi"]);
  });

  it("meThieuLo: mẻ có lô hoặc có lý do thì không còn thiếu", () => {
    const lyDo = [{ outputKind: "W", outputId: "b" } as LotWaiver];
    const ds = meThieuLo([{ id: "a" }, { id: "b" }, { id: "c" }], [vao("x", "a", "s1", null, "")], lyDo);
    expect(ds.map((m) => m.id)).toEqual(["c"]);
  });

  it("soTemMacDinh: BTP theo số block, TP theo số thùng, NL 1 tem", () => {
    const d = { wips: [{ ...me("w9", "2026-09-02", "Đông"), blocksCount: 24 }], packagings: [phieu("p9", "2026-09-02")] };
    expect(soTemMacDinh({ kind: "W", id: "w9" }, d)).toBe(24);
    expect(soTemMacDinh({ kind: "P", id: "p9" }, d)).toBe(4);
    expect(soTemMacDinh({ kind: "S", id: "s1" }, d)).toBe(1);
    expect(soTemMacDinh({ kind: "W", id: "khong" }, d)).toBe(1);
  });

  it("banGhiIn ghi đúng số tem từng lô", () => {
    const ds = banGhiIn([nutLo("W", "w1", dl)], "", "", () => "i", () => 12);
    expect(ds[0]!.copies).toBe(12);
  });

  it("ganLoChoPhien: không rõ loài vẫn gắn (chiều an toàn), không gắn trùng, báo dòng không khớp", () => {
    const d: DuLieuTruyXuat = { ...dl, products: [{ id: "mh1", code: "", name: "Hàng lạ", finishedGoodCode: "" }], lotInputs: [vao("cu", "w1", "s1", null, "")] };
    const kq = ganLoChoPhien({
      mes: [{ id: "w1", productId: "mh1" }, { id: "w2", productId: "mh1" }],
      banNoiDia: [{ id: "n1", materialTypeName: "Cá thu" }],
      loNl: [{ nut: nutLo("S", "s1", d), cach: "go" }],
      dl: d, nguoiGhi: "", luc: "", taoId: () => "g",
    });
    expect(kq.lotInputs.map((l) => l.outputId)).toEqual(["w2"]); // w1 đã gắn s1 rồi
    expect(kq.lotInputs[0]!.method).toBe("go");
    expect(kq.khongKhop).toEqual([{ kind: "N", id: "n1" }]);
  });
});
