// ============================================================
// Tên file cũ: src/features/imports/NhapNguyenLieu.tsx
// Tên tiếng Việt: Màn hình Nhập Nguyên Liệu ngày
// Description: Material Import Management Screen
// ============================================================
import { useEffect, useMemo, useState } from "react";
import type {
  DailyLock,
  ImportShipment,
  MaterialImportItem,
  Workshop,
  Category,
} from "@/types";
import { isBackdatedImport, calculateImportAmount } from "@/types";
import { newId } from "@/lib/store";
import { uid } from "@/lib/db";
import {
  useDailyLocks,
  useImportShipments,
  useSuppliers,
  useMaterialTypes,
  useMaterialImports,
  useScraps,
} from "@/lib/catalogRepo";
import {
  RequiredLegend,
  Button,
  ChoiceGroup,
  Combobox,
  ConfirmDelete,
  DateField,
  DateRangeField,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  TableSkeleton,
  ErrorSummary,
  Field,
  Input,
  Tag,
  RecordTable,
  StatCardGrid,
  notify,
  toneByName,
  type RecordTableColumn,
  type FieldError,
  type ComboboxOption,
} from "@/design-system";
import { kg, num, todayISO, formatDateVN } from "@/lib/format";
import { formatMaterialLotLabel } from "@/lib/lotTraceability";
import { useAuth } from "@/lib/auth";
import { DailyTaskReminder, LotLabelPrint, BlankDailyImportSlip } from "@/features/shared";
import { useQuickCatalogEdit } from "@/features/catalog/QuickCatalogEdit";
import { ImportSlipOcr } from "./ImportSlipOcr";
import { coOcr, type OcrCatalog } from "@/lib/ocr";
import { hasImageStorage, getPhotoUrl } from "@/lib/storage";
import { KY_OPT, getViewPeriodRange, type ViewPeriod } from "@/lib/periodUtils";
import {
  CalendarRange,
  Camera,
  ChevronDown,
  FileText,
  Lock,
  LockOpen,
  Pencil,
  QrCode,
  Plus,
  Printer,
  Save,
  Scale,
  SlidersHorizontal,
  TriangleAlert,
  Truck,
  Warehouse,
  X,
  Replace,
} from "lucide-react";
import DailyImportInvoice from "@/features/imports/DailyImportInvoice";
import ImportReport from "@/features/imports/ImportReport";
import { cn } from "@/lib/utils";

import { BulkTypeChangeDialog } from "./BulkTypeChange";

import { ImportLinesTable } from "./ImportLinesTable";
import { DayShipmentList, StepCard, ChoiceCard } from "./ImportSteps";
import { DailyScrapSection } from "./DailyScrapSection";
import {
  DEFAULT_CATEGORY,
  WORKSHOPS,
  getFrequentSuppliers,
  getSupplierVehicles,
  getSupplierLineTemplates,
  applyNewSupplierTemplate,
  getSkippedSuggestedLines,
  normalizePlate,
  createEmptyImportLine,
  importLineHasData,
  isLineComplete,
  groupShipments,
  validateShipmentHeader,
  generateLotCode,
  type ShipmentHeader,
  type ImportLine,
  type ShipmentGroup,
} from "./importHelpers";

export default function MaterialImportScreen() {
  // Người đang đăng nhập → gắn làm "người ghi" của chuyến khi lưu.
  const { profile } = useAuth();
  const operator = profile?.fullName || profile?.username || "";
  // kỳ xem sổ: ngày/tuần/tháng/năm/khoảng tự chọn
  const [rows, persist, { trangThai: status }] = useMaterialImports();
  const isLoading = status === "dang-tai" && rows.length === 0;
  const [shipments, persistShipments] = useImportShipments();
  const [locks, persistLocks, { trangThai: lockStatus }] = useDailyLocks();
  const [scraps, persistScraps] = useScraps();

  const [ky, setKy] = useState<ViewPeriod>("ngay");
  const [date, setDate] = useState(todayISO()); // ngày neo cho ngày/tuần/tháng/năm
  const [fromDate, setFromDate] = useState(todayISO());
  const [toDate, setToDate] = useState(todayISO());
  const [workshop, setWorkshop] = useState<Workshop | "Tất cả">("Đông");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [materialTypeFilter, setMaterialTypeFilter] = useState("");
  const [priceFilter, setPriceFilter] = useState<"tat-ca" | "thieu-gia">("tat-ca");
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
  const [isTypeChangeOpen, setIsTypeChangeOpen] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [isPrintingBlank, setIsPrintingBlank] = useState(false);

  const [suppliers, setSuppliers] = useSuppliers();
  const [materialTypes, setMaterialTypes] = useMaterialTypes();

  /* Ghi chuyến: đầu chuyến ở trên, cả BẢNG loại hàng điền một lượt rồi lưu. */
  const [session, setSession] = useState<ShipmentHeader | null>(null);
  /** Ba chế độ phẳng: "nhap" = form ghi (mặc định); "so" = sổ ngày; "bao-cao" = báo cáo tổng hợp. */
  const [mode, setMode] = useState<"nhap" | "so" | "bao-cao">("nhap");
  const [ocrMo, setOcrMo] = useState(false); // modal nhận diện ảnh phiếu (OCR)
  const [labelShipment, setLabelShipment] = useState<ImportShipment | null>(null);
  const [sessionShipmentId, setSessionShipmentId] = useState<string | null>(null);
  const [tableRows, setTableRows] = useState<ImportLine[]>([]);
  /** Loài dùng gần nhất trong phiên — làm mặc định cho chuyến/dòng mới thay vì
   *  luôn nhảy về "Bạch tuộc" (sai ở xưởng Khô/Cá). */
  const [lastCategory, setLastCategory] = useState<Category>(DEFAULT_CATEGORY);
  const [sessionErrors, setSessionErrors] = useState<FieldError[]>([]);
  // Khối "Xe và ghi chú" (tài xế/biển số) mở sẵn — hầu hết chuyến đều có.
  const [isExtrasOpen, setIsExtrasOpen] = useState(true);
  /** Luồng theo bước: bước đang ÉP mở (bấm "Đổi" / đang gõ tay xe). null = tự suy theo dữ liệu. */
  const [openPanel, setOpenPanel] = useState<"dai-ly" | "xe" | null>(null);
  /** Người dùng chủ động bỏ qua bước xe (chuyến không ghi xe) ⇒ bước thu lại dù ô trống. */
  const [skipTruck, setSkipTruck] = useState(false);
  /** Mở hai ô gõ tay biển số / tài xế (xe chưa từng chở cho đại lý này). */
  const [isManualVehicle, setIsManualVehicle] = useState(false);
  /** Tách "ngày ghi sổ" khỏi "ngày hàng về" (ghi bù). Mặc định MỘT ô ngày cho ca thường. */
  const [splitDates, setSplitDates] = useState(false);

  /* Đang sửa một chuyến đã ghi: id các dòng của chuyến đó (null = đang tạo mới).
     Dùng id-set thay vì chỉ chuyenId để sửa được CẢ dữ liệu cũ (không có chuyenId). */
  const [editRowIds, setEditRowIds] = useState<string[] | null>(null);

  /* Chốt ngày */
  const [isConfirmingLock, setIsConfirmingLock] = useState(false);
  /** Nhắc "còn dòng nhập chưa lưu" trước khi mở hộp chốt. */
  const [showSaveReminder, setShowSaveReminder] = useState(false);
  const [lockNote, setLockNote] = useState("");
  const [isConfirmingReopen, setIsConfirmingReopen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [lockErrors, setLockErrors] = useState<FieldError[]>([]);

  /** [từ, đến] của kỳ đang xem — mọi lọc/tổng tính theo khoảng này. */
  const [effectiveFrom, effectiveTo] = getViewPeriodRange(ky, date, fromDate, toDate);
  /** Kỳ chỉ gồm đúng một ngày ⇒ mới có nghĩa để chốt / phế liệu ngày. */
  const isSingleDay = effectiveFrom === effectiveTo;

  const view = useMemo(
    () =>
      rows
        .filter((r) => {
          const matchesDate =
            r.deliveryDate >= effectiveFrom && r.deliveryDate <= effectiveTo;
          const matchesWorkshop = workshop === "Tất cả" || r.workshop === workshop;
          const matchesSupplier = !supplierFilter || r.supplierName === supplierFilter;
          const matchesType = !materialTypeFilter || r.materialTypeName === materialTypeFilter;
          const matchesPrice = priceFilter === "tat-ca" || r.unitPrice == null;
          return matchesDate && matchesWorkshop && matchesSupplier && matchesType && matchesPrice;
        })
        .sort(
          (a, b) =>
            a.deliveryDate.localeCompare(b.deliveryDate) ||
            a.id.localeCompare(b.id)
        ),
    [rows, effectiveFrom, effectiveTo, workshop, supplierFilter, materialTypeFilter, priceFilter]
  );

  const nhomView = useMemo(() => groupShipments(view, shipments), [view, shipments]);

  /** Ngày / xưởng mặc định khi ghi chuyến mới — theo bộ lọc đang xem. */
  const postingDate = isSingleDay ? effectiveFrom : effectiveTo;
  const recordWorkshop: Workshop = workshop === "Tất cả" ? "Đông" : workshop;

  const rangeDescription = isSingleDay
    ? formatDateVN(effectiveFrom)
    : `${formatDateVN(effectiveFrom)} – ${formatDateVN(effectiveTo)}`;

  const total = useMemo(
    () => view.reduce((s, r) => s + (r.quantityKg || 0), 0),
    [view]
  );
  const totalAmount = useMemo(
    () => view.reduce((s, r) => s + calculateImportAmount(r), 0),
    [view]
  );
  const missingPriceCount = useMemo(
    () => view.filter((r) => r.unitPrice == null).length,
    [view]
  );

  /** Số bộ lọc phụ đang bật (đại lý / loại NL / đơn giá) — hiện lên nút gom. */
  const extraFilterCount =
    (supplierFilter ? 1 : 0) + (materialTypeFilter ? 1 : 0) + (priceFilter !== "tat-ca" ? 1 : 0);

  /* ---- Chốt ngày ---- */

  /** Bản ghi chốt của một (ngày + xưởng) — kể cả bản đã mở lại. */
  const lockRecordOf = (n: string, x: Workshop): DailyLock | undefined =>
    locks.find((c) => c.lockDate === n && c.workshop === x);

  const isLocked = (n: string, x: Workshop): boolean =>
    Boolean(lockRecordOf(n, x)?.isLocked);

  /* Nhắc daily-task: hôm nay (xưởng đang chọn) đã chốt nhập chưa. */
  const isImportLockedToday = isLocked(todayISO(), recordWorkshop);

  /** Tổng kg thực tế của một (ngày + xưởng), không phụ thuộc bộ lọc đang xem. */
  const dayWorkshopTotal = (n: string, x: Workshop): number =>
    rows
      .filter((r) => r.deliveryDate === n && r.workshop === x)
      .reduce((s, r) => s + (r.quantityKg || 0), 0);

  /* Thanh chốt chỉ có nghĩa khi đang xem MỘT ngày của MỘT xưởng. */
  const isSingleDayWorkshop = isSingleDay && workshop !== "Tất cả";
  const viewedWorkshop = workshop === "Tất cả" ? "Đông" : workshop;
  const currentLock = isSingleDayWorkshop
    ? lockRecordOf(effectiveFrom, viewedWorkshop)
    : undefined;
  const isDayLocked = Boolean(currentLock?.isLocked);
  const actualTotal = isSingleDayWorkshop
    ? dayWorkshopTotal(effectiveFrom, viewedWorkshop)
    : 0;
  const postLockDiff =
    currentLock?.isLocked && actualTotal !== currentLock.totalKgAtLock
      ? actualTotal - currentLock.totalKgAtLock
      : 0;

  /* ---- Danh mục: chọn sẵn, thiếu thì tạo ngay tại chỗ ----
     Lưu theo TÊN (không phải id) để dữ liệu cũ trong localStorage vẫn đọc được. */

  /** Dòng phụ của đại lý: gộp các thông tin nhận diện, ngăn bởi dấu gạch ngang.
   *  Vừa hiện dưới tên trong dropdown, vừa nằm trong chuỗi tìm kiếm của Combobox. */
  const describeSupplier = (d: (typeof suppliers)[number]): string | undefined =>
    [d.code, d.billingName, d.phone, d.address]
      .map((s) => s?.trim())
      .filter(Boolean)
      .join(" – ") || undefined;

  const supplierOptions: ComboboxOption[] = suppliers.map((d) => ({
    value: d.shortName,
    label: d.code ? `${d.code} · ${d.shortName}` : d.shortName,
    subLabel: describeSupplier(d),
  }));

  /** Sửa nhanh đại lý / loại NL tại chỗ — sổ nhập nối theo TÊN nên ô tên khoá. */
  const supplierEditor = useQuickCatalogEdit("daiLy", suppliers, setSuppliers, { theo: "ten" });
  const materialTypeEditor = useQuickCatalogEdit("loaiNL", materialTypes, setMaterialTypes, { theo: "ten" });

  const addSupplier = (ten: string) => {
    // Nhãn có mã số ("1 · Hồng Phú") nên ô chọn không tự nhận ra tên trùng ⇒ tự dò.
    const co = suppliers.find((d) => d.shortName.trim().toLowerCase() === ten.trim().toLowerCase());
    if (co) return co.shortName;
    setSuppliers([
      ...suppliers,
      {
        id: uid(),
        code: "",
        shortName: ten,
        billingName: "",
        address: "",
        nationalId: "",
        issuedDate: "",
        issuedPlace: "",
        phone: "",
        note: "",
      },
    ]);
    notify.saved(`Đã thêm đại lý "${ten}" vào danh mục`);
    return ten;
  };

  /** Tất cả loại NL — dùng cho BỘ LỌC (xem theo loại, không ràng loài). */
  const materialTypeOptions: ComboboxOption[] = materialTypes.map((l) => ({
    value: l.name,
    label: l.name,
    subLabel: l.category || undefined,
  }));

  /** Loại NL lọc theo loài: mục chưa gán loài (loai rỗng) hiện cho mọi loài;
      mục đã gán chỉ hiện đúng loài đang chọn. Chọn loài trước, loại NL sau. */
  const materialTypeOptionsByCategory = (category: string): ComboboxOption[] =>
    materialTypes
      .filter((l) => !l.category || l.category === category)
      .map((l) => ({
        value: l.name,
        label: l.name,
        phu: l.category || undefined,
      }));

  const addMaterialType = (ten: string, category = "") => {
    // Trùng tên (không phân hoa thường — kể cả loại đang gán loài khác nên không
    // hiện trong ô) ⇒ dùng lại bản có sẵn, không đẻ bản trùng.
    const co = materialTypes.find((l) => l.name.trim().toLowerCase() === ten.trim().toLowerCase());
    if (co) return co.name;
    setMaterialTypes([...materialTypes, { id: uid(), name: ten, category, note: "" }]);
    notify.saved(`Đã thêm loại nguyên liệu "${ten}" vào danh mục`);
    return ten;
  };

  /* ---- Ghi chuyến ---- */

  /** Bảng loại hàng MỞ ĐẦU cho một chuyến mới: đại lý đã có lịch sử ⇒ điền sẵn
   *  loại + đơn giá gần nhất (chỉ còn gõ kg); chưa có ⇒ một dòng trống. */
  const newTableRows = (dl: string, workshop: Workshop, cat: Category): ImportLine[] => {
    const templateRows = getSupplierLineTemplates(rows, dl, workshop);
    return templateRows.length ? templateRows : [createEmptyImportLine(cat)];
  };

  /** Đưa con trỏ vào ô kg đầu tiên — bước kế tiếp tự nhiên sau khi chọn đại lý/xe. */
  // Focus NGAY trong cú chạm (không hẹn giờ): iPhone chỉ bật bàn phím khi focus nằm
  // trong thao tác của người dùng. Bảng bước ③ luôn có sẵn trong DOM nên làm được.
  // Ưu tiên ô kg còn TRỐNG đầu tiên; cuộn vào giữa màn sau khi bước trên thu lại.
  const focusFirstKgCell = () => {
    const items = [
      ...document.querySelectorAll<HTMLInputElement>(
        '[data-grid-nav="import-lines"] [data-navcol="kg"]'
      ),
    ];
    const o = items.find((x) => !x.value.trim()) ?? items[0];
    if (!o) return;
    o.focus({ preventScroll: true });
    o.select();
    requestAnimationFrame(() => o.scrollIntoView({ block: "center", behavior: "smooth" }));
  };

  /** Enter ở ô kg CUỐI ⇒ nhảy tới nút lưu (Enter lần nữa là lưu) — gõ liền mạch bằng bàn phím. */
  const focusSaveButton = () => document.getElementById("nut-luu-chuyen")?.focus();

  /** Đưa luồng bước về đầu. `daCoXe`: mở chuyến cũ để sửa ⇒ coi bước xe đã xong. */
  const resetSteps = (hasVehicle: boolean) => {
    setOpenPanel(null);
    setSkipTruck(hasVehicle);
    setIsManualVehicle(false);
    setSplitDates(false);
  };

  const openAdd = () => {
    setSession({
      deliveryDate: postingDate,
      postingDate: todayISO(),
      backdateReason: "",
      workshop: recordWorkshop,
      // Đang lọc theo một đại lý → điền sẵn đại lý đó, khỏi chọn lại.
      supplierName: supplierFilter,
      driverName: "",
      licensePlate: "",
      note: "",
      ssccCode: "",
      scanPath: "",
    });
    setSessionShipmentId(null);
    setEditRowIds(null);
    setTableRows(newTableRows(supplierFilter, recordWorkshop, lastCategory));
    setSessionErrors([]);
    // Ghi chú / SSCC / mã lô ít dùng → thu sẵn; tài xế + biển số đã đưa ra ngoài.
    setIsExtrasOpen(false);
    resetSteps(false);
  };

  // Form-first: vào "Ghi nhập" mà chưa có phiếu → tự mở phiếu trống (không modal).
  useEffect(() => {
    if (mode === "nhap" && session === null && !isLoading) openAdd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, session, isLoading]);

  // Trong "Ghi nhập", ngày+xưởng của PHIẾU là ngữ cảnh → đồng bộ về bộ lọc để
  // sổ/phế liệu/chốt/tổng ngày bám đúng ngày đang ghi.
  // Chỉ bám ngày + xưởng (không bám cả phiếu) để gõ các ô khác không kéo bộ lọc.
  const sessionDate = session?.deliveryDate;
  const sessionWorkshop = session?.workshop;
  useEffect(() => {
    if (mode === "nhap" && sessionDate !== undefined && sessionWorkshop !== undefined) {
      setKy("ngay");
      setDate(sessionDate);
      setWorkshop(sessionWorkshop);
    }
  }, [mode, sessionDate, sessionWorkshop]);

  /** Mở lại một chuyến đã ghi để sửa — dùng CHUNG dialog với ghi chuyến mới. */
  const openShipmentEdit = (n: ShipmentGroup) => {
    setSession({
      deliveryDate: n.deliveryDate,
      postingDate: n.postingDate || n.deliveryDate,
      backdateReason: n.backdateReason,
      workshop: n.workshop,
      supplierName: n.supplierName,
      driverName: n.driverName,
      licensePlate: n.licensePlate,
      note: n.note,
      ssccCode: n.shipment?.ssccCode ?? "",
      scanPath: n.shipment?.scanPath ?? "",
    });
    setSessionShipmentId(n.shipment?.id ?? null);
    setEditRowIds(n.dong.map((r) => r.id));
    // Nạp mọi dòng đã ghi vào bảng (giữ id để cập nhật đúng bản ghi). Muốn thêm
    // loại mới thì bấm nút "Thêm loại hàng" — không tự sinh dòng.
    setTableRows(
      n.dong.map((r) => ({
        key: r.id,
        id: r.id,
        category: r.category,
        materialTypeName: r.materialTypeName,
        quantityKg: r.quantityKg,
        unitPrice: r.unitPrice,
      }))
    );
    setSessionErrors([]);
    setIsExtrasOpen(true);
    resetSteps(true);
    setMode("nhap"); // sửa chuyến mở trong form inline (chế độ Ghi nhập)
  };

  const setSessionField = <K extends keyof ShipmentHeader>(k: K, v: ShipmentHeader[K]) =>
    setSession((p) => (p ? { ...p, [k]: v } : p));

  /** Đổi ngày ghi sổ: LUÔN kéo ngày hàng về nhảy theo (chủ động). Muốn hàng về
   *  ngày khác (ghi bù) thì sửa tay ô "Ngày hàng về xưởng" sau đó. */
  const changePostingDate = (v: string) =>
    setSession((p) => (p ? { ...p, postingDate: v, deliveryDate: v } : p));

  /** Chỉnh tay ngày hàng về ⇒ khác ngày ghi sổ (ghi bù). Đổi lại ngày ghi sổ sau
   *  đó thì ngày hàng về vẫn nhảy theo như thường. */
  const changeDeliveryDate = (v: string) => setSessionField("deliveryDate", v);

  /** Chọn ĐẠI LÝ kéo theo cả chuyến: bảng loại hàng điền sẵn theo lượt giao gần
   *  nhất của đại lý (loại + giá), xe cũ hiện thành nút gợi ý. KHÔNG đè khi người
   *  dùng đã gõ số vào bảng, và không đụng bảng khi đang sửa chuyến đã ghi. */
  const pickSupplier = (v: string) => {
    if (!session) return;
    const isSupplierChanged = v !== session.supplierName;
    setSessionField("supplierName", v);
    if (v) setOpenPanel(null); // chọn xong ⇒ bước ① thu lại, bước ② (xe) tự mở
    // Chạm lại đúng đại lý đang chọn (mở "Đổi" rồi thôi) ⇒ không đụng xe / bảng.
    if (isEditingShipment || !v || !isSupplierChanged) return;
    // Đổi đại lý ⇒ xe của đại lý cũ không còn đúng (chỉ xóa khi đang ghi chuyến MỚI).
    setSession((p) => (p ? { ...p, driverName: "", licensePlate: "" } : p));
    setSkipTruck(false);
    setIsManualVehicle(false);
    // Bảng dựng lại theo đại lý MỚI: giữ kg đã gõ, KHÔNG giữ giá điền sẵn của đại lý cũ.
    const templateRows = getSupplierLineTemplates(rows, v, session.workshop);
    setTableRows((items) => applyNewSupplierTemplate(items, templateRows));
  };

  /** Đổi xưởng: mẫu loại hàng tính theo (đại lý + xưởng) ⇒ dựng lại nếu bảng chưa có số. */
  const pickWorkshop = (v: Workshop) => {
    if (!session) return;
    setSessionField("workshop", v);
    if (isEditingShipment || v === session.workshop) return;
    const templateRows = getSupplierLineTemplates(rows, session.supplierName, v);
    setTableRows((items) => applyNewSupplierTemplate(items, templateRows));
  };

  /** Chạm BIỂN SỐ: điền biển + tài xế gần nhất của xe đó (ca thường: một chạm là xong)
   *  rồi nhảy xuống ô kg. Khác tài xế thì bấm "Đổi" → chạm tên tài xế. */
  const pickPlate = (x: { licensePlate: string; driverName: string }) => {
    setSession((p) =>
      p
        ? { ...p, licensePlate: x.licensePlate, driverName: x.driverName || p.driverName }
        : p
    );
    setOpenPanel(null);
    setIsManualVehicle(false);
    focusFirstKgCell();
  };

  /** Chạm TÀI XẾ: đã có biển số ⇒ xong bước xe; chưa có ⇒ ở lại chờ chọn biển số. */
  const pickDriver = (ten: string) => {
    setSessionField("driverName", ten);
    if (!session?.licensePlate.trim()) {
      setOpenPanel("xe");
      return;
    }
    setOpenPanel(null);
    setIsManualVehicle(false);
    focusFirstKgCell();
  };

  /** Gõ tay xong xe ⇒ thu bước ②, nhảy xuống ô kg. */
  const finishTruckStep = () => {
    setOpenPanel(null);
    focusFirstKgCell();
  };

  /** Chuyến không ghi xe ⇒ xóa 2 ô, thu bước ②, nhảy xuống ô kg. */
  const skipTruckStep = () => {
    setSession((p) => (p ? { ...p, licensePlate: "", driverName: "" } : p));
    setSkipTruck(true);
    setIsManualVehicle(false);
    setOpenPanel(null);
    focusFirstKgCell();
  };

  /** Đang sửa chuyến đã ghi (khác với tạo chuyến mới). */
  const isEditingShipment = editRowIds !== null;
  /** Gợi ý theo sổ đã ghi: đại lý hay giao cho xưởng đang chọn + xe của đại lý đang chọn. */
  // Chỉ gợi ý đại lý CÒN trong danh mục — tên cũ đã đổi/xóa thì ô chọn không hiện được.
  const dlHayGiao = useMemo(
    () =>
      session
        ? getFrequentSuppliers(rows, session.workshop, 8)
            .filter((ten) => suppliers.some((d) => d.shortName === ten))
            .slice(0, 4)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, suppliers, session?.workshop]
  );
  const truckSuggestions = useMemo(
    () => getSupplierVehicles(rows, session?.supplierName ?? ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, session?.supplierName]
  );
  /** Ngày giao gần nhất của từng đại lý — dòng phụ trên thẻ chọn. */
  const lastDateBySupplier = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows)
      if ((m.get(r.supplierName) ?? "") < r.deliveryDate) m.set(r.supplierName, r.deliveryDate);
    return m;
  }, [rows]);
  /** Các chuyến đã ghi của ĐÚNG ngày + xưởng trên phiếu (không phụ thuộc bộ lọc sổ). */
  const sessionDayGroups = useMemo(
    () =>
      session
        ? groupShipments(
            rows.filter(
              (r) => r.deliveryDate === session.deliveryDate && r.workshop === session.workshop
            ),
            shipments
          )
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, shipments, session?.deliveryDate, session?.workshop]
  );
  const hasVehicleInfo = !!session && !!(session.licensePlate.trim() || session.driverName.trim());
  const hasVehicleHints = truckSuggestions.plates.length > 0 || truckSuggestions.drivers.length > 0;
  /** Bước mở/thu SUY từ dữ liệu, `dangMo` chỉ để ép mở khi bấm "Đổi" / đang gõ tay. */
  const isSupplierStepOpen = openPanel === "dai-ly" || !session?.supplierName;
  const isVehicleStepOpen = !isSupplierStepOpen && (openPanel === "xe" || (!hasVehicleInfo && !skipTruck));
  /** Hai ô ngày chỉ hiện khi ghi bù (hoặc người dùng chủ động tách). */
  const twoDates =
    !!session && (splitDates || session.postingDate !== session.deliveryDate);
  /** Mã lô của phiếu đang mở: chuyến đã ghi giữ mã cũ, chuyến mới xem trước mã sẽ sinh. */
  const sessionLotCode = !session
    ? ""
    : sessionShipmentId
      ? (() => {
          const c = shipments.find((x) => x.id === sessionShipmentId);
          return c ? formatMaterialLotLabel(c) : "— (dữ liệu cũ)";
        })()
      : generateLotCode(session.deliveryDate, session.workshop, shipments);
  /** Các dòng trong bảng đủ để lưu (có loại + số lượng). */
  const validRows = tableRows.filter(isLineComplete);
  const shipmentTotal = validRows.reduce((s, d) => s + d.quantityKg, 0);
  const shipmentAmount = validRows.reduce(
    (s, d) => s + d.quantityKg * (d.unitPrice ?? 0),
    0
  );
  /** Dòng điền sẵn chưa gõ kg — sẽ bị bỏ qua khi lưu, phải báo rõ trên thanh lưu. */
  const skipped = getSkippedSuggestedLines(tableRows);
  /** Số dòng ĐÃ LƯU đang mở trong bảng — cho câu "sửa đầu chuyến áp cho N dòng". */
  const savedRowCount = tableRows.filter((d) => d.id).length;
  /** Đang ở "Ghi nhập" và còn dòng hợp lệ CHƯA lưu vào sổ (dòng mới id=null) —
   *  để nhắc trước khi chốt ngày, kẻo số vừa gõ chưa tính vào tổng chốt. */
  const hasUnsavedRows = mode === "nhap" && validRows.some((d) => !d.id);
  const isSessionLocked = session ? isLocked(session.deliveryDate, session.workshop) : false;

  /** Dòng đã lưu thuộc chuyến đang mở (id-set khi sửa; tạo mới thì chưa có gì). */
  const belongsToSavedSession = (r: MaterialImportItem) =>
    editRowIds ? editRowIds.includes(r.id) : false;
  /** Tổng ngày = số đã lưu của ngày/xưởng (trừ chuyến đang mở, khỏi đếm đôi) +
   *  số đang gõ trong bảng ⇒ xem trước tổng ngày ngay cả khi chưa lưu. */
  const dayTotalExShipment = session
    ? rows
        .filter(
          (r) =>
            r.deliveryDate === session.deliveryDate &&
            r.workshop === session.workshop &&
            !belongsToSavedSession(r)
        )
        .reduce((s, r) => s + (r.quantityKg || 0), 0)
    : 0;
  const sessionDayTotal = dayTotalExShipment + shipmentTotal;

  /** Sửa một ô trong bảng (không tự sinh/xô dòng — thêm dòng bằng nút riêng). */
  const updateRow = (key: string, patch: Partial<ImportLine>) =>
    setTableRows((items) =>
      items.map((d) => {
        if (d.key !== key) return d;
        // Tự tay đổi loài/loại ⇒ thành dòng thường (thiếu kg sẽ bị nhắc khi lưu).
        // Chỉ sửa GIÁ thì vẫn là dòng gợi ý: không gõ kg thì vẫn tự bỏ qua.
        const isTypeEdit = "category" in patch || "materialTypeName" in patch;
        return {
          ...d,
          ...patch,
          goiY: isTypeEdit ? false : d.goiY,
          // Giá vừa tự gõ không còn là "giá lượt trước".
          priceDate: isTypeEdit || "unitPrice" in patch ? undefined : d.priceDate,
        };
      })
    );

  /** Bỏ một dòng; luôn còn ít nhất một dòng để nhập. */
  const removeRow = (key: string) =>
    setTableRows((items) => {
      const con = items.filter((d) => d.key !== key);
      return con.length ? con : [createEmptyImportLine(lastCategory)];
    });

  /** Thêm một dòng trống ở CUỐI bảng (mặc định loài theo dòng cuối cho nhanh). */
  const addNewRow = () =>
    setTableRows((items) => [
      ...items,
      createEmptyImportLine(items[items.length - 1]?.category ?? lastCategory),
    ]);

  /* ---- OCR: chụp ảnh phiếu → gợi ý điền form (nháp, người soát lại) ---- */

  /** Danh mục để OCR dò khớp tên trên phiếu (đại lý theo tên tắt, loại NL). */
  const ocrCatalog: OcrCatalog = useMemo(
    () => ({
      suppliers: suppliers.map((d) => ({ name: d.shortName, code: d.code })),
      materialTypes: materialTypes.map((l) => ({ name: l.name })),
    }),
    [suppliers, materialTypes]
  );

  /** OCR đề xuất một dòng: nối vào bảng (thay dòng trống đầu nếu bảng chưa có data). */
  const addRowFromOcr = (ten: string, soKg: number) =>
    setTableRows((items) => {
      const mt = materialTypes.find((l) => l.name === ten);
      const cat = (mt?.category || items[items.length - 1]?.category || lastCategory) as Category;
      const newRow: ImportLine = { ...createEmptyImportLine(cat), materialTypeName: ten, quantityKg: soKg };
      return items.some(importLineHasData) ? [...items, newRow] : [newRow];
    });

  /** Mở ảnh phiếu đã đính (signed URL có hạn) để đối chiếu tay. */
  const viewScanImage = async () => {
    if (!session?.scanPath) return;
    const url = await getPhotoUrl(session.scanPath);
    if (url) window.open(url, "_blank", "noopener");
    else notify.error("Chưa xem được ảnh (cần đăng nhập máy chủ).");
  };

  /**
   * Lưu cả chuyến MỘT LẦN: tạo/ghi chuyến + mọi dòng hợp lệ trong bảng, một lần
   * persist. Giữ nguyên bất biến "đầu chuyến áp cho mọi dòng", "chuyến chỉ tạo
   * khi có dòng", "dữ liệu cũ không tự sinh chuyến".
   *
   * `imLang` = đóng nhanh bằng X / Esc / bấm ra ngoài: có dòng đủ thì vẫn lưu
   * (không để mất số đã gõ), chưa đủ thì bỏ qua lặng lẽ, không nài lỗi.
   * Trả về true nếu đóng được dialog (đã lưu, hoặc không có gì để lưu khi imLang).
   */
  const saveSession = (imLang: boolean): boolean => {
    if (!session) return true;
    const validRows = tableRows.filter(isLineComplete);
    const ls: FieldError[] = [...validateShipmentHeader(session, isSessionLocked)];
    if (validRows.length === 0)
      ls.push({
        field: "Loại hàng",
        message: tableRows.some((d) => d.goiY)
          ? "Chưa gõ số kg cho loại hàng nào"
          : "Thêm ít nhất một loại hàng vào chuyến",
      });
    // Dòng dở dang (có loại thiếu số, hoặc có số chưa chọn loại): chỉ chặn khi
    // người dùng bấm Lưu — đóng nhanh bằng X thì lặng lẽ bỏ dòng dở, giữ dòng đủ.
    if (!imLang)
      tableRows.forEach((d, i) => {
        if (importLineHasData(d) && !isLineComplete(d))
          ls.push({
            field: `Dòng ${i + 1}`,
            message: !d.materialTypeName.trim()
              ? "Chưa chọn loại hàng"
              : "Số lượng phải lớn hơn 0 kg",
          });
      });

    if (ls.length > 0) {
      if (!imLang) setSessionErrors(ls);
      return false;
    }

    // Sửa dữ liệu cũ (không có bản ghi chuyến) → giữ chuyenId rỗng, gom nhóm nhờ
    // (ngày + xưởng + đại lý + xe). KHÔNG tự sinh chuyến cho dữ liệu cũ.
    const isEditingLegacy = isEditingShipment && !sessionShipmentId;
    let shipmentId = sessionShipmentId;
    let nextShipments = shipments;
    if (sessionShipmentId) {
      nextShipments = shipments.map((c) =>
        c.id === sessionShipmentId ? { ...c, ...session, id: c.id } : c
      );
    } else if (!isEditingLegacy) {
      shipmentId = newId();
      nextShipments = [
        ...shipments,
        {
          id: shipmentId,
          ...session,
          lotCode: generateLotCode(session.deliveryDate, session.workshop, shipments),
          operator,
        },
      ];
    }

    // Dòng của chuyến = các dòng hợp lệ trong bảng: dòng cũ giữ id (cập nhật),
    // dòng mới cấp id mới; dòng đã bỏ khỏi bảng không đưa lại (tức là xóa).
    const keptRows = rows.filter((r) => !belongsToSavedSession(r));
    const shipmentRows: MaterialImportItem[] = validRows.map((d) => ({
      id: d.id ?? newId(),
      shipmentId: shipmentId ?? "",
      deliveryDate: session.deliveryDate,
      workshop: session.workshop,
      category: d.category,
      supplierName: session.supplierName,
      materialTypeName: d.materialTypeName,
      quantityKg: d.quantityKg,
      unitPrice: d.unitPrice,
      driverName: session.driverName,
      licensePlate: session.licensePlate,
      note: session.note,
    }));
    persistShipments(nextShipments);
    persist([...keptRows, ...shipmentRows]);

    const newTotal = validRows.reduce((s, d) => s + d.quantityKg, 0);
    const savedShipment = shipmentId ? nextShipments.find((c) => c.id === shipmentId) : undefined;
    notify.saved(
      `Đã lưu chuyến ${session.supplierName} — ${validRows.length} loại · ${kg(newTotal)}`,
      undefined,
      savedShipment ? { label: "In tem", onClick: () => setLabelShipment(savedShipment) } : undefined
    );
    // Ngày đã chốt mà ghi thêm → báo ngay tổng ngày lệch bao nhiêu so với lúc chốt.
    const bg = lockRecordOf(session.deliveryDate, session.workshop);
    if (bg?.isLocked)
      notify.warning(
        `Ngày ${formatDateVN(session.deliveryDate)} đã chốt ${kg(bg.totalKgAtLock)} — sau khi ghi bù thành ${kg(dayTotalExShipment + newTotal)}`
      );

    // Nhớ loài cuối để chuyến/dòng sau khỏi nhảy về "Bạch tuộc".
    setLastCategory(validRows[validRows.length - 1].category);

    // Ghi ngày ngoài kỳ đang lọc → kéo bộ lọc về chuyến vừa ghi (khỏi tưởng mất).
    if (session.deliveryDate < effectiveFrom || session.deliveryDate > effectiveTo) {
      setKy("ngay");
      setDate(session.deliveryDate);
    }
    if (workshop !== "Tất cả" && workshop !== session.workshop)
      setWorkshop(session.workshop);
    if (supplierFilter && supplierFilter !== session.supplierName) setSupplierFilter("");
    if (priceFilter === "thieu-gia") setPriceFilter("tat-ca");
    return true;
  };

  const resetSession = () => {
    setSession(null);
    setSessionShipmentId(null);
    setEditRowIds(null);
    setTableRows([]);
    setSessionErrors([]);
  };

  /** Lưu xong, đóng dialog. */
  const finishShipment = () => {
    if (saveSession(false)) resetSession();
  };

  /** Lưu xong, dọn bảng nhưng GIỮ ngày + xưởng + đại lý cho chuyến kế (một đại
   *  lý hay giao nhiều lượt trong ngày) — chỉ làm mới xe + bảng loại hàng. */
  const saveAndAddShipment = () => {
    if (!saveSession(false)) return;
    const lastRowCategory = validRows.length
      ? validRows[validRows.length - 1].category
      : lastCategory;
    setSession((p) =>
      p
        ? { ...p, driverName: "", licensePlate: "", note: "", ssccCode: "", scanPath: "" }
        : p
    );
    setSessionShipmentId(null);
    setEditRowIds(null);
    setTableRows(newTableRows(session?.supplierName ?? "", session?.workshop ?? recordWorkshop, lastRowCategory));
    setSessionErrors([]);
    resetSteps(false);
  };


  /* ---- Xóa cả chuyến đang sửa (nút trong dialog) ---- */

  const deleteEditingShipment = () => {
    if (!editRowIds) return;
    const prevRows = rows;
    const prevShipment = shipments;
    const ids = new Set(editRowIds);
    persist(rows.filter((r) => !ids.has(r.id)));
    if (sessionShipmentId)
      persistShipments(shipments.filter((c) => c.id !== sessionShipmentId));
    notify.deleted(
      `Đã xóa chuyến ${session?.supplierName || ""} — ${editRowIds.length} dòng`,
      () => {
        persist(prevRows);
        persistShipments(prevShipment);
      }
    );
    resetSession();
  };

  /* ---- Chốt / mở lại ngày ---- */

  const lockDay = () => {
    /* Sổ chốt chưa nạp xong ⇒ chưa biết máy chủ đã có bản ghi (ngày, xưởng) chưa;
       tạo bản mới lúc này có thể trùng chỉ mục duy nhất (site, ngày, xưởng) ⇒ 23505. */
    if (lockStatus === "dang-tai") {
      notify.error("Đang tải sổ chốt ngày từ máy chủ — đợi vài giây rồi bấm chốt lại");
      return;
    }
    const bg = lockRecordOf(effectiveFrom, viewedWorkshop);
    const ban: DailyLock = {
      /* Có bản ghi (kể cả đã mở lại) ⇒ dùng lại id. Chưa có ⇒ id CỐ ĐỊNH theo khoá
         nghiệp vụ (ngày|xưởng), không newId(): hai máy cùng chốt một ngày sẽ ghi
         CÙNG một dòng thay vì hai id đụng chỉ mục duy nhất và kẹt hàng chờ. */
      id: bg?.id ?? `${effectiveFrom}|${viewedWorkshop}`,
      lockDate: effectiveFrom,
      workshop: viewedWorkshop,
      isLocked: true,
      lockedAt: new Date().toISOString(),
      totalKgAtLock: actualTotal,
      reopenReason: "",
      note: lockNote,
    };
    persistLocks(
      bg ? locks.map((c) => (c.id === bg.id ? ban : c)) : [...locks, ban]
    );
    notify.saved(
      `Đã chốt ngày ${formatDateVN(effectiveFrom)} · xưởng ${viewedWorkshop} — ${kg(actualTotal)}`
    );
    setIsConfirmingLock(false);
    setLockNote("");
  };

  const reopenDay = () => {
    const bg = lockRecordOf(effectiveFrom, viewedWorkshop);
    if (!bg) return;
    if (!reopenReason.trim()) {
      setLockErrors([
        { field: "Lý do mở lại", message: "Phải ghi rõ vì sao mở lại ngày" },
      ]);
      return;
    }
    persistLocks(
      locks.map((c) =>
        c.id === bg.id ? { ...c, isLocked: false, reopenReason } : c
      )
    );
    notify.warning(
      `Đã mở lại ngày ${formatDateVN(effectiveFrom)} · xưởng ${viewedWorkshop} — sửa xong nhớ chốt lại`
    );
    setIsConfirmingReopen(false);
    setReopenReason("");
    setLockErrors([]);
  };

  /* ---- Cột bảng dòng hàng trong một chuyến ---- */

  const itemColumns = (isShipmentLocked: boolean): RecordTableColumn<MaterialImportItem>[] => [
    {
      key: "materialTypeName",
      header: "Loại nguyên liệu",
      primary: true,
      render: (r) => r.materialTypeName,
      getSortValue: (r) => r.materialTypeName,
    },
    {
      key: "category",
      header: "Loài",
      render: (r) => <Tag variant="phan-loai" tone={toneByName(r.category)}>{r.category}</Tag>,
      getSortValue: (r) => r.category,
    },
    {
      key: "sl",
      header: "Số lượng (kg)",
      numeric: true,
      render: (r) => num(r.quantityKg),
      getSortValue: (r) => r.quantityKg,
    },
    {
      key: "gia",
      header: "Đơn giá (đ)",
      numeric: true,
      render: (r) =>
        r.unitPrice != null ? (
          num(r.unitPrice)
        ) : (
          <Tag variant="loi">Chưa có giá</Tag>
        ),
      getSortValue: (r) => r.unitPrice ?? 0,
    },
    {
      key: "tien",
      header: "Thành tiền (đ)",
      numeric: true,
      render: (r) => num(calculateImportAmount(r)),
      getSortValue: (r) => calculateImportAmount(r),
    },
    ...(isShipmentLocked
      ? [
          {
            key: "khoa",
            header: "Trạng thái",
            render: () => (
              <Tag variant="xong" icon={Lock}>
                Đã chốt
              </Tag>
            ),
          } as RecordTableColumn<MaterialImportItem>,
        ]
      : []),
  ];

  // CHỐT NGÀY — nằm CUỐI cột ngày (sau "đã ghi" + phế liệu): xem hết số của ngày rồi
  // mới chốt. Ngày + xưởng bám theo phiếu (bộ lọc được đồng bộ ở chế độ Ghi nhập).
  const lockSection = isSingleDayWorkshop && (
        <div className="space-y-3 rounded-xl border-2 border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {isDayLocked ? (
              <Lock className="size-6 shrink-0 text-primary" aria-hidden />
            ) : (
              <LockOpen
                className="size-6 shrink-0 text-muted-foreground"
                aria-hidden
              />
            )}
            <span className="text-lg font-semibold text-foreground">
              {isDayLocked ? "Đã chốt" : "Chưa chốt"} {formatDateVN(effectiveFrom)} · xưởng{" "}
              {viewedWorkshop}
            </span>
            <span className="text-base text-muted-foreground">
              Tổng{" "}
              <span className="tnum font-semibold text-foreground">
                {kg(actualTotal)}
              </span>
              {isDayLocked && currentLock
                ? ` · lúc chốt ${kg(currentLock.totalKgAtLock)}`
                : ""}
            </span>
            {postLockDiff !== 0 && (
              <span className="flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1 text-base text-accent-foreground">
                <TriangleAlert className="size-5 shrink-0" aria-hidden />
                Còn ghi bù{" "}
                <span className="tnum font-semibold">
                  {postLockDiff > 0 ? "+" : ""}
                  {num(postLockDiff)} kg
                </span>{" "}
                sau chốt
              </span>
            )}
          </div>
          {isDayLocked ? (
            <Button
              title="Mở khóa lại ngày đã chốt để sửa hoặc ghi bù. Phải ghi lý do, và việc mở khóa được lưu vết."
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() => {
                setIsConfirmingReopen(true);
                setReopenReason("");
                setLockErrors([]);
              }}
            >
              <LockOpen />
              Mở lại ngày
            </Button>
          ) : (
            <Button
              title="Khóa sổ ngày này lại: chốt tổng nhập trong ngày. Sau khi chốt muốn sửa phải Mở lại ngày và ghi lý do."
              size="lg"
              className="w-full"
              onClick={() =>
                hasUnsavedRows ? setShowSaveReminder(true) : setIsConfirmingLock(true)
              }
            >
              <Lock />
              Chốt ngày
            </Button>
          )}
        </div>
  );

  // FORM NHẬP (form-first, INLINE) — LUỒNG THEO BƯỚC: thanh ngữ cảnh (ngày · xưởng)
  // → ① Đại lý → ② Xe → ③ Loại hàng & kg → thanh LƯU dính đáy. Bước xong thì thu
  // lại một dòng. Cột phải (desktop) / bên dưới (điện thoại): chuyến ĐÃ GHI trong
  // ngày + phế liệu — khỏi đổi tab sang "Sổ ngày" để biết đã ghi gì.
  const entryForm = session && (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] xl:items-start">
      <div className="min-w-0 space-y-4">
        <ErrorSummary errors={sessionErrors} />

        {/* THANH NGỮ CẢNH — ngày + xưởng của cả phiếu */}
        <div className="space-y-3 rounded-xl border-2 border-border bg-card p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {twoDates ? (
              <>
                <DateField
                  label="Ngày ghi sổ"
                  required
                  info="Ngày ghi vào hệ thống. Chọn ngày này thì ngày hàng về tự nhảy theo. Cần khác thì sửa ô ngày hàng về bên cạnh."
                  value={session.postingDate}
                  onChange={changePostingDate}
                />
                <DateField
                  label="Ngày hàng về xưởng"
                  required
                  info="Ngày xe đổ hàng thật — mọi tổng hợp tính theo ngày này. Sửa tay ô này khi hàng về hôm khác (ghi bù)."
                  value={session.deliveryDate}
                  onChange={changeDeliveryDate}
                />
              </>
            ) : (
              <DateField
                label="Ngày hàng về"
                required
                info="Ngày xe đổ hàng — cũng là ngày ghi sổ. Hàng về hôm trước mà nay mới ghi thì bấm “Ghi bù” bên dưới để tách hai ngày."
                value={session.deliveryDate}
                onChange={changePostingDate}
              />
            )}
            <ChoiceGroup
              label="Phân xưởng"
              required
              columns={3}
              className={twoDates ? "sm:col-span-2" : undefined}
              value={session.workshop}
              onChange={(v) => pickWorkshop(v as Workshop)}
              options={WORKSHOPS.map((p) => ({ value: p, label: p }))}
            />
          </div>

          {(isBackdatedImport(session) || isSessionLocked) && (
            <Field
              label="Lý do ghi bù"
              required
              hint="VD: đại lý chưa xuất hóa đơn, 31/7 mới có chứng từ."
            >
              <Input
                value={session.backdateReason}
                onChange={(e) => setSessionField("backdateReason", e.target.value)}
                placeholder="Vì sao tới hôm nay mới ghi?"
              />
            </Field>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {!twoDates ? (
              <Button
                title="Hàng về hôm trước mà nay mới ghi sổ (chờ hóa đơn…): tách thành hai ô ngày ghi sổ / ngày hàng về, kèm lý do."
                type="button"
                variant="outline"
                size="sm"
                className="h-auto min-h-9 max-w-full py-1 text-left whitespace-normal"
                onClick={() => setSplitDates(true)}
              >
                <CalendarRange />
                Ghi bù (hai ngày khác nhau)
              </Button>
            ) : (
              !isBackdatedImport(session) && (
                <Button
                  title="Hàng về đúng ngày ghi sổ: gộp lại còn một ô ngày."
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSplitDates(false)}
                >
                  Gộp lại một ngày
                </Button>
              )
            )}
            {coOcr && (
              <Button
                title="Chụp hoặc chọn ảnh phiếu nhập viết tay, máy tự đọc ra ngày · đại lý · các dòng loại NL và kg. Kết quả là NHÁP — soát lại rồi mới lưu."
                type="button"
                variant="outline"
                size="sm"
                className="h-auto min-h-9 max-w-full py-1 text-left whitespace-normal"
                onClick={() => setOcrMo(true)}
              >
                <Camera />
                Nhận diện từ ảnh phiếu
              </Button>
            )}
            {session.scanPath && (
              <span className="flex items-center gap-1">
                <Tag variant="xong">Đã đính ảnh phiếu</Tag>
                {hasImageStorage && (
                  <Button
                    title="Mở lại ảnh phiếu tay đã lưu kèm chuyến này." type="button" variant="link" size="sm" onClick={viewScanImage}>
                    Xem
                  </Button>
                )}
              </span>
            )}
          </div>
        </div>

        {isSessionLocked && (
          <p className="flex items-start gap-3 rounded-lg bg-accent px-4 py-3 text-base text-accent-foreground">
            <Lock className="mt-0.5 size-6 shrink-0" aria-hidden />
            <span>
              Ngày {formatDateVN(session.deliveryDate)} · xưởng {session.workshop}{" "}
              <strong>đã chốt</strong>. Vẫn ghi được nhưng là <strong>ghi bù</strong>{" "}
              — bắt buộc ghi rõ lý do.
            </span>
          </p>
        )}

        {isEditingShipment && (
          <p className="flex items-start gap-3 rounded-lg bg-accent px-4 py-3 text-base text-accent-foreground">
            <TriangleAlert className="mt-0.5 size-6 shrink-0" aria-hidden />
            <span>
              Đang <strong>sửa chuyến đã ghi</strong>
              {savedRowCount > 0 && (
                <>
                  {" "}— đổi ngày / đại lý / xe sẽ áp cho <strong>{savedRowCount} dòng</strong> của chuyến
                </>
              )}
              .
            </span>
          </p>
        )}

        {/* ① ĐẠI LÝ — chọn xong là thu lại, kéo theo xe gợi ý + bảng loại hàng điền sẵn */}
        <StepCard
          so={1}
          title="Đại lý giao hàng"
          xong={!!session.supplierName}
          mo={isSupplierStepOpen}
          summary={session.supplierName}
          onDoi={() => setOpenPanel("dai-ly")}
        >
          {!isEditingShipment && dlHayGiao.length > 0 && (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {dlHayGiao.map((ten) => (
                <ChoiceCard
                  key={ten}
                  label={ten}
                  phu={lastDateBySupplier.get(ten) ? `Gần nhất ${formatDateVN(lastDateBySupplier.get(ten) ?? "")}` : undefined}
                  isSelected={session.supplierName === ten}
                  title={`Chọn đại lý ${ten} — tự điền sẵn các loại hàng và đơn giá theo lượt giao gần nhất, chỉ còn gõ số kg.`}
                  onClick={() => pickSupplier(ten)}
                />
              ))}
            </div>
          )}
          <Combobox
            label={dlHayGiao.length > 0 && !isEditingShipment ? "Đại lý khác" : "Đại lý giao hàng"}
            required
            hideRequiredMark
            value={session.supplierName}
            onChange={pickSupplier}
            options={supplierOptions}
            onCreate={addSupplier}
            emptyText="Chưa có đại lý nào trong danh mục."
            onEditItem={supplierEditor.openEdit}
            editLabel={supplierEditor.editLabel}
          />
        </StepCard>

        {/* ② XE — xe cũ của đại lý bấm một chạm; xe lạ thì gõ tay; không có thì bỏ qua */}
        <StepCard
          so={2}
          title="Xe chở hàng"
          xong={hasVehicleInfo || skipTruck}
          mo={isVehicleStepOpen}
          summary={
            hasVehicleInfo
              ? [session.licensePlate, session.driverName].filter(Boolean).join(" · ")
              : session.supplierName
                ? "Không ghi xe"
                : undefined
          }
          onDoi={session.supplierName ? () => setOpenPanel("xe") : undefined}
        >
          {truckSuggestions.plates.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Biển số — chạm là điền luôn tài xế hay lái xe đó
              </p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {truckSuggestions.plates.map((x) => (
                  <ChoiceCard
                    key={x.licensePlate}
                    icon={<Truck />}
                    label={x.licensePlate}
                    phu={x.driverName || undefined}
                    isSelected={normalizePlate(x.licensePlate) === normalizePlate(session.licensePlate)}
                    title="Điền biển số này kèm tài xế gần nhất lái xe đó, rồi nhảy xuống gõ số kg. Khác tài xế thì bấm Đổi và chạm tên tài xế."
                    onClick={() => pickPlate(x)}
                  />
                ))}
              </div>
            </div>
          )}
          {truckSuggestions.drivers.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Tài xế</p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {truckSuggestions.drivers.map((ten) => (
                  <ChoiceCard
                    key={ten}
                    label={ten}
                    isSelected={ten.toLowerCase() === session.driverName.trim().toLowerCase()}
                    title="Chọn tài xế này cho chuyến. Đã có biển số thì xong bước xe và nhảy xuống gõ số kg."
                    onClick={() => pickDriver(ten)}
                  />
                ))}
              </div>
            </div>
          )}
          {(isManualVehicle || hasVehicleHints === false || hasVehicleInfo) && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Biển số xe">
                <Input
                  value={session.licensePlate}
                  onFocus={() => setOpenPanel("xe")}
                  onChange={(e) => setSessionField("licensePlate", e.target.value)}
                  placeholder="VD: 86C 19555"
                />
              </Field>
              <Field label="Tài xế">
                <Input
                  value={session.driverName}
                  onFocus={() => setOpenPanel("xe")}
                  onChange={(e) => setSessionField("driverName", e.target.value)}
                  placeholder="Tên tài xế"
                />
              </Field>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {!isManualVehicle && hasVehicleHints && !hasVehicleInfo && (
              <Button
                title="Xe chưa từng chở cho đại lý này: mở hai ô để gõ tay biển số và tên tài xế."
                type="button"
                variant="outline"
                onClick={() => {
                  setIsManualVehicle(true);
                  setOpenPanel("xe");
                }}
              >
                <Plus />
                Xe khác — gõ tay
              </Button>
            )}
            {hasVehicleInfo ? (
              <Button
                title="Xong phần xe — thu bước này lại và nhảy xuống gõ số kg."
                type="button"
                onClick={finishTruckStep}
              >
                Xong, sang gõ kg
              </Button>
            ) : (
              <Button
                title="Chuyến này không cần ghi xe / tài xế — bỏ qua bước này và nhảy xuống gõ số kg."
                type="button"
                variant="outline"
                onClick={skipTruckStep}
              >
                Không ghi xe
              </Button>
            )}
          </div>
        </StepCard>

        {/* ③ LOẠI HÀNG & KG — bảng điền sẵn theo đại lý, chỉ còn gõ số */}
        <StepCard
          so={3}
          title="Loại hàng và số kg"
          xong={validRows.length > 0}
          mo
        >
          <p className="text-sm text-muted-foreground">
            {tableRows.some((d) => d.goiY)
              ? "Đã điền sẵn loại + giá theo lượt gần nhất — chỉ gõ số kg, Enter xuống dòng. Dòng không có kg tự bỏ qua."
              : "Mỗi loại một dòng. Đơn giá để trống nếu chưa có hóa đơn."}
          </p>
          <ImportLinesTable
            dong={tableRows}
            onUpdateRow={updateRow}
            onBo={removeRow}
            onAddRow={addNewRow}
            getMaterialTypeOptions={materialTypeOptionsByCategory}
            onCreateMaterialType={addMaterialType}
            onEditMaterialType={materialTypeEditor.openEdit}
            onLastRowEnter={focusSaveButton}
          />
        </StepCard>

        <div className="rounded-xl border-2 border-border bg-card">
          <button
            title="Mở / thu phần ít dùng của chuyến: ghi chú, mã SSCC, mã lô nội bộ (không bắt buộc)."
            type="button"
            onClick={() => setIsExtrasOpen((v) => !v)}
            aria-expanded={isExtrasOpen}
            className="flex min-h-11 w-full items-center justify-between gap-3 px-4 text-left font-semibold"
          >
            <span>
              Ghi chú · mã lô{" "}
              <span className="tnum font-normal text-muted-foreground">{sessionLotCode}</span>
            </span>
            <ChevronDown
              className={`size-6 shrink-0 transition-transform ${isExtrasOpen ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
          {isExtrasOpen && (
            <div className="space-y-4 border-t-2 border-border p-4">
              <Field label="Ghi chú">
                <Input
                  value={session.note}
                  onChange={(e) => setSessionField("note", e.target.value)}
                  placeholder="Ghi chú thêm (nếu có)"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Mã SSCC (nhà nước)"
                  hint="Để trống nếu chưa được cấp — điền sau."
                >
                  <Input
                    value={session.ssccCode}
                    onChange={(e) => setSessionField("ssccCode", e.target.value)}
                    placeholder="Chưa có — điền sau"
                  />
                </Field>
                <Field label="Mã lô nội bộ" hint="Tự sinh, dùng để truy xuất.">
                  <div className="flex min-h-11 items-center tnum text-base text-muted-foreground">
                    {sessionLotCode}
                  </div>
                </Field>
              </div>
            </div>
          )}
        </div>

        {/* THANH LƯU — dính đáy màn: luôn thấy tổng chuyến + nút lưu, khỏi cuộn tìm */}
        <div
          className={cn(
            "flex flex-col gap-2 rounded-xl border-2 bg-card p-3 xl:flex-row xl:items-center xl:justify-between",
            // Chỉ DÍNH ĐÁY khi đã có số để lưu — phiếu trống thì nằm yên, khỏi che các bước.
            validRows.length > 0 || isEditingShipment
              ? "sticky bottom-2 z-10 border-primary/50 shadow-lg"
              : "border-border"
          )}
        >
          <p className="min-w-0">
            <span className="text-muted-foreground">Chuyến này: </span>
            <span className="tnum text-lg font-semibold">{kg(shipmentTotal)}</span>
            <span className="text-muted-foreground">
              {" "}· {validRows.length} loại
              {shipmentAmount > 0 && <> · <span className="tnum">{num(shipmentAmount)} đ</span></>}
            </span>
            {/* Dòng điền sẵn chưa gõ kg sẽ KHÔNG được lưu — nói rõ tên loại, khỏi sót hàng. */}
            {validRows.length > 0 && skipped.length > 0 && (
              <span className="block text-sm text-muted-foreground">
                Không lưu {skipped.length} loại chưa gõ kg:{" "}
                {skipped.map((d) => d.materialTypeName).join(", ")}
              </span>
            )}
          </p>
          {/* Điện thoại: các nút chia đều MỘT hàng (chật thì tự xuống hàng); chữ dài tự xuống dòng. */}
          <div className="flex w-full flex-wrap gap-2 xl:w-auto [&>*]:flex-1 xl:[&>*]:flex-none">
            {isEditingShipment ? (
              <>
                <ConfirmDelete
                  recordDescription={`Chuyến ${session?.supplierName || "(chưa có đại lý)"} — ${formatDateVN(session?.deliveryDate ?? "")} — ${savedRowCount} dòng — ${kg(shipmentTotal)}`}
                  onConfirm={deleteEditingShipment}
                  title="Xóa cả chuyến này?"
                  confirmLabel="Xóa chuyến"
                />
                <Button variant="outline" className="min-h-11" onClick={resetSession}>
                  Hủy sửa
                </Button>
              </>
            ) : (
              <Button
                title="Ghi chuyến đang gõ vào sổ rồi mở phiếu mới GIỮ ngày + xưởng + đại lý — cho đại lý giao nhiều lượt trong ngày." variant="outline" className="h-auto min-h-11 whitespace-normal" onClick={saveAndAddShipment}>
                <Truck />
                Lưu &amp; chuyến kế
              </Button>
            )}
            <Button
              title="Ghi chuyến đang gõ vào sổ. Chuyến hiện ngay ở khung “Đã ghi trong ngày”, phiếu trống sẵn cho chuyến kế." id="nut-luu-chuyen" className="min-h-11" onClick={finishShipment}>
              <Save />
              {isEditingShipment ? "Lưu chuyến" : "Lưu vào sổ"}
            </Button>
          </div>
        </div>
      </div>

      {/* CỘT NGÀY — đã ghi gì trong ngày này + phế liệu (chốt ngày ở strip cuối màn) */}
      <div className="min-w-0 space-y-4">
        <div className="space-y-3 rounded-xl border-2 border-border bg-card p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="font-semibold">
              Đã ghi ngày {formatDateVN(session.deliveryDate)} · xưởng {session.workshop}
            </p>
            <p className="text-muted-foreground">
              {sessionDayGroups.length} chuyến ·{" "}
              <span className="tnum text-lg font-semibold text-foreground">
                {kg(sessionDayTotal)}
              </span>
            </p>
          </div>
          <DayShipmentList
            nhom={sessionDayGroups}
            isLocked={isSessionLocked}
            editingGroupKey={sessionShipmentId}
            onEdit={openShipmentEdit}
            onPrintLabel={(n) => n.shipment && setLabelShipment(n.shipment)}
          />
          <div className="flex flex-wrap gap-2 [&>*]:flex-1">
            <Button
              title="Xem trước bản in A4 “Báo cáo tổng hợp nguyên liệu” của ngày đang ghi." variant="outline" onClick={() => setShowInvoice(true)}>
              <FileText />
              Báo cáo ngày
            </Button>
            <Button
              title="In tờ phiếu trống để tổ trưởng ghi tay ngoài xưởng, tối về nhập lại vào máy." variant="outline" onClick={() => setIsPrintingBlank(true)}>
              <Printer />
              Phiếu trống
            </Button>
          </div>
        </div>

        {/* Phế liệu cân trong ngày — GỘP CHUNG một chỗ với nguyên liệu */}
        <DailyScrapSection
          date={session.deliveryDate}
          workshop={session.workshop}
          rows={scraps}
          onChange={persistScraps}
          isLocked={isSessionLocked}
        />

        {lockSection}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Nhập hàng về xưởng
          </h1>
        </div>
        {/* Tách rõ NHẬP với TRA CỨU: một màn làm một việc. */}
        <div className="flex w-full overflow-hidden rounded-xl border-2 border-border sm:w-auto">
          <button
            title="Sang chế độ Ghi nhập để gõ chuyến nguyên liệu mới."
            type="button"
            onClick={() => setMode("nhap")}
            className={cn(
              "flex-1 px-4 py-2.5 text-base font-semibold transition-colors sm:flex-none",
              mode === "nhap"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            📝 Ghi nhập
          </button>
          <button
            title="Tổng hợp nhập hàng theo kỳ (xuất Excel / in) và tra cứu sổ chi tiết các chuyến theo ngày, đại lý, loại, thiếu giá."
            type="button"
            onClick={() => setMode("bao-cao")}
            className={cn(
              "flex-1 border-l-2 border-border px-4 py-2.5 text-base font-semibold transition-colors sm:flex-none",
              mode !== "nhap"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            📊 Báo cáo
          </button>
        </div>
      </div>

      {/* Trong "Báo cáo": tổng hợp theo kỳ ⇄ sổ chi tiết các chuyến (tab "Sổ ngày" cũ —
          việc xem/sửa chuyến TRONG NGÀY đã nằm ở cột phải của "Ghi nhập"). */}
      {mode !== "nhap" && (
        <div className="flex w-full overflow-hidden rounded-lg border-2 border-border sm:w-fit">
          {(
            [
              ["bao-cao", "Tổng hợp theo kỳ", "Tổng nhập theo kỳ, gom theo đại lý × loại nguyên liệu; xuất Excel hoặc in."],
              ["so", "Sổ chi tiết các chuyến", "Tra cứu từng chuyến theo ngày / tuần / tháng, lọc đại lý · loại · chưa có giá; in tem QR, đổi loại hàng loạt."],
            ] as const
          ).map(([id, label, description], i) => (
            <button
              key={id}
              title={description}
              type="button"
              onClick={() => setMode(id)}
              className={cn(
                "flex-1 px-4 py-2 font-semibold transition-colors sm:flex-none",
                i > 0 && "border-l-2 border-border",
                mode === id ? "bg-accent text-foreground" : "bg-card text-muted-foreground hover:bg-muted"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {mode === "bao-cao" && <ImportReport />}

      {isTypeChangeOpen && (
        <BulkTypeChangeDialog
          rows={rows}
          loaiNL={materialTypes}
          onCreateMaterialType={addMaterialType}
          materialTypeEdit={materialTypeEditor}
          onClose={() => setIsTypeChangeOpen(false)}
          onSave={(ids, targetType) => {
            const bo = new Set(ids);
            const prevRows = rows;
            persist(
              rows.map((r) => (bo.has(r.id) ? { ...r, materialTypeName: targetType } : r))
            );
            notify.saved(`Đã đổi ${ids.length} chuyến sang "${targetType}"`, () =>
              persist(prevRows)
            );
            setIsTypeChangeOpen(false);
          }}
        />
      )}

      {mode === "nhap" && (
        <DailyTaskReminder isLocked={isImportLockedToday} task={`chuyến nhập nguyên liệu hôm nay — xưởng ${recordWorkshop}`} />
      )}

      {mode === "nhap" && entryForm}

      {mode === "so" && (
        <>
      <div className="flex flex-wrap gap-2">
        <Button
          title="Xem trước bản in A4 báo cáo nhập hàng của ngày đang chọn." variant="outline" size="lg" onClick={() => setShowInvoice(true)}>
          <FileText />
          Xem báo cáo
        </Button>
        <Button
          title="In tờ phiếu trống để tổ trưởng ghi tay ngoài xưởng, tối về nhập lại vào máy." variant="outline" size="lg" onClick={() => setIsPrintingBlank(true)}>
          <Printer />
          In phiếu trống
        </Button>
        <Button
          title="Đổi loại nguyên liệu cho nhiều chuyến cùng lúc — dùng khi gõ nhầm loại cho cả loạt dòng." variant="outline" size="lg" onClick={() => setIsTypeChangeOpen(true)}>
          <Replace />
          Đổi loại hàng loạt
        </Button>
      </div>

      <StatCardGrid
        className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        cards={[
          { label: "Đang xem", value: rangeDescription, icon: CalendarRange, color: "trung-tinh" },
          { label: "Phân xưởng", value: workshop, icon: Warehouse, color: "trung-tinh" },
          { label: "Số chuyến", value: nhomView.length, numeric: true, icon: Truck, color: "brand" },
          { label: "Số dòng", value: view.length, numeric: true, icon: FileText, color: "brand" },
          { label: "Tổng nhập", value: kg(total), numeric: true, icon: Scale, color: "success" },
        ]}
      />

      {/* Bộ lọc — toolbar một hàng; lọc ít dùng gom vào "Bộ lọc thêm" để sổ
          hiện ngay, không phải cuộn qua cả khối lọc */}
      <div className="space-y-4 rounded-xl border-2 border-border p-4">
        <div className="flex flex-wrap items-end gap-4">
          <Combobox
            label="Kỳ xem sổ"
            hideRequiredMark
            clearable={false}
            value={ky}
            onChange={(v) => setKy(v as ViewPeriod)}
            options={KY_OPT}
            className="min-w-[13rem]"
          />

          <div className="min-w-[220px] flex-1">
            {ky === "tuy-chon" ? (
              <DateRangeField
                label="Khoảng ngày hàng về xưởng"
                hideRequiredMark
                presets={false}
                startDate={fromDate}
                endDate={toDate}
                onChange={(tu, den) => {
                  setFromDate(tu);
                  setToDate(den);
                }}
              />
            ) : (
              <DateField
                label={
                  ky === "ngay"
                    ? "Ngày hàng về xưởng"
                    : ky === "tuan"
                      ? "Ngày bất kỳ trong tuần"
                      : ky === "thang"
                        ? "Ngày bất kỳ trong tháng"
                        : "Ngày bất kỳ trong năm"
                }
                hideRequiredMark
                hint={
                  ky === "ngay"
                    ? undefined
                    : `Kỳ đang xem: ${formatDateVN(effectiveFrom)} – ${formatDateVN(effectiveTo)}`
                }
                value={date}
                onChange={setDate}
              />
            )}
          </div>

          <Combobox
            label="Phân xưởng"
            hideRequiredMark
            clearable={false}
            value={workshop}
            onChange={(v) => setWorkshop(v as Workshop | "Tất cả")}
            options={[
              ...WORKSHOPS.map((p) => ({ value: p, label: p })),
              { value: "Tất cả", label: "Tất cả" },
            ]}
            className="min-w-[220px] flex-1"
          />

          <Button
            title="Mở thêm bộ lọc theo đại lý · loại nguyên liệu · đã có giá hay chưa."
            variant="outline"
            size="lg"
            aria-expanded={isMoreFiltersOpen}
            onClick={() => setIsMoreFiltersOpen((v) => !v)}
          >
            <SlidersHorizontal />
            Bộ lọc thêm{extraFilterCount > 0 ? ` (${extraFilterCount})` : ""}
            <ChevronDown
              className={`transition-transform ${isMoreFiltersOpen ? "rotate-180" : ""}`}
              aria-hidden
            />
          </Button>
        </div>

        {isMoreFiltersOpen && (
          <div className="space-y-4 border-t-2 border-border pt-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Combobox
                label="Đại lý"
                hideRequiredMark
                value={supplierFilter}
                onChange={setSupplierFilter}
                options={supplierOptions}
                placeholder="Tất cả đại lý"
              />
              <Combobox
                label="Loại nguyên liệu"
                hideRequiredMark
                value={materialTypeFilter}
                onChange={setMaterialTypeFilter}
                options={materialTypeOptions}
                placeholder="Tất cả loại"
              />
            </div>

            <ChoiceGroup
              label="Trạng thái giá"
              hideRequiredMark
              hint={
                missingPriceCount > 0
                  ? `Có ${missingPriceCount} dòng chưa điền đơn giá — thường là hàng chờ hóa đơn.`
                  : undefined
              }
              value={priceFilter}
              onChange={(v) => setPriceFilter(v as "tat-ca" | "thieu-gia")}
              options={[
                { value: "tat-ca", label: "Tất cả" },
                { value: "thieu-gia", label: "Chưa có giá" },
              ]}
              columns={2}
            />

            {(supplierFilter ||
              materialTypeFilter ||
              priceFilter !== "tat-ca" ||
              workshop === "Tất cả") && (
              <div className="flex justify-end">
                <Button
                  title="Xóa hết bộ lọc đang đặt, về lại danh sách đầy đủ của xưởng Đông."
                  variant="outline"
                  onClick={() => {
                    setSupplierFilter("");
                    setMaterialTypeFilter("");
                    setPriceFilter("tat-ca");
                    setWorkshop("Đông");
                  }}
                >
                  <X />
                  Bỏ hết bộ lọc
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sổ: mỗi chuyến một cụm, đúng như sổ giấy đánh STT theo đại lý */}
      {isLoading ? (
        <TableSkeleton />
      ) : nhomView.length === 0 ? (
        <EmptyState
          icon={Truck}
          title={`Chưa có chuyến nào trong ${rangeDescription}`}
          description={
            priceFilter === "thieu-gia"
              ? "Đang lọc “Chưa có giá”. Bỏ lọc để xem đủ sổ."
              : workshop === "Tất cả"
                ? "Chuyển sang “Ghi nhập” để ghi chuyến đầu tiên."
                : `Phân xưởng ${workshop}. Chuyển sang “Ghi nhập” để ghi chuyến.`
          }
          action={
            <Button
              title="Chuyển sang chế độ Ghi để nhập chuyến mới cho ngày này." size="lg" onClick={() => setMode("nhap")}>
              <Plus />
              Sang Ghi nhập
            </Button>
          }
        />
      ) : (
        <>
          <div className="space-y-5">
            {nhomView.map((n, i) => {
              const isShipmentLocked = isLocked(n.deliveryDate, n.workshop);
              return (
                <section
                  key={n.groupKey}
                  className="space-y-4 rounded-xl border-2 border-border p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="tnum text-base text-muted-foreground">
                          Chuyến {i + 1}
                        </span>
                        <span className="text-xl font-semibold text-foreground">
                          {n.supplierName || "(chưa có đại lý)"}
                        </span>
                        <span className="text-base text-muted-foreground">
                          {formatDateVN(n.deliveryDate)} · xưởng {n.workshop}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {n.isBackdated && (
                          <Tag variant="luu-y">
                            Ghi bù {formatDateVN(n.postingDate)}
                          </Tag>
                        )}
                        {isShipmentLocked && (
                          <Tag variant="xong" icon={Lock}>
                            Đã chốt
                          </Tag>
                        )}
                        {!n.shipment && (
                          <Tag variant="nguon">Dữ liệu cũ</Tag>
                        )}
                        {n.shipment && (
                          <Tag variant="phu" className="tnum">
                            Lô {formatMaterialLotLabel(n.shipment)}
                          </Tag>
                        )}
                        {n.shipment?.ssccCode && (
                          <Tag variant="phu" className="tnum">
                            SSCC {n.shipment.ssccCode}
                          </Tag>
                        )}
                        {[n.driverName, n.licensePlate].filter(Boolean).length > 0 && (
                          <span className="text-base text-muted-foreground">
                            {[n.driverName, n.licensePlate].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </div>
                      {n.isBackdated && n.backdateReason && (
                        <p className="text-base text-muted-foreground">
                          Lý do ghi bù: {n.backdateReason}
                        </p>
                      )}
                      {n.note && (
                        <p className="text-base text-muted-foreground">
                          Ghi chú: {n.note}
                        </p>
                      )}
                      {n.shipment?.operator && (
                        <p className="text-base text-muted-foreground">
                          Người ghi: {n.shipment.operator}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-base text-muted-foreground">
                        Chuyến này
                      </span>
                      <span className="tnum text-xl font-semibold">
                        {kg(n.totalKg)}
                      </span>
                      {!isShipmentLocked && (
                        <Button
                          title="Mở lại chuyến này để sửa dòng hàng, số kg hay giá. Ngày đã chốt thì phải mở khóa trước." variant="outline" onClick={() => openShipmentEdit(n)}>
                          <Pencil />
                          Sửa chuyến
                        </Button>
                      )}
                      {n.shipment && (
                        <Button
                          title="In tem QR cho chuyến này — mỗi loại nguyên liệu một tem (loại + kg) để dán đúng sọt, sau quét tra ngược được nguồn gốc."
                          variant="outline"
                          onClick={() => setLabelShipment(n.shipment)}
                        >
                          <QrCode />
                          In tem QR
                        </Button>
                      )}
                    </div>
                  </div>

                  <RecordTable
                    columns={itemColumns(isShipmentLocked)}
                    rows={n.dong}
                    getKey={(r) => r.id}
                    rowMarkKey="nhap-hang"
                  />
                </section>
              );
            })}
          </div>

          <div className="flex flex-wrap justify-end gap-x-10 gap-y-3 rounded-xl bg-muted px-5 py-4">
            <div className="flex items-baseline gap-3">
              <span className="text-base text-muted-foreground">
                Tổng khối lượng
              </span>
              <span className="tnum text-xl font-semibold">{kg(total)}</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-base text-muted-foreground">
                Tổng tiền hàng
              </span>
              <span className="tnum text-xl font-semibold">
                {num(totalAmount)} đ
              </span>
            </div>
          </div>
        </>
      )}

      {/* Phế liệu cân gộp cuối ngày theo phân xưởng */}
      {isSingleDayWorkshop && (
        <DailyScrapSection
          date={effectiveFrom}
          workshop={viewedWorkshop}
          rows={scraps}
          onChange={persistScraps}
          isLocked={isDayLocked}
          readOnly
        />
      )}
        </>
      )}

      {/* Form ghi chuyến đã chuyển INLINE (chế độ "Ghi nhập" — biến formGhi ở trên). */}

      {/* ---- Hộp thoại: chốt ngày ---- */}
      <Dialog open={isConfirmingLock} onOpenChange={setIsConfirmingLock}>
        <DialogContent className="w-full sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Chốt số liệu ngày này?</DialogTitle>
            <DialogDescription className="text-base">
              Chốt xong ngày {formatDateVN(effectiveFrom)} · xưởng {viewedWorkshop} sẽ khóa: không
              sửa, không xóa, không thêm chuyến thường. Ghi thêm chỉ còn đường
              ghi bù (bắt buộc ghi lý do) hoặc mở lại ngày.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="rounded-xl bg-muted px-5 py-4">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-base text-muted-foreground">
                  Tổng khối lượng chốt
                </span>
                <span className="tnum text-2xl font-semibold">
                  {kg(actualTotal)}
                </span>
              </div>
            </div>
            <Field label="Ghi chú khi chốt">
              <Input
                value={lockNote}
                onChange={(e) => setLockNote(e.target.value)}
                placeholder="VD: đã đối chiếu với sổ giấy của chị Thủy"
              />
            </Field>
          </div>

          <DialogFooter>
            <Button
              title="Chưa chốt vội — đóng hộp thoại, sổ ngày vẫn mở."
              variant="outline"
              size="lg"
              onClick={() => setIsConfirmingLock(false)}
            >
              Chưa chốt
            </Button>
            <Button
              title="Xác nhận khóa sổ ngày này." size="lg" onClick={lockDay}>
              <Lock />
              Chốt ngày
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Hộp thoại: nhắc còn dòng nhập chưa lưu trước khi chốt ---- */}
      <Dialog open={showSaveReminder} onOpenChange={setShowSaveReminder}>
        <DialogContent className="w-full sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              Còn dòng nhập chưa lưu vào sổ
            </DialogTitle>
            <DialogDescription className="text-base">
              Bạn đang gõ dở một chuyến nhập nhưng chưa bấm{" "}
              <strong>"Lưu vào sổ"</strong>. Chốt ngay thì số vừa gõ{" "}
              <strong>chưa được tính vào tổng chốt</strong>. Lưu vào sổ trước cho
              chắc.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex-wrap gap-2">
            <Button
              title="Đóng nhắc nhở, về lại form để nhập nốt dòng đang gõ dở."
              variant="ghost"
              size="lg"
              onClick={() => setShowSaveReminder(false)}
            >
              Quay lại nhập tiếp
            </Button>
            <Button
              title="Chốt ngày luôn và BỎ dòng đang gõ dở — dòng đó sẽ không vào sổ."
              variant="outline"
              size="lg"
              onClick={() => {
                setShowSaveReminder(false);
                setIsConfirmingLock(true);
              }}
            >
              Vẫn chốt (bỏ dòng đang gõ)
            </Button>
            <Button
              title="Ghi dòng đang gõ vào sổ trước, rồi mới chốt ngày — không mất dữ liệu."
              size="lg"
              onClick={() => {
                if (saveSession(false)) {
                  resetSession();
                  setShowSaveReminder(false);
                  setIsConfirmingLock(true);
                }
              }}
            >
              <Save />
              Lưu vào sổ rồi chốt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Hộp thoại: mở lại ngày ---- */}
      <Dialog open={isConfirmingReopen} onOpenChange={setIsConfirmingReopen}>
        <DialogContent className="w-full sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Mở lại ngày đã chốt?</DialogTitle>
            <DialogDescription className="text-base">
              Ngày {formatDateVN(effectiveFrom)} · xưởng {viewedWorkshop} đang khóa. Mở lại thì
              sửa/xóa được như thường — nhớ chốt lại sau khi sửa xong.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <ErrorSummary errors={lockErrors} />
            <RequiredLegend />
            <Field label="Lý do mở lại" required>
              <Input
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="VD: đại lý báo lại số cân của chuyến chiều"
              />
            </Field>
          </div>

          <DialogFooter>
            <Button
              title="Giữ nguyên khóa — không mở lại ngày."
              variant="outline"
              size="lg"
              onClick={() => setIsConfirmingReopen(false)}
            >
              Giữ khóa
            </Button>
            <Button
              title="Xác nhận mở khóa ngày này để sửa hoặc ghi bù." size="lg" onClick={reopenDay}>
              <LockOpen />
              Mở lại ngày
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Phiếu báo cáo tổng hợp nguyên liệu (in A4 ngang, theo kỳ) ---- */}
      {showInvoice && (
        <DailyImportInvoice
          ky={ky}
          date={date}
          startDate={fromDate}
          endDate={toDate}
          workshop={workshop}
          rows={rows}
          scraps={scraps}
          onClose={() => setShowInvoice(false)}
        />
      )}
      {labelShipment && (
        <LotLabelPrint shipment={labelShipment} onClose={() => setLabelShipment(null)} />
      )}
      {isPrintingBlank && (
        <BlankDailyImportSlip onClose={() => setIsPrintingBlank(false)} />
      )}

      {/* ---- Nhận diện ảnh phiếu (OCR) → gợi ý điền form Ghi nhập ---- */}
      {ocrMo && session && (
        <ImportSlipOcr
          catalog={ocrCatalog}
          onImageSaved={(path) => setSessionField("scanPath", path)}
          onApplySupplier={(name) => setSessionField("supplierName", name)}
          onApplyDate={(iso) => changeDeliveryDate(iso)}
          onAddRow={addRowFromOcr}
          onClose={() => setOcrMo(false)}
        />
      )}
      {supplierEditor.dialog}
      {materialTypeEditor.dialog}
    </div>
  );
}

