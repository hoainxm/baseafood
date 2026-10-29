// ============================================================
// Tên file: src/features/import-planning/ImportDossier.tsx
// Tên tiếng Việt: Hồ sơ hợp đồng nhập — đầu hồ sơ, dòng hàng, file HĐ, các lần nhập
// Description: Contract dossier of the import planning module (design-spec 46): one primary
//              "next step" action, line progress, receipts with document checklist + quantities.
// ============================================================
import { useEffect, useState } from "react";
import { Button, Popover, PopoverContent, PopoverTrigger, RecordTable, Tag, formatNumber, type RecordTableColumn } from "@/design-system";
import { CollapsibleSection } from "@/features/export-planning/parts";
import { formatDateVN, formatMoney } from "@/lib/format";
import {
  canDeleteContract,
  canDeleteDocument,
  canDeleteReceipt,
  closeGate,
  contractFiles,
  contractProgress,
  contractState,
  contractTotals,
  documentHasEvidence,
  documentLabel,
  documentsOf,
  filesOfDocument,
  importTypeLabel,
  isRequiredKind,
  lineAmount,
  linesOf,
  missingDocs,
  receiptLinesOf,
  receiptState,
  receiptsOf,
  transportLabel,
  IMPORT_DOCUMENT_KINDS,
  type ImportData,
} from "@/lib/importPlanning";
import type { ImportContract, ImportContractLine, ImportDocument, ImportFile, ImportReceipt } from "@/types";
import {
  ArrowLeft,
  Ban,
  Check,
  ChevronDown,
  CircleDashed,
  FilePlus2,
  Lock,
  LockOpen,
  Minus,
  PackageCheck,
  Pencil,
  Plus,
  RotateCcw,
  Ship,
  Trash2,
} from "lucide-react";
import { ContractStateTag, ImportFileList, ReceiptStateTag, type ImportPreviewTarget } from "./parts";

export interface DossierCan {
  create: boolean;
  update: boolean;
  delete: boolean;
  viewPrice: boolean;
  receiving: boolean;
}

export interface DossierActions {
  onBack: () => void;
  onEditContract: () => void;
  onAddReceipt: () => void;
  onEditReceipt: (r: ImportReceipt) => void;
  onCancelReceipt: (r: ImportReceipt) => void;
  onRestoreReceipt: (r: ImportReceipt) => void;
  onDeleteReceipt: (r: ImportReceipt) => void;
  onEditDocument: (r: ImportReceipt, doc?: ImportDocument) => void;
  onDeleteDocument: (doc: ImportDocument) => void;
  onRemoveFile: (f: ImportFile) => void;
  onRecordQuantity: (r: ImportReceipt) => void;
  onClose: () => void;
  onReopen: () => void;
  onCancelContract: () => void;
  onDeleteContract: () => void;
  onPreview: (f: ImportPreviewTarget) => void;
}

const kindLabel = (k: string) => IMPORT_DOCUMENT_KINDS.find((x) => x.value === k)?.label ?? k;

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid min-w-0 content-start gap-0.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-medium break-words">{children}</span>
    </div>
  );
}

export function ImportDossier({
  data,
  contract,
  focusReceiptId,
  can,
  actions,
}: {
  data: ImportData;
  contract: ImportContract;
  focusReceiptId: string;
  can: DossierCan;
  actions: DossierActions;
}) {
  const state = contractState(data, contract);
  const isOpen = contract.status === "open";
  const lines = linesOf(data, contract.id);
  const totals = contractTotals(lines, contract.linePrices);
  const progress = contractProgress(data, contract.id);
  const gate = closeGate(data, contract.id);
  const receipts = receiptsOf(data, contract.id, true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!focusReceiptId) return;
    document.getElementById(`import-receipt-${focusReceiptId}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [focusReceiptId]);

  const lineColumns: RecordTableColumn<{ line: ImportContractLine; receivedKg: number; remainingKg: number }>[] = [
    { key: "name", header: "Tên hàng", primary: true, getSortValue: (x) => x.line.productName, render: (x) => <span className="break-words">{x.line.productName}</span> },
    { key: "kg", header: "Kg HĐ", numeric: true, sortKind: "number", getSortValue: (x) => x.line.kg, render: (x) => formatNumber(x.line.kg ?? 0) },
    ...(can.viewPrice
      ? ([
          {
            key: "price",
            header: "Đơn giá",
            numeric: true,
            sortKind: "number",
            getSortValue: (x) => contract.linePrices[x.line.id] ?? null,
            render: (x) => (contract.linePrices[x.line.id] != null ? formatMoney(contract.linePrices[x.line.id] as number) : "—"),
          },
          {
            key: "amount",
            header: `Thành tiền (${contract.currency})`,
            numeric: true,
            sortKind: "number",
            getSortValue: (x) => lineAmount(x.line, contract.linePrices),
            render: (x) => {
              const a = lineAmount(x.line, contract.linePrices);
              return a === null ? "—" : formatMoney(a);
            },
          },
        ] satisfies RecordTableColumn<{ line: ImportContractLine; receivedKg: number; remainingKg: number }>[])
      : []),
    { key: "got", header: "Đã về", numeric: true, sortKind: "number", getSortValue: (x) => x.receivedKg, render: (x) => formatNumber(x.receivedKg) },
    {
      key: "left",
      header: "Còn lại",
      numeric: true,
      sortKind: "number",
      getSortValue: (x) => x.remainingKg,
      render: (x) => (x.remainingKg < 0 ? <Tag variant="warning">vượt {formatNumber(-x.remainingKg)} kg</Tag> : formatNumber(x.remainingKg)),
    },
  ];

  const primary = isOpen
    ? can.create || can.update
      ? { label: "Ghi lần nhập", title: "Ghi một lần hàng về (cont hoặc hàng lẻ). Lần nhập mới có sẵn 3 chứng từ bắt buộc để đính.", icon: Ship, onClick: actions.onAddReceipt, variant: "default" as const }
      : null
    : contract.status === "closed" && can.update
      ? { label: "Mở lại hợp đồng", title: "Mở lại hợp đồng đã đóng để ghi thêm lần nhập hoặc sửa.", icon: LockOpen, onClick: actions.onReopen, variant: "edit" as const }
      : null;

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <div data-tour="import-contract-head" className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Button variant="ghost" onClick={actions.onBack} title="Về danh sách lô nhập / hợp đồng.">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
            Quay lại
          </Button>
          <h2 className="text-lg font-semibold break-words">HĐ {contract.contractNo}</h2>
          <ContractStateTag state={state} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {primary && (
            <Button variant={primary.variant} onClick={primary.onClick} title={primary.title} data-tour="import-next-step">
              <primary.icon className="mr-2 h-4 w-4" aria-hidden />
              {primary.label}
            </Button>
          )}
          {(can.update || can.delete) && (
            <Popover open={menuOpen} onOpenChange={setMenuOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" title="Sửa, đóng, hủy hoặc xóa hợp đồng.">
                  Thao tác khác
                  <ChevronDown className="ml-2 h-4 w-4" aria-hidden />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="grid w-64 gap-1 p-2">
                {can.update && contract.status !== "cancelled" && (
                  <Button variant="edit" className="justify-start" onClick={() => (setMenuOpen(false), actions.onEditContract())} title="Sửa đầu hợp đồng, dòng hàng hoặc đính file hợp đồng đã ký.">
                    <Pencil className="mr-2 h-4 w-4" aria-hidden />
                    Sửa hợp đồng
                  </Button>
                )}
                {can.update && isOpen && (
                  <Button
                    variant="lock"
                    className="justify-start"
                    onClick={() => (setMenuOpen(false), actions.onClose())}
                    title={gate.reason === "no-receipts" ? "Chưa có lần nhập nào — chưa đóng được." : "Đóng hợp đồng: không ghi lần nhập mới nữa."}
                  >
                    <Lock className="mr-2 h-4 w-4" aria-hidden />
                    Đóng hợp đồng
                  </Button>
                )}
                {can.update && isOpen && (
                  <Button variant="ghost" className="justify-start" onClick={() => (setMenuOpen(false), actions.onCancelContract())} title="Hủy hợp đồng (ghi lý do). Mọi lần nhập của HĐ hủy theo.">
                    <Ban className="mr-2 h-4 w-4" aria-hidden />
                    Hủy hợp đồng
                  </Button>
                )}
                {can.delete && canDeleteContract(data, contract.id) && (
                  <Button variant="danger" className="justify-start" onClick={() => (setMenuOpen(false), actions.onDeleteContract())} title="Xóa hợp đồng chưa có lần nhập nào (có Hoàn tác).">
                    <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                    Xóa hợp đồng
                  </Button>
                )}
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {contract.status === "closed" && (
        <p role="status" className="rounded-lg bg-muted px-4 py-2">
          Đã đóng{contract.closeReason ? ` · Lý do: ${contract.closeReason}` : ""}
        </p>
      )}
      {contract.status === "cancelled" && (
        <p role="status" className="rounded-lg bg-muted px-4 py-2">
          Đã hủy{contract.cancelReason ? ` · Lý do: ${contract.cancelReason}` : ""}
        </p>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-4 rounded-xl border border-border bg-card p-4">
        <Info label="Đối tác">{contract.supplierName || "—"}</Info>
        <Info label="Ngày ký">{formatDateVN(contract.signedDate)}</Info>
        <Info label="Loại hình">{importTypeLabel(contract.importType) || "—"}</Info>
        <Info label="Tổng kg">
          <span className="tnum">{formatNumber(totals.totalKg)} kg</span>
        </Info>
        {can.viewPrice && totals.totalAmount !== null && (
          <Info label="Tổng tiền">
            <span className="tnum">
              {formatMoney(totals.totalAmount)} {contract.currency}
            </span>
          </Info>
        )}
        <Info label="Đã về">
          <span className="tnum">
            {formatNumber(progress.receivedKg)} / {formatNumber(progress.totalKg)} kg
          </span>
        </Info>
      </div>

      <CollapsibleSection title="Dòng hàng" summary={`${lines.length} dòng · còn ${formatNumber(progress.shortKg)} kg chưa về`} tourTarget="import-lines">
        <RecordTable columns={lineColumns} rows={progress.lines} getKey={(x) => x.line.id} rowMarkKey="import-contract-lines" emptyText="Hợp đồng chưa có dòng hàng." />
      </CollapsibleSection>

      <CollapsibleSection title="File hợp đồng" summary={`${contractFiles(data, contract.id).length} file`} defaultOpen={false}>
        {contractFiles(data, contract.id).length ? (
          <ImportFileList files={contractFiles(data, contract.id)} caption={`HĐ ${contract.contractNo}`} onPreview={actions.onPreview} onRemove={can.update ? actions.onRemoveFile : undefined} />
        ) : (
          <p className="text-muted-foreground">Chưa đính file hợp đồng đã ký. Đính ở Thao tác khác → Sửa hợp đồng.</p>
        )}
      </CollapsibleSection>

      <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
        <h3 className="font-semibold">Các lần nhập ({receipts.filter((r) => r.status !== "cancelled").length})</h3>
        {receipts.length === 0 && <p className="rounded-lg bg-muted px-4 py-3">Chưa có lần nhập nào. Khi hàng sắp về, chọn Ghi lần nhập.</p>}
        {receipts.map((r, i) => (
          <ReceiptCard key={r.id} data={data} receipt={r} index={i + 1} contractOpen={isOpen} can={can} actions={actions} isFirst={i === 0} />
        ))}
      </section>
    </div>
  );
}

function ReceiptCard({
  data,
  receipt,
  index,
  contractOpen,
  can,
  actions,
  isFirst,
}: {
  data: ImportData;
  receipt: ImportReceipt;
  index: number;
  contractOpen: boolean;
  can: DossierCan;
  actions: DossierActions;
  isFirst: boolean;
}) {
  const state = receiptState(data, receipt);
  const missing = missingDocs(data, receipt.id);
  const docs = documentsOf(data, receipt.id);
  const qty = receiptLinesOf(data, receipt.id).filter((x) => (x.kg ?? 0) > 0);
  const lines = linesOf(data, receipt.contractId);
  const cancelled = receipt.status === "cancelled";
  const editable = contractOpen && !cancelled && can.update;
  return (
    <article id={`import-receipt-${receipt.id}`} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">Lần nhập {index}</span>
            <ReceiptStateTag state={state} />
          </div>
          <span className="tnum text-sm text-muted-foreground">
            {[
              receipt.arrivalDate ? `về kho ${formatDateVN(receipt.arrivalDate)}` : receipt.expectedDate ? `dự kiến ${formatDateVN(receipt.expectedDate)}` : "",
              transportLabel(receipt.transport),
              receipt.containerNo && `cont ${receipt.containerNo}`,
              receipt.blNo && `B/L ${receipt.blNo}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          {cancelled && <span className="text-sm">Lý do hủy: {receipt.cancelReason}</span>}
          {!cancelled && missing.length > 0 && <span className="text-sm">Còn thiếu: {missing.map(kindLabel).join(", ")}</span>}
        </div>
        <div className="flex flex-wrap gap-1">
          {editable && (
            <Button size="sm" variant="edit" onClick={() => actions.onEditReceipt(receipt)} title="Sửa ngày về, vận chuyển, số cont, số B/L.">
              <Pencil className="mr-1 h-4 w-4" aria-hidden />
              Sửa
            </Button>
          )}
          {editable && (
            <Button size="sm" variant="outline" onClick={() => actions.onCancelReceipt(receipt)} title="Hủy lần nhập (ghi lý do) — không tính vào tháng và số đã về.">
              <Ban className="mr-1 h-4 w-4" aria-hidden />
              Hủy
            </Button>
          )}
          {cancelled && contractOpen && can.update && (
            <Button size="sm" variant="edit" onClick={() => actions.onRestoreReceipt(receipt)} title="Khôi phục lần nhập đã hủy.">
              <RotateCcw className="mr-1 h-4 w-4" aria-hidden />
              Khôi phục
            </Button>
          )}
          {can.delete && canDeleteReceipt(data, receipt.id) && (
            <Button size="sm" variant="danger" onClick={() => actions.onDeleteReceipt(receipt)} title="Xóa lần nhập chưa có file và chưa có thực nhập (có Hoàn tác).">
              <Trash2 className="h-4 w-4" aria-hidden />
              <span className="sr-only">Xóa lần nhập</span>
            </Button>
          )}
        </div>
      </div>

      <div data-tour={isFirst ? "import-receipt-docs" : undefined} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
        <h4 className="font-medium">Chứng từ</h4>
        <ul className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
          {docs.map((doc) => {
            const files = filesOfDocument(data, doc.id);
            const has = documentHasEvidence(data, doc);
            const Icon = doc.notApplicable ? Minus : has ? Check : CircleDashed;
            return (
              <li key={doc.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 rounded-lg border border-border px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Icon className={`h-4 w-4 shrink-0 ${has ? "text-success" : "text-muted-foreground"}`} aria-hidden />
                    <span className="font-medium break-words">{documentLabel(doc)}</span>
                    {isRequiredKind(doc.kind) ? <Tag variant="muted">bắt buộc</Tag> : null}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {editable && (
                      <Button size="sm" variant="outline" onClick={() => actions.onEditDocument(receipt, doc)} title={`Ghi số, ngày, file của ${documentLabel(doc)}.`}>
                        <FilePlus2 className="mr-1 h-4 w-4" aria-hidden />
                        Cập nhật
                      </Button>
                    )}
                    {editable && canDeleteDocument(doc) && (
                      <Button size="sm" variant="danger" onClick={() => actions.onDeleteDocument(doc)} title={`Xóa ${documentLabel(doc)} khỏi lần nhập (có Hoàn tác).`}>
                        <Trash2 className="h-4 w-4" aria-hidden />
                        <span className="sr-only">Xóa {documentLabel(doc)}</span>
                      </Button>
                    )}
                  </div>
                </div>
                <span className="tnum text-sm text-muted-foreground">
                  {doc.notApplicable
                    ? `Không áp dụng · ${doc.naReason}`
                    : [doc.docNo && `Số ${doc.docNo}`, doc.docDate && formatDateVN(doc.docDate), doc.kind === "import-declaration" && importTypeLabel(doc.importType)].filter(Boolean).join(" · ") ||
                      (has ? "" : "Chưa có gì")}
                </span>
                <ImportFileList files={files} caption={documentLabel(doc)} onPreview={actions.onPreview} onRemove={editable ? actions.onRemoveFile : undefined} />
              </li>
            );
          })}
        </ul>
        {editable && (
          <div>
            <Button size="sm" variant="outline" onClick={() => actions.onEditDocument(receipt)} title="Thêm C/O, giấy kiểm dịch, B/L hoặc chứng từ khác (nếu có).">
              <Plus className="mr-1 h-4 w-4" aria-hidden />
              Thêm chứng từ
            </Button>
          </div>
        )}
      </div>

      <div data-tour={isFirst ? "import-receipt-quantity" : undefined} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-medium">Thực nhập</h4>
          {contractOpen && !cancelled && can.receiving && (
            <Button size="sm" variant="save" onClick={() => actions.onRecordQuantity(receipt)} title="Ghi số kg thực nhập của từng dòng hàng (theo invoice).">
              <PackageCheck className="mr-1 h-4 w-4" aria-hidden />
              Ghi thực nhập
            </Button>
          )}
        </div>
        {qty.length === 0 ? (
          <p className="text-muted-foreground">Chưa ghi thực nhập.</p>
        ) : (
          <ul className="grid gap-1">
            {qty.map((x) => (
              <li key={x.id} className="tnum flex flex-wrap justify-between gap-2">
                <span className="break-words">{lines.find((l) => l.id === x.contractLineId)?.productName ?? "Dòng đã bỏ"}</span>
                <span>{formatNumber(x.kg ?? 0)} kg</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
