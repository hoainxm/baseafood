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
import { useCompanyProfileStore } from "@/lib/catalogRepo";
import { termsOf, workingRevision, type ExportData } from "@/lib/exportPlanning";
import type { Customer, ExportContract, ExportShipment, ExportStepItem, InvoiceComposition } from "@/types";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { useExportOptionPicker } from "./exportOptionPicker";
import { downloadInvoiceDocument, invoiceDocumentFor, type InvoiceFileFormat } from "./invoiceDocument";

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
  const contractLines = workingRevision(data, contract.id)?.lines ?? [];
  const lines = shipmentLinesOf(data.shipmentLines ?? [], shipment.id);
  const banks = bankAccountsOf(picker.options);
  const bank = banks.find((b) => b.id === comp.bankOptionId) ?? banks[0];
  // Người bán + logo từ Thông tin công ty (ba-spec 67).
  const company = useCompanyProfileStore();
  const seller = useMemo(() => companySellerOf(company.profile), [company.profile]);
  const doc = useMemo(() => invoiceDocumentFor(data, shipment, contract, customer, item, picker.options, seller), [data, shipment, contract, customer, item, picker.options, seller]);
  const totalsDiffer =
    item.cartons !== doc.totals.units || item.netKg !== doc.totals.netKg || item.amount !== doc.totals.amount;
  const pod = shipment.portOfDischarge || terms.portOfDischarge;

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
      </div>
      {bank && <p className="rounded-lg bg-muted px-4 py-2 text-sm whitespace-pre-line">{bankBlockLines(bank).join("\n")}</p>}
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
        {doc.incompleteLineIds.length > 0 && (
          <p className="text-warning">{doc.incompleteLineIds.length} dòng thiếu số kiện, kg/thùng hoặc đơn giá — dòng đó in trống tiền, không cộng vào tổng.</p>
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
