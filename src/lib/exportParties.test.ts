// Phòng KH 2026-11-05: Người nhận hàng + Notify ở HĐ ⇒ SI (và vận đơn theo SI); invoice / PL theo khách hàng.
import { describe, expect, it } from "vitest";
import type { ComposedDocument, ExportContractRevision } from "@/types";
import { emptyTerms } from "./exportPlanning";
import { EXPORT_CONTRACT_REVISION_TABLE, EXPORT_STEP_ITEM_TABLE } from "./repo";
import { initialSi, siPartiesFromContract, siToValues } from "./shippingInstruction";
import { marketOptions } from "@/features/catalog/catalogConfig";

const rev = (over: Partial<ExportContractRevision["terms"]> = {}): ExportContractRevision => ({
  id: "r1",
  contractId: "c1",
  revisionNo: 0,
  revisedOn: "2026-11-05",
  changeSummary: "",
  terms: { ...emptyTerms(), ...over },
  lines: [],
  filePath: "",
  fileName: "",
  recordedBy: "KH",
  createdAt: "2026-11-05T00:00:00Z",
});
const roundTrip = (r: ExportContractRevision) => EXPORT_CONTRACT_REVISION_TABLE.fromRow(EXPORT_CONTRACT_REVISION_TABLE.toRow(r) as Record<string, unknown>);
const customer = { name: "SEACHEMOT CO., LTD", address: "Tokyo, Japan" };
const CONSIGNEE = { name: "SEACHEMOT LOGISTICS", address: "Hakata Port\nFukuoka" };
const NOTIFY = { name: "ABC CUSTOMS BROKER", address: "Fukuoka" };

describe("Người nhận hàng + Notify của HĐ", () => {
  it("lưu rồi đọc lại giữ Consignee, Notify, Hạn hợp đồng (lỗi cũ: Hạn hợp đồng mất khi tải lại)", () => {
    const back = roundTrip(rev({ consignee: CONSIGNEE, notifyParty: NOTIFY, contractValidUntil: "2027-10-10" }));
    expect(back.terms.consignee).toEqual(CONSIGNEE);
    expect(back.terms.notifyParty).toEqual(NOTIFY);
    expect(back.terms.contractValidUntil).toBe("2027-10-10");
    const plain = roundTrip(rev());
    expect("consignee" in plain.terms || "notifyParty" in plain.terms || "contractValidUntil" in plain.terms).toBe(false);
  });

  it("SI mới: Consignee + Notify theo HĐ, hơn SI lần trước của khách", () => {
    const prevForm = initialSi({ saved: null, previous: null, customer, goods: [], today: "2026-10-01" });
    const previous = { values: siToValues({ ...prevForm, consignee: "OLD CONSIGNEE", notifyParty: "OLD NOTIFY", attn: "Ms Thao" }) } as unknown as ComposedDocument;
    const f = initialSi({ saved: null, previous, customer, goods: [], today: "2026-11-05", parties: { consignee: CONSIGNEE, notifyParty: NOTIFY } });
    expect(f.consignee).toBe("SEACHEMOT LOGISTICS\nHakata Port\nFukuoka");
    expect(f.notifyParty).toBe("ABC CUSTOMS BROKER\nFukuoka");
    expect(f.attn).toBe("Ms Thao"); // ô khác vẫn nhớ theo SI lần trước
    // HĐ chưa ghi ⇒ như cũ.
    const old = initialSi({ saved: null, previous, customer, goods: [], today: "2026-11-05", parties: {} });
    expect(old.consignee).toBe("OLD CONSIGNEE");
    expect(old.notifyParty).toBe("OLD NOTIFY");
  });

  it("Lấy theo hợp đồng: HĐ chưa ghi người nhận ⇒ khách hàng; chưa ghi Notify ⇒ giữ ô đang có", () => {
    expect(siPartiesFromContract(customer, {})).toEqual({ consignee: "SEACHEMOT CO., LTD\nTokyo, Japan", notifyParty: null });
    expect(siPartiesFromContract(customer, { notifyParty: NOTIFY }).notifyParty).toBe("ABC CUSTOMS BROKER\nFukuoka");
  });

  it("bên mua sửa tay ở phần lập invoice lưu rồi đọc lại được", () => {
    const item = {
      id: "ci", shipmentId: "s", step: "document", docKind: "commercial-invoice", docForm: "", docIssuer: "", state: "not-started", number: "", issuedOn: "", note: "", naReason: "", sharedFromId: "",
      cartons: null, netKg: null, amount: null, onBoardDate: "", createdAt: "2026-11-05",
      invoiceComposition: { bankOptionId: "", unitPrices: {}, tradeTerms: "", originNote: "", specialNotes: "", buyerName: "SEACHEMOT OSAKA", buyerAddress: "Osaka" },
    } as const;
    const back = EXPORT_STEP_ITEM_TABLE.fromRow(EXPORT_STEP_ITEM_TABLE.toRow(item as never) as Record<string, unknown>);
    expect(back.invoiceComposition?.buyerName).toBe("SEACHEMOT OSAKA");
    expect(back.invoiceComposition?.buyerAddress).toBe("Osaka");
  });
});

describe("Thị trường tự thêm ở Sửa thông tin khách hàng (lỗi 2026-11-05)", () => {
  it("giá trị vừa thêm có trong danh sách chọn, không trùng", () => {
    expect(marketOptions("Úc").map((o) => o.value)).toContain("Úc");
    expect(marketOptions("Nhật", ["Nhật", "Úc"]).filter((o) => o.value === "Nhật")).toHaveLength(1);
    expect(marketOptions("", ["Đài Loan"]).map((o) => o.value)).toContain("Đài Loan");
  });
});
