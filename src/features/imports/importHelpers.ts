// ============================================================
// Tên file: src/features/imports/importHelpers.ts
// Tên tiếng Việt: Kiểu & hàm thuần của màn Nhập hàng (đầu chuyến, dòng bảng, gom chuyến, kiểm lỗi)
// Description: Pure types/helpers for the Material Import screen — no React, unit-testable.
// Tách khỏi MaterialImportScreen.tsx (2169 dòng) ngày 2026-09-21 — KHÔNG đổi logic.
// ============================================================
import type {
  Category,
  ImportShipment,
  MaterialImportItem,
  Workshop,
} from "@/types";
import { calculateImportAmount, isBackdatedImport } from "@/types";
import { newId } from "@/lib/store";
import type { LoiNhap } from "@/design-system";

export const PHAN_XUONG: Workshop[] = ["Đông", "Cá", "Khô"];

/** Loại phế liệu hay gặp — vẫn thêm mới tại chỗ được. */
export const PHE_LIEU_GOI_Y = ["Nội tạng", "Dạt"];

/** Đầu chuyến đang nhập — dùng chung cho mọi dòng loại hàng trong chuyến. */
export interface DauChuyen {
  deliveryDate: string;
  postingDate: string;
  backdateReason: string;
  workshop: Workshop;
  supplierName: string;
  driverName: string;
  licensePlate: string;
  note: string;
  /** Mã SSCC nhà nước — thường để trống, điền sau khi được cấp. */
  ssccCode: string;
  /** Đường dẫn ảnh phiếu tay đã chụp (nền OCR). Rỗng = chưa chụp. */
  scanPath: string;
}

/** Chữ viết tắt phân xưởng cho mã lô. */
export const CHU_XUONG: Record<Workshop, string> = {
  Đông: "Đ",
  Cá: "C",
  Khô: "K",
};

/** Sinh mã lô nội bộ đọc được: ‹chữ xưởng›-‹yymmdd›-‹stt trong ngày›, vd "Đ-260902-01".
 *  Là NHÃN hiển thị/trace, không phải khóa — trùng cũng không sao, cho sửa tay sau. */
export function sinhMaLo(
  deliveryDate: string,
  workshop: Workshop,
  dsChuyen: ImportShipment[],
): string {
  const w = CHU_XUONG[workshop] ?? "X";
  const ngay = (deliveryDate || "").replace(/-/g, "").slice(2); // yymmdd
  const stt =
    dsChuyen.filter(
      (c) => c.deliveryDate === deliveryDate && c.workshop === workshop,
    ).length + 1;
  return `${w}-${ngay}-${String(stt).padStart(2, "0")}`;
}

/**
 * Một dòng loại hàng trong BẢNG nhập của chuyến. Cả chuyến điền một lượt rồi
 * lưu một lần (batch) thay vì "thêm từng loại → bấm lưu" như bản trước.
 *  - `key`: khóa React ổn định theo dòng (không đổi khi gõ).
 *  - `id`: id dòng ĐÃ LƯU (`null` = dòng mới chưa lưu). Khi sửa chuyến, dòng cũ
 *    giữ nguyên id để cập nhật đúng bản ghi; bỏ dòng = không đưa lại vào persist.
 */
export interface DongBang {
  key: string;
  id: string | null;
  category: Category;
  materialTypeName: string;
  quantityKg: number;
  unitPrice: number | null;
  /** Dòng ĐIỀN SẴN theo chuyến gần nhất của đại lý (loại + giá), chờ gõ kg. Chưa
   *  có kg thì coi như KHÔNG có dữ liệu: lưu tự bỏ qua, không nài lỗi. Người dùng
   *  tự sửa loại/giá thì cờ này tắt (thành dòng thường). */
  goiY?: boolean;
}

export const LOAI_MAC_DINH: Category = "Bạch tuộc";

/** Dòng trống mới cho bảng (mặc định theo loài đang dùng cho nhanh). */
export const dongBangRong = (cat: Category = LOAI_MAC_DINH): DongBang => ({
  key: newId(),
  id: null,
  category: cat,
  materialTypeName: "",
  quantityKg: 0,
  unitPrice: null,
});

/** Dòng đã có dữ liệu (dù chưa đủ) — dùng để biết khi nào cần thêm dòng trống. */
export const dongCoData = (d: DongBang): boolean =>
  d.goiY
    ? d.quantityKg > 0
    : d.materialTypeName.trim() !== "" ||
      d.quantityKg > 0 ||
      d.unitPrice != null;

/** Dòng đủ để lưu (có loại + số lượng > 0). */
export const dongDayDu = (d: DongBang): boolean =>
  d.materialTypeName.trim() !== "" && d.quantityKg > 0;

/**
 * Một chuyến hiện trên sổ. Có hai nguồn:
 *  - chuyến THẬT (bảng `chuyen_nhap`) — mọi chuyến ghi từ nay;
 *  - nhóm NGẦM của dữ liệu cũ (dòng chưa có `chuyenId`) — gom theo
 *    (ngày + xưởng + đại lý + xe) đúng như cách màn cũ đếm.
 */
export interface NhomChuyen {
  khoa: string;
  chuyen: ImportShipment | null;
  deliveryDate: string;
  postingDate: string;
  backdateReason: string;
  workshop: Workshop;
  supplierName: string;
  driverName: string;
  licensePlate: string;
  note: string;
  dong: MaterialImportItem[];
  tongKg: number;
  tongTien: number;
  ghiBu: boolean;
}

export function gomChuyen(
  rows: MaterialImportItem[],
  chuyen: ImportShipment[],
): NhomChuyen[] {
  const theoId = new Map(chuyen.map((c) => [c.id, c]));
  const nhoms = new Map<string, NhomChuyen>();

  for (const r of rows) {
    const c = r.shipmentId ? theoId.get(r.shipmentId) : undefined;
    const khoa = c
      ? c.id
      : `ngam|${r.deliveryDate}|${r.workshop}|${r.supplierName}|${r.driverName}|${r.licensePlate}`;
    let nhom = nhoms.get(khoa);
    if (!nhom) {
      nhom = {
        khoa,
        chuyen: c ?? null,
        deliveryDate: c?.deliveryDate ?? r.deliveryDate,
        postingDate: c?.postingDate ?? r.deliveryDate,
        backdateReason: c?.backdateReason ?? "",
        workshop: c?.workshop ?? r.workshop,
        supplierName: c?.supplierName ?? r.supplierName,
        driverName: c?.driverName ?? r.driverName,
        licensePlate: c?.licensePlate ?? r.licensePlate,
        note: c?.note ?? r.note,
        dong: [],
        tongKg: 0,
        tongTien: 0,
        ghiBu: false,
      };
      nhom.ghiBu = isBackdatedImport(nhom);
      nhoms.set(khoa, nhom);
    }
    nhom.dong.push(r);
    nhom.tongKg += r.quantityKg || 0;
    nhom.tongTien += calculateImportAmount(r);
  }

  return [...nhoms.values()].sort(
    (a, b) =>
      a.deliveryDate.localeCompare(b.deliveryDate) ||
      a.supplierName.localeCompare(b.supplierName, "vi") ||
      a.khoa.localeCompare(b.khoa),
  );
}

/** Kiểm tra đầu chuyến — dùng chung cho lúc ghi mới và lúc sửa. */
export function loiDauChuyen(d: DauChuyen, daChot: boolean): LoiNhap[] {
  const ls: LoiNhap[] = [];
  if (!d.supplierName.trim())
    ls.push({ truong: "Đại lý", thongBao: "Chưa chọn đại lý giao hàng" });
  if (d.postingDate < d.deliveryDate)
    ls.push({
      truong: "Ngày ghi sổ",
      thongBao: "Ngày ghi sổ không thể trước ngày hàng về xưởng",
    });
  const canLyDo = isBackdatedImport(d) || daChot;
  if (canLyDo && !d.backdateReason.trim())
    ls.push({
      truong: "Lý do ghi bù",
      thongBao: daChot
        ? "Ngày này đã chốt — phải ghi rõ vì sao ghi thêm"
        : "Ghi sau ngày hàng về — phải ghi rõ lý do (VD: chờ hóa đơn)",
    });
  return ls;
}

/* ---------- Gợi ý theo đại lý — chọn đại lý là kéo theo xe + loại hàng ---------- */
// Tính TỪ DÒNG HÀNG (material_imports), không từ bảng chuyến: dòng luôn mang đủ
// ngày · đại lý · tài xế · biển số, kể cả dữ liệu cũ không có chuyến cha.

/** Khóa gom một lượt giao: chuyến thật theo id, dữ liệu cũ theo (ngày + xe). */
const khoaLuot = (r: MaterialImportItem) =>
  r.shipmentId || `ngam|${r.deliveryDate}|${r.licensePlate}|${r.driverName}`;

/** Mới nhất lên đầu: theo ngày hàng về, cùng ngày thì theo id (id sinh theo giờ). */
const moiTruoc = (a: MaterialImportItem, b: MaterialImportItem) =>
  b.deliveryDate.localeCompare(a.deliveryDate) || b.id.localeCompare(a.id);

/** Biển số bỏ dấu cách/chấm/gạch, viết hoa — "72c-16603" và "72C 16603" là một xe. */
export const chuanBienSo = (s: string) =>
  s.replace(/[\s.\-']/g, "").toUpperCase();

/** Đại lý hay giao cho xưởng này gần đây — nhiều lượt trước, bằng nhau thì mới trước. */
export function daiLyHayGiao(
  rows: MaterialImportItem[],
  workshop: Workshop,
  toiDa = 4,
  xetLuot = 40,
): string[] {
  const luot = new Map<string, string>(); // khóa lượt → đại lý (giữ thứ tự mới→cũ)
  for (const r of rows
    .filter((x) => x.workshop === workshop && x.supplierName)
    .sort(moiTruoc)) {
    if (luot.size >= xetLuot && !luot.has(khoaLuot(r))) break;
    if (!luot.has(khoaLuot(r))) luot.set(khoaLuot(r), r.supplierName);
  }
  const dem = new Map<string, { n: number; thuTu: number }>();
  [...luot.values()].forEach((ten, i) => {
    const d = dem.get(ten);
    if (d) d.n += 1;
    else dem.set(ten, { n: 1, thuTu: i });
  });
  return [...dem.entries()]
    .sort((a, b) => b[1].n - a[1].n || a[1].thuTu - b[1].thuTu)
    .slice(0, toiDa)
    .map(([ten]) => ten);
}

/** Một xe (biển số + tài xế) từng chở cho đại lý. */
export interface XeGoiY {
  licensePlate: string;
  driverName: string;
}

/** Xe từng chở cho đại lý này, mới nhất trước; gộp trùng theo biển số chuẩn hóa + tài xế. */
export function xeCuaDaiLy(
  rows: MaterialImportItem[],
  supplierName: string,
  toiDa = 4,
): XeGoiY[] {
  if (!supplierName) return [];
  const ds = new Map<string, XeGoiY>();
  for (const r of rows
    .filter((x) => x.supplierName === supplierName)
    .sort(moiTruoc)) {
    const bien = r.licensePlate.trim();
    const tx = r.driverName.trim();
    if (!bien && !tx) continue;
    const k = `${chuanBienSo(bien)}|${tx.toLowerCase()}`;
    if (!ds.has(k)) ds.set(k, { licensePlate: bien, driverName: tx });
    if (ds.size >= toiDa) break;
  }
  return [...ds.values()];
}

/**
 * Mẫu bảng loại hàng cho đại lý: các loại đại lý này giao trong `soLuot` lượt gần
 * nhất (loại của lượt mới nhất đứng trước), kèm ĐƠN GIÁ gần nhất của từng loại.
 * Kg để trống — người nhập chỉ còn gõ số. Không có lịch sử ⇒ mảng rỗng.
 */
export function mauDongCuaDaiLy(
  rows: MaterialImportItem[],
  supplierName: string,
  workshop: Workshop,
  soLuot = 3,
  toiDa = 6,
): DongBang[] {
  if (!supplierName) return [];
  const cua = rows.filter(
    (r) => r.supplierName === supplierName && r.workshop === workshop,
  );
  // Các lượt gần nhất (mới → cũ).
  const luot: string[] = [];
  for (const r of [...cua].sort(moiTruoc)) {
    if (luot.includes(khoaLuot(r))) continue;
    if (luot.length >= soLuot) break;
    luot.push(khoaLuot(r));
  }
  // Trong một lượt giữ THỨ TỰ GHI (thứ tự mảng gốc) — đúng thứ tự trên tờ giấy.
  const mau = new Map<string, DongBang>();
  for (const k of luot)
    for (const r of cua) {
      if (khoaLuot(r) !== k) continue;
      const ten = r.materialTypeName.trim();
      if (!ten) continue;
      const co = mau.get(ten);
      if (!co)
        mau.set(ten, {
          ...dongBangRong(r.category),
          materialTypeName: ten,
          unitPrice: r.unitPrice,
          goiY: true,
        });
      else if (co.unitPrice == null && r.unitPrice != null)
        co.unitPrice = r.unitPrice;
    }
  return [...mau.values()].slice(0, toiDa);
}
