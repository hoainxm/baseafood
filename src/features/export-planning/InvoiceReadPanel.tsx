// ============================================================
// Tên file: src/features/export-planning/InvoiceReadPanel.tsx
// Tên tiếng Việt: Khối "Đọc invoice" trong hộp cập nhật Commercial Invoice
// Description: Reads the attached invoice (Excel / PDF exported from Excel — not scans), fills the
//              empty number / date / 3 totals, flags fields that differ, flags lines that differ from
//              the contract, and lets the user map each line to a factory product so names can be
//              extracted on Save. Never writes on its own (ba-spec 41 v7 NV17 · R27).
// ============================================================
import { useEffect, useRef, useState } from "react";
import { Button, Combobox, Tag, formatNumber, notify, type ComboboxOption } from "@/design-system";
import { useQuickCatalogEdit } from "@/features/catalog/QuickCatalogEdit";
import { newId } from "@/lib/store";
import { formatDateVN, formatMoney } from "@/lib/format";
import { findCustomerName } from "@/lib/customerProductNames";
import { rankProductsForLine } from "@/lib/exportPlanning";
import { compareInvoiceToContract, fillInvoiceItem, isReadableInvoiceFile, matchInvoiceLines, type InvoiceReadResult, type InvoiceTotalField } from "@/lib/invoiceReader";
import { readInvoiceFile } from "@/lib/invoiceFileReader";
import { downloadExportFile } from "@/lib/exportFileStorage";
import type { CustomerProductName, ExportContractLine, ExportFile, ExportStepItem, Product } from "@/types";
import { FileSearch } from "lucide-react";
import { FilePicker } from "./parts";

/** Kết quả đọc đang giữ trong hộp (không vào nháp — file chọn từ máy không lưu nháp được). */
export interface InvoiceReadState {
  fileKey: string;
  fileName: string;
  /** null = đang đọc. */
  result: InvoiceReadResult | null;
  /** Mặt hàng của từng dòng invoice ("" = chưa nối). */
  productIds: string[];
  /** Ô đã tự điền lúc đọc xong. */
  filled: InvoiceTotalField[];
}

const FIELD_LABELS: Record<InvoiceTotalField, string> = {
  number: "Số chứng từ",
  issuedOn: "Ngày",
  cartons: "Tổng thùng",
  netKg: "Tổng kg tịnh",
  amount: "Tổng tiền",
};

const fileKeyOf = (f: File) => `${f.name}:${f.size}:${f.lastModified}`;

export function InvoiceReadPanel({
  pickedFiles,
  savedFiles,
  item,
  onPatchItem,
  state,
  onStateChange,
  contractLines,
  customerId,
  customerNames,
  products,
  setProducts,
  canViewPrice,
  currency,
  contractNo,
  readOnlyPick = false,
}: {
  contractNo: string;
  /** Chạy không nối máy chủ (không lưu được file): khối có ô chọn file RIÊNG chỉ để đọc, không lưu. */
  readOnlyPick?: boolean;
  pickedFiles: File[];
  savedFiles: ExportFile[];
  item: ExportStepItem;
  onPatchItem: (patch: Partial<ExportStepItem>) => void;
  state: InvoiceReadState | null;
  onStateChange: (s: InvoiceReadState | null) => void;
  contractLines: ExportContractLine[];
  customerId: string;
  customerNames: readonly CustomerProductName[];
  products: Product[];
  setProducts: (rows: Product[]) => boolean | void;
  canViewPrice: boolean;
  currency: string;
}) {
  const productEditor = useQuickCatalogEdit("product", products, (rows) => void setProducts(rows));
  /** Lần đọc mới nhất — kết quả về muộn của lần cũ thì bỏ. */
  const latest = useRef("");
  const [busySaved, setBusySaved] = useState(false);
  const [localFiles, setLocalFiles] = useState<File[]>([]);
  const sourceFiles = readOnlyPick ? localFiles : pickedFiles;
  const itemRef = useRef(item);
  itemRef.current = item;

  const run = async (fileKey: string, fileName: string, load: () => Promise<Blob | null>) => {
    latest.current = fileKey;
    onStateChange({ fileKey, fileName, result: null, productIds: [], filled: [] });
    const blob = await load();
    const result: InvoiceReadResult = blob
      ? await readInvoiceFile(blob, fileName)
      : { ok: false, reason: "error", message: "Không tải được file từ kho file để đọc." };
    if (latest.current !== fileKey) return;
    if (!result.ok) {
      onStateChange({ fileKey, fileName, result, productIds: [], filled: [] });
      return;
    }
    const matches = matchInvoiceLines(result.invoice, contractLines, customerId, customerNames, products);
    const fill = fillInvoiceItem(itemRef.current, result.invoice);
    if (fill.filled.length) onPatchItem(Object.fromEntries(fill.filled.map((k) => [k, fill.item[k]])));
    onStateChange({ fileKey, fileName, result, productIds: matches.map((m) => m.productId), filled: fill.filled });
  };

  // Chọn file Excel / PDF mới ⇒ tự đọc (file đầu tiên đọc được trong các file vừa chọn).
  useEffect(() => {
    const f = sourceFiles.find((x) => isReadableInvoiceFile(x.name));
    if (!f || state?.fileKey === fileKeyOf(f)) return;
    void run(fileKeyOf(f), f.name, () => Promise.resolve(f));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ đọc khi danh sách file đổi
  }, [sourceFiles]);

  const readableSaved = savedFiles.filter((f) => isReadableInvoiceFile(f.fileName));
  const hasPickedReadable = sourceFiles.some((x) => isReadableInvoiceFile(x.name));
  const readSaved = async (f: ExportFile) => {
    setBusySaved(true);
    try {
      await run(`saved:${f.id}`, f.fileName, () => downloadExportFile(f.path));
    } finally {
      setBusySaved(false);
    }
  };

  const result = state?.result;
  const invoice = result?.ok ? result.invoice : null;
  const conflicts = invoice ? fillInvoiceItem(item, invoice).conflicts : [];
  const matches = invoice ? matchInvoiceLines(invoice, contractLines, customerId, customerNames, products) : [];
  const issues = invoice ? compareInvoiceToContract(invoice.lines, matches, contractLines) : [];
  const notInContract = issues.filter((x) => x.kind === "not-in-contract").length;
  const show = (field: InvoiceTotalField, v: string | number) =>
    field === "issuedOn" ? formatDateVN(String(v)) : field === "amount" ? `${formatMoney(Number(v))} ${currency}` : typeof v === "number" ? formatNumber(v) : v;
  const visibleConflicts = conflicts.filter((c) => canViewPrice || c.field !== "amount");
  const mappedCount = state?.productIds.filter(Boolean).length ?? 0;

  const optionsFor = (description: string, size: string): ComboboxOption[] =>
    rankProductsForLine(description, products, customerId, { size, names: customerNames }).map((m) => ({
      value: m.id,
      label: m.code ? `${m.code} · ${m.name}` : m.name,
      subLabel: [m.code, findCustomerName(customerNames, customerId, m.id)?.tradeName || m.tradeName].filter(Boolean).join(" · ") || undefined,
    }));
  const addProduct = (name: string) => {
    const existing = products.find((m) => m.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (existing) return existing.id;
    const m: Product = { id: newId(), code: "", name, finishedGoodCode: "" };
    setProducts([...products, m]);
    notify.saved(`Đã thêm mặt hàng "${name}" vào danh mục`);
    return m.id;
  };
  const setProductAt = (i: number, v: string) => {
    if (!state) return;
    const ids = [...state.productIds];
    ids[i] = v;
    onStateChange({ ...state, productIds: ids });
  };

  return (
    <section className="grid min-w-0 gap-3 rounded-lg border border-border p-3 sm:p-4" aria-label="Đọc invoice">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 className="font-semibold">Đọc invoice</h3>
        {!readOnlyPick && !hasPickedReadable && readableSaved.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void readSaved(readableSaved[readableSaved.length - 1])}
            title={`Đọc lại file ${readableSaved[readableSaved.length - 1].fileName}: điền ô còn trống, so với hợp đồng, nối dòng hàng để trích xuất tên hàng của khách.`}
          >
            <FileSearch className="mr-1 h-4 w-4" aria-hidden />
            {busySaved ? "Đang đọc…" : "Đọc file đã đính"}
          </Button>
        )}
      </div>

      {readOnlyPick && (
        <FilePicker files={localFiles} onChange={setLocalFiles} multiple={false} accept=".xlsx,.xls,.pdf" label="Chọn file để đọc" />
      )}
      {!state && (
        <p className="text-sm text-muted-foreground">
          Đính file Excel gốc hoặc PDF xuất từ Excel của invoice: hệ thống tự điền số, ngày, 3 số tổng còn trống và trích xuất tên hàng của khách khi Lưu. Bản scan
          (ảnh) không đọc — vẫn đính được làm bằng chứng.{readOnlyPick ? " Đang chạy không nối máy chủ: file chọn ở đây chỉ để đọc, không được lưu." : ""}
        </p>
      )}

      {state && !result && (
        <p role="status" className="text-sm text-muted-foreground">
          Đang đọc {state.fileName}…
        </p>
      )}

      {result && !result.ok && (
        <p role="status" className="rounded-lg bg-warning-surface px-4 py-2 text-sm">
          {state?.fileName}: {result.message}
        </p>
      )}

      {invoice && result?.ok && state && (
        <>
          <p role="status" className="tnum text-sm">
            Đọc từ <span className="font-medium">{state.fileName}</span>: Invoice {invoice.invoiceNo || "(không rõ số)"}
            {invoice.issuedOn ? ` · ${formatDateVN(invoice.issuedOn)}` : ""} · {invoice.lines.length} dòng · {formatNumber(invoice.totals.cartons)} thùng ·{" "}
            {formatNumber(invoice.totals.netKg)} kg{canViewPrice && invoice.totals.amount != null ? ` · ${formatMoney(invoice.totals.amount)} ${invoice.currency || currency}` : ""}
          </p>
          {state.filled.filter((f) => canViewPrice || f !== "amount").length > 0 && (
            <p className="text-sm text-muted-foreground">
              Đã điền ô còn trống: {state.filled.filter((f) => canViewPrice || f !== "amount").map((f) => FIELD_LABELS[f]).join(", ")}. Bấm Lưu để ghi.
            </p>
          )}
          {visibleConflicts.length > 0 && (
            <div className="grid gap-2 rounded-lg bg-warning-surface px-4 py-3 text-sm" role="status">
              <p className="font-medium">Số đang ghi khác invoice (chưa ghi đè):</p>
              <ul className="tnum grid gap-1">
                {visibleConflicts.map((c) => (
                  <li key={c.field}>
                    {FIELD_LABELS[c.field]}: đang ghi {show(c.field, c.current)} — invoice {show(c.field, c.invoice)}
                  </li>
                ))}
              </ul>
              <div>
                <Button
                  size="sm"
                  onClick={() => onPatchItem(Object.fromEntries(visibleConflicts.map((c) => [c.field, c.invoice])))}
                  title="Thay các ô đang khác bằng số trên invoice (chưa ghi — bấm Lưu để ghi)."
                >
                  Dùng số trên invoice
                </Button>
              </div>
            </div>
          )}
          {(result.warnings.length > 0 || notInContract > 0 || (canViewPrice && issues.length > notInContract)) && (
            <ul className="grid gap-1 rounded-lg bg-warning-surface px-4 py-3 text-sm" aria-label="Chỗ cần xem lại">
              {result.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
              {notInContract > 0 && (
                <li className="tnum">
                  {notInContract === invoice.lines.length
                    ? `Không dòng nào của invoice khớp tên + size với hợp đồng ${contractNo} — kiểm lại đã đính đúng invoice của hợp đồng này chưa.`
                    : `${notInContract} / ${invoice.lines.length} dòng không có dòng cùng tên + size trong hợp đồng ${contractNo} (đánh dấu "Không có trong HĐ" ở từng dòng).`}
                </li>
              )}
              {issues
                .filter((x) => x.kind === "price-differs" && canViewPrice)
                .map((x) => (
                  <li key={`${x.lineIndex}-${x.kind}`}>
                    Dòng {x.lineIndex + 1} — {x.message}
                  </li>
                ))}
            </ul>
          )}
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)]">
            <p className="tnum text-sm text-muted-foreground">
              Đã nối mặt hàng {mappedCount} / {invoice.lines.length} dòng — dòng đã nối được trích xuất tên hàng của khách khi Lưu (không ghi đè tên đang có).
            </p>
            {invoice.lines.map((l, i) => {
              const issue = issues.find((x) => x.lineIndex === i);
              return (
                <div key={i} className="grid min-w-0 gap-3 border-b border-border py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-end">
                  <div className="grid min-w-0 gap-0.5 text-sm">
                    <span className="flex flex-wrap items-center gap-2 text-muted-foreground">
                      Dòng {i + 1}
                      {issue && (issue.kind === "not-in-contract" || canViewPrice) && <Tag variant="warning">{issue.kind === "price-differs" ? "Giá khác HĐ" : "Không có trong HĐ"}</Tag>}
                    </span>
                    <span className="break-words font-semibold">{l.description}</span>
                    {(l.size || l.packing) && <span className="break-words text-muted-foreground">{[l.size, l.packing].filter(Boolean).join(" · ")}</span>}
                    <span className="tnum">
                      {formatNumber(l.cartons)} thùng · {formatNumber(l.netKg)} kg
                      {canViewPrice && l.unitPrice != null ? ` · ${formatNumber(l.unitPrice)} ${currency}/kg` : ""}
                      {canViewPrice && l.amount != null ? ` · ${formatMoney(l.amount)} ${currency}` : ""}
                    </span>
                  </div>
                  <Combobox
                    label={`Mặt hàng xưởng · dòng ${i + 1}`}
                    value={state.productIds[i] ?? ""}
                    onChange={(v) => setProductAt(i, v)}
                    options={optionsFor(l.description, l.size)}
                    onCreate={productEditor.canCreate ? addProduct : undefined}
                    emptyText="Chưa có mặt hàng nào trong danh mục."
                    onEditItem={productEditor.openEdit}
                    canEdit={productEditor.canEdit}
                    editLabel={productEditor.editLabel}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}
      {productEditor.dialog}
    </section>
  );
}
