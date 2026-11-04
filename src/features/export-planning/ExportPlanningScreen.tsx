// ============================================================
// Tên file: src/features/export-planning/ExportPlanningScreen.tsx
// Tên tiếng Việt: Phòng Kế hoạch · Xuất khẩu — tháng × khách × hợp đồng × chuyến, 6 bước, khép kín
// Description: Export planning screen (/planning-export, wave 1): month plan, contract list,
//              contract dossier with shipments and step checklists; loading staff get a phone
//              view to upload layer photos / load plans. All writes here, rules in lib.
// ============================================================
// Spec: docs/spec/xuat-khau-phong-ke-hoach.md · ba-spec: docs/app-map/41-export-planning.ba-spec.md.
// Máy chủ chặn bằng RLS riêng của mig 0075 (has_export_permission); màn ẩn nút theo useCan.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, ConfirmDelete, EmptyState, TableSkeleton, Tabs, TabsList, TabsTrigger, formatNumber, notify, todayIso } from "@/design-system";
import { useCustomerProductNameStore, useCustomers, useExportBookingDetailsAvailable, useExportBookingFilesAvailable, useExportDeferralsAvailable, useExportLoadingExtraPhotosAvailable, useExportOptionStore,
  useCompanyProfileStore, useGoodsTypeStore, useProducts } from "@/lib/catalogRepo";
import { lineUnits, shipmentLinesOf } from "@/lib/exportInvoice";
import { companySellerOf } from "@/lib/companyProfile";
import { extractCustomerNames } from "@/lib/customerProductNames";
import { CustomerProductNamesDialog } from "@/features/catalog/CustomerProductNamesDialog";
import { useAuth } from "@/lib/auth";
import { useCan } from "@/features/shared/PermissionProvider";
import { newId } from "@/lib/store";
import {
  CONTRACT_ATTACHMENT_LABELS,
  SUB_STEP_LABELS,
  applyProductMapping,
  contractClosure,
  documentKindLabel,
  documentItems,
  shipmentKindLabel,
  finalReviewGate,
  missingAttachmentKinds,
  validateDeferral,
  withDeferral,
  shipmentGate,
  shipmentGateText,
  buildMonthExcel,
  deviationText,
  buildPeriodPlan,
  monthPeriod,
  rangePeriod,
  weekPeriod,
  type Period,
  canCancel,
  canDeleteContract,
  canDeleteShipment,
  cancelContract,
  contractTotals,
  effectiveRevision,
  isBlankShipment,
  isShipmentClosed,
  missingDocumentItems,
  scheduleFor,
  scheduleGate,
  shipmentsFromSchedule,
  type ScheduleRow,
  nextRevisionNo,
  openShipmentsOf,
  shipmentMonth,
  termsOf,
  workingRevision,
  contractChangeSummary,
  addableContracts,
  shipmentContractIds,
  shipmentContractLines,
  lineContractOf,
} from "@/lib/exportPlanning";
import { hasExportStorage } from "@/lib/exportFileStorage";
import { ROLES, type ExportActivity, type ExportContract, type ExportContractAttachmentKind, type ExportDeadlineExtension, type ExportFile, type ExportPayment, type ExportShipment, type ExportShipmentKind, type ExportShipmentLine, type ExportStepItem } from "@/types";
import { BarChart3, CalendarDays, FilePlus2, FileText, FolderLock, ListChecks } from "lucide-react";
import { ExportCatalogView, normalizeExportCatalogList } from "./ExportCatalogView";
import { ContractDossier } from "./ContractDossier";
import { ContractFormDialog, type ContractFormTarget, type ContractSavePayload } from "./ContractFormDialog";
import { ContractListView } from "./ContractListView";
import { LoadingView } from "./LoadingView";
import { MonthView } from "./MonthView";
import { ReportView } from "./ReportView";
import { buildExportReport, buildReportExcel, parseReportPeriod, type ReportPeriod } from "@/lib/exportReports";
import { ProductMappingDialog, type ProductMappingTarget } from "./ProductMappingDialog";
import { ExportFilePreview, type PreviewTarget } from "./parts";
import {
  AttachmentDialog,
  ExtensionDialog,
  FinalReviewDialog,
  PaymentDialog,
  ReasonDialog,
  type AttachmentTarget,
  type FinalReviewTarget,
  type ExtensionTarget,
  type PaymentTarget,
  type ReasonTarget,
} from "./RecordDialogs";
import { ShipmentPanel } from "./ShipmentPanel";
import { LoadingCountDialog, ShipmentLinesDialog, type LoadingCountTarget, type ShipmentLinesTarget } from "./ShipmentGoods";
import { EXTRA_PHOTO_TEXT } from "./shipmentGoodsLogic";
import { downloadInvoiceDocument, invoiceDocumentFor } from "./invoiceDocument";
import {
  LoadingUploadDialog,
  ScheduleDialog,
  ShipmentFormDialog,
  StepItemDialog,
  type LoadingUploadTarget,
  type ScheduleTarget,
  type ShipmentTarget,
  type StepItemTarget,
  type InvoiceNameExtract,
} from "./ShipmentDialogs";
import { BookingDialog, TransportDialog, type BookingTarget, type TransportTarget } from "./BookingDialogs";
import { useExportData } from "./useExportData";
import { buildExportTour, pickTourContract } from "./exportTour";
import { usePageTour } from "@/features/shared/PageTourProvider";
import { recordName } from "@/lib/personName";

/** Hai tab luôn nằm cạnh nhau, chữ được xuống dòng: điện thoại 360 px / chữ 130 % không tràn, không đè nút Lập hợp đồng. */
// Điện thoại: chữ được xuống dòng trong ô tab; từ sm trở lên KHÔNG gãy dòng (nhãn v5 m).
const TAB_TRIGGER = "h-auto min-h-9 whitespace-normal px-3 max-sm:[&>svg]:hidden sm:whitespace-nowrap sm:px-4";

const KIND_FROM_TEXT = (t: string): ExportShipmentKind => {
  const x = t.toUpperCase();
  if (x.includes("HC")) return "40HC-RF";
  if (x.includes("20")) return "20RF";
  return "40RF";
};

export default function ExportPlanningScreen() {
  const today = todayIso();
  const { profile } = useAuth();
  const recordedBy = recordName(profile, "Máy này");
  const can = useCan("export-plans");
  const loadingCan = useCan("export-plans.loading");
  const paymentsCan = useCan("export-plans.payments");
  const orderCan = useCan("production-orders");
  const navigate = useNavigate();
  const store = useExportData();
  const d = store.data;
  const [customers, setCustomers] = useCustomers();
  const goodsTypeStore = useGoodsTypeStore(); // cột Loại hàng của Excel (mig 0089)
  const [products, setProducts] = useProducts();
  // Tên hàng theo khách (mig 0077, ba-spec 41 v6): điền dòng hàng, gợi ý nối, trích xuất khi lưu.
  const nameStore = useCustomerProductNameStore();
  const customerCan = useCan("catalog.customers");
  const [namesFor, setNamesFor] = useState<{ id: string; name: string } | null>(null);
  /** Người duyệt = tài khoản đang đăng nhập (mig 0079: Trưởng / Phó phòng Kế hoạch có quyền Duyệt). */
  const approverRole = (["planning-head", "planning-deputy", "admin"] as const).find((r) => profile?.roles.includes(r));
  const approverName = approverRole ? `${recordedBy} — ${ROLES.find((r) => r.value === approverRole)?.label ?? ""}` : recordedBy;
  const [params, setParams] = useSearchParams();
  const filesAvailable = hasExportStorage;
  const opts = { filesAvailable };

  const viewParam = params.get("view");
  const view = viewParam === "contracts" || viewParam === "reports" || viewParam === "catalog" ? viewParam : "month";
  // Tab Danh mục (ba-spec 62): danh sách đang xem ở ?list= (mặc định Cảng xếp).
  const catalogList = normalizeExportCatalogList(params.get("list"));
  // Kỳ báo cáo: ?report=2026 · 2026-Q3 · 2026-09 (mặc định năm nay) — giữ khi mở HĐ rồi Quay lại.
  const reportPeriod = parseReportPeriod(params.get("report"), today, "year");
  const setReportPeriod = (p: ReportPeriod) => setParam({ report: p.key === today.slice(0, 4) ? "" : p.key }, true);
  // Kỳ xem: ?month=yyyy-mm (mặc định tháng này) · ?week=yyyy-mm-dd (tuần chứa ngày đó) · ?from=&to= (khoảng ngày).
  const isoDay = /^\d{4}-\d{2}-\d{2}$/;
  const period: Period =
    isoDay.test(params.get("from") ?? "") && isoDay.test(params.get("to") ?? "")
      ? rangePeriod(params.get("from") as string, params.get("to") as string)
      : isoDay.test(params.get("week") ?? "")
        ? weekPeriod(params.get("week") as string)
        : monthPeriod(/^\d{4}-\d{2}$/.test(params.get("month") ?? "") ? (params.get("month") as string) : today.slice(0, 7));
  const setPeriod = (p: Period) =>
    setParam(
      p.kind === "range"
        ? { month: "", week: "", from: p.from, to: p.to }
        : p.kind === "week"
          ? { month: "", week: p.from, from: "", to: "" }
          : { month: p.from.slice(0, 7) === today.slice(0, 7) ? "" : p.from.slice(0, 7), week: "", from: "", to: "" },
      true,
    );
  const contractId = params.get("contract") ?? "";
  const shipmentParam = params.get("shipment") ?? "";
  const setParam = (patch: Record<string, string>, replace = false) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        for (const [k, v] of Object.entries(patch)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        return next;
      },
      { replace },
    );

  // ---- Hộp ----
  const [contractForm, setContractForm] = useState<ContractFormTarget | null>(null);
  const [finalTarget, setFinalTarget] = useState<FinalReviewTarget | null>(null);
  const [attachTarget, setAttachTarget] = useState<AttachmentTarget | null>(null);
  const [extensionTarget, setExtensionTarget] = useState<ExtensionTarget | null>(null);
  const [shipmentTarget, setShipmentTarget] = useState<ShipmentTarget | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<ScheduleTarget | null>(null);
  const [itemTarget, setItemTarget] = useState<StepItemTarget | null>(null);
  const [loadingTarget, setLoadingTarget] = useState<LoadingUploadTarget | null>(null);
  const [bookingTarget, setBookingTarget] = useState<BookingTarget | null>(null);
  const [transportTarget, setTransportTarget] = useState<TransportTarget | null>(null);
  const [linesTarget, setLinesTarget] = useState<ShipmentLinesTarget | null>(null);
  const [countTarget, setCountTarget] = useState<LoadingCountTarget | null>(null);
  const exportOptions = useExportOptionStore().options;
  // Người bán + logo trên chứng từ lấy từ Thông tin công ty (ba-spec 67).
  const company = useCompanyProfileStore();
  /** Mig 0097 — ảnh kèm số lượng thực đóng + ảnh bao bì / cân gross. */
  const extraPhotosAvailable = useExportLoadingExtraPhotosAvailable();
  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(null);
  const [mappingTarget, setMappingTarget] = useState<ProductMappingTarget | null>(null);
  const [reasonTarget, setReasonTarget] = useState<ReasonTarget | null>(null);
  const [deletingContract, setDeletingContract] = useState<ExportContract | null>(null);
  const [deletingShipment, setDeletingShipment] = useState<ExportShipment | null>(null);
  const [preview, setPreview] = useState<PreviewTarget | null>(null);

  const customerName = (id: string) => customers.find((c) => c.id === id)?.name || "(khách chưa rõ)";
  const contract = contractId ? d.contracts.find((c) => c.id === contractId) : undefined;

  /* ---------- Nhật ký hợp đồng (mig 0079) — chỉ thêm ---------- */

  // Ref giữ bản MỚI NHẤT: hai lượt ghi trong cùng một lần bấm (hoặc Hoàn tác chạy từ toast cũ) không
  // được ghi đè làm rơi dòng nhật ký vừa thêm.
  const activitiesRef = useRef(d.activities);
  useEffect(() => {
    activitiesRef.current = d.activities;
  }, [d.activities]);
  const track = (contractId: string, shipmentId: string, action: ExportActivity["action"], summary: string) => {
    if (!store.canLog || !contractId) return;
    const next = [...activitiesRef.current, { id: newId(), contractId, shipmentId, action, summary, actor: recordedBy, createdAt: new Date().toISOString() }];
    activitiesRef.current = next;
    store.saveActivities(next);
  };
  /** Hoàn tác cũng vào nhật ký — tra soát thấy cả việc làm rồi bỏ. */
  const undoTracked = (contractId: string, shipmentId: string, summary: string, undo: () => void) => () => {
    undo();
    track(contractId, shipmentId, "undo", `Hoàn tác: ${summary}`);
  };
  const shipName = (s: Pick<ExportShipment, "lotCode" | "bookingNo"> | undefined) => (s ? (s.lotCode ? `lô ${s.lotCode}` : s.bookingNo ? `booking ${s.bookingNo}` : "chưa có mã lô") : "");
  const itemName = (i: Pick<ExportStepItem, "step" | "docKind">) => (i.step === "document" ? documentKindLabel(i.docKind, d.documentKinds) : SUB_STEP_LABELS[i.step]);
  const contractIdOfShipment = (shipmentId: string) => d.shipments.find((x) => x.id === shipmentId)?.contractId ?? "";

  /* ---------- Ghi (mọi lượt ghi có Hoàn tác — luật 6 / 13) ---------- */

  /** Bước 5: chuyến còn mở chưa khép của HĐ nhận thêm mục chứng từ mà bản hiệu lực mới yêu cầu (R6). */
  const syncDocumentItems = (contractIdToSync: string, items: readonly ExportStepItem[], data = d) => {
    const terms = termsOf(data, contractIdToSync);
    const add = openShipmentsOf(data, contractIdToSync)
      .filter((s) => !isShipmentClosed(data, s, opts))
      .flatMap((s) => missingDocumentItems(s.id, terms, items, newId));
    return add;
  };

  /**
   * Trích xuất từ chứng từ (NV16 · R26): thêm tên còn thiếu của khách từ các dòng đã nối. Máy chủ chưa có bảng
   * hoặc không có quyền ghi ⇒ bỏ qua (HĐ vẫn lưu). Trả về số tên thêm + hàm Hoàn tác.
   */
  const learnNames = (customerId: string, lines: Parameters<typeof extractCustomerNames>[2], docNo: string, docKind: "HĐ" | "Invoice" = "HĐ") => {
    const allowed = nameStore.isAvailable && (can.create || can.update || customerCan.create || customerCan.update);
    const prev = nameStore.names;
    const created = allowed ? extractCustomerNames(prev, customerId, lines, docNo, newId, docKind) : [];
    if (created.length && nameStore.setNames([...prev, ...created]) === false) return { count: 0, undo: () => {} };
    return { count: created.length, undo: () => (created.length ? void nameStore.setNames(prev) : undefined) };
  };
  const learnedText = (n: number) => (n ? ` · trích xuất ${n} tên hàng của khách` : "");

  const saveContract = (p: ContractSavePayload): boolean => {
    const prevC = d.contracts;
    const prevR = d.revisions;
    const nextC = prevC.some((c) => c.id === p.contract.id) ? prevC.map((c) => (c.id === p.contract.id ? p.contract : c)) : [...prevC, p.contract];
    const nextR = p.mode === "edit" ? prevR.map((r) => (r.id === p.revision.id ? p.revision : r)) : [...prevR, p.revision];
    if (!store.saveContracts(nextC)) return false;
    if (!store.saveRevisions(nextR)) {
      store.saveContracts(prevC);
      return false;
    }
    const undoFiles = saveExtraFiles(p.attachments);
    if (!undoFiles) {
      store.saveRevisions(prevR);
      store.saveContracts(prevC);
      return false;
    }
    const learned = learnNames(p.contract.customerId, p.revision.lines, p.contract.contractNo);
    // Bản vừa ghi có hiệu lực ngay (không còn bước duyệt HĐ) ⇒ chuyến còn mở nhận thêm mục chứng từ bản mới yêu cầu (R6).
    const prevI = d.items;
    const added = p.mode === "create" ? [] : syncDocumentItems(p.contract.id, prevI, { ...d, contracts: nextC, revisions: nextR });
    // Lịch xuất hàng gõ ngay trong form Lập HĐ (ba-spec 41 R42 + R43): N chuyến + mục chứng từ bước 5 (R6) ghi CÙNG lần lưu, chung Hoàn tác.
    const prevS = d.shipments;
    const t = p.revision.terms;
    const scheduled = p.mode === "create" && p.schedule?.length
      ? shipmentsFromSchedule(p.schedule, { contractId: p.contract.id, kind: KIND_FROM_TEXT(t.containerType), portOfDischarge: t.portOfDischarge }, newId, new Date().toISOString())
      : [];
    if (scheduled.length && !store.saveShipments([...prevS, ...scheduled])) {
      undoFiles();
      store.saveRevisions(prevR);
      store.saveContracts(prevC);
      return false;
    }
    const scheduleItems = scheduled.flatMap((s) => missingDocumentItems(s.id, t, prevI, newId));
    if (added.length || scheduleItems.length) store.saveItems([...prevI, ...added, ...scheduleItems]);
    const scheduleText = scheduled.length
      ? `lịch xuất hàng ${scheduled.length} chuyến (${[...new Set(scheduled.map((s) => shipmentMonth(s).split("-").reverse().join("/")))].join(", ")})`
      : "";
    const what =
      p.mode === "create"
        ? `Lập HĐ ${p.contract.contractNo} (bản 0)${scheduleText ? ` + ${scheduleText}` : ""}`
        : p.mode === "revise"
          ? `Ghi bản sửa ${p.revision.revisionNo} của HĐ ${p.contract.contractNo} — có hiệu lực ngay`
          : `Sửa bản ${p.revision.revisionNo} của HĐ ${p.contract.contractNo}`;
    // Nhật ký ghi ĐỦ trường đổi, cũ → mới (ba-spec 68 R3) — Số HĐ cũ chỉ còn ở đây khi đổi số.
    const before =
      p.mode === "create"
        ? undefined
        : {
            contract: prevC.find((c) => c.id === p.contract.id) ?? p.contract,
            revision: p.mode === "edit" ? prevR.find((r) => r.id === p.revision.id) : (workingRevision(d, p.contract.id) ?? undefined),
          };
    const changes = contractChangeSummary(before, { contract: p.contract, revision: p.revision }, (id) => customers.find((x) => x.id === id)?.name ?? "");
    const logged = changes.length ? `${what}: ${changes.join("; ")}`.slice(0, 1000) : what;
    track(p.contract.id, "", p.mode === "create" ? "create" : "update", logged);
    notify.saved(
      (p.mode === "create"
        ? `Đã lập HĐ ${p.contract.contractNo}${scheduleText ? ` + ${scheduleText}` : ""} — ${p.thenCreateOrder ? "đang mở Lập lệnh sản xuất; đính kèm hợp đồng đã ký sau ở hồ sơ HĐ" : "việc tiếp: đính kèm hợp đồng đã ký"}`
        : p.mode === "revise"
          ? `Đã ghi bản sửa ${p.revision.revisionNo} của HĐ ${p.contract.contractNo} — có hiệu lực ngay`
          : `Đã lưu sửa HĐ ${p.contract.contractNo}`) +
        learnedText(learned.count),
      undoTracked(p.contract.id, "", what, () => {
        store.saveContracts(prevC);
        store.saveRevisions(prevR);
        if (scheduled.length) store.saveShipments(prevS);
        if (added.length || scheduleItems.length) store.saveItems(prevI);
        learned.undo();
        undoFiles();
      }),
    );
    setContractForm(null);
    if (p.mode === "create" && p.thenCreateOrder) {
      // "Lưu & lập lệnh sản xuất" (ba-spec 48 LS1): sang Lệnh sản xuất, hộp lập lệnh chọn sẵn HĐ vừa lưu (lịch đã ghi cùng HĐ).
      navigate(`/planning-production?new=1&contract=${encodeURIComponent(p.contract.id)}`);
    } else if (p.mode === "create") {
      // Lịch đã trả lời ngay trong form (R42) ⇒ không bật hộp hỏi lịch sau khi lưu nữa.
      setParam({ contract: p.contract.id, shipment: "" });
    }
    return true;
  };

  /** NV19: ghi lịch xuất hàng = N chuyến còn trống + mục chứng từ bước 5 theo bản hiệu lực (R6). Không cần đủ hồ sơ (R40). */
  const saveSchedule = (contractId: string, rows: ScheduleRow[]): boolean => {
    const gate = scheduleGate(d, contractId);
    if (!gate.ok) {
      notify.error(gate.reason === "has-shipments" ? "Hợp đồng đã có chuyến — ghi thêm chuyến ở hồ sơ hợp đồng." : "Hợp đồng đã đóng / hủy hoặc chưa có bản hiệu lực — chưa tạo lịch được.");
      return false;
    }
    const terms = termsOf(d, contractId);
    const created = shipmentsFromSchedule(rows, { contractId, kind: KIND_FROM_TEXT(terms.containerType), portOfDischarge: terms.portOfDischarge }, newId, new Date().toISOString());
    const prevS = d.shipments;
    const prevI = d.items;
    if (!store.saveShipments([...prevS, ...created])) return false;
    const add = created.flatMap((s) => missingDocumentItems(s.id, terms, prevI, newId));
    if (add.length) store.saveItems([...prevI, ...add]);
    const what = `Tạo lịch xuất hàng: ${created.length} chuyến (${[...new Set(created.map((s) => s.planMonth.split("-").reverse().join("/")))].join(", ")})`;
    track(contractId, "", "create", what);
    notify.saved(
      `Đã tạo lịch xuất hàng: ${created.length} chuyến`,
      undoTracked(contractId, "", what, () => {
        store.saveShipments(prevS);
        store.saveItems(prevI);
      }),
    );
    setScheduleTarget(null);
    return true;
  };
  const openSchedule = (c: ExportContract) => {
    const rev = effectiveRevision(d, c.id);
    const t = termsOf(d, c.id);
    setScheduleTarget({
      contractId: c.id,
      contractNo: c.contractNo,
      rows: scheduleFor(d, c.id, today),
      totalKg: rev ? contractTotals(rev.lines).kg : 0,
      containerCount: rev?.terms.containerCount ?? null,
      deadline: t.latestShipmentDate,
      afterCreate: false,
    });
  };

  /** File thêm của một ô đính kèm (phụ lục, thư bổ sung) ⇒ Hồ sơ đính kèm cấp HĐ. Trả hàm lùi (null = ghi hụt). */
  const saveExtraFiles = (extra: readonly ExportFile[]): (() => void) | null => {
    const prevF = d.files;
    if (!extra.length) return () => {};
    if (!store.saveFiles([...prevF, ...extra])) return null;
    return () => store.saveFiles(prevF);
  };

  const saveExtension = (e: ExportDeadlineExtension, extra: ExportFile[]): boolean => {
    const prev = d.extensions;
    if (!store.saveExtensions([...prev, e])) return false;
    const undoFiles = saveExtraFiles(extra);
    if (!undoFiles) {
      store.saveExtensions(prev);
      return false;
    }
    const what = `Gia hạn giao hàng tới ${e.newDeadline.split("-").reverse().join("/")}${e.note ? ` — ${e.note}` : ""}`;
    track(e.contractId, "", "update", what);
    notify.saved(`Đã gia hạn giao hàng tới ${e.newDeadline.split("-").reverse().join("/")}`, undoTracked(e.contractId, "", what, () => {
        store.saveExtensions(prev);
        undoFiles();
      }));
    setExtensionTarget(null);
    return true;
  };

  const saveShipment = (s: ExportShipment, isNew: boolean, bookingFiles: ExportFile[] = []): boolean => {
    // Ghi chuyến MỚI chỉ sau khi HĐ đã duyệt + đủ hồ sơ (mig 0079) — nút đã ẩn, chặn thêm ở đây.
    const gate = shipmentGate(d, s.contractId, opts);
    if (isNew && !gate.ok) {
      notify.error(`Chưa ghi chuyến được: ${shipmentGateText(gate)}`);
      return false;
    }
    const prevS = d.shipments;
    const prevI = d.items;
    const prevF = d.files;
    const nextS = isNew ? [...prevS, s] : prevS.map((x) => (x.id === s.id ? s : x));
    if (!store.saveShipments(nextS)) return false;
    // File booking chọn trong hộp ghi chuyến (ba-spec 60 NV1) — cùng lần lưu, cùng Hoàn tác.
    if (bookingFiles.length) store.saveFiles([...prevF, ...bookingFiles]);
    if (isNew) {
      const add = missingDocumentItems(s.id, termsOf(d, s.contractId), prevI, newId);
      if (add.length) store.saveItems([...prevI, ...add]);
    }
    const what =
      (isNew ? `Ghi chuyến ${shipName(s)} — tháng ${shipmentMonth(s).split("-").reverse().join("/")}` : `Sửa chuyến ${shipName(s)}`) +
      (bookingFiles.length ? ` · đính ${bookingFiles.length} file booking: ${bookingFiles.map((f) => f.fileName).join(", ")}` : "");
    track(s.contractId, s.id, isNew ? "create" : "update", what);
    notify.saved(
      isNew ? `Đã ghi chuyến${s.lotCode ? ` lô ${s.lotCode}` : ""} — tháng ${shipmentMonth(s).split("-").reverse().join("/")}` : "Đã lưu chuyến",
      undoTracked(s.contractId, s.id, what, () => {
        store.saveShipments(prevS);
        store.saveItems(prevI);
        if (bookingFiles.length) store.saveFiles(prevF);
      }),
    );
    setShipmentTarget(null);
    setParam({ shipment: s.id }, true);
    return true;
  };

  const saveItem = (item: ExportStepItem, newFiles: ExportFile[], isNew: boolean, extract?: InvoiceNameExtract): boolean => {
    const prevI = d.items;
    const prevF = d.files;
    const nextI = isNew ? [...prevI, item] : prevI.map((x) => (x.id === item.id ? item : x));
    if (!store.saveItems(nextI)) return false;
    if (newFiles.length && !store.saveFiles([...prevF, ...newFiles])) {
      store.saveItems(prevI);
      return false;
    }
    // Đọc Commercial Invoice (R27): dòng đã nối mặt hàng ⇒ trích xuất tên hàng của khách còn thiếu.
    const ship = d.shipments.find((x) => x.id === item.shipmentId);
    const customerId = ship ? (d.contracts.find((c) => c.id === ship.contractId)?.customerId ?? "") : "";
    const learned = extract && customerId ? learnNames(customerId, extract.lines, extract.docNo, "Invoice") : { count: 0, undo: () => {} };
    const what = `${isNew ? "Thêm" : "Cập nhật"} ${itemName(item)} của chuyến ${shipName(ship)}${item.number ? ` (số ${item.number})` : ""}${newFiles.length ? ` — đính ${newFiles.length} file` : ""}`;
    track(ship?.contractId ?? "", item.shipmentId, newFiles.length ? "attach" : isNew ? "create" : "update", what);
    notify.saved(
      `Đã lưu${newFiles.length ? ` (kèm ${newFiles.length} file)` : ""}${learnedText(learned.count)}`,
      undoTracked(ship?.contractId ?? "", item.shipmentId, what, () => {
        store.saveItems(prevI);
        store.saveFiles(prevF);
        learned.undo();
      }),
    );
    setItemTarget(null);
    return true;
  };

  /* ---------- Hàng của chuyến · số thực đóng · tải invoice (ba-spec 63) ---------- */

  const goodsLabel = (s: ExportShipment) => [s.lotCode && `Lô ${s.lotCode}`, shipmentKindLabel(s.kind), s.containerNo].filter(Boolean).join(" · ") || "Chuyến chưa có mã lô";

  const openShipmentLines = (s: ExportShipment) => {
    // Σ kiện các chuyến KHÁC theo id dòng HĐ — kể cả chuyến gộp của HĐ chính khác (ba-spec 70: id dòng HĐ không trùng giữa các HĐ).
    const other: Record<string, number> = {};
    for (const l of d.shipmentLines ?? []) {
      if (l.shipmentId === s.id) continue;
      const sh = d.shipments.find((x) => x.id === l.shipmentId);
      if (!sh || sh.status === "cancelled") continue;
      other[l.contractLineId] = (other[l.contractLineId] ?? 0) + (lineUnits(l) ?? 0);
    }
    const group = (c: ExportContract | undefined, id: string) => ({ contractId: id, contractNo: c?.contractNo ?? "", lines: workingRevision(d, id)?.lines ?? [] });
    const groups = shipmentContractIds(d, s).map((id) => group(d.contracts.find((c) => c.id === id), id));
    const addable = addableContracts(d, s, opts).map((c) => group(c, c.id));
    setLinesTarget({ shipment: s, label: goodsLabel(s), groups, addable, lines: shipmentLinesOf(d.shipmentLines ?? [], s.id), otherShipmentUnits: other });
  };

  const saveShipmentLines = (s: ExportShipment, lines: ExportShipmentLine[]): boolean => {
    const prev = d.shipmentLines ?? [];
    if (!store.saveShipmentLines([...prev.filter((l) => l.shipmentId !== s.id), ...lines])) return false;
    const what = `Cập nhật hàng của chuyến ${shipName(s)} — ${lines.length} dòng`;
    track(s.contractId, s.id, "update", what);
    notify.saved(`Đã lưu hàng của chuyến (${lines.length} dòng)`, undoTracked(s.contractId, s.id, what, () => store.saveShipmentLines(prev)));
    setLinesTarget(null);
    return true;
  };

  const openLoadingCount = (s: ExportShipment) =>
    setCountTarget({ shipment: s, label: goodsLabel(s), lines: shipmentLinesOf(d.shipmentLines ?? [], s.id), contractLines: shipmentContractLines(d, s), lineContract: lineContractOf(d, s) });

  /** Đóng cont điền số thực đóng: cập nhật dòng đã có, thêm dòng mới lấy từ dòng HĐ (mig 0098). */
  const saveLoadingCount = (s: ExportShipment, lines: ExportShipmentLine[]): boolean => {
    if (!lines.length) {
      setCountTarget(null);
      return true;
    }
    const prev = d.shipmentLines ?? [];
    const byId = new Map(lines.map((l) => [l.id, l]));
    const added = lines.filter((l) => !prev.some((p) => p.id === l.id));
    if (!store.saveShipmentLines([...prev.map((l) => byId.get(l.id) ?? l), ...added])) return false;
    const what = `Điền số thực đóng của chuyến ${shipName(s)}${added.length ? ` — thêm ${added.length} dòng hàng từ hợp đồng` : ""}`;
    track(s.contractId, s.id, "update", what);
    // Có dòng mới ⇒ không Hoàn tác: người đóng cont không có quyền xóa dòng (policy delete), hoàn tác sẽ không gỡ được.
    notify.saved("Đã lưu số thực đóng", added.length ? undefined : undoTracked(s.contractId, s.id, what, () => store.saveShipmentLines(prev)));
    setCountTarget(null);
    return true;
  };

  const downloadShipmentInvoice = (s: ExportShipment, format: "xlsx" | "pdf" | "docx") => {
    const c = d.contracts.find((x) => x.id === s.contractId);
    if (!c) return;
    const ci = documentItems(d, s.id).find((x) => x.docKind === "commercial-invoice");
    void downloadInvoiceDocument(invoiceDocumentFor(d, s, c, customers.find((x) => x.id === c.customerId), ci, exportOptions, companySellerOf(company.profile)), format, company.profile.logoPath);
  };

  const saveLoadingFiles = (rows: ExportFile[]): boolean => {
    const prev = d.files;
    if (!store.saveFiles([...prev, ...rows])) return false;
    const r0 = rows[0];
    const kindText =
      r0?.step === "booking"
        ? "booking"
        : r0?.step === "loading-count-photos" || r0?.step === "package-weight-photos"
          ? EXTRA_PHOTO_TEXT[r0.step].title.toLowerCase()
          : (SUB_STEP_LABELS[r0?.step as ExportStepItem["step"]] ?? "đóng cont");
    const what = r0 ? `Đính ${rows.length} file ${kindText} cho chuyến ${shipName(d.shipments.find((x) => x.id === r0.shipmentId))}` : "";
    if (r0) track(r0.contractId, r0.shipmentId, "attach", what);
    notify.saved(`Đã đính ${rows.length} file ${r0?.step === "booking" ? "booking" : "đóng cont"}`, undoTracked(r0?.contractId ?? "", r0?.shipmentId ?? "", what, () => store.saveFiles(prev)));
    setLoadingTarget(null);
    return true;
  };

  const removeFile = (f: ExportFile) => {
    const prev = d.files;
    if (!store.saveFiles(prev.filter((x) => x.id !== f.id))) return;
    const what = `Gỡ file ${f.fileName}${f.step === "contract" ? ` (${CONTRACT_ATTACHMENT_LABELS[f.attachmentKind || "other"]})` : f.shipmentId ? ` của chuyến ${shipName(d.shipments.find((x) => x.id === f.shipmentId))}` : ""}`;
    track(f.contractId, f.shipmentId, "detach", what);
    notify.deleted(`Đã gỡ file ${f.fileName}`, undoTracked(f.contractId, f.shipmentId, what, () => store.saveFiles(prev)));
  };

  const deleteItem = (item: ExportStepItem) => {
    const prevI = d.items;
    const prevF = d.files;
    if (!store.saveItems(prevI.filter((x) => x.id !== item.id))) return;
    store.saveFiles(prevF.filter((f) => f.stepItemId !== item.id));
    const cid = contractIdOfShipment(item.shipmentId);
    const what = `Xóa mục ${itemName(item)} của chuyến ${shipName(d.shipments.find((x) => x.id === item.shipmentId))}`;
    track(cid, item.shipmentId, "delete", what);
    notify.deleted(
      "Đã xóa mục chứng từ",
      undoTracked(cid, item.shipmentId, what, () => {
        store.saveItems(prevI);
        store.saveFiles(prevF);
      }),
    );
    setItemTarget(null);
  };

  const savePayment = (p: ExportPayment, extra: ExportFile[]): boolean => {
    const prev = d.payments;
    const next = prev.some((x) => x.id === p.id) ? prev.map((x) => (x.id === p.id ? p : x)) : [...prev, p];
    if (!store.savePayments(next)) return false;
    const undoFiles = saveExtraFiles(extra);
    if (!undoFiles) {
      store.savePayments(prev);
      return false;
    }
    const cid = p.contractId || contractIdOfShipment(p.shipmentId);
    const isEdit = prev.some((x) => x.id === p.id);
    const what = `${isEdit ? "Sửa" : "Ghi"} ${p.kind === "payment" ? `tiền về ${formatNumber(p.amount)} ${p.currency}` : "ngày gửi bộ chứng từ"} ${p.date.split("-").reverse().join("/")}${p.shipmentId ? ` — chuyến ${shipName(d.shipments.find((x) => x.id === p.shipmentId))}` : ""}`;
    track(cid, p.shipmentId, isEdit ? "update" : "create", what);
    notify.saved(p.kind === "payment" ? "Đã ghi tiền về" : "Đã ghi ngày gửi bộ chứng từ", undoTracked(cid, p.shipmentId, what, () => {
        store.savePayments(prev);
        undoFiles();
      }));
    setPaymentTarget(null);
    return true;
  };

  const deletePayment = (p: ExportPayment) => {
    const prev = d.payments;
    if (!store.savePayments(prev.filter((x) => x.id !== p.id))) return;
    const cid = p.contractId || contractIdOfShipment(p.shipmentId);
    const what = `Xóa dòng ${p.kind === "payment" ? `tiền về ${formatNumber(p.amount)} ${p.currency}` : "gửi bộ chứng từ"} ngày ${p.date.split("-").reverse().join("/")}`;
    track(cid, p.shipmentId, "delete", what);
    notify.deleted("Đã xóa dòng", undoTracked(cid, p.shipmentId, what, () => store.savePayments(prev)));
  };

  const updateContract = (c: ExportContract, patch: Partial<ExportContract>, message: string, action: ExportActivity["action"]) => {
    const prev = d.contracts;
    if (!store.saveContracts(prev.map((x) => (x.id === c.id ? { ...x, ...patch } : x)))) return;
    track(c.id, "", action, message);
    notify.saved(message, undoTracked(c.id, "", message, () => store.saveContracts(prev)));
  };

  const doCancelContract = (c: ExportContract, reason: string) => {
    const prevC = d.contracts;
    const prevS = d.shipments;
    const out = cancelContract(d, c.id, reason);
    if (!store.saveContracts(out.contracts)) return;
    store.saveShipments(out.shipments);
    const what = `Hủy HĐ ${c.contractNo} và các chuyến còn mở — ${reason}`;
    track(c.id, "", "cancel", what);
    notify.saved(
      `Đã hủy HĐ ${c.contractNo} và các chuyến còn mở`,
      undoTracked(c.id, "", what, () => {
        store.saveContracts(prevC);
        store.saveShipments(prevS);
      }),
    );
  };

  const doDeleteContract = (c: ExportContract) => {
    const prev = { c: d.contracts, r: d.revisions, a: d.approvals, e: d.extensions, p: d.payments, s: d.shipments, i: d.items };
    // R41: xóa được thì mọi chuyến của HĐ đều còn trống (lịch chưa làm gì) ⇒ xóa luôn chuyến + mục của chúng.
    const blankIds = new Set(prev.s.filter((x) => x.contractId === c.id && isBlankShipment(d, x)).map((x) => x.id));
    if (!store.saveContracts(prev.c.filter((x) => x.id !== c.id))) return;
    if (blankIds.size) {
      store.saveShipments(prev.s.filter((x) => !blankIds.has(x.id)));
      store.saveItems(prev.i.filter((x) => !blankIds.has(x.shipmentId)));
    }
    store.saveRevisions(prev.r.filter((x) => x.contractId !== c.id));
    store.saveApprovals(prev.a.filter((x) => x.contractId !== c.id));
    store.saveExtensions(prev.e.filter((x) => x.contractId !== c.id));
    store.savePayments(prev.p.filter((x) => x.contractId !== c.id));
    setParam({ contract: "", shipment: "" });
    const what = `Xóa HĐ nháp ${c.contractNo}`;
    track(c.id, "", "delete", what);
    notify.deleted(
      `Đã xóa HĐ ${c.contractNo}`,
      undoTracked(c.id, "", what, () => {
        store.saveContracts(prev.c);
        store.saveRevisions(prev.r);
        store.saveApprovals(prev.a);
        store.saveExtensions(prev.e);
        store.savePayments(prev.p);
        if (blankIds.size) {
          store.saveShipments(prev.s);
          store.saveItems(prev.i);
        }
      }),
    );
  };

  const doCancelShipment = (s: ExportShipment, reason: string) => {
    const prev = d.shipments;
    if (!store.saveShipments(prev.map((x) => (x.id === s.id ? { ...x, status: "cancelled" as const, cancelReason: reason } : x)))) return;
    const what = `Hủy chuyến ${shipName(s)} — ${reason}`;
    track(s.contractId, s.id, "cancel", what);
    notify.saved("Đã hủy chuyến", undoTracked(s.contractId, s.id, what, () => store.saveShipments(prev)));
  };

  /** Nối dòng hàng ↔ mặt hàng: ghi thẳng vào bản đang dùng (thông tin nội bộ, không phải bản sửa HĐ). */
  const saveProductMapping = (revisionId: string, map: Record<string, string>): boolean => {
    const prev = d.revisions;
    // Bản mới hơn nhận nối cho dòng cùng tên + size còn trống; nối ở bản cũ không xóa nối dòng mới.
    const next = applyProductMapping(prev, revisionId, map);
    if (!store.saveRevisions(next)) return false;
    const n = Object.values(map).filter(Boolean).length;
    const rev = next.find((r) => r.id === revisionId);
    const c = rev ? d.contracts.find((x) => x.id === rev.contractId) : undefined;
    const learned = rev && c ? learnNames(c.customerId, rev.lines, c.contractNo) : { count: 0, undo: () => {} };
    const what = `Nối mặt hàng cho ${n} dòng hàng của HĐ ${c?.contractNo ?? ""}`;
    track(c?.id ?? "", "", "update", what);
    notify.saved(
      `Đã nối mặt hàng cho ${n} dòng hàng${learnedText(learned.count)}`,
      undoTracked(c?.id ?? "", "", what, () => {
        store.saveRevisions(prev);
        learned.undo();
      }),
    );
    setMappingTarget(null);
    return true;
  };

  const doRestoreShipment = (s: ExportShipment) => {
    const prev = d.shipments;
    if (!store.saveShipments(prev.map((x) => (x.id === s.id ? { ...x, status: "open" as const, cancelReason: "" } : x)))) return;
    const what = `Khôi phục chuyến ${shipName(s)}`;
    track(s.contractId, s.id, "restore", what);
    notify.saved(`Đã khôi phục chuyến${s.lotCode ? ` lô ${s.lotCode}` : ""}`, undoTracked(s.contractId, s.id, what, () => store.saveShipments(prev)));
  };

  const doDeleteShipment = (s: ExportShipment) => {
    const prevS = d.shipments;
    const prevI = d.items;
    const prevL = d.shipmentLines ?? [];
    if (!store.saveShipments(prevS.filter((x) => x.id !== s.id))) return;
    store.saveItems(prevI.filter((x) => x.shipmentId !== s.id));
    if (prevL.some((l) => l.shipmentId === s.id)) store.saveShipmentLines(prevL.filter((l) => l.shipmentId !== s.id));
    setParam({ shipment: "" }, true);
    const what = `Xóa chuyến ${shipName(s)}`;
    track(s.contractId, s.id, "delete", what);
    notify.deleted(
      "Đã xóa chuyến",
      undoTracked(s.contractId, s.id, what, () => {
        store.saveShipments(prevS);
        store.saveItems(prevI);
        if (prevL.some((l) => l.shipmentId === s.id)) store.saveShipmentLines(prevL);
      }),
    );
  };

  /** ba-spec 58: máy chủ đã chạy 0093 thì mới cho ghi "bổ sung sau" (chưa có cột ⇒ gửi lên kẹt hàng chờ). */
  const deferralsAvailable = useExportDeferralsAvailable();
  /** ba-spec 60: máy chủ đã chạy 0094 + có kho file ⇒ đính file booking được. */
  const bookingFilesEnabled = useExportBookingFilesAvailable() && filesAvailable;
  /** ba-spec 71: máy chủ đã chạy 0101 ⇒ ô Đại lý + khối Booking (12 trường) + Thông tin xe vận chuyển. */
  const bookingDetailsEnabled = useExportBookingDetailsAvailable();

  /** Cập nhật booking (ba-spec 71 NV2): ghi chuyến + file booking mới cùng một lần, cùng Hoàn tác. */
  const saveBooking = (s: ExportShipment, files: ExportFile[], readFrom: string): boolean => {
    const prevS = d.shipments;
    const prevF = d.files;
    if (!store.saveShipments(prevS.map((x) => (x.id === s.id ? s : x)))) return false;
    if (files.length) store.saveFiles([...prevF, ...files]);
    const what =
      `Cập nhật booking chuyến ${shipName(s)}` +
      (readFrom ? ` — đọc từ file ${readFrom}` : "") +
      (files.length ? ` · đính ${files.length} file booking: ${files.map((f) => f.fileName).join(", ")}` : "");
    track(s.contractId, s.id, files.length ? "attach" : "update", what);
    notify.saved(
      "Đã lưu thông tin booking",
      undoTracked(s.contractId, s.id, what, () => {
        store.saveShipments(prevS);
        if (files.length) store.saveFiles(prevF);
      }),
    );
    setBookingTarget(null);
    return true;
  };

  /** Thông tin xe vận chuyển (ba-spec 71 NV4). */
  const saveTransport = (s: ExportShipment): boolean => {
    const prevS = d.shipments;
    const had = !!prevS.find((x) => x.id === s.id)?.transport?.haulier;
    if (!store.saveShipments(prevS.map((x) => (x.id === s.id ? s : x)))) return false;
    const what = `${had ? "Sửa" : "Ghi"} thông tin xe vận chuyển chuyến ${shipName(s)} — ${s.transport?.haulier ?? ""}`;
    track(s.contractId, s.id, had ? "update" : "create", what);
    notify.saved("Đã lưu thông tin xe vận chuyển", undoTracked(s.contractId, s.id, what, () => store.saveShipments(prevS)));
    setTransportTarget(null);
    return true;
  };

  /** Ghi "bổ sung sau" cho một loại hồ sơ bắt buộc còn thiếu (R1–R3): mở ghi chuyến, vẫn chặn duyệt cuối. */
  const doDefer = (c: ExportContract, kind: ExportContractAttachmentKind, reason: string) => {
    if (validateDeferral(reason).length) return;
    const prevC = d.contracts;
    const next = withDeferral(c, kind, { reason, by: recordedBy, at: new Date().toISOString() });
    if (!store.saveContracts(prevC.map((x) => (x.id === c.id ? next : x)))) return;
    const what = `Ghi bổ sung sau: ${CONTRACT_ATTACHMENT_LABELS[kind]} của HĐ ${c.contractNo} — ${reason.trim()}`;
    track(c.id, "", "update", what);
    notify.saved(`Đã ghi ${CONTRACT_ATTACHMENT_LABELS[kind]} bổ sung sau — ghi chuyến được, duyệt cuối vẫn cần đủ file`, undoTracked(c.id, "", what, () => store.saveContracts(prevC)));
  };

  /** Bỏ dấu "bổ sung sau" bằng tay (R8) ⇒ loại về Thiếu; có Hoàn tác. */
  const doClearDeferral = (c: ExportContract, kind: ExportContractAttachmentKind) => {
    const prevC = d.contracts;
    if (!store.saveContracts(prevC.map((x) => (x.id === c.id ? withDeferral(c, kind, null) : x)))) return;
    const what = `Bỏ ghi bổ sung sau: ${CONTRACT_ATTACHMENT_LABELS[kind]} của HĐ ${c.contractNo}`;
    track(c.id, "", "update", what);
    notify.saved(`Đã bỏ ghi bổ sung sau — ${CONTRACT_ATTACHMENT_LABELS[kind]} về Thiếu`, undoTracked(c.id, "", what, () => store.saveContracts(prevC)));
  };

  /** Bước Đính kèm (mig 0079): hồ sơ cấp HĐ — đủ loại bắt buộc thì mở bước Ghi chuyến. */
  const saveAttachments = (rows: ExportFile[]): boolean => {
    const prev = d.files;
    const prevC = d.contracts;
    const r0 = rows[0];
    if (!r0 || !store.saveFiles([...prev, ...rows])) return false;
    const c = d.contracts.find((x) => x.id === r0.contractId);
    // Đính file đúng loại đang "bổ sung sau" ⇒ gỡ dấu (R7) — gỡ file sau này thì loại về Thiếu, không về Bổ sung sau.
    const attachedKind = r0.attachmentKind;
    if (c && attachedKind && c.attachmentDeferrals?.[attachedKind]) store.saveContracts(prevC.map((x) => (x.id === c.id ? withDeferral(c, attachedKind, null) : x)));
    const kind = CONTRACT_ATTACHMENT_LABELS[r0.attachmentKind || "other"];
    const what = `Đính kèm ${rows.length} file ${kind} vào HĐ ${c?.contractNo ?? ""}: ${rows.map((r) => r.fileName).join(", ")}`;
    track(r0.contractId, "", "attach", what);
    const missing = missingAttachmentKinds({ ...d, files: [...prev, ...rows] }, r0.contractId, opts);
    notify.saved(
      `Đã đính kèm ${rows.length} file ${kind}${missing.length ? ` — còn thiếu ${missing.map((k) => CONTRACT_ATTACHMENT_LABELS[k]).join(", ")}` : " — đủ hồ sơ, ghi chuyến được"}`,
      undoTracked(r0.contractId, "", what, () => {
        store.saveFiles(prev);
        store.saveContracts(prevC);
      }),
    );
    setAttachTarget(null);
    return true;
  };

  /** Duyệt cuối (mig 0079): đồng ý ⇒ đóng HĐ; trả về ⇒ chỉ ghi lượt duyệt kèm lý do. */
  const saveFinalReview = (a: Parameters<React.ComponentProps<typeof FinalReviewDialog>["onSave"]>[0]): boolean => {
    const prevA = d.approvals;
    const prevC = d.contracts;
    const c = d.contracts.find((x) => x.id === a.contractId);
    if (!c || !store.saveApprovals([...prevA, a])) return false;
    if (a.decision === "approved" && !store.saveContracts(prevC.map((x) => (x.id === c.id ? { ...x, status: "closed" as const, closeReason: a.reason || "Duyệt cuối — xuất đủ trong dung sai" } : x)))) {
      store.saveApprovals(prevA);
      return false;
    }
    const what = `Duyệt cuối HĐ ${c.contractNo}: ${a.decision === "approved" ? "đồng ý — đóng hợp đồng" : "trả về"}${a.reason ? ` — ${a.reason}` : ""}`;
    track(c.id, "", a.decision === "approved" ? "close" : "return", what);
    notify.saved(
      a.decision === "approved" ? `Đã duyệt cuối — đóng HĐ ${c.contractNo}` : `Đã trả về HĐ ${c.contractNo} kèm lý do`,
      undoTracked(c.id, "", what, () => {
        store.saveApprovals(prevA);
        store.saveContracts(prevC);
      }),
    );
    setFinalTarget(null);
    return true;
  };

  const exportExcel = async (p: Period, customerId: string) => {
    const plan = buildPeriodPlan(p, d, customers, today, opts, customerId);
    const xl = buildMonthExcel(plan, d, goodsTypeStore.goodsTypes);
    const { exportAoaToXlsx } = await import("@/lib/reportXlsx"); // nạp động — xlsx không vào chunk chính
    const slug = p.kind === "month" ? p.from.slice(0, 7) : `${p.from}_${p.to}`;
    const who = customerId ? ` — ${customerName(customerId)}` : "";
    exportAoaToXlsx({
      sheetName: `Kế hoạch XK ${slug}`.slice(0, 31),
      aoa: [[`KẾ HOẠCH XUẤT HÀNG ${p.label.toUpperCase()}${who}`], [], xl.header, ...xl.rows.map((r) => r.cells)],
      colWidths: [10, 22, 30, 12, 10, 14, 16, 14, 12, 10, 12, 14, 14, 30],
      fileName: `ke-hoach-xuat-khau-${slug}.xlsx`,
    });
  };

  const exportReportExcel = async (p: ReportPeriod, customerId: string) => {
    const report = buildExportReport(d, p, { customers, customerId, today, evidence: opts });
    const who = customerId ? customerName(customerId) : "";
    const aoa = buildReportExcel(report, { viewPrice: can["view-price"], customerName: who, deviationText });
    const { exportAoaToXlsx } = await import("@/lib/reportXlsx"); // nạp động — xlsx không vào chunk chính
    exportAoaToXlsx({
      sheetName: `Báo cáo XK ${p.key}`.slice(0, 31),
      aoa,
      colWidths: [28, 16, 16, 16, 18, 18, 18, 18, 12],
      fileName: `bao-cao-xuat-khau-${p.key}${customerId ? `-${customerId}` : ""}.xlsx`,
    });
  };

  /* ---------- Hộp của hồ sơ đang mở ---------- */

  const shipmentDefaults = (c: ExportContract): ShipmentTarget["defaults"] => {
    const terms = termsOf(d, c.id);
    const rev = workingRevision(d, c.id);
    const kg = rev ? contractTotals(rev.lines).kg : 0;
    const planned = openShipmentsOf(d, c.id).reduce((t, s) => t + (s.plannedKg ?? 0), 0);
    return {
      planMonth: (terms.latestShipmentDate || today).slice(0, 7),
      portOfDischarge: terms.portOfDischarge,
      kind: KIND_FROM_TEXT(terms.containerType),
      plannedKg: kg > planned ? Math.round((kg - planned) * 100) / 100 : null,
    };
  };

  const dossier = useMemo(() => {
    if (!contract) return null;
    const ships = d.shipments.filter((s) => s.contractId === contract.id);
    const selected = ships.find((s) => s.id === shipmentParam) ?? (ships.length === 1 ? ships[0] : undefined);
    return { ships, selected };
  }, [contract, d.shipments, shipmentParam]);

  // Hướng dẫn từng bước (ba-spec 43): hồ sơ minh họa chọn từ dữ liệu đang có (R4); bước chỉ đổi
  // đường dẫn (replace) — không ghi gì (R1). Thoát thì PageTourProvider trả trang về chỗ cũ (R5).
  // Tour chụp lúc bắt đầu ⇒ đổi đường dẫn qua ref luôn trỏ hàm MỚI NHẤT (hàm cũ giữ tham số
  // cũ, làm rơi kỳ xem ?month= đang chọn).
  const setParamRef = useRef(setParam);
  useEffect(() => {
    setParamRef.current = setParam;
  });
  const tourPick = useMemo(() => pickTourContract(d, opts), [d, filesAvailable]); // eslint-disable-line react-hooks/exhaustive-deps
  const tour = useMemo(
    () =>
      buildExportTour({
        pick: tourPick,
        can: { create: can.create, update: can.update, payments: paymentsCan.view },
        openDossier: (cid, sid) => setParamRef.current({ view: "", contract: cid, shipment: sid }, true),
        backToPlan: () => setParamRef.current({ view: "", list: "", contract: "", shipment: "" }, true),
      }),
    [tourPick, can.create, can.update, paymentsCan.view], // eslint-disable-line react-hooks/exhaustive-deps
  );
  usePageTour(can.view && !store.isLoading ? tour : null);

  /* ---------- Vẽ ---------- */

  if (!can.view && loadingCan.view) {
    return (
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
        <LoadingView
          shipments={d.shipments}
          contracts={d.contracts}
          files={d.files}
          customers={customers}
          today={today}
          canUpload={loadingCan.create && filesAvailable}
          onUpload={setLoadingTarget}
          onPreview={setPreview}
          shipmentLines={store.shipmentLinesAvailable ? (d.shipmentLines ?? []) : []}
          canCount={loadingCan.create}
          onCount={openLoadingCount}
          extraPhotosEnabled={extraPhotosAvailable}
        />
        <LoadingUploadDialog target={loadingTarget} recordedBy={recordedBy} onClose={() => setLoadingTarget(null)} onSave={saveLoadingFiles} />
        <LoadingCountDialog target={countTarget} recordedBy={recordedBy} onClose={() => setCountTarget(null)} onSave={saveLoadingCount} />
        <ExportFilePreview file={preview} onClose={() => setPreview(null)} />
      </div>
    );
  }

  if (!can.view) {
    return <EmptyState icon={FolderLock} title="Chưa được cấp quyền Xuất khẩu" description="Hỏi quản trị viên cấp vai trò Nhân viên / Trưởng / Phó phòng Kế hoạch hoặc quyền xem module Xuất khẩu." />;
  }

  const currency = contract ? termsOf(d, contract.id).currency || "USD" : "USD";

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
      {!contract && (
        <>
          <h1 className="sr-only">Xuất khẩu</h1>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs value={view} onValueChange={(v) => setParam({ view: v === "contracts" || v === "reports" || v === "catalog" ? v : "", list: "" }, true)}>
              <TabsList data-tour="export-tabs" className="grid w-full grid-cols-2 items-stretch group-data-horizontal/tabs:h-auto sm:inline-flex sm:w-fit sm:max-w-full sm:flex-wrap">
                <TabsTrigger value="month" className={TAB_TRIGGER} title="Lịch xuất hàng: chuyến theo tháng / tuần / khoảng ngày, xếp theo ngày xuất (đóng cont, chưa có thì ETD) — chọn một ngày để xem chuyến gom theo khách.">
                  <CalendarDays className="mr-2 h-4 w-4" aria-hidden />
                  Lịch xuất hàng
                </TabsTrigger>
                <TabsTrigger value="contracts" className={TAB_TRIGGER} title="Danh sách mọi hợp đồng, lọc theo trạng thái.">
                  <FileText className="mr-2 h-4 w-4" aria-hidden />
                  Hợp đồng
                </TabsTrigger>
                <TabsTrigger value="reports" className={TAB_TRIGGER} title="Báo cáo theo tháng · quý · năm: sản lượng, giá trị, tiền về, đúng hạn, hồ sơ còn kẹt, hợp đồng cần chú ý.">
                  <BarChart3 className="mr-2 h-4 w-4" aria-hidden />
                  Báo cáo
                </TabsTrigger>
                <TabsTrigger value="catalog" className={TAB_TRIGGER} title="Danh sách chọn của Xuất khẩu: cảng xếp, cảng đích, loại container, tiền tệ, loại chứng từ, loại hàng — thêm, sửa, xóa mục.">
                  <ListChecks className="mr-2 h-4 w-4" aria-hidden />
                  Danh mục
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {can.create && (
              <Button data-tour="create-contract" onClick={() => setContractForm({ mode: "create" })} title="Lập hồ sơ hợp đồng xuất khẩu mới: khách, số HĐ, điều khoản, dòng hàng. Lập xong đính kèm hợp đồng đã ký rồi ghi chuyến.">
                <FilePlus2 className="mr-2 h-4 w-4" aria-hidden />
                Lập hợp đồng
              </Button>
            )}
          </div>
          {!filesAvailable && (
            <p role="status" className="rounded-lg bg-warning-surface px-4 py-2 text-sm">
              Đang chạy không nối máy chủ: chưa tải / mở được file — ghi chú và số chứng từ được tính thay file.
            </p>
          )}
          {view === "catalog" ? (
            <ExportCatalogView list={catalogList} onListChange={(v) => setParam({ list: v === "loading-port" ? "" : v }, true)} />
          ) : store.isLoading ? (
            <TableSkeleton />
          ) : view === "month" ? (
            <MonthView
              data={d}
              customers={customers}
              period={period}
              today={today}
              filesAvailable={filesAvailable}
              canExport={can.export}
              onPeriodChange={setPeriod}
              onOpenContract={(cid, sid) => setParam({ contract: cid, shipment: sid ?? "" })}
              onExportExcel={(p, cid) => void exportExcel(p, cid)}
            />
          ) : view === "reports" ? (
            <ReportView
              data={d}
              customers={customers}
              period={reportPeriod}
              today={today}
              filesAvailable={filesAvailable}
              canSeePrice={can["view-price"]}
              canExport={can.export}
              onPeriodChange={setReportPeriod}
              onOpenContract={(cid) => setParam({ contract: cid, shipment: "" })}
              onExportExcel={(p, cid) => void exportReportExcel(p, cid)}
            />
          ) : (
            <ContractListView data={d} customers={customers} filesAvailable={filesAvailable} canSeePrice={can["view-price"]} today={today} onOpen={(cid) => setParam({ contract: cid, shipment: "" })} />
          )}
        </>
      )}

      {contractId && !contract && !store.isLoading && (
        <EmptyState icon={FolderLock} title="Không thấy hợp đồng này" description="Hợp đồng đã bị xóa, hoặc tài khoản không được xem." />
      )}

      {contract && dossier && (
        <ContractDossier
          data={d}
          contract={contract}
          customerName={customerName(contract.customerId)}
          can={{
            create: can.create,
            update: can.update,
            delete: can.delete,
            approve: can.approve,
            viewPrice: can["view-price"],
            paymentsWrite: paymentsCan.create || paymentsCan.update,
            paymentsDelete: paymentsCan.delete,
          }}
          products={products}
          today={today}
          onEditPayment={(p) => setPaymentTarget({ contractId: contract.id, shipmentId: "", label: `HĐ ${contract.contractNo}`, kind: p.kind, currency, existing: p })}
          onDeletePayment={deletePayment}
          onOpenCustomerNames={() => setNamesFor({ id: contract.customerId, name: customerName(contract.customerId) })}
          onMapProducts={() => {
            const r = workingRevision(d, contract.id);
            if (r) setMappingTarget({ contractNo: contract.contractNo, customerId: contract.customerId, revision: r });
          }}
          filesAvailable={filesAvailable}
          selectedShipmentId={dossier.selected?.id ?? ""}
          // Xóa HĐ nháp kéo theo xóa lượt duyệt của nó — RLS 0079 chỉ cho người có quyền Duyệt xóa lượt duyệt.
          canDelete={canDeleteContract(d, contract.id).ok && (can.approve || !d.approvals.some((a) => a.contractId === contract.id))}
          canCancel={canCancel(d, contract.id).ok}
          onBack={() => setParam({ contract: "", shipment: "" })}
          onSelectShipment={(sid) => setParam({ shipment: sid }, true)}
          onEditContract={() => {
            const r = workingRevision(d, contract.id);
            if (r) setContractForm({ mode: "edit", contract, revision: r });
          }}
          onRevise={() => {
            const base = effectiveRevision(d, contract.id);
            if (base) setContractForm({ mode: "revise", contract, base, revisionNo: nextRevisionNo(d, contract.id) });
          }}
          onExtend={() => setExtensionTarget({ contractId: contract.id, contractNo: contract.contractNo, currentDeadline: termsOf(d, contract.id).latestShipmentDate })}
          onAddShipment={() => setShipmentTarget({ contractId: contract.id, contractNo: contract.contractNo, defaults: shipmentDefaults(contract) })}
          onSchedule={() => openSchedule(contract)}
          onCancelContract={() =>
            setReasonTarget({
              title: `Hủy HĐ ${contract.contractNo}?`,
              description: "Hợp đồng và mọi chuyến còn mở chuyển Đã hủy. Dữ liệu, file giữ nguyên.",
              confirmLabel: "Hủy hợp đồng",
              destructive: true,
              onConfirm: (reason) => doCancelContract(contract, reason),
            })
          }
          onAttach={() => setAttachTarget({ contractId: contract.id, contractNo: contract.contractNo, missing: missingAttachmentKinds(d, contract.id, opts) })}
          onRemoveAttachment={removeFile}
          deferralsAvailable={deferralsAvailable}
          onDeferAttachment={(kind) =>
            setReasonTarget({
              title: `Chưa có ${CONTRACT_ATTACHMENT_LABELS[kind]} — bổ sung sau`,
              description:
                "Ghi chuyến và làm các bước tiếp được ngay; bước 1 của chuyến ghi chờ hồ sơ. Duyệt cuối, đóng hợp đồng vẫn cần đính đủ file. Đính file đúng loại thì dấu tự gỡ.",
              confirmLabel: "Ghi bổ sung sau",
              onConfirm: (reason) => doDefer(contract, kind, reason),
            })
          }
          onClearDeferral={(kind) => doClearDeferral(contract, kind)}
          onFinalReview={() => {
            const eff = effectiveRevision(d, contract.id);
            const g = finalReviewGate(d, contract.id, opts);
            if (!eff || !g.ok) return;
            const cl = contractClosure(d, contract.id, opts);
            const kg = `Thực xuất ${formatNumber(cl.actuals.kg)} / ${formatNumber(cl.target.kg)} kg (${deviationText(cl.kgDeviationPct)})`;
            setFinalTarget({
              contractId: contract.id,
              contractNo: contract.contractNo,
              revisionId: eff.id,
              needsReason: g.needsReason,
              summary: g.needsReason
                ? `${kg}. Hợp đồng CHƯA xuất đủ trong dung sai hoặc còn chuyến chưa đủ hồ sơ — đồng ý là đóng sớm, phải ghi lý do.`
                : `${kg} — trong dung sai, mọi chuyến đã đủ hồ sơ.`,
            });
          }}
          onReopen={() => updateContract(contract, { status: "open", closeReason: "" }, `Mở lại HĐ ${contract.contractNo} — phải duyệt cuối lại`, "reopen")}
          onDeleteContract={() => setDeletingContract(contract)}
          onDeposit={() => setPaymentTarget({ contractId: contract.id, shipmentId: "", label: `HĐ ${contract.contractNo}`, kind: "payment", currency })}
          onPreview={setPreview}
        >
          {dossier.selected && (
            <ShipmentPanel
              data={d}
              shipment={dossier.selected}
              contract={contract}
              currency={currency}
              can={{
                update: can.update,
                delete: can.delete,
                view: can.view,
                viewPrice: can["view-price"],
                loadingCreate: loadingCan.create,
                paymentsView: paymentsCan.view,
                paymentsWrite: paymentsCan.create || paymentsCan.update,
                paymentsDelete: paymentsCan.delete,
              }}
              filesAvailable={filesAvailable}
              canDeleteShipment={canDeleteShipment(d, dossier.selected.id)}
              onEdit={() => dossier.selected && setShipmentTarget({ contractId: contract.id, contractNo: contract.contractNo, existing: dossier.selected, defaults: shipmentDefaults(contract) })}
              onCancel={() => {
                const s = dossier.selected;
                if (!s) return;
                setReasonTarget({
                  title: "Hủy chuyến này?",
                  description: "Chuyến chuyển Đã hủy, không tính vào kỳ xem và không tính đủ hồ sơ của hợp đồng. Dữ liệu, file giữ nguyên; khôi phục lại được.",
                  confirmLabel: "Hủy chuyến",
                  destructive: true,
                  onConfirm: (reason) => doCancelShipment(s, reason),
                });
              }}
              onRestore={() => dossier.selected && doRestoreShipment(dossier.selected)}
              onDelete={() => dossier.selected && setDeletingShipment(dossier.selected)}
              onOpenItem={setItemTarget}
              onUploadLoading={setLoadingTarget}
              bookingFilesEnabled={bookingFilesEnabled}
              bookingDetailsEnabled={bookingDetailsEnabled}
              onBooking={setBookingTarget}
              onTransport={setTransportTarget}
              goodsEnabled={store.shipmentLinesAvailable}
              extraPhotosEnabled={extraPhotosAvailable}
              onEditLines={() => dossier.selected && openShipmentLines(dossier.selected)}
              onLoadingCount={() => dossier.selected && openLoadingCount(dossier.selected)}
              onDownloadInvoice={(format) => dossier.selected && downloadShipmentInvoice(dossier.selected, format)}
              onPayment={setPaymentTarget}
              onDeletePayment={deletePayment}
              onPreview={setPreview}
              onRemoveFile={removeFile}
            />
          )}
        </ContractDossier>
      )}

      <ContractFormDialog
        target={contractForm}
        documentKindSource={store.documentKindSource}
        contracts={d.contracts}
        customers={customers}
        setCustomers={setCustomers}
        products={products}
        setProducts={setProducts}
        customerNames={nameStore.names}
        data={d}
        recordedBy={recordedBy}
        canSeePrice={can["view-price"]}
        canCreateOrder={orderCan.create}
        onClose={() => setContractForm(null)}
        onSave={saveContract}
      />
      <FinalReviewDialog target={finalTarget} approverName={approverName} onClose={() => setFinalTarget(null)} onSave={saveFinalReview} />
      <AttachmentDialog target={attachTarget} recordedBy={recordedBy} onClose={() => setAttachTarget(null)} onSave={saveAttachments} />
      <ExtensionDialog target={extensionTarget} recordedBy={recordedBy} onClose={() => setExtensionTarget(null)} onSave={saveExtension} />
      <ShipmentFormDialog
        target={shipmentTarget}
        onClose={() => setShipmentTarget(null)}
        onSave={saveShipment}
        recordedBy={recordedBy}
        bookingFilesEnabled={bookingFilesEnabled}
        bookingDetailsEnabled={bookingDetailsEnabled}
      />
      <BookingDialog target={bookingTarget} recordedBy={recordedBy} filesEnabled={bookingFilesEnabled} onClose={() => setBookingTarget(null)} onSave={saveBooking} />
      <TransportDialog target={transportTarget} onClose={() => setTransportTarget(null)} onSave={saveTransport} />
      <ScheduleDialog target={scheduleTarget} onClose={() => setScheduleTarget(null)} onSave={saveSchedule} />
      <StepItemDialog
        target={itemTarget}
        documentKindSource={store.documentKindSource}
        data={d}
        filesAvailable={filesAvailable}
        recordedBy={recordedBy}
        canDelete={can.update}
        invoiceCatalog={{ products, setProducts, customerNames: nameStore.names }}
        canViewPrice={can["view-price"]}
        customers={customers}
        invoiceComposeEnabled={store.shipmentLinesAvailable && can["view-price"]}
        onClose={() => setItemTarget(null)}
        onSave={saveItem}
        onRemoveFile={removeFile}
        onDeleteItem={deleteItem}
        onPreview={setPreview}
      />
      <LoadingUploadDialog target={loadingTarget} recordedBy={recordedBy} onClose={() => setLoadingTarget(null)} onSave={saveLoadingFiles} />
      <ShipmentLinesDialog target={linesTarget} onClose={() => setLinesTarget(null)} onSave={saveShipmentLines} />
      <LoadingCountDialog target={countTarget} recordedBy={recordedBy} onClose={() => setCountTarget(null)} onSave={saveLoadingCount} />
      <PaymentDialog target={paymentTarget} recordedBy={recordedBy} onClose={() => setPaymentTarget(null)} onSave={savePayment} />
      <ReasonDialog target={reasonTarget} onClose={() => setReasonTarget(null)} />
      <ProductMappingDialog target={mappingTarget} data={d} products={products} setProducts={setProducts} customerNames={nameStore.names} onClose={() => setMappingTarget(null)} onSave={saveProductMapping} />
      <CustomerProductNamesDialog
        customer={namesFor}
        names={nameStore.names}
        setNames={nameStore.setNames}
        products={products}
        setProducts={setProducts}
        isAvailable={nameStore.isAvailable}
        canWrite={customerCan.create || customerCan.update}
        canDelete={customerCan.delete}
        extractSource={d}
        onClose={() => setNamesFor(null)}
      />
      <ExportFilePreview file={preview} onClose={() => setPreview(null)} />

      <ConfirmDelete
        open={!!deletingContract}
        onOpenChange={(o) => !o && setDeletingContract(null)}
        title="Xóa hợp đồng này?"
        confirmLabel="Xóa hợp đồng"
        recordDescription={
          deletingContract
            ? `HĐ ${deletingContract.contractNo} — ${customerName(deletingContract.customerId)}${(() => {
                const n = d.shipments.filter((x) => x.contractId === deletingContract.id).length;
                return n ? ` · kèm ${n} chuyến dự kiến còn trống của lịch xuất hàng` : "";
              })()}`
            : ""
        }
        onConfirm={() => {
          if (deletingContract) doDeleteContract(deletingContract);
          setDeletingContract(null);
        }}
      />
      <ConfirmDelete
        open={!!deletingShipment}
        onOpenChange={(o) => !o && setDeletingShipment(null)}
        title="Xóa chuyến này?"
        confirmLabel="Xóa chuyến"
        recordDescription={deletingShipment ? [deletingShipment.lotCode && `Lô ${deletingShipment.lotCode}`, deletingShipment.bookingNo].filter(Boolean).join(" · ") || "Chuyến chưa có mã lô" : ""}
        onConfirm={() => {
          if (deletingShipment) doDeleteShipment(deletingShipment);
          setDeletingShipment(null);
        }}
      />
    </div>
  );
}
