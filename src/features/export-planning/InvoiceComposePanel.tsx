// ============================================================
// Tên file: src/features/export-planning/InvoiceComposePanel.tsx
// Tên tiếng Việt: Lập Commercial Invoice từ hàng của chuyến + tải file Excel
// Description: Invoice composer inside the Commercial Invoice item dialog — bank, prices, notes, download (ba-spec 63 NV3)
// ============================================================
// Chị Vi (Zalo 2026-11-02): "trên hệ thống chị nhập thông tin vô nó sẽ ra file invoice này". Khối này lấy
// hàng của chuyến (số thực đóng của kho, chưa có ⇒ kế hoạch), đơn giá dòng HĐ (sửa được), tài khoản ngân
// hàng chọn trong danh sách, ghi chú riêng khách yêu cầu ⇒ tải một file gồm Invoice · Packing list (+
// Expiry date list). Tải file là trình bày ⇒ không toast (luật 13); phần lập lưu cùng nút Lưu của mục.
import { useMemo, useState } from "react";
import { Button, Combobox, Field, Input, NumberField, Textarea, formatNumber } from "@/design-system";
import { formatMoney } from "@/lib/format";
import {
  DEFAULT_ORIGIN_NOTE,
  EMPTY_COMPOSITION,
  bankAccountsOf,
  bankBlockLines,
  defaultTradeTerms,
  invoiceUnitPrice,
  lineNetKg,
  lineUnits,
  shipmentLinesOf,
} from "@/lib/exportInvoice";
import { companySellerOf } from "@/lib/companyProfile";
import { useCompanyProfileStore, useComposedDocuments } from "@/lib/catalogRepo";
import { SHIPPING_INSTRUCTION_DOC } from "@/lib/shippingInstruction";
import { documentItems, shipmentContractLines, termsOf, type ExportData } from "@/lib/exportPlanning";
import type { Customer, ExportContract, ExportShipment, ExportStepItem, InvoiceComposition } from "@/types";
import { Download, FileSpreadsheet, FileText, RotateCcw } from "lucide-react";
import { useExportOptionPicker } from "./exportOptionPicker";
import { downloadInvoiceDocument, invoiceDocumentFor, type InvoiceFileFormat } from "./invoiceDocument";

/** Thiếu gì ở một dòng invoice ⇒ chỗ bổ sung. */
const INCOMPLETE_TEXT = {
  units: "chưa có số kiện (điền Số lượng thực đóng hoặc kế hoạch ở Hàng của chuyến)",
  netKg: "chưa có kg tịnh mỗi thùng (sửa ở Hàng của chuyến)",
  unitPrice: "chưa có đơn giá (gõ ở ô Đơn giá phía trên, hoặc ghi đơn giá ở dòng hàng hợp đồng)",
} as const;

export function InvoiceComposePanel({
  data,
  shipment,
  contract,
  customer,
  item,
  onPatchItem,
}: {
  data: ExportData;
  shipment: ExportShipment;
  contract: ExportContract;
  customer: Customer | undefined;
  item: ExportStepItem;
  onPatchItem: (patch: Partial<ExportStepItem>) => void;
}) {
  const picker = useExportOptionPicker();
  const [busy, setBusy] = useState(false);
  const comp = item.invoiceComposition ?? EMPTY_COMPOSITION;
  const setComp = (patch: Partial<InvoiceComposition>) => onPatchItem({ invoiceComposition: { ...comp, ...patch } });
  const terms = termsOf(data, contract.id);
  const currency = terms.currency || "USD";
  const contractLines = shipmentContractLines(data, shipment);
  const lines = shipmentLinesOf(data.shipmentLines ?? [], shipment.id);
  const banks = bankAccountsOf(picker.options);
  const bank = banks.find((b) => b.id === comp.bankOptionId) ?? banks[0];
  // Người bán + logo từ Thông tin công ty (ba-spec 67).
  const company = useCompanyProfileStore();
  const seller = useMemo(() => companySellerOf(company.profile), [company.profile]);
  // Packing list lấy gross theo SI đã lưu của chuyến (Phòng KH 2026-11-04).
  const [composed] = useComposedDocuments();
  const siDoc = useMemo(() => composed.find((x) => x.docType === SHIPPING_INSTRUCTION_DOC && x.sourceId === shipment.id) ?? null, [composed, shipment.id]);
  const doc = useMemo(
    () => invoiceDocumentFor(data, shipment, contract, customer, item, picker.options, seller, siDoc),
    [data, shipment, contract, customer, item, picker.options, seller, siDoc],
  );
  const totalsDiffer =
    item.cartons !== doc.totals.units || item.netKg !== doc.totals.netKg || item.amount !== doc.totals.amount;
  const pod = shipment.portOfDischarge || terms.portOfDischarge;
  const blFromItem = documentItems(data, shipment.id).find((d) => d.docKind === "bill-of-lading")?.number.trim() ?? "";

  if (!lines.length) {
    return (
      <section className="grid gap-2 rounded-lg border border-border p-4">
        <p className="flex items-center gap-2 font-semibold">
          <FileSpreadsheet className="h-4 w-4" aria-hidden />
          Lập invoice từ app
        </p>
        <p className="text-sm text-muted-foreground">Chuyến chưa có hàng chi tiết. Đóng hộp này, bấm <b>Nhập hàng của chuyến</b> ở khối Hàng của chuyến, rồi quay lại để tải file Invoice.</p>
      </section>
    );
  }

  const download = async (format: InvoiceFileFormat) => {
    setBusy(true);
    // Ô tổng đang trống ⇒ điền theo invoice vừa lập (như Đọc invoice — không ghi đè số đã có).
    const patch: Partial<ExportStepItem> = {};
    if (item.cartons == null) patch.cartons = doc.totals.units;
    if (item.netKg == null) patch.netKg = doc.totals.netKg;
    if (item.amount == null) patch.amount = doc.totals.amount;
    if (Object.keys(patch).length) onPatchItem(patch);
    await downloadInvoiceDocument(doc, format, company.profile.logoPath);
    setBusy(false);
  };

  return (
    <section data-tour="invoice-compose" className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 rounded-lg border border-border p-4">
      <div className="grid gap-1">
        <p className="flex items-center gap-2 font-semibold">
          <FileSpreadsheet className="h-4 w-4" aria-hidden />
          Lập invoice từ app
        </p>
        <p className="text-sm text-muted-foreground">
          Lấy {lines.length} dòng hàng của chuyến (số thực đóng của kho; dòng chưa điền dùng số kế hoạch). File tải về gồm Invoice, Packing list
          {lines.some((l) => l.expiry.trim()) ? ", Expiry date list" : ""}. Phần lập lưu khi bấm Lưu của mục này.
        </p>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
        <Combobox
          label="Tài khoản nhận tiền"
          hideRequiredMark
          clearable={false}
          {...picker.fieldProps("bank-account", bank?.name ?? "")}
          onChange={(name) => setComp({ bankOptionId: banks.find((b) => b.name === name)?.id ?? "" })}
        />
        <Field label="Điều kiện giao (Trade Terms)" hint={`Trống ⇒ "${defaultTradeTerms(terms.incoterm, pod) || "theo HĐ"}".`}>
          <Input value={comp.tradeTerms} onChange={(e) => setComp({ tradeTerms: e.target.value })} />
        </Field>
        <Field label="Số B/L (in trên invoice)" hint={blFromItem ? `Trống ⇒ "${blFromItem}" theo mục Bill of Lading.` : "Trống ⇒ để trống trên invoice (mục Bill of Lading chưa ghi số)."}>
          <Input value={comp.blNo ?? ""} onChange={(e) => setComp({ blNo: e.target.value })} />
        </Field>
      </div>
      {bank && <p className="rounded-lg bg-muted px-4 py-2 text-sm whitespace-pre-line">{bankBlockLines(bank).join("\n")}</p>}
      {/* Phòng KH 2026-11-05: bên mua theo khách hàng của HĐ, sửa tay được cho riêng chuyến này. */}
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 rounded-md border p-3 sm:grid-cols-2" data-tour="invoice-buyer">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 sm:col-span-2">
          <p className="text-sm">
            <span className="font-medium">Bên mua (Applicant) trên invoice + packing list</span>
            <span className="block text-muted-foreground">Theo khách hàng của hợp đồng; sửa ở đây khi chuyến này cần ghi khác.</span>
          </p>
          {(comp.buyerName || comp.buyerAddress) && (
            <Button size="sm" variant="outline" onClick={() => setComp({ buyerName: "", buyerAddress: "" })} title="Bỏ phần sửa tay — ghi lại tên + địa chỉ theo khách hàng của hợp đồng.">
              <RotateCcw className="mr-1 h-4 w-4" aria-hidden />
              Lấy theo hợp đồng
            </Button>
          )}
        </div>
        <Field label="Tên bên mua" hint={`Trống ⇒ "${customer?.name ?? ""}".`}>
          <Input value={comp.buyerName ?? ""} onChange={(e) => setComp({ buyerName: e.target.value })} />
        </Field>
        <Field label="Địa chỉ bên mua" hint="Trống ⇒ địa chỉ khách hàng. Mỗi dòng một hàng.">
          <Textarea rows={3} value={comp.buyerAddress ?? ""} onChange={(e) => setComp({ buyerAddress: e.target.value })} />
        </Field>
      </div>
      <div className="grid gap-2">
        <p className="text-sm font-medium">Đơn giá từng dòng ({currency}/kg) — mặc định theo dòng hàng HĐ</p>
        {lines.map((l) => {
          const price = invoiceUnitPrice(l, comp, contractLines);
          const kg = lineNetKg(l);
          return (
            <div key={l.id} className="grid min-w-0 gap-2 border-b border-border pb-2 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_11rem] sm:items-end">
              <div className="grid min-w-0 gap-0.5 text-sm">
                <p className="font-medium break-words">{[l.description, l.size].filter((t) => t.trim()).join(" · ")}</p>
                <p className="tnum text-muted-foreground">
                  {formatNumber(lineUnits(l) ?? 0)} kiện{l.loadedUnits == null ? " (kế hoạch)" : ""} · {kg != null ? `${formatNumber(kg)} kg` : "thiếu kg/thùng"}
                  {kg != null && price != null ? ` · ${formatMoney(Math.round(kg * price * 100) / 100)} ${currency}` : ""}
                </p>
              </div>
              <NumberField
                label="Đơn giá"
                unit={`${currency}/kg`}
                value={price}
                onChange={(v) => {
                  const next = { ...comp.unitPrices };
                  if (v == null) delete next[l.id];
                  else next[l.id] = v;
                  setComp({ unitPrices: next });
                }}
              />
            </div>
          );
        })}
      </div>
      <Field label="Dòng dưới tiêu đề bảng" hint={`VD "${DEFAULT_ORIGIN_NOTE}". Packing list in "Manufactured in Vietnam".`}>
        <Input value={comp.originNote} onChange={(e) => setComp({ originNote: e.target.value })} />
      </Field>
      <Field
        label="Thông tin riêng khách yêu cầu"
        hint='In sau dòng "Says". Mỗi dòng một hàng; dán bảng từ Excel (ô cách nhau bằng Tab) hoặc ngăn ô bằng dấu |. VD: *NOTE: · Items | Ref. Import Invoice Number | Origin of Raw Material.'
      >
        <Textarea rows={4} value={comp.specialNotes} onChange={(e) => setComp({ specialNotes: e.target.value })} />
      </Field>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-2 rounded-lg bg-muted px-4 py-3 text-sm">
        <p className="tnum font-semibold">
          Invoice lập: {formatNumber(doc.totals.units)} kiện · {formatNumber(doc.totals.netKg)} kg tịnh · {formatMoney(doc.totals.amount)} {currency}
        </p>
        {doc.incompleteLines.length > 0 && (
          <div className="grid gap-1 text-warning">
            <p>
              {doc.incompleteLines.length} dòng chưa tính được tiền — invoice in trống ô tiền của dòng đó và tổng tiền chưa cộng dòng đó. Bổ sung rồi tải lại file:
            </p>
            <ul className="grid list-disc gap-0.5 pl-5">
              {doc.incompleteLines.map((x) => {
                const l = lines.find((y) => y.id === x.lineId);
                return (
                  <li key={x.lineId} className="break-words">
                    {[l?.description, l?.size].filter((t) => t?.trim()).join(" · ") || "Dòng hàng"}: {x.missing.map((m) => INCOMPLETE_TEXT[m]).join(", ")}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {!item.number.trim() && <p className="text-warning">Chưa ghi Số chứng từ (số invoice) ở trên — file in trống số invoice.</p>}
        {totalsDiffer && (item.cartons != null || item.netKg != null || item.amount != null) && (
          <div className="flex flex-wrap items-center gap-2">
            <span>
              3 ô tổng đang ghi {formatNumber(item.cartons ?? 0)} thùng · {formatNumber(item.netKg ?? 0)} kg · {formatMoney(item.amount ?? 0)} — khác invoice lập.
            </span>
            <Button size="sm" variant="outline" className="h-auto max-w-full whitespace-normal" onClick={() => onPatchItem({ cartons: doc.totals.units, netKg: doc.totals.netKg, amount: doc.totals.amount })} title="Ghi 3 ô tổng (thực xuất) theo invoice vừa lập.">
              Dùng số của invoice lập
            </Button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button className="h-auto min-h-9 max-w-full whitespace-normal" onClick={() => void download("pdf")} disabled={busy} title={`Tải bản PDF in sẵn theo mẫu INVOICE 275/26: mỗi chứng từ một trang A4 (Invoice, Packing list${doc.sheets.length > 2 ? ", Expiry date list" : ""}).`}>
          <FileText className="mr-2 h-4 w-4" aria-hidden />
          {busy ? "Đang tạo file…" : "Tải file Invoice (PDF)"}
        </Button>
        <Button variant="outline" className="h-auto min-h-9 max-w-full whitespace-normal" onClick={() => void download("docx")} disabled={busy} title={`Tải file Word (.docx) cùng bố cục bản PDF để sửa tiếp chữ, thêm dòng khách yêu cầu: Invoice, Packing list${doc.sheets.length > 2 ? ", Expiry date list" : ""}.`}>
          <FileText className="mr-2 h-4 w-4" aria-hidden />
          Tải file Word
        </Button>
        <Button variant="outline" className="h-auto min-h-9 max-w-full whitespace-normal" onClick={() => void download("xlsx")} disabled={busy} title={`Tải file ${doc.fileName} để sửa tiếp trong Excel: Invoice, Packing list${doc.sheets.length > 2 ? ", Expiry date list" : ""}.`}>
          <Download className="mr-2 h-4 w-4" aria-hidden />
          Tải file Excel
        </Button>
      </div>
      {picker.dialogs}
    </section>
  );
}
