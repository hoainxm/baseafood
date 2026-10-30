// ============================================================
// Tên file: src/features/export-planning/ContractDossier.tsx
// Tên tiếng Việt: Hồ sơ một hợp đồng — điều khoản, dòng hàng, các bản + duyệt, gia hạn, chuyến
// Description: Contract dossier page: header + state, terms, lines, revision / approval history,
//              deadline extensions, tolerance closure, shipments (1 shipment ⇒ shown inline).
// ============================================================
import {
  Button,
  InlineConfirmDelete,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RecordTable,
  Tag,
  formatNumber,
  type RecordTableColumn,
  AbbrHint,
} from "@/design-system";
import {
  APPROVAL_LABELS,
  CONTRACT_ATTACHMENT_LABELS,
  FINAL_REVIEW_LABELS,
  PAYMENT_METHODS,
  activitiesOf,
  contractAttachments,
  finalReviewGate,
  finalReviewsOf,
  missingAttachmentKinds,
  requiredAttachmentKinds,
  shipmentGate,
  shipmentGateText,
  approvalsOf,
  contractStateLabel,
  deviationText,
  isContainerKind,
  revisionApprovalLabelState,
  unmappedLines,
  contractClosure,
  contractCoverage,
  contractPaymentSummary,
  contractState,
  contractTotals,
  effectiveDeadline,
  effectiveRevision,
  lineAmount,
  lineCartons,
  lineKg,
  requiredDocumentLabel,
  revisionsOf,
  shipmentKindLabel,
  workingRevision,
  type ExportData,
} from "@/lib/exportPlanning";
import { formatDateVN, formatMoney } from "@/lib/format";
import { useGoodsTypeStore } from "@/lib/catalogRepo";
import { goodsTypeName } from "@/lib/goodsTypes";
import { useOrderCoverage } from "@/features/production-orders/useOrderCoverage";
import type { ExportContract, ExportContractLine, ExportFile, ExportPayment, ExportShipment, Product } from "@/types";
import {
  ArrowLeft,
  Ban,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FilePen,
  History,
  Paperclip,
  Languages,
  Link2,
  LockOpen,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";
import { ActivityList, CollapsibleSection, ContractFlowBar, FileList, StepBar, type PreviewTarget } from "./parts";
import { CONTRACT_STATE_TAG, progressText, shipmentProgress } from "./progress";

export interface DossierCan {
  create: boolean;
  update: boolean;
  delete: boolean;
  /** Duyệt cuối / mở lại HĐ — Trưởng, Phó phòng Kế hoạch (mig 0079). */
  approve: boolean;
  viewPrice: boolean;
  paymentsWrite: boolean;
  paymentsDelete: boolean;
}

export function ContractDossier({
  data,
  contract,
  customerName,
  can,
  filesAvailable,
  selectedShipmentId,
  canDelete,
  canCancel,
  onBack,
  onSelectShipment,
  onEditContract,
  onRevise,
  onExtend,
  onAddShipment,
  onCancelContract,
  onAttach,
  onRemoveAttachment,
  onFinalReview,
  onReopen,
  onDeleteContract,
  onDeposit,
  onEditPayment,
  onDeletePayment,
  onMapProducts,
  onOpenCustomerNames,
  products,
  today,
  onPreview,
  children,
}: {
  data: ExportData;
  contract: ExportContract;
  customerName: string;
  can: DossierCan;
  filesAvailable: boolean;
  selectedShipmentId: string;
  canDelete: boolean;
  canCancel: boolean;
  onBack: () => void;
  onSelectShipment: (id: string) => void;
  onEditContract: () => void;
  onRevise: () => void;
  onExtend: () => void;
  onAddShipment: () => void;
  onCancelContract: () => void;
  /** Mở hộp đính kèm hồ sơ cấp HĐ (bước Đính kèm). */
  onAttach: () => void;
  onRemoveAttachment: (f: ExportFile) => void;
  /** Mở hộp duyệt cuối — đồng ý thì đóng HĐ (thay "Chốt HĐ" cũ). */
  onFinalReview: () => void;
  onReopen: () => void;
  onDeleteContract: () => void;
  onDeposit: () => void;
  /** Sửa / xóa một lần tiền cọc, tiền về ghi ở cấp HĐ (XK-06). */
  onEditPayment: (p: ExportPayment) => void;
  onDeletePayment: (p: ExportPayment) => void;
  /** Mở hộp nối dòng hàng ↔ danh mục mặt hàng (không tạo bản sửa). */
  onMapProducts: () => void;
  /** Mở danh sách "Tên hàng trên chứng từ" của khách của HĐ (ba-spec 41 v6). */
  onOpenCustomerNames: () => void;
  /** Danh mục mặt hàng — hiện mặt hàng đã nối của từng dòng hàng. */
  products: readonly Pick<Product, "id" | "code" | "name">[];
  today: string;
  onPreview: (f: PreviewTarget) => void;
  /** Khung chuyến đang chọn (ShipmentPanel) — màn truyền vào. */
  children?: React.ReactNode;
}) {
  const opts = { filesAvailable };
  const eff = effectiveRevision(data, contract.id);
  const working = workingRevision(data, contract.id);
  const terms = working?.terms;
  const totals = working ? contractTotals(working.lines) : null;
  const state = contractState(data, contract.id, opts);
  const closure = contractClosure(data, contract.id, opts);
  const coverage = contractCoverage(data, contract.id);
  const deadline = effectiveDeadline(data, contract.id);
  const revisions = revisionsOf(data, contract.id);
  const extensions = data.extensions.filter((e) => e.contractId === contract.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const shipments = data.shipments.filter((s) => s.contractId === contract.id).sort((a, b) => (a.loadingDate || a.etd || a.planMonth).localeCompare(b.loadingDate || b.etd || b.planMonth));
  const isOpen = contract.status === "open";
  const currency = terms?.currency || "USD";
  const pay = contractPaymentSummary(data, contract.id);
  const unmapped = working ? unmappedLines(working.lines).length : 0;
  const productName = (id: string | undefined) => {
    const p = id ? products.find((x) => x.id === id) : undefined;
    return p ? (p.code ? `${p.code} · ${p.name}` : p.name) : "";
  };
  /** Tiền cọc / tiền về ghi ở cấp HĐ (không gắn chuyến). */
  const contractPayments = data.payments.filter((p) => p.contractId === contract.id && !p.shipmentId && p.kind === "payment").sort((a, b) => a.date.localeCompare(b.date));
  const isOverdue = isOpen && !!deadline && deadline < today && state !== "closed" && (!shipments.some((s) => s.status === "open") || !coverage.covered);

  // Loại hàng (mig 0089) — chưa chạy ⇒ không hiện cột.
  const goodsStore = useGoodsTypeStore();
  const orderCoverage = useOrderCoverage();
  const lineColumns: RecordTableColumn<ExportContractLine>[] = [
    { key: "description", header: "Tên hàng (như HĐ)", primary: true, render: (l) => <span className="font-semibold">{l.description}</span> },
    {
      key: "product",
      header: "Mặt hàng (danh mục)",
      render: (l) => productName(l.productId) || <Tag variant="warning">Chưa nối</Tag>,
      getSortValue: (l) => productName(l.productId),
    },
    { key: "size", header: "Size", render: (l) => l.size || "—" },
    ...(goodsStore.isAvailable
      ? ([
          {
            key: "goods-type",
            header: "Loại hàng",
            getSortValue: (l) => goodsTypeName(goodsStore.goodsTypes, l.goodsTypeId) || null,
            render: (l) => goodsTypeName(goodsStore.goodsTypes, l.goodsTypeId) || "—",
          },
        ] satisfies RecordTableColumn<ExportContractLine>[])
      : []),
    { key: "packing", header: "Quy cách", render: (l) => l.packing || "—", hideOnMobile: true },
    // R38: yêu cầu NL như cột trên HĐ — chép sang dòng Lệnh sản xuất.
    { key: "piece-length", header: "Chiều dài", getSortValue: (l) => l.pieceLength || null, render: (l) => l.pieceLength || "—", hideOnMobile: true },
    { key: "part-ratio", header: "Tỉ lệ râu / thân / cổ", getSortValue: (l) => l.partRatio || null, render: (l) => l.partRatio || "—", hideOnMobile: true },
    { key: "pieces-per-kg", header: "Số miếng / kg", getSortValue: (l) => l.piecesPerKg || null, render: (l) => l.piecesPerKg || "—", hideOnMobile: true },
    {
      key: "qty",
      header: "Số lượng",
      numeric: true,
      render: (l) => `${formatNumber(l.quantity)} ${l.unitKind === "bundle" ? `kiện (${formatNumber(lineCartons(l))} thùng)` : "thùng"}`,
    },
    { key: "kg", header: "Kg", numeric: true, render: (l) => formatNumber(lineKg(l)) },
    // Đã ra lệnh sản xuất (ba-spec 48 R4) — chỉ người xem được Lệnh sản xuất.
    ...(orderCoverage
      ? ([
          {
            key: "ordered",
            header: "Đã ra lệnh (kg)",
            numeric: true,
            sortKind: "number",
            getSortValue: (l) => orderCoverage(l, eff?.terms.tolerancePct ?? null).orderedKg,
            render: (l) => {
              const c = orderCoverage(l, eff?.terms.tolerancePct ?? null);
              return (
                <span className="grid justify-items-end">
                  <span className="tnum">{formatNumber(c.orderedKg)}</span>
                  <span className={`tnum text-sm ${c.overTolerance ? "text-warning" : "text-muted-foreground"}`}>
                    {c.overTolerance ? "vượt dung sai" : `còn ${formatNumber(c.remainingKg)}`}
                  </span>
                </span>
              );
            },
          },
        ] satisfies RecordTableColumn<ExportContractLine>[])
      : []),
    ...(can.viewPrice
      ? [
          { key: "price", header: `Đơn giá (${currency}/kg)`, numeric: true, render: (l: ExportContractLine) => formatMoney(l.unitPrice) },
          { key: "amount", header: `Tiền (${currency})`, numeric: true, render: (l: ExportContractLine) => formatMoney(lineAmount(l)) },
        ]
      : []),
    { key: "hs", header: "Mã HS", render: (l) => l.hsCode || "—", secondary: true },
    { key: "micro", header: "Vi sinh / kỹ thuật", render: (l) => l.microSpec || "—", secondary: true },
    { key: "line-note", header: "Ghi chú dòng", getSortValue: (l) => l.note || null, render: (l) => l.note || "—", secondary: true },
  ];

  const gate = shipmentGate(data, contract.id, opts);
  const finalGate = finalReviewGate(data, contract.id, opts);
  const attachments = contractAttachments(data, contract.id);
  const missingKinds = missingAttachmentKinds(data, contract.id, opts);
  const requiredKinds = eff ? requiredAttachmentKinds(eff.terms) : [];
  const finalReviews = finalReviewsOf(data, contract.id);
  const lastFinal = finalReviews.at(-1);
  const activities = activitiesOf(data, contract.id);
  const shipmentLabel = (id: string) => {
    const s = data.shipments.find((x) => x.id === id);
    return s ? `chuyến ${s.lotCode ? `lô ${s.lotCode}` : s.bookingNo || shipmentKindLabel(s.kind)}` : "";
  };

  /**
   * Việc làm tiếp của HĐ — MỘT nút chính (design-spec 42): đính kèm → ghi chuyến → duyệt cuối (không còn
   * bước duyệt HĐ — 2026-10-29). Người không có quyền làm chặng hiện tại thấy câu chờ.
   */
  const primary: "attach" | "ship" | "final" | null = !isOpen
    ? null
    : state === "attaching" && can.update
        ? "attach"
        : state === "final-review" && can.approve
          ? "final"
          : state === "shipping" && can.create && gate.ok && (!shipments.some((s) => s.status === "open") || !coverage.covered)
            ? "ship"
            : null;
  /** Câu chờ khi chặng hiện tại không phải việc của người đang xem. */
  const waitingText = !isOpen
    ? ""
    : state === "attaching" && !can.update
        ? "Chờ Nhân viên Kế hoạch đính kèm hồ sơ"
        : state === "final-review" && !can.approve
          ? "Chờ Trưởng / Phó phòng Kế hoạch duyệt cuối để đóng hợp đồng"
          : "";

  const menuItems: { key: string; node: React.ReactNode }[] = [];
  const menuBtn = (key: string, node: React.ReactNode) => menuItems.push({ key, node });
  if (isOpen) {
    if (can.update && eff && primary !== "attach")
      menuBtn("attach", (
        <Button variant="ghost" className="w-full justify-start" onClick={onAttach} title="Đính kèm hồ sơ của hợp đồng: hợp đồng đã ký, L/C, proforma, hồ sơ khác.">
          <Paperclip className="mr-2 h-4 w-4" aria-hidden />
          Đính kèm hồ sơ
        </Button>
      ));
    // Chưa có chuyến nào dựa vào HĐ ⇒ sửa thẳng bản đang dùng (gõ nhầm lúc lập). Có chuyến rồi ⇒ ghi bản sửa để giữ dấu.
    if (can.update && working && !shipments.length)
      menuBtn("edit", (
        <Button variant="edit" className="w-full justify-start" onClick={onEditContract} title="Sửa thẳng bản hợp đồng đang dùng — được khi hợp đồng chưa có chuyến nào.">
          <Pencil className="mr-2 h-4 w-4" aria-hidden />
          Sửa hợp đồng
        </Button>
      ));
    if (can.update && eff)
      menuBtn("revise", (
        <Button variant="ghost" className="w-full justify-start" onClick={onRevise} title="Ghi bản sửa (rvs / phụ kiện / tu chỉnh L/C) — bản mới có hiệu lực ngay khi lưu, bản cũ giữ lại để tra.">
          <FilePen className="mr-2 h-4 w-4" aria-hidden />
          Ghi bản sửa
        </Button>
      ));
    if (can.update)
      menuBtn("extend", (
        <Button variant="ghost" className="w-full justify-start" onClick={onExtend} title="Ghi hạn giao mới khách đã xác nhận — không cần duyệt lại.">
          <CalendarClock className="mr-2 h-4 w-4" aria-hidden />
          Gia hạn giao hàng
        </Button>
      ));
    if (can.create && gate.ok && primary !== "ship")
      menuBtn("ship", (
        <Button variant="ghost" className="w-full justify-start" onClick={onAddShipment} title="Ghi thêm một chuyến (một container) cho hợp đồng này.">
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          Ghi thêm chuyến
        </Button>
      ));
    if (can.paymentsWrite)
      menuBtn("deposit", (
        <Button variant="ghost" className="w-full justify-start" onClick={onDeposit} title="Ghi tiền cọc / tiền về ở cấp hợp đồng.">
          <Wallet className="mr-2 h-4 w-4" aria-hidden />
          Ghi tiền cọc
        </Button>
      ));
    if (can.approve && finalGate.ok && primary !== "final")
      menuBtn("final", (
        <Button
          variant="lock"
          className="w-full justify-start"
          onClick={onFinalReview}
          title={finalGate.needsReason ? "Duyệt cuối, đóng hợp đồng sớm kèm lý do (chưa xuất đủ trong dung sai — VD khách giảm lượng, phụ kiện)." : "Duyệt cuối: xem lại hồ sơ rồi đóng hợp đồng hoặc trả về."}
        >
          <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />
          Duyệt cuối · đóng HĐ
        </Button>
      ));
    if (can.update && canCancel)
      menuBtn("cancel", (
        <Button variant="ghost" className="w-full justify-start" onClick={onCancelContract} title="Hủy hợp đồng kèm lý do — các chuyến chưa đóng cont hủy theo. Dữ liệu giữ nguyên.">
          <Ban className="mr-2 h-4 w-4" aria-hidden />
          Hủy hợp đồng
        </Button>
      ));
    if (can.delete && canDelete)
      menuBtn("delete", (
        <Button variant="danger" className="w-full justify-start" onClick={onDeleteContract} title="Xóa hợp đồng nháp chưa duyệt, chưa có chuyến (có Hoàn tác).">
          <Trash2 className="mr-2 h-4 w-4" aria-hidden />
          Xóa hợp đồng
        </Button>
      ));
  }

  const openShipments = shipments.filter((s) => s.status === "open");
  const termsFirst = !eff || !openShipments.length;

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
      <div className="flex flex-wrap items-start gap-3">
        <Button variant="outline" onClick={onBack} title="Quay lại danh sách.">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
          Quay lại
        </Button>
        <div data-tour="contract-status" className="grid min-w-0 flex-1 basis-64 gap-1">
          <h2 className="font-semibold">
            HĐ {contract.contractNo} · {customerName}
          </h2>
          <div className="flex min-w-0 flex-wrap gap-1 [&>*]:max-w-full [&>*]:whitespace-normal">
            <Tag variant={CONTRACT_STATE_TAG[state]}>{contractStateLabel(state, contract)}</Tag>
            {isOpen && state === "attaching" && <Tag variant="warning">Thiếu: {missingKinds.map((k) => CONTRACT_ATTACHMENT_LABELS[k]).join(", ")}</Tag>}
            {isOpen && lastFinal?.decision === "needs-revision" && <Tag variant="warning">Duyệt cuối trả về: {lastFinal.reason}</Tag>}
            {isOverdue && <Tag variant="error">Quá hạn giao {formatDateVN(deadline)}</Tag>}
            {isOpen && unmapped > 0 && <Tag variant="warning">{unmapped} dòng hàng chưa nối danh mục</Tag>}
            {isOpen && !coverage.covered && (
              <Tag variant="warning">
                Còn {coverage.missingKg > 0 ? `${formatNumber(coverage.missingKg)} kg` : ""}
                {coverage.missingKg > 0 && coverage.missingContainers > 0 ? " / " : ""}
                {coverage.missingContainers > 0 ? `${coverage.missingContainers} cont` : ""} chưa ghi chuyến
              </Tag>
            )}
            {isOpen && closure.reason === "out-of-tolerance" && (
              <Tag variant="error">
                Ngoài dung sai: kg {deviationText(closure.kgDeviationPct)}
                {can.viewPrice ? ` · tiền ${deviationText(closure.amountDeviationPct)}` : ""}
              </Tag>
            )}
            {contract.status === "cancelled" && contract.cancelReason && <Tag variant="muted">Lý do hủy: {contract.cancelReason}</Tag>}
            {contract.status === "closed" && contract.closeReason && <Tag variant="muted">Đóng HĐ: {contract.closeReason}</Tag>}
          </div>
        </div>
        <div data-tour="next-action" className="flex flex-wrap items-center gap-2">
          {primary === "attach" && (
            <Button onClick={onAttach} title={`Việc tiếp: đính kèm hồ sơ còn thiếu — ${missingKinds.map((k) => CONTRACT_ATTACHMENT_LABELS[k]).join(", ")}. Đủ hồ sơ mới ghi chuyến được.`}>
              <Paperclip className="mr-2 h-4 w-4" aria-hidden />
              Đính kèm hồ sơ
            </Button>
          )}
          {primary === "ship" && (
            <Button onClick={onAddShipment} title="Việc tiếp: ghi một chuyến (một container) cho hợp đồng này.">
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Ghi chuyến
            </Button>
          )}
          {primary === "final" && (
            <Button variant="lock" onClick={onFinalReview} title="Việc tiếp: hợp đồng đã xuất đủ — xem lại hồ sơ rồi đồng ý đóng hợp đồng, hoặc trả về kèm lý do.">
              <ClipboardCheck className="mr-2 h-4 w-4" aria-hidden />
              Duyệt cuối
            </Button>
          )}
          {waitingText && <Tag variant="pending">{waitingText}</Tag>}
          {menuItems.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" title="Các thao tác khác của hợp đồng: bản sửa, gia hạn, đính kèm, ghi thêm chuyến, tiền cọc, duyệt cuối, hủy…">
                  <MoreHorizontal className="mr-2 h-4 w-4" aria-hidden />
                  Thao tác khác
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="grid w-64 gap-1 p-2">
                {menuItems.map((m) => (
                  <div key={m.key}>{m.node}</div>
                ))}
              </PopoverContent>
            </Popover>
          )}
          {contract.status === "closed" && can.approve && (
            <Button variant="edit" onClick={onReopen} title="Mở lại hợp đồng đã đóng — trạng thái tính lại theo số thực xuất, phải duyệt cuối lại.">
              <LockOpen className="mr-2 h-4 w-4" aria-hidden />
              Mở lại HĐ
            </Button>
          )}
        </div>
      </div>

      <ContractFlowBar state={state} />

      {terms && totals && (
        <dl data-tour="dossier-summary" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-3 rounded-xl bg-muted/50 px-4 py-3 text-sm">
          <Info label="Hạn giao" value={`${formatDateVN(deadline)}${extensions.length ? " (đã gia hạn)" : ""}`} />
          <Info label="Tổng hợp đồng" value={`${formatNumber(totals.kg)} kg${can.viewPrice ? ` · ${formatMoney(totals.amount)} ${currency}` : ""}`} />
          <Info label="Dung sai" value={`±${formatNumber(terms.tolerancePct ?? 0)}% lượng và tiền`} />
          <Info label="Chuyến" value={shipmentCountText(openShipments, terms.containerCount)} />
          <Info
            label="Thực xuất · tiền về"
            value={
              closure.actuals.kg > 0
                ? `${formatNumber(closure.actuals.kg)} kg${can.viewPrice ? ` · ${formatMoney(closure.actuals.amount)} ${currency} · đã về ${formatMoney(pay.received)} ${currency}` : ""}`
                : can.viewPrice && pay.received > 0
                  ? `chưa có invoice · đã về ${formatMoney(pay.received)} ${currency}`
                  : "chưa có invoice"
            }
          />
        </dl>
      )}

      {eff && (
        <CollapsibleSection
          tourTarget="contract-attachments"
          title="Hồ sơ đính kèm"
          summary={missingKinds.length ? `Thiếu ${missingKinds.map((k) => CONTRACT_ATTACHMENT_LABELS[k]).join(", ")}` : `Đủ hồ sơ · ${attachments.length} file`}
          defaultOpen={state === "attaching"}
        >
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {requiredKinds.map((k) => (
              <Tag key={k} variant={missingKinds.includes(k) ? "warning" : "done"}>
                {CONTRACT_ATTACHMENT_LABELS[k]}: {missingKinds.includes(k) ? "còn thiếu" : "đã có"}
              </Tag>
            ))}
            {can.update && isOpen && filesAvailable && (
              <Button size="sm" variant="outline" onClick={onAttach} title="Đính kèm thêm file hồ sơ của hợp đồng (chọn loại hồ sơ, nhiều file một lần).">
                <Paperclip className="mr-1 h-4 w-4" aria-hidden />
                Đính kèm file
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Bắt buộc: hợp đồng đã ký{eff.terms.paymentMethod === "lc" ? " và L/C" : ""}. Đủ hồ sơ bắt buộc mới ghi chuyến được.
            {!filesAvailable ? " Đang chạy không nối máy chủ — chưa tải được file, bước này không bắt file." : ""}
          </p>
          <FileList files={attachments} caption={`Hồ sơ HĐ ${contract.contractNo}`} onPreview={onPreview} onRemove={can.update && isOpen ? onRemoveAttachment : undefined} />
        </CollapsibleSection>
      )}

      {openShipments.length === 0 && (
        <div className="grid justify-items-start gap-2 rounded-xl border border-dashed border-border px-4 py-5">
          <p className="font-semibold">Chưa ghi chuyến nào</p>
          <p className="text-sm text-muted-foreground">
            Mỗi chuyến là một container: lệnh sản xuất, bao bì, đóng cont và bộ chứng từ ghi theo từng chuyến.
            {!gate.ok && gate.reason !== "not-open" ? ` Ghi chuyến được sau khi hợp đồng được duyệt và đính kèm đủ hồ sơ — ${shipmentGateText(gate)}` : ""}
          </p>
        </div>
      )}
      {shipments.length > 1 && (
        <section data-tour="shipment-list" className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
          <h3 className="font-semibold">Chuyến của hợp đồng — chọn để xem các bước</h3>
          {shipments.map((s) => (
            <ShipmentRow key={s.id} data={data} shipment={s} selected={s.id === selectedShipmentId} onSelect={() => onSelectShipment(s.id)} filesAvailable={filesAvailable} />
          ))}
        </section>
      )}

      {children}

      {can.viewPrice && contractPayments.length > 0 && (
        <CollapsibleSection title="Tiền cọc · tiền về cấp hợp đồng" summary={`${contractPayments.length} lần · ${formatMoney(contractPayments.reduce((t, p) => t + (p.amount ?? 0), 0))} ${currency}`} defaultOpen>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)]">
            {contractPayments.map((p) => (
              <div key={p.id} className="flex min-w-0 flex-wrap items-center gap-2 border-b border-border py-2 text-sm last:border-b-0">
                <Wallet className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="tnum min-w-0 flex-1 break-words">
                  {formatDateVN(p.date)} · {formatMoney(p.amount)} {p.currency}
                  {p.method ? ` · ${p.method}` : ""}
                  {p.note ? ` · ${p.note}` : ""}
                </span>
                {p.filePath && (
                  <Button size="sm" variant="ghost" onClick={() => onPreview({ path: p.filePath, name: p.fileName, caption: `Tiền về · HĐ ${contract.contractNo}` })} title="Xem giấy báo có đính kèm.">
                    Xem file
                  </Button>
                )}
                {can.paymentsWrite && (
                  <Button size="sm" variant="edit" onClick={() => onEditPayment(p)} title="Sửa lần tiền cọc / tiền về này.">
                    <Pencil className="h-4 w-4" aria-hidden />
                    <span className="sr-only">Sửa</span>
                  </Button>
                )}
                {can.paymentsDelete && (
                  <InlineConfirmDelete onConfirm={() => onDeletePayment(p)} recordDescription={`Tiền về ${formatDateVN(p.date)} — ${formatMoney(p.amount)} ${p.currency}`} />
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {terms && totals && (
        <CollapsibleSection
          tourTarget="contract-details"
          title={`Điều khoản ${eff ? `· bản ${eff.revisionNo} đang hiệu lực` : "· chưa có bản hiệu lực"}`}
          summary={[terms.incoterm, terms.portOfDischarge, PAYMENT_METHODS.find((p) => p.value === terms.paymentMethod)?.label].filter(Boolean).join(" · ")}
          defaultOpen={termsFirst}
        >
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Info label="Ngày ký" value={formatDateVN(contract.signedOn)} />
            <Info label="Số PO của khách" value={contract.orderRef} />
            <Info label="Incoterm · cảng" value={[terms.incoterm, terms.portOfLoading && `${terms.portOfLoading} → ${terms.portOfDischarge}`].filter(Boolean).join(" · ") || terms.portOfDischarge} />
            <Info
              label="Thanh toán"
              value={[
                terms.paymentMethod === "other" && terms.paymentOther?.trim()
                  ? terms.paymentOther.trim()
                  : PAYMENT_METHODS.find((p) => p.value === terms.paymentMethod)?.label,
                terms.depositPct != null && `cọc ${formatNumber(terms.depositPct)}%`,
                terms.paymentMethod === "lc" && terms.lcNo && `L/C ${terms.lcNo}`,
                terms.lcExpiry && `hết hạn ${formatDateVN(terms.lcExpiry)}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            />
            <Info label="Hạn giao" value={`${formatDateVN(deadline)}${extensions.length ? ` (gia hạn từ ${formatDateVN(terms.latestShipmentDate)})` : ""}`} />
            <Info label="Container" value={[terms.containerCount != null && `${terms.containerCount} cont`, terms.containerType].filter(Boolean).join(" ")} />
            <Info
              label="Tổng"
              value={`${formatNumber(totals.units)} thùng/kiện · ${formatNumber(totals.cartons)} thùng · ${formatNumber(totals.kg)} kg${can.viewPrice ? ` · ${formatMoney(totals.amount)} ${currency}` : ""}`}
            />
            <Info label="Ghi chú" value={contract.note} />
          </dl>
          {terms.requiredDocuments.length > 0 && (
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
              <p className="text-sm text-muted-foreground">Chứng từ khách yêu cầu</p>
              <div className="flex flex-wrap gap-1">
                {terms.requiredDocuments.map((d, i) => (
                  <Tag key={i} variant="category" tone="blue" className="max-w-full whitespace-normal">
                    {requiredDocumentLabel(d, data.documentKinds)}
                  </Tag>
                ))}
              </div>
            </div>
          )}
        </CollapsibleSection>
      )}

      {working && (
        <CollapsibleSection
          title={`Dòng hàng (${working.lines.length})`}
          summary={totals ? `${formatNumber(totals.units)} thùng/kiện · ${formatNumber(totals.kg)} kg${can.viewPrice ? ` · ${formatMoney(totals.amount)} ${currency}` : ""}${unmapped ? ` · ${unmapped} dòng chưa nối danh mục` : ""}` : undefined}
          defaultOpen={termsFirst}
        >
          <div className="flex min-w-0 flex-wrap items-center gap-2 pb-2">
            <Button size="sm" variant="ghost" className="h-auto max-w-full whitespace-normal text-left" onClick={onOpenCustomerNames} title={`Xem / sửa tên hàng ${customerName} dùng trên hợp đồng, invoice (theo từng mặt hàng, size).`}>
              <Languages className="mr-1 h-4 w-4" aria-hidden />
              Tên hàng của {customerName}
            </Button>
          </div>
          {can.update && isOpen && (
            <div className="flex min-w-0 flex-wrap items-center gap-2 pb-2">
              <Button size="sm" variant="outline" onClick={onMapProducts} title="Chọn mặt hàng trong danh mục cho từng dòng hàng — thông tin nội bộ, không tạo bản sửa, không cần duyệt lại.">
                <Link2 className="mr-1 h-4 w-4" aria-hidden />
                Nối mặt hàng
              </Button>
              <span className="text-sm text-muted-foreground">
                {unmapped ? `${unmapped} dòng chưa nối — Lệnh sản xuất chỉ xong khi mọi dòng đã nối.` : "Mọi dòng đã nối danh mục mặt hàng."}
              </span>
            </div>
          )}
          <RecordTable columns={lineColumns} rows={working.lines} getKey={(l) => l.id} rowMarkKey={`export-contract-lines:${contract.id}`} emptyText="Hợp đồng chưa có dòng hàng." />
        </CollapsibleSection>
      )}

      <CollapsibleSection
        title="Các bản hợp đồng · duyệt cuối"
        summary={`${revisions.length} bản${extensions.length ? ` · ${extensions.length} lần gia hạn` : ""}`}
        defaultOpen={false}
      >
        {[...revisions].reverse().map((r) => {
          // Lượt duyệt bản chỉ còn ở dữ liệu CŨ (trước 2026-10-29) — hiện thẻ khi có, không thì thôi.
          const st = approvalsOf(data, r.id).length ? revisionApprovalLabelState(data, r) : null;
          return (
            <div key={r.id} className="grid gap-2 border-b border-border pb-3 text-sm last:border-b-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">Bản {r.revisionNo}</span>
                <span className="text-muted-foreground">{formatDateVN(r.revisedOn)}</span>
                {st && <Tag variant={st === "approved" ? "done" : st === "rejected" ? "error" : "muted"}>{APPROVAL_LABELS[st]}</Tag>}
                {eff?.id === r.id && <Tag variant="source">Đang hiệu lực</Tag>}
              </div>
              {r.changeSummary && <p>{r.changeSummary}</p>}
              <p className="tnum text-muted-foreground">
                {formatNumber(contractTotals(r.lines).kg)} kg{can.viewPrice ? ` · ${formatMoney(contractTotals(r.lines).amount)} ${r.terms.currency}` : ""} · hạn giao{" "}
                {formatDateVN(r.terms.latestShipmentDate)}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {r.filePath && (
                  <Button size="sm" variant="outline" onClick={() => onPreview({ path: r.filePath, name: r.fileName, caption: `HĐ ${contract.contractNo} · bản ${r.revisionNo}` })} title="Xem file hợp đồng của bản này.">
                    File hợp đồng
                  </Button>
                )}
                {approvalsOf(data, r.id).map((a) => (
                  <span key={a.id} className="flex flex-wrap items-center gap-2">
                    <span>
                      {APPROVAL_LABELS[a.decision]} · {a.approverName} · {formatDateVN(a.decidedOn)}
                      {a.reason ? ` · ${a.reason}` : ""}
                    </span>
                    {a.filePath && (
                      <Button size="sm" variant="ghost" onClick={() => onPreview({ path: a.filePath, name: a.fileName, caption: `Bản ký · HĐ ${contract.contractNo} · bản ${r.revisionNo}` })} title="Xem file kèm lượt duyệt (bản ký scan của quy trình cũ).">
                        Bản ký
                      </Button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
        {extensions.map((e) => (
          <div key={e.id} className="flex flex-wrap items-center gap-2 text-sm">
            <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1">
              Gia hạn tới {formatDateVN(e.newDeadline)} · khách xác nhận {formatDateVN(e.confirmedOn)}
              {e.note ? ` · ${e.note}` : ""}
            </span>
            {e.filePath && (
              <Button size="sm" variant="ghost" onClick={() => onPreview({ path: e.filePath, name: e.fileName, caption: `Gia hạn · HĐ ${contract.contractNo}` })} title="Xem xác nhận của khách.">
                Xác nhận
              </Button>
            )}
          </div>
        ))}
        {finalReviews.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1">
              Duyệt cuối: {FINAL_REVIEW_LABELS[a.decision === "approved" ? "approved" : "needs-revision"]} · {a.approverName} · {formatDateVN(a.decidedOn)}
              {a.reason ? ` · ${a.reason}` : ""}
            </span>
          </div>
        ))}
      </CollapsibleSection>

      <CollapsibleSection tourTarget="contract-activity" title="Nhật ký thao tác" summary={`${activities.length} dòng`} defaultOpen={false}>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <History className="h-4 w-4 shrink-0" aria-hidden />
          Ai làm gì, lúc nào trên hợp đồng này — chỉ thêm, không sửa / xóa được. Dùng để tra soát.
        </p>
        <ActivityList items={activities} shipmentLabel={shipmentLabel} />
      </CollapsibleSection>
    </div>
  );
}

/** "2 cont / 1 cont" — xe tải / đóng ghép không phải container nên ghi riêng (XK-21). */
function shipmentCountText(open: readonly ExportShipment[], containerCount: number | null): string {
  const cont = open.filter((s) => isContainerKind(s.kind)).length;
  const other = open.length - cont;
  const base = containerCount != null ? `${cont} / ${containerCount} cont` : `${cont} cont`;
  return other ? `${base} + ${other} chuyến xe tải / đóng ghép` : base;
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid min-w-0 content-start gap-0.5">
      <dt className="flex items-center gap-1 text-muted-foreground">
        {label}
        <AbbrHint label={label} />
      </dt>
      <dd className="tnum break-words font-medium">{value || "—"}</dd>
    </div>
  );
}

function ShipmentRow({
  data,
  shipment,
  selected,
  onSelect,
  filesAvailable,
}: {
  data: ExportData;
  shipment: ExportShipment;
  selected: boolean;
  onSelect: () => void;
  filesAvailable: boolean;
}) {
  const p = shipmentProgress(data, shipment, { filesAvailable });
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`grid min-w-0 gap-2 rounded-lg border p-3 text-left sm:grid-cols-[minmax(0,1fr)_minmax(12rem,20rem)] sm:items-center ${selected ? "border-primary bg-accent" : "border-border hover:bg-muted"}`}
      title="Mở các bước của chuyến này."
    >
      <span className="grid min-w-0 gap-0.5">
        <span className="font-semibold">
          {[shipment.lotCode && `Lô ${shipment.lotCode}`, shipmentKindLabel(shipment.kind), shipment.containerNo].filter(Boolean).join(" · ")}
        </span>
        <span className="tnum text-sm text-muted-foreground">
          {shipment.status === "cancelled"
            ? `Đã hủy · ${shipment.cancelReason}`
            : [shipment.loadingDate && `Đóng ${formatDateVN(shipment.loadingDate)}`, shipment.etd && `ETD ${formatDateVN(shipment.etd)}`, shipment.bookingNo || "chờ booking"]
                .filter(Boolean)
                .join(" · ")}
        </span>
      </span>
      {shipment.status === "open" && (
        <span className="grid min-w-0 gap-1">
          <StepBar steps={p.steps} />
          <span className={`text-sm ${p.next === null ? "font-semibold text-success" : ""}`}>{progressText(p)}</span>
        </span>
      )}
    </button>
  );
}
