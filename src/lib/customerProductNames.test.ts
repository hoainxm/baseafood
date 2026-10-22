// Oracle: docs/app-map/41-export-planning.ba-spec.md v6 — R23 · R26, AC-39 · AC-46 · AC-47.
// Tên thật của HĐ 18.26 (Seachemot) — dòng 3 và 4 cùng tên, khác size.
import { describe, expect, it } from "vitest";
import { learnCustomerNames, lineTextAfterPick, productsByCustomerName, validateCustomerProductName } from "./customerProductNames";
import type { CustomerProductName, ExportContractLine } from "@/types";

let seq = 0;
const nid = () => `n-${++seq}`;
const row = (over: Partial<CustomerProductName>): CustomerProductName => ({
  id: nid(), customerId: "scm", productId: "p-55", tradeName: "Frozen iwadako boiled cut", sizeText: "5-5.5 gr/pc", packing: "", hsCode: "", note: "", ...over,
});
const line = (over: Partial<ExportContractLine>): ExportContractLine => ({
  id: nid(), description: "", hsCode: "", size: "", packing: "", unitKind: "carton", cartonsPerUnit: 1, netKgPerCarton: 10, quantity: 100, kg: null, unitPrice: 10, microSpec: "", ...over,
});

describe("AC-39 — chọn mặt hàng điền theo tên của khách, không ghi đè", () => {
  const scm = { tradeName: "Frozen iwadako boiled cut", sizeText: "5-5.5 gr/pc", packing: "Net weight IQF 1kg/PE x 10/CTN", hsCode: "16055500" };
  const product = { tradeName: "Frozen boiled octopus" };
  it("dòng trống của Seachemot ⇒ đủ 4 ô của Seachemot", () => {
    expect(lineTextAfterPick({ description: "", size: "", packing: "", hsCode: "" }, product, scm)).toEqual({
      description: "Frozen iwadako boiled cut", size: "5-5.5 gr/pc", packing: "Net weight IQF 1kg/PE x 10/CTN", hsCode: "16055500",
    });
  });
  it("ô đã gõ giữ nguyên, ô trống vẫn được điền", () => {
    const r = lineTextAfterPick({ description: "Iwadako cut", size: "", packing: "", hsCode: "" }, product, scm);
    expect(r.description).toBe("Iwadako cut");
    expect(r.size).toBe("5-5.5 gr/pc");
  });
  it("khách chưa có tên (Matsuda) ⇒ chỉ ô tên lấy tên mặc định", () => {
    expect(lineTextAfterPick({ description: "", size: "", packing: "", hsCode: "" }, product, undefined)).toEqual({ description: "Frozen boiled octopus", size: "", packing: "", hsCode: "" });
    expect(lineTextAfterPick({ description: "", size: "", packing: "", hsCode: "" }, undefined, undefined).description).toBe("");
  });
});

describe("Khớp tên của khách (R23 bậc 1–2)", () => {
  const names = [row({ productId: "p-55" }), row({ productId: "p-67", sizeText: "6-7 gr/pc" }), row({ customerId: "mat", productId: "p-55", tradeName: "Frozen boiled octopus", sizeText: "" })];
  it("tên + size ra một; tên không size ra hai; khách khác không lẫn", () => {
    expect(productsByCustomerName(names, "scm", "FROZEN iwadako  boiled cut", "6-7 gr/PC")).toEqual({ tier: 1, productIds: ["p-67"] });
    expect(productsByCustomerName(names, "scm", "Frozen iwadako boiled cut").productIds.sort()).toEqual(["p-55", "p-67"]);
    expect(productsByCustomerName(names, "scm", "Frozen boiled octopus")).toEqual({ tier: null, productIds: [] });
    expect(productsByCustomerName(names, "mat", "Frozen boiled octopus", "x")).toEqual({ tier: 2, productIds: ["p-55"] });
  });
});

describe("AC-47 — chặn trùng trong danh sách của một khách", () => {
  const all = [row({ id: "a", productId: "p-55" })];
  it("hai dòng cho cùng (khách, mặt hàng) ⇒ lỗi", () => {
    expect(validateCustomerProductName(row({ id: "b", productId: "p-55", sizeText: "x" }), all).map((i) => i.field)).toContain("Mặt hàng");
  });
  it("mặt hàng khác trùng cả tên lẫn size (khác hoa thường) ⇒ lỗi size", () => {
    expect(validateCustomerProductName(row({ id: "b", productId: "p-67", tradeName: "FROZEN iwadako boiled cut", sizeText: "5-5.5 GR/pc" }), all).map((i) => i.field)).toEqual(["Size"]);
  });
  it("cùng tên khác size ⇒ hợp lệ; khách khác trùng tên ⇒ hợp lệ; tên rỗng ⇒ lỗi", () => {
    expect(validateCustomerProductName(row({ id: "b", productId: "p-67", sizeText: "6-7 gr/pc" }), all)).toEqual([]);
    expect(validateCustomerProductName(row({ id: "b", customerId: "mat", productId: "p-55" }), all)).toEqual([]);
    expect(validateCustomerProductName(row({ id: "b", productId: "p-67", tradeName: " " }), all).map((i) => i.field)).toEqual(["Tên trên chứng từ"]);
  });
});

describe("AC-46 — tự học từ HĐ, chỉ tạo, không ghi đè", () => {
  const lines = Array.from({ length: 14 }, (_, k) => line({ productId: `p-${k + 1}`, description: `Frozen item ${k + 1}`, size: `${k + 1} gr/pc`, packing: "IQF 1kg x 10", hsCode: "16055500" }));
  it("HĐ 18.26 nối 14 mặt hàng ⇒ tạo 14 dòng có ghi chú nguồn", () => {
    const created = learnCustomerNames([], "scm", lines, "18.26/BSF-SCM.2026", nid);
    expect(created).toHaveLength(14);
    expect(created[0]).toMatchObject({ customerId: "scm", productId: "p-1", tradeName: "Frozen item 1", sizeText: "1 gr/pc", packing: "IQF 1kg x 10", hsCode: "16055500", note: "Tự học từ HĐ 18.26/BSF-SCM.2026" });
  });
  it("lưu lại với tên khác ⇒ 0 dòng mới, tên cũ giữ nguyên", () => {
    const first = learnCustomerNames([], "scm", lines, "18.26/BSF-SCM.2026", nid);
    const again = learnCustomerNames(first, "scm", [{ ...lines[0], description: "X" }, ...lines.slice(1)], "18.26/BSF-SCM.2026", nid);
    expect(again).toEqual([]);
    expect(first[0].tradeName).toBe("Frozen item 1");
  });
  it("bỏ dòng chưa nối / tên rỗng / mặt hàng lặp / trùng tên + size với mặt hàng khác", () => {
    const created = learnCustomerNames(
      [row({ productId: "p-55" })],
      "scm",
      [
        line({ productId: undefined, description: "Chưa nối" }),
        line({ productId: "p-2", description: "  " }),
        line({ productId: "p-3", description: "A", size: "1" }),
        line({ productId: "p-3", description: "B", size: "2" }),
        line({ productId: "p-67", description: "Frozen iwadako boiled cut", size: "5-5.5 gr/pc" }),
      ],
      "HĐ",
      nid,
    );
    expect(created.map((c) => [c.productId, c.tradeName])).toEqual([["p-3", "A"]]);
    expect(learnCustomerNames([], "", lines, "x", nid)).toEqual([]);
  });
});
