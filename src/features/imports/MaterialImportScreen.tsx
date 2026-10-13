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
  ChuThichBatBuoc,
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
  SkeletonBang,
  ErrorSummary,
  Field,
  Input,
  Nhan,
  RecordTable,
  ThongKe,
  notify,
  sacTheoTen,
  type Cot,
  type LoiNhap,
  type MucChon,
} from "@/design-system";
import { kg, num, todayISO, formatDateVN } from "@/lib/format";
import { formatMaterialLotLabel } from "@/lib/lotTraceability";
import { useAuth } from "@/lib/auth";
import { DailyTaskReminder, QrTemLoIn, PhieuTrongNhapNL } from "@/features/shared";
import { useSuaDanhMuc } from "@/features/catalog/SuaDanhMucNhanh";
import { OcrPhieuNhap } from "./OcrPhieuNhap";
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
import PhieuNLNgay from "@/features/imports/DailyImportInvoice";
import BaoCaoNhap from "@/features/imports/ImportReport";
import { cn } from "@/lib/utils";

import { HopDoiLoaiHangLoat } from "./BulkTypeChange";

import { BangDongHang } from "./BangDongHang";
import { ChuyenTrongNgay, TheBuoc, TheChon } from "./BuocNhap";
import { KhoiPheLieuNgay } from "./KhoiPheLieuNgay";
import {
  LOAI_MAC_DINH,
  PHAN_XUONG,
  daiLyHayGiao,
  xeCuaDaiLy,
  mauDongCuaDaiLy,
  apMauDaiLyMoi,
  dongGoiYBoQua,
  chuanBienSo,
  dongBangRong,
  dongCoData,
  dongDayDu,
  gomChuyen,
  loiDauChuyen,
  sinhMaLo,
  type DauChuyen,
  type DongBang,
  type NhomChuyen,
} from "./importHelpers";

export default function NhapNguyenLieuScreen() {
  // Người đang đăng nhập → gắn làm "người ghi" của chuyến khi lưu.
  const { nguoiDung } = useAuth();
  const operator = nguoiDung?.fullName || nguoiDung?.username || "";
  // kỳ xem sổ: ngày/tuần/tháng/năm/khoảng tự chọn
  const [rows, persist, { trangThai }] = useMaterialImports();
  const isLoading = trangThai === "dang-tai" && rows.length === 0;
  const [shipments, persistShipments] = useImportShipments();
  const [locks, persistLocks, { trangThai: ttChot }] = useDailyLocks();
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
  const [phien, setPhien] = useState<DauChuyen | null>(null);
  /** Ba chế độ phẳng: "nhap" = form ghi (mặc định); "so" = sổ ngày; "bao-cao" = báo cáo tổng hợp. */
  const [cheDo, setCheDo] = useState<"nhap" | "so" | "bao-cao">("nhap");
  const [ocrMo, setOcrMo] = useState(false); // modal nhận diện ảnh phiếu (OCR)
  const [labelShipment, setLabelShipment] = useState<ImportShipment | null>(null);
  const [sessionShipmentId, setSessionShipmentId] = useState<string | null>(null);
  const [tableRows, setTableRows] = useState<DongBang[]>([]);
  /** Loài dùng gần nhất trong phiên — làm mặc định cho chuyến/dòng mới thay vì
   *  luôn nhảy về "Bạch tuộc" (sai ở xưởng Khô/Cá). */
  const [lastCategory, setLastCategory] = useState<Category>(LOAI_MAC_DINH);
  const [loiPhien, setLoiPhien] = useState<LoiNhap[]>([]);
  // Khối "Xe và ghi chú" (tài xế/biển số) mở sẵn — hầu hết chuyến đều có.
  const [moPhuPhien, setMoPhuPhien] = useState(true);
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
  const [lockErrors, setLockErrors] = useState<LoiNhap[]>([]);

  /** [từ, đến] của kỳ đang xem — mọi lọc/tổng tính theo khoảng này. */
  const [tuHieuLuc, denHieuLuc] = getViewPeriodRange(ky, date, fromDate, toDate);
  /** Kỳ chỉ gồm đúng một ngày ⇒ mới có nghĩa để chốt / phế liệu ngày. */
  const isSingleDay = tuHieuLuc === denHieuLuc;

  const view = useMemo(
    () =>
      rows
        .filter((r) => {
          const matchesDate =
            r.deliveryDate >= tuHieuLuc && r.deliveryDate <= denHieuLuc;
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
    [rows, tuHieuLuc, denHieuLuc, workshop, supplierFilter, materialTypeFilter, priceFilter]
  );

  const nhomView = useMemo(() => gomChuyen(view, shipments), [view, shipments]);

  /** Ngày / xưởng mặc định khi ghi chuyến mới — theo bộ lọc đang xem. */
  const postingDate = isSingleDay ? tuHieuLuc : denHieuLuc;
  const recordWorkshop: Workshop = workshop === "Tất cả" ? "Đông" : workshop;

  const rangeDescription = isSingleDay
    ? formatDateVN(tuHieuLuc)
    : `${formatDateVN(tuHieuLuc)} – ${formatDateVN(denHieuLuc)}`;

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
    ? lockRecordOf(tuHieuLuc, viewedWorkshop)
    : undefined;
  const isDayLocked = Boolean(currentLock?.isLocked);
  const actualTotal = isSingleDayWorkshop
    ? dayWorkshopTotal(tuHieuLuc, viewedWorkshop)
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

  const supplierOptions: MucChon[] = suppliers.map((d) => ({
    value: d.shortName,
    label: d.code ? `${d.code} · ${d.shortName}` : d.shortName,
    phu: describeSupplier(d),
  }));

  /** Sửa nhanh đại lý / loại NL tại chỗ — sổ nhập nối theo TÊN nên ô tên khoá. */
  const supplierEditor = useSuaDanhMuc("daiLy", suppliers, setSuppliers, { theo: "ten" });
  const materialTypeEditor = useSuaDanhMuc("loaiNL", materialTypes, setMaterialTypes, { theo: "ten" });

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
    notify.daLuu(`Đã thêm đại lý "${ten}" vào danh mục`);
    return ten;
  };

  /** Tất cả loại NL — dùng cho BỘ LỌC (xem theo loại, không ràng loài). */
  const materialTypeOptions: MucChon[] = materialTypes.map((l) => ({
    value: l.name,
    label: l.name,
    phu: l.category || undefined,
  }));

  /** Loại NL lọc theo loài: mục chưa gán loài (loai rỗng) hiện cho mọi loài;
      mục đã gán chỉ hiện đúng loài đang chọn. Chọn loài trước, loại NL sau. */
  const materialTypeOptionsByCategory = (category: string): MucChon[] =>
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
    setMaterialTypes([...materialTypes, { id: uid(), name: ten, category: category, note: "" }]);
    notify.daLuu(`Đã thêm loại nguyên liệu "${ten}" vào danh mục`);
    return ten;
  };

  /* ---- Ghi chuyến ---- */

  /** Bảng loại hàng MỞ ĐẦU cho một chuyến mới: đại lý đã có lịch sử ⇒ điền sẵn
   *  loại + đơn giá gần nhất (chỉ còn gõ kg); chưa có ⇒ một dòng trống. */
  const newTableRows = (dl: string, workshop: Workshop, cat: Category): DongBang[] => {
    const templateRows = mauDongCuaDaiLy(rows, dl, workshop);
    return templateRows.length ? templateRows : [dongBangRong(cat)];
  };

  /** Đưa con trỏ vào ô kg đầu tiên — bước kế tiếp tự nhiên sau khi chọn đại lý/xe. */
  // Focus NGAY trong cú chạm (không hẹn giờ): iPhone chỉ bật bàn phím khi focus nằm
  // trong thao tác của người dùng. Bảng bước ③ luôn có sẵn trong DOM nên làm được.
  // Ưu tiên ô kg còn TRỐNG đầu tiên; cuộn vào giữa màn sau khi bước trên thu lại.
  const focusFirstKgCell = () => {
    const ds = [
      ...document.querySelectorAll<HTMLInputElement>(
        '[data-luoi-phim="dong-hang"] [data-navcol="kg"]'
      ),
    ];
    const o = ds.find((x) => !x.value.trim()) ?? ds[0];
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
    setPhien({
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
    setLoiPhien([]);
    // Ghi chú / SSCC / mã lô ít dùng → thu sẵn; tài xế + biển số đã đưa ra ngoài.
    setMoPhuPhien(false);
    resetSteps(false);
  };

  // Form-first: vào "Ghi nhập" mà chưa có phiếu → tự mở phiếu trống (không modal).
  useEffect(() => {
    if (cheDo === "nhap" && phien === null && !isLoading) openAdd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cheDo, phien, isLoading]);

  // Trong "Ghi nhập", ngày+xưởng của PHIẾU là ngữ cảnh → đồng bộ về bộ lọc để
  // sổ/phế liệu/chốt/tổng ngày bám đúng ngày đang ghi.
  // Chỉ bám ngày + xưởng (không bám cả phiếu) để gõ các ô khác không kéo bộ lọc.
  const sessionDate = phien?.deliveryDate;
  const sessionWorkshop = phien?.workshop;
  useEffect(() => {
    if (cheDo === "nhap" && sessionDate !== undefined && sessionWorkshop !== undefined) {
      setKy("ngay");
      setDate(sessionDate);
      setWorkshop(sessionWorkshop);
    }
  }, [cheDo, sessionDate, sessionWorkshop]);

  /** Mở lại một chuyến đã ghi để sửa — dùng CHUNG dialog với ghi chuyến mới. */
  const openShipmentEdit = (n: NhomChuyen) => {
    setPhien({
      deliveryDate: n.deliveryDate,
      postingDate: n.postingDate || n.deliveryDate,
      backdateReason: n.backdateReason,
      workshop: n.workshop,
      supplierName: n.supplierName,
      driverName: n.driverName,
      licensePlate: n.licensePlate,
      note: n.note,
      ssccCode: n.chuyen?.ssccCode ?? "",
      scanPath: n.chuyen?.scanPath ?? "",
    });
    setSessionShipmentId(n.chuyen?.id ?? null);
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
    setLoiPhien([]);
    setMoPhuPhien(true);
    resetSteps(true);
    setCheDo("nhap"); // sửa chuyến mở trong form inline (chế độ Ghi nhập)
  };

  const setSessionField = <K extends keyof DauChuyen>(k: K, v: DauChuyen[K]) =>
    setPhien((p) => (p ? { ...p, [k]: v } : p));

  /** Đổi ngày ghi sổ: LUÔN kéo ngày hàng về nhảy theo (chủ động). Muốn hàng về
   *  ngày khác (ghi bù) thì sửa tay ô "Ngày hàng về xưởng" sau đó. */
  const changePostingDate = (v: string) =>
    setPhien((p) => (p ? { ...p, postingDate: v, deliveryDate: v } : p));

  /** Chỉnh tay ngày hàng về ⇒ khác ngày ghi sổ (ghi bù). Đổi lại ngày ghi sổ sau
   *  đó thì ngày hàng về vẫn nhảy theo như thường. */
  const changeDeliveryDate = (v: string) => setSessionField("deliveryDate", v);

  /** Chọn ĐẠI LÝ kéo theo cả chuyến: bảng loại hàng điền sẵn theo lượt giao gần
   *  nhất của đại lý (loại + giá), xe cũ hiện thành nút gợi ý. KHÔNG đè khi người
   *  dùng đã gõ số vào bảng, và không đụng bảng khi đang sửa chuyến đã ghi. */
  const pickSupplier = (v: string) => {
    if (!phien) return;
    const isSupplierChanged = v !== phien.supplierName;
    setSessionField("supplierName", v);
    if (v) setOpenPanel(null); // chọn xong ⇒ bước ① thu lại, bước ② (xe) tự mở
    // Chạm lại đúng đại lý đang chọn (mở "Đổi" rồi thôi) ⇒ không đụng xe / bảng.
    if (isEditingShipment || !v || !isSupplierChanged) return;
    // Đổi đại lý ⇒ xe của đại lý cũ không còn đúng (chỉ xóa khi đang ghi chuyến MỚI).
    setPhien((p) => (p ? { ...p, driverName: "", licensePlate: "" } : p));
    setSkipTruck(false);
    setIsManualVehicle(false);
    // Bảng dựng lại theo đại lý MỚI: giữ kg đã gõ, KHÔNG giữ giá điền sẵn của đại lý cũ.
    const templateRows = mauDongCuaDaiLy(rows, v, phien.workshop);
    setTableRows((ds) => apMauDaiLyMoi(ds, templateRows));
  };

  /** Đổi xưởng: mẫu loại hàng tính theo (đại lý + xưởng) ⇒ dựng lại nếu bảng chưa có số. */
  const pickWorkshop = (v: Workshop) => {
    if (!phien) return;
    setSessionField("workshop", v);
    if (isEditingShipment || v === phien.workshop) return;
    const templateRows = mauDongCuaDaiLy(rows, phien.supplierName, v);
    setTableRows((ds) => apMauDaiLyMoi(ds, templateRows));
  };

  /** Chạm BIỂN SỐ: điền biển + tài xế gần nhất của xe đó (ca thường: một chạm là xong)
   *  rồi nhảy xuống ô kg. Khác tài xế thì bấm "Đổi" → chạm tên tài xế. */
  const pickPlate = (x: { licensePlate: string; driverName: string }) => {
    setPhien((p) =>
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
    if (!phien?.licensePlate.trim()) {
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
    setPhien((p) => (p ? { ...p, licensePlate: "", driverName: "" } : p));
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
      phien
        ? daiLyHayGiao(rows, phien.workshop, 8)
            .filter((ten) => suppliers.some((d) => d.shortName === ten))
            .slice(0, 4)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, suppliers, phien?.workshop]
  );
  const truckSuggestions = useMemo(
    () => xeCuaDaiLy(rows, phien?.supplierName ?? ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, phien?.supplierName]
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
      phien
        ? gomChuyen(
            rows.filter(
              (r) => r.deliveryDate === phien.deliveryDate && r.workshop === phien.workshop
            ),
            shipments
          )
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, shipments, phien?.deliveryDate, phien?.workshop]
  );
  const hasVehicleInfo = !!phien && !!(phien.licensePlate.trim() || phien.driverName.trim());
  const hasVehicleHints = truckSuggestions.bienSo.length > 0 || truckSuggestions.taiXe.length > 0;
  /** Bước mở/thu SUY từ dữ liệu, `dangMo` chỉ để ép mở khi bấm "Đổi" / đang gõ tay. */
  const isSupplierStepOpen = openPanel === "dai-ly" || !phien?.supplierName;
  const isVehicleStepOpen = !isSupplierStepOpen && (openPanel === "xe" || (!hasVehicleInfo && !skipTruck));
  /** Hai ô ngày chỉ hiện khi ghi bù (hoặc người dùng chủ động tách). */
  const twoDates =
    !!phien && (splitDates || phien.postingDate !== phien.deliveryDate);
  /** Mã lô của phiếu đang mở: chuyến đã ghi giữ mã cũ, chuyến mới xem trước mã sẽ sinh. */
  const sessionLotCode = !phien
    ? ""
    : sessionShipmentId
      ? (() => {
          const c = shipments.find((x) => x.id === sessionShipmentId);
          return c ? formatMaterialLotLabel(c) : "— (dữ liệu cũ)";
        })()
      : sinhMaLo(phien.deliveryDate, phien.workshop, shipments);
  /** Các dòng trong bảng đủ để lưu (có loại + số lượng). */
  const validRows = tableRows.filter(dongDayDu);
  const shipmentTotal = validRows.reduce((s, d) => s + d.quantityKg, 0);
  const shipmentAmount = validRows.reduce(
    (s, d) => s + d.quantityKg * (d.unitPrice ?? 0),
    0
  );
  /** Dòng điền sẵn chưa gõ kg — sẽ bị bỏ qua khi lưu, phải báo rõ trên thanh lưu. */
  const skipped = dongGoiYBoQua(tableRows);
  /** Số dòng ĐÃ LƯU đang mở trong bảng — cho câu "sửa đầu chuyến áp cho N dòng". */
  const savedRowCount = tableRows.filter((d) => d.id).length;
  /** Đang ở "Ghi nhập" và còn dòng hợp lệ CHƯA lưu vào sổ (dòng mới id=null) —
   *  để nhắc trước khi chốt ngày, kẻo số vừa gõ chưa tính vào tổng chốt. */
  const hasUnsavedRows = cheDo === "nhap" && validRows.some((d) => !d.id);
  const isSessionLocked = phien ? isLocked(phien.deliveryDate, phien.workshop) : false;

  /** Dòng đã lưu thuộc chuyến đang mở (id-set khi sửa; tạo mới thì chưa có gì). */
  const belongsToSavedSession = (r: MaterialImportItem) =>
    editRowIds ? editRowIds.includes(r.id) : false;
  /** Tổng ngày = số đã lưu của ngày/xưởng (trừ chuyến đang mở, khỏi đếm đôi) +
   *  số đang gõ trong bảng ⇒ xem trước tổng ngày ngay cả khi chưa lưu. */
  const dayTotalExShipment = phien
    ? rows
        .filter(
          (r) =>
            r.deliveryDate === phien.deliveryDate &&
            r.workshop === phien.workshop &&
            !belongsToSavedSession(r)
        )
        .reduce((s, r) => s + (r.quantityKg || 0), 0)
    : 0;
  const sessionDayTotal = dayTotalExShipment + shipmentTotal;

  /** Sửa một ô trong bảng (không tự sinh/xô dòng — thêm dòng bằng nút riêng). */
  const updateRow = (key: string, patch: Partial<DongBang>) =>
    setTableRows((ds) =>
      ds.map((d) => {
        if (d.key !== key) return d;
        // Tự tay đổi loài/loại ⇒ thành dòng thường (thiếu kg sẽ bị nhắc khi lưu).
        // Chỉ sửa GIÁ thì vẫn là dòng gợi ý: không gõ kg thì vẫn tự bỏ qua.
        const isTypeEdit = "category" in patch || "materialTypeName" in patch;
        return {
          ...d,
          ...patch,
          goiY: isTypeEdit ? false : d.goiY,
          // Giá vừa tự gõ không còn là "giá lượt trước".
          giaNgay: isTypeEdit || "unitPrice" in patch ? undefined : d.giaNgay,
        };
      })
    );

  /** Bỏ một dòng; luôn còn ít nhất một dòng để nhập. */
  const removeRow = (key: string) =>
    setTableRows((ds) => {
      const con = ds.filter((d) => d.key !== key);
      return con.length ? con : [dongBangRong(lastCategory)];
    });

  /** Thêm một dòng trống ở CUỐI bảng (mặc định loài theo dòng cuối cho nhanh). */
  const addNewRow = () =>
    setTableRows((ds) => [
      ...ds,
      dongBangRong(ds[ds.length - 1]?.category ?? lastCategory),
    ]);

  /* ---- OCR: chụp ảnh phiếu → gợi ý điền form (nháp, người soát lại) ---- */

  /** Danh mục để OCR dò khớp tên trên phiếu (đại lý theo tên tắt, loại NL). */
  const ocrCatalog: OcrCatalog = useMemo(
    () => ({
      daiLy: suppliers.map((d) => ({ name: d.shortName, code: d.code })),
      loaiNL: materialTypes.map((l) => ({ name: l.name })),
    }),
    [suppliers, materialTypes]
  );

  /** OCR đề xuất một dòng: nối vào bảng (thay dòng trống đầu nếu bảng chưa có data). */
  const addRowFromOcr = (ten: string, soKg: number) =>
    setTableRows((ds) => {
      const mt = materialTypes.find((l) => l.name === ten);
      const cat = (mt?.category || ds[ds.length - 1]?.category || lastCategory) as Category;
      const newRow: DongBang = { ...dongBangRong(cat), materialTypeName: ten, quantityKg: soKg };
      return ds.some(dongCoData) ? [...ds, newRow] : [newRow];
    });

  /** Mở ảnh phiếu đã đính (signed URL có hạn) để đối chiếu tay. */
  const viewScanImage = async () => {
    if (!phien?.scanPath) return;
    const url = await getPhotoUrl(phien.scanPath);
    if (url) window.open(url, "_blank", "noopener");
    else notify.loi("Chưa xem được ảnh (cần đăng nhập máy chủ).");
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
    if (!phien) return true;
    const validRows = tableRows.filter(dongDayDu);
    const ls: LoiNhap[] = [...loiDauChuyen(phien, isSessionLocked)];
    if (validRows.length === 0)
      ls.push({
        truong: "Loại hàng",
        thongBao: tableRows.some((d) => d.goiY)
          ? "Chưa gõ số kg cho loại hàng nào"
          : "Thêm ít nhất một loại hàng vào chuyến",
      });
    // Dòng dở dang (có loại thiếu số, hoặc có số chưa chọn loại): chỉ chặn khi
    // người dùng bấm Lưu — đóng nhanh bằng X thì lặng lẽ bỏ dòng dở, giữ dòng đủ.
    if (!imLang)
      tableRows.forEach((d, i) => {
        if (dongCoData(d) && !dongDayDu(d))
          ls.push({
            truong: `Dòng ${i + 1}`,
            thongBao: !d.materialTypeName.trim()
              ? "Chưa chọn loại hàng"
              : "Số lượng phải lớn hơn 0 kg",
          });
      });

    if (ls.length > 0) {
      if (!imLang) setLoiPhien(ls);
      return false;
    }

    // Sửa dữ liệu cũ (không có bản ghi chuyến) → giữ chuyenId rỗng, gom nhóm nhờ
    // (ngày + xưởng + đại lý + xe). KHÔNG tự sinh chuyến cho dữ liệu cũ.
    const isEditingLegacy = isEditingShipment && !sessionShipmentId;
    let shipmentId = sessionShipmentId;
    let nextShipments = shipments;
    if (sessionShipmentId) {
      nextShipments = shipments.map((c) =>
        c.id === sessionShipmentId ? { ...c, ...phien, id: c.id } : c
      );
    } else if (!isEditingLegacy) {
      shipmentId = newId();
      nextShipments = [
        ...shipments,
        {
          id: shipmentId,
          ...phien,
          lotCode: sinhMaLo(phien.deliveryDate, phien.workshop, shipments),
          operator: operator,
        },
      ];
    }

    // Dòng của chuyến = các dòng hợp lệ trong bảng: dòng cũ giữ id (cập nhật),
    // dòng mới cấp id mới; dòng đã bỏ khỏi bảng không đưa lại (tức là xóa).
    const rowsGiuLai = rows.filter((r) => !belongsToSavedSession(r));
    const shipmentRows: MaterialImportItem[] = validRows.map((d) => ({
      id: d.id ?? newId(),
      shipmentId: shipmentId ?? "",
      deliveryDate: phien.deliveryDate,
      workshop: phien.workshop,
      category: d.category,
      supplierName: phien.supplierName,
      materialTypeName: d.materialTypeName,
      quantityKg: d.quantityKg,
      unitPrice: d.unitPrice,
      driverName: phien.driverName,
      licensePlate: phien.licensePlate,
      note: phien.note,
    }));
    persistShipments(nextShipments);
    persist([...rowsGiuLai, ...shipmentRows]);

    const newTotal = validRows.reduce((s, d) => s + d.quantityKg, 0);
    const savedShipment = shipmentId ? nextShipments.find((c) => c.id === shipmentId) : undefined;
    notify.daLuu(
      `Đã lưu chuyến ${phien.supplierName} — ${validRows.length} loại · ${kg(newTotal)}`,
      undefined,
      savedShipment ? { label: "In tem", onClick: () => setLabelShipment(savedShipment) } : undefined
    );
    // Ngày đã chốt mà ghi thêm → báo ngay tổng ngày lệch bao nhiêu so với lúc chốt.
    const bg = lockRecordOf(phien.deliveryDate, phien.workshop);
    if (bg?.isLocked)
      notify.canhBao(
        `Ngày ${formatDateVN(phien.deliveryDate)} đã chốt ${kg(bg.totalKgAtLock)} — sau khi ghi bù thành ${kg(dayTotalExShipment + newTotal)}`
      );

    // Nhớ loài cuối để chuyến/dòng sau khỏi nhảy về "Bạch tuộc".
    setLastCategory(validRows[validRows.length - 1].category);

    // Ghi ngày ngoài kỳ đang lọc → kéo bộ lọc về chuyến vừa ghi (khỏi tưởng mất).
    if (phien.deliveryDate < tuHieuLuc || phien.deliveryDate > denHieuLuc) {
      setKy("ngay");
      setDate(phien.deliveryDate);
    }
    if (workshop !== "Tất cả" && workshop !== phien.workshop)
      setWorkshop(phien.workshop);
    if (supplierFilter && supplierFilter !== phien.supplierName) setSupplierFilter("");
    if (priceFilter === "thieu-gia") setPriceFilter("tat-ca");
    return true;
  };

  const resetSession = () => {
    setPhien(null);
    setSessionShipmentId(null);
    setEditRowIds(null);
    setTableRows([]);
    setLoiPhien([]);
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
    setPhien((p) =>
      p
        ? { ...p, driverName: "", licensePlate: "", note: "", ssccCode: "", scanPath: "" }
        : p
    );
    setSessionShipmentId(null);
    setEditRowIds(null);
    setTableRows(newTableRows(phien?.supplierName ?? "", phien?.workshop ?? recordWorkshop, lastRowCategory));
    setLoiPhien([]);
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
    notify.daXoa(
      `Đã xóa chuyến ${phien?.supplierName || ""} — ${editRowIds.length} dòng`,
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
    if (ttChot === "dang-tai") {
      notify.loi("Đang tải sổ chốt ngày từ máy chủ — đợi vài giây rồi bấm chốt lại");
      return;
    }
    const bg = lockRecordOf(tuHieuLuc, viewedWorkshop);
    const ban: DailyLock = {
      /* Có bản ghi (kể cả đã mở lại) ⇒ dùng lại id. Chưa có ⇒ id CỐ ĐỊNH theo khoá
         nghiệp vụ (ngày|xưởng), không newId(): hai máy cùng chốt một ngày sẽ ghi
         CÙNG một dòng thay vì hai id đụng chỉ mục duy nhất và kẹt hàng chờ. */
      id: bg?.id ?? `${tuHieuLuc}|${viewedWorkshop}`,
      lockDate: tuHieuLuc,
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
    notify.daLuu(
      `Đã chốt ngày ${formatDateVN(tuHieuLuc)} · xưởng ${viewedWorkshop} — ${kg(actualTotal)}`
    );
    setIsConfirmingLock(false);
    setLockNote("");
  };

  const reopenDay = () => {
    const bg = lockRecordOf(tuHieuLuc, viewedWorkshop);
    if (!bg) return;
    if (!reopenReason.trim()) {
      setLockErrors([
        { truong: "Lý do mở lại", thongBao: "Phải ghi rõ vì sao mở lại ngày" },
      ]);
      return;
    }
    persistLocks(
      locks.map((c) =>
        c.id === bg.id ? { ...c, isLocked: false, reopenReason: reopenReason } : c
      )
    );
    notify.canhBao(
      `Đã mở lại ngày ${formatDateVN(tuHieuLuc)} · xưởng ${viewedWorkshop} — sửa xong nhớ chốt lại`
    );
    setIsConfirmingReopen(false);
    setReopenReason("");
    setLockErrors([]);
  };

  /* ---- Cột bảng dòng hàng trong một chuyến ---- */

  const itemColumns = (isShipmentLocked: boolean): Cot<MaterialImportItem>[] => [
    {
      key: "materialTypeName",
      header: "Loại nguyên liệu",
      chinh: true,
      render: (r) => r.materialTypeName,
      sapXep: (r) => r.materialTypeName,
    },
    {
      key: "category",
      header: "Loài",
      render: (r) => <Nhan loai="phan-loai" sac={sacTheoTen(r.category)}>{r.category}</Nhan>,
      sapXep: (r) => r.category,
    },
    {
      key: "sl",
      header: "Số lượng (kg)",
      so: true,
      render: (r) => num(r.quantityKg),
      sapXep: (r) => r.quantityKg,
    },
    {
      key: "gia",
      header: "Đơn giá (đ)",
      so: true,
      render: (r) =>
        r.unitPrice != null ? (
          num(r.unitPrice)
        ) : (
          <Nhan loai="loi">Chưa có giá</Nhan>
        ),
      sapXep: (r) => r.unitPrice ?? 0,
    },
    {
      key: "tien",
      header: "Thành tiền (đ)",
      so: true,
      render: (r) => num(calculateImportAmount(r)),
      sapXep: (r) => calculateImportAmount(r),
    },
    ...(isShipmentLocked
      ? [
          {
            key: "khoa",
            header: "Trạng thái",
            render: () => (
              <Nhan loai="xong" icon={Lock}>
                Đã chốt
              </Nhan>
            ),
          } as Cot<MaterialImportItem>,
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
              {isDayLocked ? "Đã chốt" : "Chưa chốt"} {formatDateVN(tuHieuLuc)} · xưởng{" "}
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
  const entryForm = phien && (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] xl:items-start">
      <div className="min-w-0 space-y-4">
        <ErrorSummary loi={loiPhien} />

        {/* THANH NGỮ CẢNH — ngày + xưởng của cả phiếu */}
        <div className="space-y-3 rounded-xl border-2 border-border bg-card p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {twoDates ? (
              <>
                <DateField
                  label="Ngày ghi sổ"
                  required
                  info="Ngày ghi vào hệ thống. Chọn ngày này thì ngày hàng về tự nhảy theo. Cần khác thì sửa ô ngày hàng về bên cạnh."
                  value={phien.postingDate}
                  onChange={changePostingDate}
                />
                <DateField
                  label="Ngày hàng về xưởng"
                  required
                  info="Ngày xe đổ hàng thật — mọi tổng hợp tính theo ngày này. Sửa tay ô này khi hàng về hôm khác (ghi bù)."
                  value={phien.deliveryDate}
                  onChange={changeDeliveryDate}
                />
              </>
            ) : (
              <DateField
                label="Ngày hàng về"
                required
                info="Ngày xe đổ hàng — cũng là ngày ghi sổ. Hàng về hôm trước mà nay mới ghi thì bấm “Ghi bù” bên dưới để tách hai ngày."
                value={phien.deliveryDate}
                onChange={changePostingDate}
              />
            )}
            <ChoiceGroup
              label="Phân xưởng"
              required
              cot={3}
              className={twoDates ? "sm:col-span-2" : undefined}
              value={phien.workshop}
              onChange={(v) => pickWorkshop(v as Workshop)}
              options={PHAN_XUONG.map((p) => ({ value: p, label: p }))}
            />
          </div>

          {(isBackdatedImport(phien) || isSessionLocked) && (
            <Field
              label="Lý do ghi bù"
              required
              hint="VD: đại lý chưa xuất hóa đơn, 31/7 mới có chứng từ."
            >
              <Input
                value={phien.backdateReason}
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
              !isBackdatedImport(phien) && (
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
            {phien.scanPath && (
              <span className="flex items-center gap-1">
                <Nhan loai="xong">Đã đính ảnh phiếu</Nhan>
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
              Ngày {formatDateVN(phien.deliveryDate)} · xưởng {phien.workshop}{" "}
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
        <TheBuoc
          so={1}
          tieuDe="Đại lý giao hàng"
          xong={!!phien.supplierName}
          mo={isSupplierStepOpen}
          tomTat={phien.supplierName}
          onDoi={() => setOpenPanel("dai-ly")}
        >
          {!isEditingShipment && dlHayGiao.length > 0 && (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {dlHayGiao.map((ten) => (
                <TheChon
                  key={ten}
                  tieuDe={ten}
                  phu={lastDateBySupplier.get(ten) ? `Gần nhất ${formatDateVN(lastDateBySupplier.get(ten) ?? "")}` : undefined}
                  dangChon={phien.supplierName === ten}
                  title={`Chọn đại lý ${ten} — tự điền sẵn các loại hàng và đơn giá theo lượt giao gần nhất, chỉ còn gõ số kg.`}
                  onClick={() => pickSupplier(ten)}
                />
              ))}
            </div>
          )}
          <Combobox
            label={dlHayGiao.length > 0 && !isEditingShipment ? "Đại lý khác" : "Đại lý giao hàng"}
            required
            anNhanBatBuoc
            value={phien.supplierName}
            onChange={pickSupplier}
            options={supplierOptions}
            onCreate={addSupplier}
            emptyText="Chưa có đại lý nào trong danh mục."
            onSuaMuc={supplierEditor.moSua}
            nhanSua={supplierEditor.nhanSua}
          />
        </TheBuoc>

        {/* ② XE — xe cũ của đại lý bấm một chạm; xe lạ thì gõ tay; không có thì bỏ qua */}
        <TheBuoc
          so={2}
          tieuDe="Xe chở hàng"
          xong={hasVehicleInfo || skipTruck}
          mo={isVehicleStepOpen}
          tomTat={
            hasVehicleInfo
              ? [phien.licensePlate, phien.driverName].filter(Boolean).join(" · ")
              : phien.supplierName
                ? "Không ghi xe"
                : undefined
          }
          onDoi={phien.supplierName ? () => setOpenPanel("xe") : undefined}
        >
          {truckSuggestions.bienSo.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Biển số — chạm là điền luôn tài xế hay lái xe đó
              </p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {truckSuggestions.bienSo.map((x) => (
                  <TheChon
                    key={x.licensePlate}
                    icon={<Truck />}
                    tieuDe={x.licensePlate}
                    phu={x.driverName || undefined}
                    dangChon={chuanBienSo(x.licensePlate) === chuanBienSo(phien.licensePlate)}
                    title="Điền biển số này kèm tài xế gần nhất lái xe đó, rồi nhảy xuống gõ số kg. Khác tài xế thì bấm Đổi và chạm tên tài xế."
                    onClick={() => pickPlate(x)}
                  />
                ))}
              </div>
            </div>
          )}
          {truckSuggestions.taiXe.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Tài xế</p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {truckSuggestions.taiXe.map((ten) => (
                  <TheChon
                    key={ten}
                    tieuDe={ten}
                    dangChon={ten.toLowerCase() === phien.driverName.trim().toLowerCase()}
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
                  value={phien.licensePlate}
                  onFocus={() => setOpenPanel("xe")}
                  onChange={(e) => setSessionField("licensePlate", e.target.value)}
                  placeholder="VD: 86C 19555"
                />
              </Field>
              <Field label="Tài xế">
                <Input
                  value={phien.driverName}
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
        </TheBuoc>

        {/* ③ LOẠI HÀNG & KG — bảng điền sẵn theo đại lý, chỉ còn gõ số */}
        <TheBuoc
          so={3}
          tieuDe="Loại hàng và số kg"
          xong={validRows.length > 0}
          mo
        >
          <p className="text-sm text-muted-foreground">
            {tableRows.some((d) => d.goiY)
              ? "Đã điền sẵn loại + giá theo lượt gần nhất — chỉ gõ số kg, Enter xuống dòng. Dòng không có kg tự bỏ qua."
              : "Mỗi loại một dòng. Đơn giá để trống nếu chưa có hóa đơn."}
          </p>
          <BangDongHang
            dong={tableRows}
            onSua={updateRow}
            onBo={removeRow}
            onThem={addNewRow}
            optLoaiTheoLoai={materialTypeOptionsByCategory}
            onTaoLoai={addMaterialType}
            onSuaLoai={materialTypeEditor.moSua}
            onEnterCuoi={focusSaveButton}
          />
        </TheBuoc>

        <div className="rounded-xl border-2 border-border bg-card">
          <button
            title="Mở / thu phần ít dùng của chuyến: ghi chú, mã SSCC, mã lô nội bộ (không bắt buộc)."
            type="button"
            onClick={() => setMoPhuPhien((v) => !v)}
            aria-expanded={moPhuPhien}
            className="flex min-h-11 w-full items-center justify-between gap-3 px-4 text-left font-semibold"
          >
            <span>
              Ghi chú · mã lô{" "}
              <span className="tnum font-normal text-muted-foreground">{sessionLotCode}</span>
            </span>
            <ChevronDown
              className={`size-6 shrink-0 transition-transform ${moPhuPhien ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
          {moPhuPhien && (
            <div className="space-y-4 border-t-2 border-border p-4">
              <Field label="Ghi chú">
                <Input
                  value={phien.note}
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
                    value={phien.ssccCode}
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
                  moTaBanGhi={`Chuyến ${phien?.supplierName || "(chưa có đại lý)"} — ${formatDateVN(phien?.deliveryDate ?? "")} — ${savedRowCount} dòng — ${kg(shipmentTotal)}`}
                  onConfirm={deleteEditingShipment}
                  tieuDe="Xóa cả chuyến này?"
                  nhanNut="Xóa chuyến"
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
              Đã ghi ngày {formatDateVN(phien.deliveryDate)} · xưởng {phien.workshop}
            </p>
            <p className="text-muted-foreground">
              {sessionDayGroups.length} chuyến ·{" "}
              <span className="tnum text-lg font-semibold text-foreground">
                {kg(sessionDayTotal)}
              </span>
            </p>
          </div>
          <ChuyenTrongNgay
            nhom={sessionDayGroups}
            khoa={isSessionLocked}
            dangSuaKhoa={sessionShipmentId}
            onSua={openShipmentEdit}
            onInTem={(n) => n.chuyen && setLabelShipment(n.chuyen)}
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
        <KhoiPheLieuNgay
          ngay={phien.deliveryDate}
          phanXuong={phien.workshop}
          rows={scraps}
          onChange={persistScraps}
          khoa={isSessionLocked}
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
            onClick={() => setCheDo("nhap")}
            className={cn(
              "flex-1 px-4 py-2.5 text-base font-semibold transition-colors sm:flex-none",
              cheDo === "nhap"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            📝 Ghi nhập
          </button>
          <button
            title="Tổng hợp nhập hàng theo kỳ (xuất Excel / in) và tra cứu sổ chi tiết các chuyến theo ngày, đại lý, loại, thiếu giá."
            type="button"
            onClick={() => setCheDo("bao-cao")}
            className={cn(
              "flex-1 border-l-2 border-border px-4 py-2.5 text-base font-semibold transition-colors sm:flex-none",
              cheDo !== "nhap"
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
      {cheDo !== "nhap" && (
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
              onClick={() => setCheDo(id)}
              className={cn(
                "flex-1 px-4 py-2 font-semibold transition-colors sm:flex-none",
                i > 0 && "border-l-2 border-border",
                cheDo === id ? "bg-accent text-foreground" : "bg-card text-muted-foreground hover:bg-muted"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {cheDo === "bao-cao" && <BaoCaoNhap />}

      {isTypeChangeOpen && (
        <HopDoiLoaiHangLoat
          rows={rows}
          loaiNL={materialTypes}
          onThemLoaiNL={addMaterialType}
          suaLoai={materialTypeEditor}
          onClose={() => setIsTypeChangeOpen(false)}
          onLuu={(ids, targetType) => {
            const bo = new Set(ids);
            const prevRows = rows;
            persist(
              rows.map((r) => (bo.has(r.id) ? { ...r, materialTypeName: targetType } : r))
            );
            notify.daLuu(`Đã đổi ${ids.length} chuyến sang "${targetType}"`, () =>
              persist(prevRows)
            );
            setIsTypeChangeOpen(false);
          }}
        />
      )}

      {cheDo === "nhap" && (
        <DailyTaskReminder daChot={isImportLockedToday} viec={`chuyến nhập nguyên liệu hôm nay — xưởng ${recordWorkshop}`} />
      )}

      {cheDo === "nhap" && entryForm}

      {cheDo === "so" && (
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

      <ThongKe
        className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        the={[
          { nhan: "Đang xem", giaTri: rangeDescription, icon: CalendarRange, mau: "trung-tinh" },
          { nhan: "Phân xưởng", giaTri: workshop, icon: Warehouse, mau: "trung-tinh" },
          { nhan: "Số chuyến", giaTri: nhomView.length, so: true, icon: Truck, mau: "brand" },
          { nhan: "Số dòng", giaTri: view.length, so: true, icon: FileText, mau: "brand" },
          { nhan: "Tổng nhập", giaTri: kg(total), so: true, icon: Scale, mau: "success" },
        ]}
      />

      {/* Bộ lọc — toolbar một hàng; lọc ít dùng gom vào "Bộ lọc thêm" để sổ
          hiện ngay, không phải cuộn qua cả khối lọc */}
      <div className="space-y-4 rounded-xl border-2 border-border p-4">
        <div className="flex flex-wrap items-end gap-4">
          <Combobox
            label="Kỳ xem sổ"
            anNhanBatBuoc
            choPhepXoa={false}
            value={ky}
            onChange={(v) => setKy(v as ViewPeriod)}
            options={KY_OPT}
            className="min-w-[13rem]"
          />

          <div className="min-w-[220px] flex-1">
            {ky === "tuy-chon" ? (
              <DateRangeField
                label="Khoảng ngày hàng về xưởng"
                anNhanBatBuoc
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
                anNhanBatBuoc
                hint={
                  ky === "ngay"
                    ? undefined
                    : `Kỳ đang xem: ${formatDateVN(tuHieuLuc)} – ${formatDateVN(denHieuLuc)}`
                }
                value={date}
                onChange={setDate}
              />
            )}
          </div>

          <Combobox
            label="Phân xưởng"
            anNhanBatBuoc
            choPhepXoa={false}
            value={workshop}
            onChange={(v) => setWorkshop(v as Workshop | "Tất cả")}
            options={[
              ...PHAN_XUONG.map((p) => ({ value: p, label: p })),
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
                anNhanBatBuoc
                value={supplierFilter}
                onChange={setSupplierFilter}
                options={supplierOptions}
                placeholder="Tất cả đại lý"
              />
              <Combobox
                label="Loại nguyên liệu"
                anNhanBatBuoc
                value={materialTypeFilter}
                onChange={setMaterialTypeFilter}
                options={materialTypeOptions}
                placeholder="Tất cả loại"
              />
            </div>

            <ChoiceGroup
              label="Trạng thái giá"
              anNhanBatBuoc
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
              cot={2}
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
        <SkeletonBang />
      ) : nhomView.length === 0 ? (
        <EmptyState
          icon={Truck}
          tieuDe={`Chưa có chuyến nào trong ${rangeDescription}`}
          moTa={
            priceFilter === "thieu-gia"
              ? "Đang lọc “Chưa có giá”. Bỏ lọc để xem đủ sổ."
              : workshop === "Tất cả"
                ? "Chuyển sang “Ghi nhập” để ghi chuyến đầu tiên."
                : `Phân xưởng ${workshop}. Chuyển sang “Ghi nhập” để ghi chuyến.`
          }
          action={
            <Button
              title="Chuyển sang chế độ Ghi để nhập chuyến mới cho ngày này." size="lg" onClick={() => setCheDo("nhap")}>
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
                  key={n.khoa}
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
                        {n.ghiBu && (
                          <Nhan loai="luu-y">
                            Ghi bù {formatDateVN(n.postingDate)}
                          </Nhan>
                        )}
                        {isShipmentLocked && (
                          <Nhan loai="xong" icon={Lock}>
                            Đã chốt
                          </Nhan>
                        )}
                        {!n.chuyen && (
                          <Nhan loai="nguon">Dữ liệu cũ</Nhan>
                        )}
                        {n.chuyen && (
                          <Nhan loai="phu" className="tnum">
                            Lô {formatMaterialLotLabel(n.chuyen)}
                          </Nhan>
                        )}
                        {n.chuyen?.ssccCode && (
                          <Nhan loai="phu" className="tnum">
                            SSCC {n.chuyen.ssccCode}
                          </Nhan>
                        )}
                        {[n.driverName, n.licensePlate].filter(Boolean).length > 0 && (
                          <span className="text-base text-muted-foreground">
                            {[n.driverName, n.licensePlate].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </div>
                      {n.ghiBu && n.backdateReason && (
                        <p className="text-base text-muted-foreground">
                          Lý do ghi bù: {n.backdateReason}
                        </p>
                      )}
                      {n.note && (
                        <p className="text-base text-muted-foreground">
                          Ghi chú: {n.note}
                        </p>
                      )}
                      {n.chuyen?.operator && (
                        <p className="text-base text-muted-foreground">
                          Người ghi: {n.chuyen.operator}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-base text-muted-foreground">
                        Chuyến này
                      </span>
                      <span className="tnum text-xl font-semibold">
                        {kg(n.tongKg)}
                      </span>
                      {!isShipmentLocked && (
                        <Button
                          title="Mở lại chuyến này để sửa dòng hàng, số kg hay giá. Ngày đã chốt thì phải mở khóa trước." variant="outline" onClick={() => openShipmentEdit(n)}>
                          <Pencil />
                          Sửa chuyến
                        </Button>
                      )}
                      {n.chuyen && (
                        <Button
                          title="In tem QR cho chuyến này — mỗi loại nguyên liệu một tem (loại + kg) để dán đúng sọt, sau quét tra ngược được nguồn gốc."
                          variant="outline"
                          onClick={() => setLabelShipment(n.chuyen)}
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
                    toMau="nhap-hang"
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
        <KhoiPheLieuNgay
          ngay={tuHieuLuc}
          phanXuong={viewedWorkshop}
          rows={scraps}
          onChange={persistScraps}
          khoa={isDayLocked}
          chiXem
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
              Chốt xong ngày {formatDateVN(tuHieuLuc)} · xưởng {viewedWorkshop} sẽ khóa: không
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
              Ngày {formatDateVN(tuHieuLuc)} · xưởng {viewedWorkshop} đang khóa. Mở lại thì
              sửa/xóa được như thường — nhớ chốt lại sau khi sửa xong.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <ErrorSummary loi={lockErrors} />
            <ChuThichBatBuoc />
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
        <PhieuNLNgay
          ky={ky}
          ngay={date}
          startDate={fromDate}
          endDate={toDate}
          workshop={workshop}
          rows={rows}
          pheLieu={scraps}
          onClose={() => setShowInvoice(false)}
        />
      )}
      {labelShipment && (
        <QrTemLoIn chuyen={labelShipment} onClose={() => setLabelShipment(null)} />
      )}
      {isPrintingBlank && (
        <PhieuTrongNhapNL onClose={() => setIsPrintingBlank(false)} />
      )}

      {/* ---- Nhận diện ảnh phiếu (OCR) → gợi ý điền form Ghi nhập ---- */}
      {ocrMo && phien && (
        <OcrPhieuNhap
          danhMuc={ocrCatalog}
          onLuuAnh={(path) => setSessionField("scanPath", path)}
          onApDaiLy={(name) => setSessionField("supplierName", name)}
          onApNgay={(iso) => changeDeliveryDate(iso)}
          onThemDong={addRowFromOcr}
          onClose={() => setOcrMo(false)}
        />
      )}
      {supplierEditor.hop}
      {materialTypeEditor.hop}
    </div>
  );
}

