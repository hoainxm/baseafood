// Phòng KH 2026-11-04: địa chỉ khách đọc từ file HĐ; hợp đồng ký đính nhầm loại / ở file của bản HĐ vẫn báo Thiếu.
import { describe, expect, it } from "vitest";
import type { ExportContractRevision, ExportFile } from "@/types";
import { parseContractRows, specificationDetails, splitSpecification } from "./contractReader";
import { EMPTY_EXPORT_DATA, attachmentCandidates, type ExportData } from "./exportPlanning";

const head = [
  ["SALES CONTRACT"], ["No: 02-26-PC"], ["Date: 02 April 2026."],
  ["THE SELLER: BASEAFOOD 1 COMPANY LIMITED"], ["Add: 321 Tran Xuan Do St., Quarter 2, Baria Ward, Hochiminh City, S.R.Vietnam"], ["Tel: 84.254.3826217"],
  ["THE BUYER: PEACOCK CO., LTD"], ["Add : 3-2-1 SHINSAN, NAGAOKA CITY, NIIGATA PREF, JAPAN"], ["Tel: 81-258-21-4001"],
];
const table = [
  ["Mark", "Commodities", "Packing", "Price CFR", "Quantity", "", "Amount (usd)"],
  ["", "", "", "", "Ctns", "Kgs", ""],
  ["1", "Frozen Blanched cut Octopus Specification 1: - Size 1.3 – 1.4 gr", "IQF, 1 Kg / pe X 10 pe / Ctn", "9.05", "9,700", "97,000.00", "877,850.00"],
  ["", "Specification 2: - Size 1.8 – 2.2 gr", "IQF, 1 Kg / pe X 10 pe / Ctn", "9.10", "4,300", "43,000.00", "391,300.00"],
];

describe("đọc file HĐ xuất — địa chỉ khách", () => {
  it("dòng Add ngay dưới THE BUYER là địa chỉ khách; địa chỉ bên bán không lẫn vào", () => {
    const c = parseContractRows([...head, ...table], "export").contract!;
    expect(c.partnerName).toBe("PEACOCK CO., LTD");
    expect(c.partnerAddress).toBe("3-2-1 SHINSAN, NAGAOKA CITY, NIIGATA PREF, JAPAN");
    expect(c.lines.map((l) => [l.cartons, l.netKgPerCarton, l.kg])).toEqual([[9700, 10, 97000], [4300, 10, 43000]]);
  });

  it("không có dòng Add ⇒ trống", () => {
    const c = parseContractRows([["THE BUYER: PEACOCK CO., LTD"], ["Tel: 1"], ...table], "export").contract!;
    expect(c.partnerAddress).toBe("");
  });
});

describe("file có sẵn dùng làm Hợp đồng đã ký", () => {
  const f = (id: string, kind: ExportFile["attachmentKind"], path = `p/${id}`): ExportFile =>
    ({ id, contractId: "c1", shipmentId: "", stepItemId: "", step: "contract", attachmentKind: kind, path, fileName: `${id}.pdf`, layerNo: null, caption: "", uploadedBy: "", createdAt: "2026-11-04" }) as ExportFile;
  const rev = (no: number, filePath: string) => ({ id: `r${no}`, contractId: "c1", revisionNo: no, filePath, fileName: `ban${no}.pdf`, lines: [], terms: {} }) as unknown as ExportContractRevision;

  it("07-26-MAT: file đính loại Phụ lục ⇒ ứng viên đổi loại; 02-26-PC: file của bản 1, 2 (cùng file) ⇒ một ứng viên", () => {
    const d: ExportData = { ...EMPTY_EXPORT_DATA, files: [f("phu-luc", "other")], revisions: [rev(0, "p/doc"), rev(1, "p/ky"), rev(2, "p/ky")] };
    const c = attachmentCandidates(d, "c1", "signed-contract");
    expect(c.map((x) => [x.source, x.path])).toEqual([["attachment", "p/phu-luc"], ["revision", "p/ky"], ["revision", "p/doc"]]);
  });

  it("đã có file đúng loại cùng đường dẫn ⇒ không gợi ý lại", () => {
    const d: ExportData = { ...EMPTY_EXPORT_DATA, files: [f("ky", "signed-contract", "p/ky")], revisions: [rev(1, "p/ky")] };
    expect(attachmentCandidates(d, "c1", "signed-contract")).toEqual([]);
  });
});

describe("đọc HĐ ghi tên hàng một lần rồi liệt kê Specification (Peacock 02-26-PC) — chép như Chép dòng", () => {
  const H = [["Mark", "Commodities", "Packing", "Price CFR", "Quantity", "", "Amount (usd)"], ["", "", "", "", "Ctns", "Kgs", ""]];
  const P = "IQF, 1 Kg / pe X 10 pe / Ctn";
  const read = (t: string[][]) => parseContractRows([...head, ...H, ...t, ["II. PAYMENT: TTR"]], "export").contract!.lines;

  it("hàng tên riêng + mỗi spec một hàng + dòng mô tả tiếp + Packing gộp ô ⇒ đủ 2 dòng, cùng tên, cùng quy cách", () => {
    const lines = read([
      ["1", "Frozen Blanched cut Octopus", "", "", "", "", ""],
      ["", "Specification 1: - Size 1.3 – 1.4 gr (700-750 pcs/kg)", P, "9.05", "9,700", "97,000.00", "877,850.00"],
      ["", "- Length: max 3.5 cm.", "", "", "", "", ""],
      ["", "- Ratio tentacle / body: about 80% / 20%", "", "", "", "", ""],
      ["", "Specification 2: - Size 1.8 – 2.2 gr (455-555 pcs/kg)", "", "9.10", "4,300", "43,000.00", "391,300.00"],
      ["", "TOTAL", "", "", "14,000", "140,000.00", "1,269,150.00"],
    ]);
    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.description)).toEqual(["Frozen Blanched cut Octopus", "Frozen Blanched cut Octopus"]);
    expect(lines.map((l) => l.packing)).toEqual([P, P]);
    expect(lines.map((l) => [l.cartons, l.netKgPerCarton, l.kg, l.unitPrice])).toEqual([[9700, 10, 97000, 9.05], [4300, 10, 43000, 9.1]]);
    expect(lines[0]).toMatchObject({ size: "1.3 – 1.4 gr", piecesPerKg: "700-750", pieceLength: "max 3.5 cm", partRatio: "about 80% / 20%" });
    expect(lines[1]).toMatchObject({ size: "1.8 – 2.2 gr", piecesPerKg: "455-555" });
  });

  it("tên hàng + spec cùng một ô ⇒ tên hàng gọn, spec tách ra size / số miếng / chiều dài / tỉ lệ", () => {
    const lines = read([
      ["1", "Frozen Blanched cut Octopus Specification 1: - Size 1.3 – 1.4 gr (700-750 pcs/kg) - Length: max 3.5 cm. - Ratio tentacle / body: about 80% / 20%", P, "9.05", "9,700", "97,000.00", "877,850.00"],
      ["", "Specification 2: - Size 1.8 – 2.2 gr (455-555 pcs/kg) - Length: max 3.5 cm.", P, "9.10", "4,300", "43,000.00", "391,300.00"],
    ]);
    expect(lines.map((l) => [l.description, l.size, l.piecesPerKg, l.pieceLength])).toEqual([
      ["Frozen Blanched cut Octopus", "1.3 – 1.4 gr", "700-750", "max 3.5 cm"],
      ["Frozen Blanched cut Octopus", "1.8 – 2.2 gr", "455-555", "max 3.5 cm"],
    ]);
    expect(lines[0].partRatio).toBe("about 80% / 20%");
  });

  it("hàm tách", () => {
    expect(splitSpecification("Frozen octopus Specification 2: - Size 1-2 gr")).toEqual({ title: "Frozen octopus", spec: "- Size 1-2 gr" });
    expect(splitSpecification("FROZEN CRAB KARAAGE")).toEqual({ title: "FROZEN CRAB KARAAGE", spec: "" });
    expect(specificationDetails("- Size 2-4 g")).toMatchObject({ size: "2-4 g", piecesPerKg: "" });
  });
});
