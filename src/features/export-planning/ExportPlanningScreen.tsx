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
import { useSearchParams } from "react-router-dom";
import { Button, ConfirmDelete, EmptyState, TableSkeleton, Tabs, TabsList, TabsTrigger, notify, todayIso } from "@/design-system";
import { useCustomers, useProducts, useUserProfiles } from "@/lib/catalogRepo";
import { useAuth } from "@/lib/auth";
import { useCan } from "@/features/shared/PermissionProvider";
import { newId } from "@/lib/store";
import {
  buildMonthExcel,
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
  isShipmentClosed,
  latestRevision,
  missingDocumentItems,
  nextRevisionNo,
  openShipmentsOf,
  pendingRevision,
  shipmentMonth,
  termsOf,
  workingRevision,
} from "@/lib/exportPlanning";
import { hasExportStorage } from "@/lib/exportFileStorage";
import type { ExportContract, ExportFile, ExportPayment, ExportShipment, ExportShipmentKind, ExportStepItem } from "@/types";
import { CalendarDays, FilePlus2, FileText, FolderLock, Route } from "lucide-react";
import { ContractDossier } from "./ContractDossier";
import { ContractFormDialog, type ContractFormTarget, type ContractSavePayload } from "./ContractFormDialog";
import { ContractListView } from "./ContractListView";
import { LoadingView } from "./LoadingView";
import { MonthView } from "./MonthView";
import { ProductMappingDialog, type ProductMappingTarget } from "./ProductMappingDialog";
import { ExportFilePreview, type PreviewTarget } from "./parts";
import {
  ApprovalDialog,
  ExtensionDialog,
  PaymentDialog,
  ReasonDialog,
  type ApprovalTarget,
  type ExtensionTarget,
  type PaymentTarget,
  type ReasonTarget,
} from "./RecordDialogs";
import { ShipmentPanel } from "./ShipmentPanel";
import {
  LoadingUploadDialog,
  ShipmentFormDialog,
  StepItemDialog,
  type LoadingUploadTarget,
  type ShipmentTarget,
  type StepItemTarget,
} from "./ShipmentDialogs";
import { useExportData } from "./useExportData";
import { buildExportTour, pickTourContract } from "./exportTour";
import { usePageTour, usePageTourControl } from "@/features/shared/PageTourProvider";

/** Hai tab luôn nằm cạnh nhau, chữ được xuống dòng: điện thoại 360 px / chữ 130 % không tràn, không đè nút Lập hợp đồng. */
const TAB_TRIGGER = "h-auto min-h-9 whitespace-normal px-3 max-sm:[&>svg]:hidden sm:px-4";

const KIND_FROM_TEXT = (t: string): ExportShipmentKind => {
  const x = t.toUpperCase();
  if (x.includes("HC")) return "40HC-RF";
  if (x.includes("20")) return "20RF";
  return "40RF";
};

export default function ExportPlanningScreen() {
  const today = todayIso();
  const { profile } = useAuth();
  const recordedBy = profile?.fullName || profile?.username || "Máy này";
  const can = useCan("export-plans");
  const loadingCan = useCan("export-plans.loading");
  const paymentsCan = useCan("export-plans.payments");
  const store = useExportData();
  const d = store.data;
  const [customers, setCustomers] = useCustomers();
  const [products, setProducts] = useProducts();
  const [profiles] = useUserProfiles();
  /** Người ký duyệt = tài khoản có vai trò Giám đốc / Phó giám đốc (không gõ tự do — XK audit 2026-10-20). */
  const approvers = profiles
    .filter((p) => p.roles.includes("director") || p.roles.includes("vice-director"))
    .map((p) => ({ name: p.fullName || p.username, role: p.roles.includes("director") ? ("director" as const) : ("vice-director" as const) }))
    .filter((a) => a.name.trim());
  const [params, setParams] = useSearchParams();
  const filesAvailable = hasExportStorage;
  const opts = { filesAvailable };

  const view = params.get("view") === "contracts" ? "contracts" : "month";
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
  const [approvalTarget, setApprovalTarget] = useState<ApprovalTarget | null>(null);
  const [extensionTarget, setExtensionTarget] = useState<ExtensionTarget | null>(null);
  const [shipmentTarget, setShipmentTarget] = useState<ShipmentTarget | null>(null);
  const [itemTarget, setItemTarget] = useState<StepItemTarget | null>(null);
  const [loadingTarget, setLoadingTarget] = useState<LoadingUploadTarget | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(null);
  const [mappingTarget, setMappingTarget] = useState<ProductMappingTarget | null>(null);
  const [reasonTarget, setReasonTarget] = useState<ReasonTarget | null>(null);
  const [deletingContract, setDeletingContract] = useState<ExportContract | null>(null);
  const [deletingShipment, setDeletingShipment] = useState<ExportShipment | null>(null);
  const [preview, setPreview] = useState<PreviewTarget | null>(null);

  const customerName = (id: string) => customers.find((c) => c.id === id)?.name || "(khách chưa rõ)";
  const contract = contractId ? d.contracts.find((c) => c.id === contractId) : undefined;

  /* ---------- Ghi (mọi lượt ghi có Hoàn tác — luật 6 / 13) ---------- */

  /** Bước 5: chuyến còn mở chưa khép của HĐ nhận thêm mục chứng từ mà bản hiệu lực mới yêu cầu (R6). */
  const syncDocumentItems = (contractIdToSync: string, items: readonly ExportStepItem[], data = d) => {
    const terms = termsOf(data, contractIdToSync);
    const add = openShipmentsOf(data, contractIdToSync)
      .filter((s) => !isShipmentClosed(data, s, opts))
      .flatMap((s) => missingDocumentItems(s.id, terms, items, newId));
    return add;
  };

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
    notify.saved(
      p.mode === "create" ? `Đã lập HĐ ${p.contract.contractNo} — chờ ghi kết quả duyệt` : p.mode === "revise" ? `Đã ghi bản sửa ${p.revision.revisionNo} của HĐ ${p.contract.contractNo}` : `Đã lưu bản chờ duyệt của HĐ ${p.contract.contractNo}`,
      () => {
        store.saveContracts(prevC);
        store.saveRevisions(prevR);
      },
    );
    setContractForm(null);
    if (p.mode === "create") setParam({ contract: p.contract.id, shipment: "" });
    return true;
  };

  const saveApproval = (a: Parameters<React.ComponentProps<typeof ApprovalDialog>["onSave"]>[0]): boolean => {
    const prevA = d.approvals;
    const prevC = d.contracts;
    const prevS = d.shipments;
    const prevI = d.items;
    const nextA = [...prevA, a];
    if (!store.saveApprovals(nextA)) return false;
    const after = { ...d, approvals: nextA };
    const c = d.contracts.find((x) => x.id === a.contractId);
    let message = `Đã ghi kết quả duyệt HĐ ${c?.contractNo ?? ""}`;
    if (a.decision === "approved" && effectiveRevision(after, a.contractId)?.id === a.revisionId) {
      const add = syncDocumentItems(a.contractId, prevI, after);
      if (add.length) store.saveItems([...prevI, ...add]);
      message = `HĐ ${c?.contractNo ?? ""}: BGĐ đồng ý — bản này có hiệu lực`;
    }
    if (a.decision === "rejected" && !effectiveRevision(after, a.contractId)) {
      // Bản đầu bị từ chối ⇒ hủy HĐ + các chuyến còn mở (AC-8). Bản sửa bị từ chối ⇒ chỉ bỏ bản sửa.
      const out = cancelContract(d, a.contractId, a.reason);
      store.saveContracts(out.contracts);
      store.saveShipments(out.shipments);
      message = `HĐ ${c?.contractNo ?? ""} bị từ chối — đã hủy hợp đồng và các chuyến còn mở`;
    }
    notify.saved(message, () => {
      store.saveApprovals(prevA);
      store.saveContracts(prevC);
      store.saveShipments(prevS);
      store.saveItems(prevI);
    });
    setApprovalTarget(null);
    return true;
  };

  const saveExtension = (e: Parameters<React.ComponentProps<typeof ExtensionDialog>["onSave"]>[0]): boolean => {
    const prev = d.extensions;
    if (!store.saveExtensions([...prev, e])) return false;
    notify.saved(`Đã gia hạn giao hàng tới ${e.newDeadline.split("-").reverse().join("/")}`, () => store.saveExtensions(prev));
    setExtensionTarget(null);
    return true;
  };

  const saveShipment = (s: ExportShipment, isNew: boolean): boolean => {
    const prevS = d.shipments;
    const prevI = d.items;
    const nextS = isNew ? [...prevS, s] : prevS.map((x) => (x.id === s.id ? s : x));
    if (!store.saveShipments(nextS)) return false;
    if (isNew) {
      const add = missingDocumentItems(s.id, termsOf(d, s.contractId), prevI, newId);
      if (add.length) store.saveItems([...prevI, ...add]);
    }
    notify.saved(isNew ? `Đã lên chuyến${s.lotCode ? ` lô ${s.lotCode}` : ""} — tháng ${shipmentMonth(s).split("-").reverse().join("/")}` : "Đã lưu chuyến", () => {
      store.saveShipments(prevS);
      store.saveItems(prevI);
    });
    setShipmentTarget(null);
    setParam({ shipment: s.id }, true);
    return true;
  };

  const saveItem = (item: ExportStepItem, newFiles: ExportFile[], isNew: boolean): boolean => {
    const prevI = d.items;
    const prevF = d.files;
    const nextI = isNew ? [...prevI, item] : prevI.map((x) => (x.id === item.id ? item : x));
    if (!store.saveItems(nextI)) return false;
    if (newFiles.length && !store.saveFiles([...prevF, ...newFiles])) {
      store.saveItems(prevI);
      return false;
    }
    notify.saved(`Đã lưu${newFiles.length ? ` (kèm ${newFiles.length} file)` : ""}`, () => {
      store.saveItems(prevI);
      store.saveFiles(prevF);
    });
    setItemTarget(null);
    return true;
  };

  const saveLoadingFiles = (rows: ExportFile[]): boolean => {
    const prev = d.files;
    if (!store.saveFiles([...prev, ...rows])) return false;
    notify.saved(`Đã đính ${rows.length} file đóng cont`, () => store.saveFiles(prev));
    setLoadingTarget(null);
    return true;
  };

  const removeFile = (f: ExportFile) => {
    const prev = d.files;
    if (!store.saveFiles(prev.filter((x) => x.id !== f.id))) return;
    notify.deleted(`Đã gỡ file ${f.fileName}`, () => store.saveFiles(prev));
  };

  const deleteItem = (item: ExportStepItem) => {
    const prevI = d.items;
    const prevF = d.files;
    if (!store.saveItems(prevI.filter((x) => x.id !== item.id))) return;
    store.saveFiles(prevF.filter((f) => f.stepItemId !== item.id));
    notify.deleted("Đã xóa mục chứng từ", () => {
      store.saveItems(prevI);
      store.saveFiles(prevF);
    });
    setItemTarget(null);
  };

  const savePayment = (p: ExportPayment): boolean => {
    const prev = d.payments;
    const next = prev.some((x) => x.id === p.id) ? prev.map((x) => (x.id === p.id ? p : x)) : [...prev, p];
    if (!store.savePayments(next)) return false;
    notify.saved(p.kind === "payment" ? "Đã ghi tiền về" : "Đã ghi ngày gửi bộ chứng từ", () => store.savePayments(prev));
    setPaymentTarget(null);
    return true;
  };

  const deletePayment = (p: ExportPayment) => {
    const prev = d.payments;
    if (!store.savePayments(prev.filter((x) => x.id !== p.id))) return;
    notify.deleted("Đã xóa dòng", () => store.savePayments(prev));
  };

  const updateContract = (c: ExportContract, patch: Partial<ExportContract>, message: string) => {
    const prev = d.contracts;
    if (!store.saveContracts(prev.map((x) => (x.id === c.id ? { ...x, ...patch } : x)))) return;
    notify.saved(message, () => store.saveContracts(prev));
  };

  const doCancelContract = (c: ExportContract, reason: string) => {
    const prevC = d.contracts;
    const prevS = d.shipments;
    const out = cancelContract(d, c.id, reason);
    if (!store.saveContracts(out.contracts)) return;
    store.saveShipments(out.shipments);
    notify.saved(`Đã hủy HĐ ${c.contractNo} và các chuyến còn mở`, () => {
      store.saveContracts(prevC);
      store.saveShipments(prevS);
    });
  };

  const doDeleteContract = (c: ExportContract) => {
    const prev = { c: d.contracts, r: d.revisions, a: d.approvals, e: d.extensions, p: d.payments };
    if (!store.saveContracts(prev.c.filter((x) => x.id !== c.id))) return;
    store.saveRevisions(prev.r.filter((x) => x.contractId !== c.id));
    store.saveApprovals(prev.a.filter((x) => x.contractId !== c.id));
    store.saveExtensions(prev.e.filter((x) => x.contractId !== c.id));
    store.savePayments(prev.p.filter((x) => x.contractId !== c.id));
    setParam({ contract: "", shipment: "" });
    notify.deleted(`Đã xóa HĐ ${c.contractNo}`, () => {
      store.saveContracts(prev.c);
      store.saveRevisions(prev.r);
      store.saveApprovals(prev.a);
      store.saveExtensions(prev.e);
      store.savePayments(prev.p);
    });
  };

  const doCancelShipment = (s: ExportShipment, reason: string) => {
    const prev = d.shipments;
    if (!store.saveShipments(prev.map((x) => (x.id === s.id ? { ...x, status: "cancelled" as const, cancelReason: reason } : x)))) return;
    notify.saved("Đã hủy chuyến", () => store.saveShipments(prev));
  };

  /** Nối dòng hàng ↔ mặt hàng: ghi thẳng vào bản đang dùng (thông tin nội bộ, không phải bản sửa HĐ). */
  const saveProductMapping = (revisionId: string, map: Record<string, string>): boolean => {
    const prev = d.revisions;
    const next = prev.map((r) => (r.id === revisionId ? { ...r, lines: r.lines.map((l) => ({ ...l, productId: map[l.id] || undefined })) } : r));
    if (!store.saveRevisions(next)) return false;
    const n = Object.values(map).filter(Boolean).length;
    notify.saved(`Đã nối mặt hàng cho ${n} dòng hàng`, () => store.saveRevisions(prev));
    setMappingTarget(null);
    return true;
  };

  const doRestoreShipment = (s: ExportShipment) => {
    const prev = d.shipments;
    if (!store.saveShipments(prev.map((x) => (x.id === s.id ? { ...x, status: "open" as const, cancelReason: "" } : x)))) return;
    notify.saved(`Đã khôi phục chuyến${s.lotCode ? ` lô ${s.lotCode}` : ""}`, () => store.saveShipments(prev));
  };

  const doDeleteShipment = (s: ExportShipment) => {
    const prevS = d.shipments;
    const prevI = d.items;
    if (!store.saveShipments(prevS.filter((x) => x.id !== s.id))) return;
    store.saveItems(prevI.filter((x) => x.shipmentId !== s.id));
    setParam({ shipment: "" }, true);
    notify.deleted("Đã xóa chuyến", () => {
      store.saveShipments(prevS);
      store.saveItems(prevI);
    });
  };

  const exportExcel = async (p: Period, customerId: string) => {
    const plan = buildPeriodPlan(p, d, customers, today, opts, customerId);
    const xl = buildMonthExcel(plan, d);
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
        backToPlan: () => setParamRef.current({ view: "", contract: "", shipment: "" }, true),
      }),
    [tourPick, can.create, can.update, paymentsCan.view], // eslint-disable-line react-hooks/exhaustive-deps
  );
  usePageTour(can.view && !store.isLoading ? tour : null);
  const pageTour = usePageTourControl();

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
        />
        <LoadingUploadDialog target={loadingTarget} recordedBy={recordedBy} onClose={() => setLoadingTarget(null)} onSave={saveLoadingFiles} />
        <ExportFilePreview file={preview} onClose={() => setPreview(null)} />
      </div>
    );
  }

  if (!can.view) {
    return <EmptyState icon={FolderLock} title="Chưa được cấp quyền Xuất khẩu" description="Hỏi quản trị viên cấp vai trò Nhân viên Kế hoạch hoặc quyền xem module Xuất khẩu." />;
  }

  const currency = contract ? termsOf(d, contract.id).currency || "USD" : "USD";

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
      {!contract && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid min-w-0 flex-1 basis-64 grid-cols-[minmax(0,1fr)] gap-3">
              <p className="max-w-3xl text-muted-foreground">Mỗi chuyến container của từng khách đang ở bước nào và còn thiếu gì, tới khi hợp đồng xuất đủ.</p>
              <Tabs value={view} onValueChange={(v) => setParam({ view: v === "contracts" ? "contracts" : "" }, true)}>
                <TabsList data-tour="export-tabs" className="grid w-full grid-cols-2 items-stretch group-data-horizontal/tabs:h-auto sm:inline-flex sm:w-fit">
                  <TabsTrigger value="month" className={TAB_TRIGGER} title="Lịch xuất hàng: chuyến theo tháng / tuần / khoảng ngày đóng cont, gom theo khách.">
                    <CalendarDays className="mr-2 h-4 w-4" aria-hidden />
                    Lịch xuất hàng
                  </TabsTrigger>
                  <TabsTrigger value="contracts" className={TAB_TRIGGER} title="Danh sách mọi hợp đồng, lọc theo trạng thái.">
                    <FileText className="mr-2 h-4 w-4" aria-hidden />
                    Hợp đồng
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {pageTour.available && (
                <Button
                  variant="outline"
                  data-tour-start
                  onClick={pageTour.start}
                  title="Mở hướng dẫn thao tác: lần lượt chỉ từng khu vực trên trang theo thứ tự công việc. Hướng dẫn không thay đổi dữ liệu."
                >
                  <Route className="mr-2 h-4 w-4" aria-hidden />
                  Hướng dẫn thao tác
                </Button>
              )}
              {can.create && (
                <Button data-tour="create-contract" onClick={() => setContractForm({ mode: "create" })} title="Lập hồ sơ hợp đồng xuất khẩu mới: khách, số HĐ, điều khoản, dòng hàng, file ký.">
                  <FilePlus2 className="mr-2 h-4 w-4" aria-hidden />
                  Lập hợp đồng
                </Button>
              )}
            </div>
          </div>
          {!filesAvailable && (
            <p role="status" className="rounded-lg bg-warning-surface px-4 py-2 text-sm">
              Đang chạy không nối máy chủ: chưa tải / mở được file — ghi chú và số chứng từ được tính thay file.
            </p>
          )}
          {store.isLoading ? (
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
          can={{ create: can.create, update: can.update, delete: can.delete, viewPrice: can["view-price"], paymentsWrite: paymentsCan.create || paymentsCan.update, paymentsDelete: paymentsCan.delete }}
          products={products}
          today={today}
          onEditPayment={(p) => setPaymentTarget({ contractId: contract.id, shipmentId: "", label: `HĐ ${contract.contractNo}`, kind: p.kind, currency, existing: p })}
          onDeletePayment={deletePayment}
          onMapProducts={() => {
            const r = workingRevision(d, contract.id);
            if (r) setMappingTarget({ contractNo: contract.contractNo, customerId: contract.customerId, revision: r });
          }}
          filesAvailable={filesAvailable}
          selectedShipmentId={dossier.selected?.id ?? ""}
          canDelete={canDeleteContract(d, contract.id).ok}
          canCancel={canCancel(d, contract.id).ok}
          onBack={() => setParam({ contract: "", shipment: "" })}
          onSelectShipment={(sid) => setParam({ shipment: sid }, true)}
          onEditPending={() => {
            const r = pendingRevision(d, contract.id) ?? latestRevision(d, contract.id);
            if (r) setContractForm({ mode: "edit", contract, revision: r });
          }}
          onRevise={() => {
            const base = effectiveRevision(d, contract.id);
            if (base) setContractForm({ mode: "revise", contract, base, revisionNo: nextRevisionNo(d, contract.id) });
          }}
          onApprove={() => {
            const r = pendingRevision(d, contract.id) ?? (!effectiveRevision(d, contract.id) ? latestRevision(d, contract.id) : null);
            if (r) setApprovalTarget({ contractId: contract.id, contractNo: contract.contractNo, revisionId: r.id, revisionNo: r.revisionNo });
          }}
          onExtend={() => setExtensionTarget({ contractId: contract.id, contractNo: contract.contractNo, currentDeadline: termsOf(d, contract.id).latestShipmentDate })}
          onAddShipment={() => setShipmentTarget({ contractId: contract.id, contractNo: contract.contractNo, defaults: shipmentDefaults(contract) })}
          onCancelContract={() =>
            setReasonTarget({
              title: `Hủy HĐ ${contract.contractNo}?`,
              description: "Hợp đồng và mọi chuyến còn mở chuyển Đã hủy. Dữ liệu, file giữ nguyên.",
              confirmLabel: "Hủy hợp đồng",
              destructive: true,
              onConfirm: (reason) => doCancelContract(contract, reason),
            })
          }
          onCloseManually={() =>
            setReasonTarget({
              title: `Chốt HĐ ${contract.contractNo}?`,
              description: "Dùng khi số xuất ngoài dung sai hoặc chuyến chưa đủ hồ sơ mà khách đã xác nhận (phụ kiện giảm lượng, gia hạn…). Ghi rõ lý do.",
              confirmLabel: "Chốt hợp đồng",
              onConfirm: (reason) => updateContract(contract, { status: "closed", closeReason: reason }, `Đã chốt HĐ ${contract.contractNo}`),
            })
          }
          onReopen={() => updateContract(contract, { status: "open", closeReason: "" }, `Đã mở lại HĐ ${contract.contractNo}`)}
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
        contracts={d.contracts}
        customers={customers}
        setCustomers={setCustomers}
        products={products}
        setProducts={setProducts}
        data={d}
        recordedBy={recordedBy}
        canSeePrice={can["view-price"]}
        onClose={() => setContractForm(null)}
        onSave={saveContract}
      />
      <ApprovalDialog target={approvalTarget} approvers={approvers} recordedBy={recordedBy} onClose={() => setApprovalTarget(null)} onSave={saveApproval} />
      <ExtensionDialog target={extensionTarget} recordedBy={recordedBy} onClose={() => setExtensionTarget(null)} onSave={saveExtension} />
      <ShipmentFormDialog target={shipmentTarget} onClose={() => setShipmentTarget(null)} onSave={saveShipment} />
      <StepItemDialog
        target={itemTarget}
        data={d}
        filesAvailable={filesAvailable}
        recordedBy={recordedBy}
        canDelete={can.update}
        onClose={() => setItemTarget(null)}
        onSave={saveItem}
        onRemoveFile={removeFile}
        onDeleteItem={deleteItem}
        onPreview={setPreview}
      />
      <LoadingUploadDialog target={loadingTarget} recordedBy={recordedBy} onClose={() => setLoadingTarget(null)} onSave={saveLoadingFiles} />
      <PaymentDialog target={paymentTarget} recordedBy={recordedBy} onClose={() => setPaymentTarget(null)} onSave={savePayment} />
      <ReasonDialog target={reasonTarget} onClose={() => setReasonTarget(null)} />
      <ProductMappingDialog target={mappingTarget} data={d} products={products} setProducts={setProducts} onClose={() => setMappingTarget(null)} onSave={saveProductMapping} />
      <ExportFilePreview file={preview} onClose={() => setPreview(null)} />

      <ConfirmDelete
        open={!!deletingContract}
        onOpenChange={(o) => !o && setDeletingContract(null)}
        title="Xóa hợp đồng này?"
        confirmLabel="Xóa hợp đồng"
        recordDescription={deletingContract ? `HĐ ${deletingContract.contractNo} — ${customerName(deletingContract.customerId)}` : ""}
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
