// ============================================================
// Tên file: src/lib/truyXuatLo.ts
// Truy xuất theo LÔ: đọc mã QR, nhận diện lô, dựng cây truy NGƯỢC / truy XUÔI,
// cân bằng khối lượng. Hàm THUẦN — không đọc/ghi dữ liệu, không đụng giao diện.
// Thiết kế + căn cứ chuẩn (GS1 Digital Link · EPCIS · GDST · FSMA 204 · TT 02/2024):
// docs/spec/qr-truy-xuat-lo.md
//
// Ba loại lô dùng đúng bản ghi đang có, KHÔNG thêm cột:
//   S = lô NL  = một chuyến nhập (import_shipments), nhãn = lot_code
//   W = lô BTP = một dòng sản xuất (production_wips), nhãn SUY RA
//   P = lô TP  = một phiếu đóng gói (packagings),     nhãn SUY RA
// Mối nối giữa các tầng: bảng lot_inputs (mig 0046) + export_items.wip_id (đã có)
// + lot_dispatches (mig 0056: lô đi ra — bán lẻ, bán nội địa, quét kiểm lệnh xuất).
// ============================================================
import type {
  Customer,
  DomesticSaleItem,
  LabelPrint,
  ExportItem,
  ExportOrder,
  ImportShipment,
  LotDispatch,
  LotInput,
  LotKind,
  LotWaiver,
  MaterialImportItem,
  MaterialType,
  Packaging,
  Product,
  SalesInvoice,
  SalesItem,
  SalesOrder,
  WipProductionItem,
  Workshop,
} from "@/types";
import { KHO_BAN_LE, KHO_TP, locBanLe, tinhTon, tinhTonTPTheoLo, truTonBTP } from "./inventory";
import { viDate } from "./format";

export interface DuLieuTruyXuat {
  shipments: readonly ImportShipment[];
  imports: readonly MaterialImportItem[];
  wips: readonly WipProductionItem[];
  packagings: readonly Packaging[];
  lotInputs: readonly LotInput[];
  exportItems: readonly ExportItem[];
  exportOrders: readonly ExportOrder[];
  salesOrders: readonly SalesOrder[];
  products: readonly Product[];
  customers: readonly Customer[];
  // --- Đợt 2b (mig 0056) — tùy chọn để chỗ chỉ cần tra nhanh khỏi phải nạp hết ---
  salesItems?: readonly SalesItem[];
  salesInvoices?: readonly SalesInvoice[];
  domesticSales?: readonly DomesticSaleItem[];
  lotDispatches?: readonly LotDispatch[];
  lotWaivers?: readonly LotWaiver[];
  labelPrints?: readonly LabelPrint[];
  materialTypes?: readonly MaterialType[];
}

/**
 * Lá cuối của cây truy xuôi — hàng đã rời xưởng:
 *   X = một dòng lệnh xuất theo đơn · B = một dòng bán lẻ · N = một dòng bán nội địa NL.
 */
export type LoaiNut = LotKind | "X" | "B" | "N";

/** Lá "hàng đã ra khỏi xưởng" — dùng cho danh sách thu hồi. */
export const laHangRa = (k: LoaiNut): k is "X" | "B" | "N" => k === "X" || k === "B" || k === "N";

export interface NutLo {
  kind: LoaiNut;
  id: string;
  /** Nhãn đọc được, in trên tem. */
  nhan: string;
  /** Là gì: loại NL / mặt hàng. */
  moTa: string;
  /** yyyy-mm-dd */
  ngay: string;
  xuong: Workshop | "";
  /** Khối lượng của lô: kg nhận (NL) · kg sản xuất (BTP) · kg ra (TP) · kg xuất (X). */
  kg: number;
  /** Dữ liệu then chốt (KDE) để hiện trên hộ chiếu lô. */
  chiTiet: { nhan: string; giaTri: string }[];
  /** Bản ghi nguồn không còn (bị xóa) — chỉ còn nhãn chụp lúc gắn. */
  mat: boolean;
}

export const TEN_LOAI: Record<LoaiNut, string> = {
  S: "Nguyên liệu",
  W: "Bán thành phẩm",
  P: "Thành phẩm",
  X: "Xuất theo đơn",
  B: "Bán lẻ",
  N: "Bán nội địa",
};

const CHU_XUONG: Record<Workshop, string> = { Đông: "Đ", Cá: "C", Khô: "K" };

// ---------- Mã QR ----------

/**
 * Nội dung QR = một đường link (kiểu GS1 Digital Link): camera điện thoại nào quét
 * cũng mở thẳng hộ chiếu lô. `origin` lấy lúc IN từ chính địa chỉ app đang chạy —
 * không ghi cứng tên miền trong code.
 */
export function noiDungQr(kind: LotKind, id: string, origin: string): string {
  return `${origin.replace(/\/+$/, "")}/#/qr?lo=${kind}:${encodeURIComponent(id)}`;
}

export type MaDaDoc = { kind: LotKind; id: string } | { ma: string };

/**
 * Đọc chuỗi quét được / gõ vào. Nhận CẢ BA dạng:
 *  - đường link mới `…/#/qr?lo=W:<id>`
 *  - mã trần `W:<id>`
 *  - mã lô trần của TEM CŨ (`Đ-260902-01`) — tem in trước đợt này vẫn dùng được.
 */
export function docMaQr(text: string): MaDaDoc | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  const m = /[?&]lo=([^&#\s]+)/.exec(t);
  if (m) return docMaQr(decodeURIComponent(m[1]!));
  const k = /^([SWP]):(.+)$/.exec(t);
  if (k) return { kind: k[1] as LotKind, id: k[2]! };
  return { ma: t };
}

// ---------- Nhãn lô ----------

const yymmdd = (iso: string) => (iso || "").replace(/-/g, "").slice(2, 8);
const duoiId = (id: string) => id.replace(/[^0-9a-zA-Z]/g, "").slice(-4).toUpperCase();

/** Nhãn lô BTP suy ra từ mẻ SX: `BĐ-260918-7F3A`. Không lưu — luôn khớp bản ghi. */
export const nhanLoBtp = (w: Pick<WipProductionItem, "id" | "workshop" | "productionDate">) =>
  `B${CHU_XUONG[w.workshop] ?? "X"}-${yymmdd(w.productionDate)}-${duoiId(w.id)}`;

/** Nhãn lô TP suy ra từ phiếu đóng gói: `TĐ-260918-C21B`. */
export const nhanLoTp = (p: Pick<Packaging, "id" | "workshop" | "date">) =>
  `T${CHU_XUONG[p.workshop] ?? "X"}-${yymmdd(p.date)}-${duoiId(p.id)}`;

/** Nhãn lô NL: mã lô của chuyến, chuyến cũ chưa có mã thì suy như BTP/TP. */
export const nhanLoNl = (s: Pick<ImportShipment, "id" | "workshop" | "deliveryDate" | "lotCode">) =>
  s.lotCode?.trim() || `N${CHU_XUONG[s.workshop] ?? "X"}-${yymmdd(s.deliveryDate)}-${duoiId(s.id)}`;

// ---------- Dựng nút ----------

const tenMatHang = (dl: DuLieuTruyXuat, id: string) => {
  const p = dl.products.find((x) => x.id === id);
  return p ? (p.code ? `${p.code} · ${p.name}` : p.name) : id || "—";
};

const kgChu = (v: number) => `${Math.round(v * 100) / 100} kg`;
/** Ngày hiển thị dd/mm/yyyy (quy tắc 2 — locale vi-VN); trống thì "—". */
const ngayVi = (iso: string | undefined) => (iso ? viDate(iso) : "—");

/** Nhãn lô đã CHỤP lúc gắn / in (lot_inputs · lot_dispatches · label_prints) — cho lô đã bị xóa. */
function nhanChup(dl: DuLieuTruyXuat, kind: LotKind, id: string): string {
  return (
    dl.lotInputs.find((l) => l.inputKind === kind && l.inputId === id)?.inputLabel ||
    (dl.lotDispatches ?? []).find((d) => d.lotKind === kind && d.lotId === id)?.lotLabel ||
    (dl.labelPrints ?? []).find((p) => p.lotKind === kind && p.lotId === id)?.label ||
    id
  );
}

/** Dựng một nút lô từ loại + id. Bản ghi đã mất thì trả nút `mat` với nhãn đã chụp. */
export function nutLo(kind: LoaiNut, id: string, dl: DuLieuTruyXuat): NutLo {
  const mat = (nhan: string): NutLo => ({
    kind, id, nhan, moTa: "(bản ghi không còn)", ngay: "", xuong: "", kg: 0, chiTiet: [], mat: true,
  });
  if (kind === "S") {
    const s = dl.shipments.find((x) => x.id === id);
    if (!s) return mat(nhanChup(dl, "S", id));
    const dong = dl.imports.filter((m) => m.shipmentId === id);
    const loai = [...new Set(dong.map((m) => m.materialTypeName || m.category).filter(Boolean))];
    const kg = dong.reduce((t, m) => t + (m.quantityKg || 0), 0);
    return {
      kind, id, nhan: nhanLoNl(s), moTa: loai.join(", ") || "nguyên liệu",
      ngay: s.deliveryDate, xuong: s.workshop, kg, mat: false,
      chiTiet: [
        { nhan: "Đại lý", giaTri: s.supplierName || "—" },
        { nhan: "Ngày về", giaTri: ngayVi(s.deliveryDate) },
        { nhan: "Xe · tài xế", giaTri: [s.licensePlate, s.driverName].filter(Boolean).join(" · ") || "—" },
        ...dong.map((m) => ({ nhan: m.materialTypeName || m.category, giaTri: kgChu(m.quantityKg || 0) })),
        ...(s.ssccCode ? [{ nhan: "SSCC", giaTri: s.ssccCode }] : []),
        ...(s.operator ? [{ nhan: "Người ghi", giaTri: s.operator }] : []),
      ],
    };
  }
  if (kind === "W") {
    const w = dl.wips.find((x) => x.id === id);
    if (!w) return mat(nhanChup(dl, "W", id));
    return {
      kind, id, nhan: nhanLoBtp(w), moTa: tenMatHang(dl, w.productId),
      ngay: w.productionDate, xuong: w.workshop, kg: w.quantityKg || 0, mat: false,
      chiTiet: [
        { nhan: "Mặt hàng", giaTri: tenMatHang(dl, w.productId) },
        ...(w.spec ? [{ nhan: "Quy cách", giaTri: w.spec }] : []),
        { nhan: "Ngày sản xuất", giaTri: ngayVi(w.productionDate) },
        { nhan: "Sản lượng", giaTri: `${kgChu(w.quantityKg || 0)}${w.blocksCount ? ` · ${w.blocksCount} block` : ""}` },
        ...(w.warehouse ? [{ nhan: "Kho", giaTri: w.warehouse }] : []),
        ...(w.processingType ? [{ nhan: "Kiểu chế biến", giaTri: w.processingType }] : []),
        ...(w.operator ? [{ nhan: "Người ghi", giaTri: w.operator }] : []),
      ],
    };
  }
  if (kind === "P") {
    const p = dl.packagings.find((x) => x.id === id);
    if (!p) return mat(nhanChup(dl, "P", id));
    return {
      kind, id, nhan: nhanLoTp(p), moTa: tenMatHang(dl, p.toProductId),
      ngay: p.date, xuong: p.workshop, kg: p.outputKg || 0, mat: false,
      chiTiet: [
        { nhan: "Thành phẩm", giaTri: tenMatHang(dl, p.toProductId) },
        ...(p.toSpec ? [{ nhan: "Quy cách", giaTri: p.toSpec }] : []),
        { nhan: "Ngày đóng gói", giaTri: ngayVi(p.date) },
        { nhan: "Ra", giaTri: `${kgChu(p.outputKg || 0)}${p.outputUnits ? ` · ${p.outputUnits} đơn vị` : ""}` },
        { nhan: "Từ BTP", giaTri: `${tenMatHang(dl, p.fromProductId)} · ${kgChu(p.inputKg || 0)}` },
        ...(p.warehouse ? [{ nhan: "Kho", giaTri: p.warehouse }] : []),
      ],
    };
  }
  if (kind === "B") {
    const b = (dl.salesItems ?? []).find((r) => r.id === id);
    if (!b) return mat(id);
    const phieu = (dl.salesInvoices ?? []).find((v) => v.id === b.invoiceId);
    const khach = phieu ? dl.customers.find((c) => c.id === phieu.customerId) : undefined;
    const nguon = b.sourceWarehouse === KHO_TP ? "đóng gói" : b.sourceWarehouse === KHO_BAN_LE ? "block thô" : b.sourceWarehouse;
    return {
      kind, id, nhan: `Bán ${ngayVi(b.deliveryDate)} → ${khach?.name ?? "khách ?"}`,
      moTa: tenMatHang(dl, b.productId), ngay: b.deliveryDate, xuong: phieu?.workshop ?? "", kg: b.quantityKg || 0, mat: false,
      chiTiet: [
        { nhan: "Khách", giaTri: khach ? `${khach.name}${khach.market ? ` (${khach.market})` : ""}` : "—" },
        { nhan: "Ngày giao", giaTri: ngayVi(b.deliveryDate) },
        { nhan: "Mặt hàng", giaTri: `${tenMatHang(dl, b.productId)}${b.spec ? ` · ${b.spec}` : ""}` },
        { nhan: "Khối lượng", giaTri: kgChu(b.quantityKg || 0) },
        ...(nguon ? [{ nhan: "Nguồn", giaTri: nguon }] : []),
        ...(phieu?.channel ? [{ nhan: "Kênh", giaTri: phieu.channel }] : []),
      ],
    };
  }
  if (kind === "N") {
    const n = (dl.domesticSales ?? []).find((r) => r.id === id);
    if (!n) return mat(id);
    return {
      kind, id, nhan: `Bán NĐ ${ngayVi(n.saleDate)} → ${n.customerName || "khách ?"}`,
      moTa: n.materialTypeName || "nguyên liệu", ngay: n.saleDate, xuong: n.workshop, kg: n.quantityKg || 0, mat: false,
      chiTiet: [
        { nhan: "Khách", giaTri: n.customerName || "—" },
        { nhan: "Ngày bán", giaTri: ngayVi(n.saleDate) },
        { nhan: "Loại NL", giaTri: n.materialTypeName || "—" },
        { nhan: "Khối lượng", giaTri: kgChu(n.quantityKg || 0) },
        ...(n.operator ? [{ nhan: "Người ghi", giaTri: n.operator }] : []),
      ],
    };
  }
  // X — một dòng lệnh xuất
  const x = dl.exportItems.find((e) => e.id === id);
  if (!x) return mat(id);
  const lenh = dl.exportOrders.find((o) => o.id === x.exportId);
  const don = lenh ? dl.salesOrders.find((o) => o.id === lenh.orderId) : undefined;
  const khach = don ? dl.customers.find((c) => c.id === don.customerId) : undefined;
  return {
    kind, id, nhan: `Xuất ${ngayVi(lenh?.exportDate)} → ${khach?.name ?? "khách ?"}`,
    moTa: tenMatHang(dl, x.productId), ngay: lenh?.exportDate ?? "", xuong: "", kg: x.quantityKg || 0, mat: false,
    chiTiet: [
      { nhan: "Khách", giaTri: khach ? `${khach.name}${khach.market ? ` (${khach.market})` : ""}` : "—" },
      { nhan: "Ngày xuất", giaTri: ngayVi(lenh?.exportDate) },
      { nhan: "Khối lượng", giaTri: `${kgChu(x.quantityKg || 0)}${x.blocksCount ? ` · ${x.blocksCount} block` : ""}` },
    ],
  };
}

// ---------- Tìm lô từ mã quét ----------

const chuanMa = (s: string) => s.normalize("NFC").trim().toUpperCase();

/**
 * Tìm lô từ mã đã đọc. Mã loại:id thì trúng đúng một. Mã TRẦN (tem cũ, hoặc gõ tay
 * nhãn) có thể trúng NHIỀU lô — mã lô cũ không đảm bảo duy nhất — nên trả MẢNG để
 * màn hình cho người chọn. Không bao giờ tự chọn bừa một cái.
 */
export function timLo(ma: MaDaDoc, dl: DuLieuTruyXuat): NutLo[] {
  if ("kind" in ma) {
    const n = nutLo(ma.kind, ma.id, dl);
    const coDau =
      dl.lotInputs.some((l) => l.inputId === ma.id || l.outputId === ma.id) ||
      (dl.lotDispatches ?? []).some((d) => d.lotKind === ma.kind && d.lotId === ma.id);
    return n.mat && !coDau ? [] : [n];
  }
  const k = chuanMa(ma.ma);
  return [
    ...dl.shipments.filter((s) => chuanMa(nhanLoNl(s)) === k).map((s) => nutLo("S", s.id, dl)),
    ...dl.wips.filter((w) => chuanMa(nhanLoBtp(w)) === k).map((w) => nutLo("W", w.id, dl)),
    ...dl.packagings.filter((p) => chuanMa(nhanLoTp(p)) === k).map((p) => nutLo("P", p.id, dl)),
  ];
}

// ---------- Cây gia phả lô ----------

export interface NhanhCay {
  nut: NutLo;
  /** kg của mối nối (đầu vào đã dùng / đầu ra đã nhận). null = chưa cân. */
  kg: number | null;
  con: NhanhCay[];
}

/**
 * Truy NGƯỢC: lô này làm từ những lô nào (nhiều tầng: TP → BTP → NL).
 * `sau` giới hạn độ sâu; `daQua` chặn vòng lặp nếu dữ liệu nhập sai thành vòng.
 */
export function truyNguoc(kind: LoaiNut, id: string, dl: DuLieuTruyXuat, sau = 5, daQua = new Set<string>()): NhanhCay[] {
  if (sau <= 0 || (kind !== "W" && kind !== "P")) return [];
  const khoa = `${kind}:${id}`;
  if (daQua.has(khoa)) return [];
  daQua.add(khoa);
  return dl.lotInputs
    .filter((l) => l.outputKind === kind && l.outputId === id)
    .map((l) => ({
      nut: nutLo(l.inputKind, l.inputId, dl),
      kg: l.quantityKg,
      con: truyNguoc(l.inputKind, l.inputId, dl, sau - 1, daQua),
    }));
}

/** Dòng lô đi ra có nghĩa "hàng đã rời xưởng" (không gồm dấu quét kiểm lệnh xuất — trùng export_items). */
const raKhoiXuong = (d: LotDispatch) => d.docKind === "sales_item" || d.docKind === "domestic_sale";

/**
 * Truy XUÔI: lô này đã đi vào những đâu (NL → mẻ SX → đóng gói / lệnh xuất / bán → khách).
 * Cây này là thứ cần khi THU HỒI: chỉ ra đúng phạm vi hàng bị ảnh hưởng.
 * Ngả ra khỏi xưởng: lệnh xuất theo đơn (BTP, `export_items.wip_id`) · bán lẻ
 * (BTP block thô / TP đóng gói) · bán nội địa (NL bán thẳng) — hai ngả sau qua
 * `lot_dispatches` (mig 0056).
 */
export function truyXuoi(kind: LoaiNut, id: string, dl: DuLieuTruyXuat, sau = 5, daQua = new Set<string>()): NhanhCay[] {
  if (sau <= 0 || laHangRa(kind)) return [];
  const khoa = `${kind}:${id}`;
  if (daQua.has(khoa)) return [];
  daQua.add(khoa);
  const quaBienDoi: NhanhCay[] =
    kind === "P"
      ? []
      : dl.lotInputs
          .filter((l) => l.inputKind === kind && l.inputId === id)
          .map((l) => ({
            nut: nutLo(l.outputKind, l.outputId, dl),
            kg: l.quantityKg,
            con: truyXuoi(l.outputKind, l.outputId, dl, sau - 1, daQua),
          }));
  const quaXuat: NhanhCay[] =
    kind === "W"
      ? dl.exportItems
          .filter((x) => x.wipId === id)
          .map((x) => ({ nut: nutLo("X", x.id, dl), kg: x.quantityKg || 0, con: [] }))
      : [];
  const quaBan: NhanhCay[] = (dl.lotDispatches ?? [])
    .filter((d) => raKhoiXuong(d) && d.lotKind === kind && d.lotId === id)
    .map((d) => ({ nut: nutLo(d.docKind === "domestic_sale" ? "N" : "B", d.docId, dl), kg: d.quantityKg, con: [] }));
  return [...quaBienDoi, ...quaXuat, ...quaBan];
}

// ---------- Cân bằng khối lượng ----------

export interface CanBang {
  /** kg của lô (nhận / sản xuất). */
  vao: number;
  /** các ngả đã đi, có kg. */
  ra: { nhan: string; kg: number }[];
  /** số lần gắn lô chưa ghi kg — cân bằng chưa đầy đủ. */
  chuaCan: number;
  /** vao − Σ ra. Âm = dùng/xuất quá số có ⇒ nghi sai số hoặc gắn nhầm lô. */
  con: number;
}

/**
 * Cân bằng khối lượng theo lô (theo HỒ SƠ LÔ — chỉ cộng các mối nối có kg):
 *   NL : nhận ↔ đưa vào SX + bán nội địa
 *   BTP: sản xuất ↔ đóng gói + xuất theo lệnh + bán lẻ block thô
 *   TP : đóng gói ra ↔ bán lẻ
 */
export function canBangLo(kind: LoaiNut, id: string, dl: DuLieuTruyXuat): CanBang | null {
  if (kind !== "S" && kind !== "W" && kind !== "P") return null;
  const n = nutLo(kind, id, dl);
  if (n.mat) return null;
  const ra: CanBang["ra"] = [];
  let chuaCan = 0;
  const cong = (nhan: string, kgs: (number | null)[]) => {
    const co = kgs.filter((k): k is number => k != null);
    chuaCan += kgs.length - co.length;
    if (co.length) ra.push({ nhan, kg: co.reduce((s, k) => s + k, 0) });
  };
  if (kind !== "P") {
    cong(
      kind === "S" ? "Đã đưa vào sản xuất" : "Đã đóng gói",
      dl.lotInputs.filter((l) => l.inputKind === kind && l.inputId === id).map((l) => l.quantityKg)
    );
  }
  if (kind === "W") {
    const xuat = dl.exportItems.filter((x) => x.wipId === id);
    if (xuat.length) ra.push({ nhan: "Đã xuất theo lệnh", kg: xuat.reduce((t, x) => t + (x.quantityKg || 0), 0) });
  }
  const ban = (dl.lotDispatches ?? []).filter((d) => raKhoiXuong(d) && d.lotKind === kind && d.lotId === id);
  cong(kind === "S" ? "Bán nội địa" : kind === "W" ? "Bán lẻ block thô" : "Bán lẻ", ban.map((d) => d.quantityKg));
  const tongRa = ra.reduce((t, r) => t + r.kg, 0);
  return { vao: n.kg, ra, chuaCan, con: n.kg - tongRa };
}

/**
 * Kg CÒN TRONG KHO của lô theo SỔ TỒN (khác cân bằng theo hồ sơ lô: sổ tồn trừ cả
 * dòng bán/đóng gói CHƯA gắn lô theo FIFO). BTP chưa duyệt nhập kho ⇒ null.
 * NL ⇒ null (tồn NL theo lô chưa có — doc 38).
 */
export function tonKhoCuaLo(kind: LoaiNut, id: string, dl: DuLieuTruyXuat): number | null {
  if (kind === "W") {
    const ton = tinhTon(
      [...dl.wips],
      [...dl.exportItems],
      truTonBTP([...(dl.salesItems ?? [])], [...dl.packagings], dl.lotInputs, dl.lotDispatches ?? [])
    );
    return ton.find((l) => l.wipId === id)?.conLai ?? null;
  }
  if (kind === "P") {
    const ton = tinhTonTPTheoLo([...dl.packagings], locBanLe([...(dl.salesItems ?? [])], KHO_TP, dl.lotDispatches ?? []));
    return ton.find((l) => l.wipId === id)?.conLai ?? null;
  }
  return null;
}

// ---------- Danh sách lô để CHỌN khi gắn ----------

const lui = (iso: string, ngay: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - ngay);
  return d.toISOString().slice(0, 10);
};

/**
 * Lô NL để chọn khi gắn cho mẻ SX, cùng xưởng:
 *  1. về trong `soNgay` ngày tính tới ngày SX — MỚI trước (NL tươi vừa về);
 *  2. CỘNG lô cũ hơn (tới 1 năm) mà theo hồ sơ còn kg — CŨ trước (FIFO gợi ý):
 *     NL cấp đông kỳ trước đem xả đông. Chỉ lấy lô đã từng gắn, hoặc về từ ngày
 *     bắt đầu truy xuất (lần gắn lô đầu tiên) — lô trước đó chưa ai theo dõi,
 *     liệt kê ra chỉ làm rối.
 */
export function loNlDeChon(dl: DuLieuTruyXuat, xuong: Workshop, denNgay: string, soNgay = 45): NutLo[] {
  const tu = lui(denNgay, soNgay);
  const ganDay = dl.shipments
    .filter((s) => s.workshop === xuong && s.deliveryDate >= tu && s.deliveryDate <= denNgay)
    .sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate));
  const batDau = dl.lotInputs.reduce<string>((m, l) => (!m || (l.recordedAt && l.recordedAt < m) ? l.recordedAt : m), "").slice(0, 10);
  const daGan = new Set(dl.lotInputs.filter((l) => l.inputKind === "S").map((l) => l.inputId));
  const motNam = lui(denNgay, 365);
  const cuConDo = dl.shipments
    .filter(
      (s) =>
        s.workshop === xuong &&
        s.deliveryDate < tu &&
        s.deliveryDate >= motNam &&
        (daGan.has(s.id) || (!!batDau && s.deliveryDate >= batDau))
    )
    .filter((s) => (canBangLo("S", s.id, dl)?.con ?? 0) > 0)
    .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate));
  return [...ganDay, ...cuConDo].map((s) => nutLo("S", s.id, dl));
}

/** Lô BTP gần đây để chọn khi gắn cho phiếu đóng gói: cùng xưởng (hàng đông trữ lâu ⇒ cửa sổ rộng). */
export function loBtpDeChon(dl: DuLieuTruyXuat, xuong: Workshop, denNgay: string, soNgay = 120, matHangId?: string): NutLo[] {
  const tu = lui(denNgay, soNgay);
  return dl.wips
    .filter((w) => w.workshop === xuong && w.productionDate >= tu && w.productionDate <= denNgay)
    .sort(
      (a, b) =>
        Number(b.productId === matHangId) - Number(a.productId === matHangId) ||
        b.productionDate.localeCompare(a.productionDate)
    )
    .map((w) => nutLo("W", w.id, dl));
}

// ---------- Danh sách lô để IN TEM hàng loạt ----------

export interface LocLoDeIn {
  /** yyyy-mm-dd, tính cả hai đầu. */
  tu: string;
  den: string;
  /** "" = mọi xưởng. */
  xuong: Workshop | "";
  /** Loại lô cần in; rỗng ⇒ không lô nào. */
  loai: readonly LotKind[];
}

const THU_TU_LOAI: Record<LotKind, number> = { S: 0, W: 1, P: 2 };

/**
 * Mọi lô (NL · BTP · TP) trong khoảng ngày để in tem một lượt — MỚI trước, cùng
 * ngày thì theo chuỗi NL → BTP → TP. Ngày của lô: ngày hàng về · ngày SX · ngày đóng gói.
 */
export function dsLoDeIn(dl: DuLieuTruyXuat, loc: LocLoDeIn): NutLo[] {
  const trong = (ngay: string, xuong: Workshop) =>
    ngay >= loc.tu && ngay <= loc.den && (!loc.xuong || xuong === loc.xuong);
  const co = (k: LotKind) => loc.loai.includes(k);
  return [
    ...(co("S") ? dl.shipments.filter((s) => trong(s.deliveryDate, s.workshop)).map((s) => nutLo("S", s.id, dl)) : []),
    ...(co("W") ? dl.wips.filter((w) => trong(w.productionDate, w.workshop)).map((w) => nutLo("W", w.id, dl)) : []),
    ...(co("P") ? dl.packagings.filter((p) => trong(p.date, p.workshop)).map((p) => nutLo("P", p.id, dl)) : []),
  ].sort(
    (a, b) =>
      b.ngay.localeCompare(a.ngay) ||
      THU_TU_LOAI[a.kind as LotKind] - THU_TU_LOAI[b.kind as LotKind] ||
      a.nhan.localeCompare(b.nhan)
  );
}

// ---------- Sổ in tem (mig 0049) ----------

export const khoaLo = (kind: LotKind, id: string) => `${kind}:${id}`;

export interface TomTatIn {
  /** số lượt bấm In */
  lan: number;
  /** tổng số tem đã in */
  tem: number;
  /** lượt in gần nhất */
  cuoi: LabelPrint;
}

/** Gom sổ in tem theo lô: khóa `loại:id` → số lượt, số tem, lần in gần nhất. */
export function tomTatIn(prints: readonly LabelPrint[]): Map<string, TomTatIn> {
  const m = new Map<string, TomTatIn>();
  for (const p of prints) {
    const k = khoaLo(p.lotKind, p.lotId);
    const cu = m.get(k);
    if (!cu) m.set(k, { lan: 1, tem: p.copies, cuoi: p });
    else
      m.set(k, {
        lan: cu.lan + 1,
        tem: cu.tem + p.copies,
        cuoi: p.printedAt > cu.cuoi.printedAt ? p : cu.cuoi,
      });
  }
  return m;
}

/**
 * Dòng sổ in cho một lượt in (mỗi lô một dòng). Bỏ nút không phải lô (hàng đã ra)
 * và lô đã mất. `soTem` = số tem đã in của từng lô (mặc định 1).
 */
export function banGhiIn(
  nuts: readonly NutLo[],
  nguoiIn: string,
  luc: string,
  taoId: () => string,
  soTem: (n: NutLo) => number = () => 1
): LabelPrint[] {
  return nuts
    .filter((n): n is NutLo & { kind: LotKind } => !laHangRa(n.kind) && !n.mat)
    .map((n) => ({
      id: taoId(), lotKind: n.kind, lotId: n.id, label: n.nhan,
      copies: Math.max(1, Math.round(soTem(n) || 1)), operator: nguoiIn, printedAt: luc,
    }));
}

// ---------- Gắn lô NL cho CẢ PHIÊN ghi sản xuất (đợt 2b) ----------

const chuan = (s: string | undefined) => (s ?? "").normalize("NFC").trim().toLowerCase();

/** Họ NL của một lô NL: các loài (category) + tên loại NL có trong chuyến. */
function hoCuaLoNl(dl: DuLieuTruyXuat, shipmentId: string) {
  const dong = dl.imports.filter((m) => m.shipmentId === shipmentId);
  const ten = new Set(dong.map((m) => chuan(m.materialTypeName)).filter(Boolean));
  const loai = new Set(
    dong
      .flatMap((m) => [m.category, (dl.materialTypes ?? []).find((t) => chuan(t.name) === chuan(m.materialTypeName))?.category])
      .map((x) => chuan(x))
      .filter(Boolean)
  );
  return { ten, loai };
}

/** Loài của mặt hàng một mẻ ("" = không rõ): category mặt hàng, rồi tới loài của loại NL gắn trên mặt hàng. */
function loaiCuaMe(dl: DuLieuTruyXuat, w: Pick<WipProductionItem, "productId">): string {
  const p = dl.products.find((x) => x.id === w.productId);
  if (!p) return "";
  return chuan(p.category) || chuan((dl.materialTypes ?? []).find((t) => t.id === p.materialTypeId)?.category);
}

export interface KetQuaGanPhien {
  lotInputs: LotInput[];
  dispatches: LotDispatch[];
  /** Mẻ / dòng bán nội địa không khớp họ NL với lô nào của phiên — để người ghi tự gắn. */
  khongKhop: { kind: "W" | "N"; id: string }[];
}

/**
 * Tổ trưởng khai MỘT lần "phiên này dùng lô NL nào" ⇒ gắn cho từng mẻ vừa lưu
 * (lot_inputs) và từng dòng bán nội địa (lot_dispatches), kg để trống (chưa cân).
 *
 * Chỉ gắn khi KHỚP HỌ NL, để mẻ bạch tuộc không dính lô mực:
 *  - mẻ: loài mặt hàng có trong lô; không rõ loài (mặt hàng chưa gắn loài / chuyến
 *    không ghi loài) ⇒ VẪN gắn — gắn thừa chỉ làm phạm vi thu hồi rộng ra, không
 *    bao giờ hẹp lại (chiều an toàn);
 *  - bán nội địa: lô có đúng loại NL đó, hoặc cùng loài.
 * Cặp đã gắn rồi thì bỏ qua (không nhân đôi).
 */
export function ganLoChoPhien(a: {
  mes: readonly Pick<WipProductionItem, "id" | "productId">[];
  banNoiDia: readonly Pick<DomesticSaleItem, "id" | "materialTypeName">[];
  loNl: readonly { nut: NutLo; cach: LotInput["method"] }[];
  dl: DuLieuTruyXuat;
  nguoiGhi: string;
  luc: string;
  taoId: () => string;
}): KetQuaGanPhien {
  const lots = a.loNl.filter((l) => l.nut.kind === "S" && !l.nut.mat).map((l) => ({ ...l, ho: hoCuaLoNl(a.dl, l.nut.id) }));
  const lotInputs: LotInput[] = [];
  const dispatches: LotDispatch[] = [];
  const khongKhop: KetQuaGanPhien["khongKhop"] = [];
  if (!lots.length) return { lotInputs, dispatches, khongKhop };

  for (const me of a.mes) {
    const loai = loaiCuaMe(a.dl, me);
    const hop = lots.filter((l) => !loai || l.ho.loai.size === 0 || l.ho.loai.has(loai));
    if (!hop.length) khongKhop.push({ kind: "W", id: me.id });
    for (const l of hop) {
      if (a.dl.lotInputs.some((x) => x.outputKind === "W" && x.outputId === me.id && x.inputKind === "S" && x.inputId === l.nut.id)) continue;
      lotInputs.push({
        id: a.taoId(), outputKind: "W", outputId: me.id, inputKind: "S", inputId: l.nut.id,
        inputLabel: l.nut.nhan, material: l.nut.moTa, quantityKg: null, method: l.cach,
        operator: a.nguoiGhi, recordedAt: a.luc,
      });
    }
  }
  for (const b of a.banNoiDia) {
    const ten = chuan(b.materialTypeName);
    const loai = chuan((a.dl.materialTypes ?? []).find((t) => chuan(t.name) === ten)?.category);
    const hop = lots.filter((l) => l.ho.ten.has(ten) || (!!loai && l.ho.loai.has(loai)));
    if (!hop.length) khongKhop.push({ kind: "N", id: b.id });
    for (const l of hop) {
      if ((a.dl.lotDispatches ?? []).some((x) => x.docKind === "domestic_sale" && x.docId === b.id && x.lotId === l.nut.id)) continue;
      dispatches.push({
        id: a.taoId(), lotKind: "S", lotId: l.nut.id, lotLabel: l.nut.nhan, docKind: "domestic_sale", docId: b.id,
        quantityKg: null, method: l.cach, operator: a.nguoiGhi, recordedAt: a.luc,
      });
    }
  }
  return { lotInputs, dispatches, khongKhop };
}

/** Mẻ SX CHƯA gắn lô NL và CHƯA ghi lý do bỏ qua — chốt ngày phải xử lý hết. */
export function meThieuLo<T extends Pick<WipProductionItem, "id">>(
  mes: readonly T[],
  lotInputs: readonly LotInput[],
  lotWaivers: readonly LotWaiver[]
): T[] {
  return mes.filter(
    (w) =>
      !lotInputs.some((l) => l.outputKind === "W" && l.outputId === w.id) &&
      !lotWaivers.some((x) => x.outputKind === "W" && x.outputId === w.id)
  );
}

// ---------- Theo giai đoạn (đợt 2b) ----------

export type KhoaGiaiDoan = "nhap" | "san-xuat" | "kho" | "dong-goi" | "xuat-ban";

/** Việc còn thiếu ở một mục: in tem · gắn lô · duyệt nhập kho · quét kiểm khi xếp xe. */
export type ViecThieu = "tem" | "lo" | "duyet" | "quet";

export interface MucGiaiDoan {
  /** Lô (S/W/P) hoặc dòng hàng ra (X lệnh xuất · B bán lẻ · N bán nội địa). */
  nut: NutLo;
  /** Số tem đã in (lô S/W/P); undefined = không áp dụng. */
  daIn?: number;
  /** Số lô đầu vào đã gắn (W: lô NL · P: lô BTP) hoặc lô đã gắn cho hàng ra (B/N). */
  soLo?: number;
  /** W/P chưa gắn lô nhưng đã ghi lý do khi chốt ngày. */
  lyDo?: string;
  /** S: số mẻ / dòng bán nội địa đã dùng lô này. */
  daDung?: number;
  /** W: trạng thái kho. */
  kho?: "cho-nhap" | "da-nhap";
  /** Tồn trong kho theo sổ tồn (W đã nhập, P). */
  ton?: number | null;
  /** X: đã quét kiểm khi xếp xe. */
  daQuet?: boolean;
  /** X: lệnh xuất + đơn của dòng — để mở thẳng hộp kiểm lô. */
  lenhId?: string;
  donId?: string;
  /** B: lô gắn cho dòng bán lẻ là BTP (block thô) hay TP (đóng gói). */
  loaiLoBan?: "W" | "P";
  thieu: ViecThieu[];
}

export interface GiaiDoan {
  khoa: KhoaGiaiDoan;
  ten: string;
  muc: MucGiaiDoan[];
}

/**
 * Chuỗi truy xuất xếp theo GIAI ĐOẠN (nhập NL → sản xuất → kho → đóng gói → xuất/bán)
 * cho một khoảng ngày × xưởng: mỗi lô / dòng hàng ra kèm trạng thái (tem, lô đã gắn,
 * kho, quét kiểm) và VIỆC CÒN THIẾU — để kiểm QR từng khâu ở MỘT chỗ thay vì đi 7 màn.
 * Ngày của mục: ngày hàng về · ngày SX · ngày đóng gói · ngày xuất / bán.
 */
export function theoGiaiDoan(dl: DuLieuTruyXuat, loc: { tu: string; den: string; xuong: Workshop | "" }): GiaiDoan[] {
  const trong = (ngay: string, xuong: Workshop | "" | undefined) =>
    !!ngay && ngay >= loc.tu && ngay <= loc.den && (!loc.xuong || xuong === loc.xuong);
  const disp = dl.lotDispatches ?? [];
  const waivers = dl.lotWaivers ?? [];
  const daIn = tomTatIn(dl.labelPrints ?? []);
  const soTem = (k: LotKind, id: string) => daIn.get(khoaLo(k, id))?.tem ?? 0;
  const lyDo = (k: "W" | "P", id: string) => waivers.find((x) => x.outputKind === k && x.outputId === id)?.reason;
  const soLoVao = (k: "W" | "P", id: string) => dl.lotInputs.filter((l) => l.outputKind === k && l.outputId === id).length;
  const soLoRa = (doc: LotDispatch["docKind"], id: string) => disp.filter((d) => d.docKind === doc && d.docId === id).length;
  const thieuTemLo = (tem: number, lo: number, coLyDo: boolean): ViecThieu[] => [
    ...(lo === 0 && !coLyDo ? (["lo"] as const) : []),
    ...(tem === 0 ? (["tem"] as const) : []),
  ];
  const moiTruoc = <T extends { nut: NutLo }>(a: T, b: T) => b.nut.ngay.localeCompare(a.nut.ngay) || a.nut.nhan.localeCompare(b.nut.nhan);

  const nhap: MucGiaiDoan[] = dl.shipments
    .filter((s) => trong(s.deliveryDate, s.workshop))
    .map((s) => {
      const tem = soTem("S", s.id);
      const dung =
        new Set(dl.lotInputs.filter((l) => l.inputKind === "S" && l.inputId === s.id).map((l) => l.outputId)).size +
        disp.filter((d) => d.lotKind === "S" && d.lotId === s.id && d.docKind === "domestic_sale").length;
      return { nut: nutLo("S", s.id, dl), daIn: tem, daDung: dung, thieu: tem === 0 ? (["tem"] as ViecThieu[]) : [] };
    })
    .sort(moiTruoc);

  const mes = dl.wips.filter((w) => trong(w.productionDate, w.workshop));
  const sanXuat: MucGiaiDoan[] = mes
    .map((w) => {
      const tem = soTem("W", w.id);
      const lo = soLoVao("W", w.id);
      const ld = lyDo("W", w.id);
      return { nut: nutLo("W", w.id, dl), daIn: tem, soLo: lo, lyDo: ld, kho: w.status, thieu: thieuTemLo(tem, lo, !!ld) };
    })
    .sort(moiTruoc);

  const kho: MucGiaiDoan[] = mes
    .map((w) => ({
      nut: nutLo("W", w.id, dl),
      kho: w.status,
      ton: w.status === "da-nhap" ? tonKhoCuaLo("W", w.id, dl) : null,
      daIn: soTem("W", w.id),
      thieu: w.status === "cho-nhap" ? (["duyet"] as ViecThieu[]) : [],
    }))
    .sort((a, b) => Number(b.kho === "cho-nhap") - Number(a.kho === "cho-nhap") || moiTruoc(a, b));

  const dongGoi: MucGiaiDoan[] = dl.packagings
    .filter((p) => trong(p.date, p.workshop))
    .map((p) => {
      const tem = soTem("P", p.id);
      const lo = soLoVao("P", p.id);
      const ld = lyDo("P", p.id);
      return { nut: nutLo("P", p.id, dl), daIn: tem, soLo: lo, lyDo: ld, ton: tonKhoCuaLo("P", p.id, dl), thieu: thieuTemLo(tem, lo, !!ld) };
    })
    .sort(moiTruoc);

  const lenh = new Map(dl.exportOrders.map((o) => [o.id, o]));
  const phieuBan = new Map((dl.salesInvoices ?? []).map((v) => [v.id, v]));
  const xuatBan: MucGiaiDoan[] = [
    ...dl.exportItems
      .filter((x) => trong(lenh.get(x.exportId)?.exportDate ?? "", dl.wips.find((w) => w.id === x.wipId)?.workshop))
      .map((x) => {
        const quet = soLoRa("export_item", x.id) > 0;
        return { nut: nutLo("X", x.id, dl), daQuet: quet, lenhId: x.exportId, donId: lenh.get(x.exportId)?.orderId, thieu: quet ? [] : (["quet"] as ViecThieu[]) };
      }),
    ...(dl.salesItems ?? [])
      .filter((b) => (b.sourceWarehouse === KHO_BAN_LE || b.sourceWarehouse === KHO_TP) && trong(b.deliveryDate, phieuBan.get(b.invoiceId)?.workshop))
      .map((b) => {
        const lo = soLoRa("sales_item", b.id);
        return { nut: nutLo("B", b.id, dl), soLo: lo, loaiLoBan: (b.sourceWarehouse === KHO_TP ? "P" : "W") as "W" | "P", thieu: lo ? [] : (["lo"] as ViecThieu[]) };
      }),
    ...(dl.domesticSales ?? [])
      .filter((n) => trong(n.saleDate, n.workshop))
      .map((n) => {
        const lo = soLoRa("domestic_sale", n.id);
        return { nut: nutLo("N", n.id, dl), soLo: lo, thieu: lo ? [] : (["lo"] as ViecThieu[]) };
      }),
  ].sort(moiTruoc);

  return [
    { khoa: "nhap", ten: "Nhập nguyên liệu", muc: nhap },
    { khoa: "san-xuat", ten: "Sản xuất bán thành phẩm", muc: sanXuat },
    { khoa: "kho", ten: "Nhập kho dự trữ", muc: kho },
    { khoa: "dong-goi", ten: "Đóng gói thành phẩm", muc: dongGoi },
    { khoa: "xuat-ban", ten: "Xuất theo đơn & bán", muc: xuatBan },
  ];
}

// ---------- Danh sách thu hồi (đợt 2b) ----------

export interface DongThuHoi {
  loai: "X" | "B" | "N";
  khach: string;
  ngay: string;
  chungTu: string;
  matHang: string;
  /** kg của mối nối (đi ra từ lô liền trước); null = chưa cân. */
  kg: number | null;
  /** nhãn lô liền trước — hàng rời xưởng từ lô này */
  tuLo: string;
}

/**
 * Lô này nghi có vấn đề ⇒ ai đã nhận hàng (khách · ngày · chứng từ · kg) và
 * những lô BTP/TP còn trong xưởng cần khoanh lại. Đi hết cây truy xuôi.
 */
export function danhSachThuHoi(kind: LoaiNut, id: string, dl: DuLieuTruyXuat): { hangRa: DongThuHoi[]; loTrongXuong: NutLo[] } {
  const hangRa: DongThuHoi[] = [];
  const loTrongXuong: NutLo[] = [];
  const goc = nutLo(kind, id, dl);
  if (goc.kind === "W" || goc.kind === "P") loTrongXuong.push(goc);
  const khachX = (xId: string) => {
    const x = dl.exportItems.find((e) => e.id === xId);
    const lenh = x ? dl.exportOrders.find((o) => o.id === x.exportId) : undefined;
    const don = lenh ? dl.salesOrders.find((o) => o.id === lenh.orderId) : undefined;
    return { khach: dl.customers.find((c) => c.id === don?.customerId)?.name ?? "", ngay: lenh?.exportDate ?? "" };
  };
  const khachB = (bId: string) => {
    const b = (dl.salesItems ?? []).find((r) => r.id === bId);
    const phieu = b ? (dl.salesInvoices ?? []).find((v) => v.id === b.invoiceId) : undefined;
    return dl.customers.find((c) => c.id === phieu?.customerId)?.name ?? "";
  };
  const di = (cay: NhanhCay[], cha: NutLo) => {
    for (const nh of cay) {
      const n = nh.nut;
      if (n.kind === "X") {
        const k = khachX(n.id);
        hangRa.push({ loai: "X", khach: k.khach, ngay: k.ngay, chungTu: `Lệnh xuất ${ngayVi(k.ngay)}`, matHang: n.moTa, kg: nh.kg, tuLo: cha.nhan });
      } else if (n.kind === "B") {
        hangRa.push({ loai: "B", khach: khachB(n.id), ngay: n.ngay, chungTu: `Phiếu bán ${ngayVi(n.ngay)}`, matHang: n.moTa, kg: nh.kg, tuLo: cha.nhan });
      } else if (n.kind === "N") {
        const r = (dl.domesticSales ?? []).find((x) => x.id === n.id);
        hangRa.push({ loai: "N", khach: r?.customerName ?? "", ngay: n.ngay, chungTu: `Bán nội địa ${ngayVi(n.ngay)}`, matHang: n.moTa, kg: nh.kg, tuLo: cha.nhan });
      } else {
        if ((n.kind === "W" || n.kind === "P") && !loTrongXuong.some((l) => l.kind === n.kind && l.id === n.id)) loTrongXuong.push(n);
        di(nh.con, n);
      }
    }
  };
  di(truyXuoi(kind, id, dl), goc);
  hangRa.sort((a, b) => a.ngay.localeCompare(b.ngay) || a.khach.localeCompare(b.khach));
  return { hangRa, loTrongXuong };
}

// ---------- Số tem mặc định (đợt 2b) ----------

/** Mỗi block (BTP) / mỗi thùng-gói (TP) một tem; NL một tem cho chuyến. Sửa được khi in. */
export function soTemMacDinh(n: Pick<NutLo, "kind" | "id">, dl: Pick<DuLieuTruyXuat, "wips" | "packagings">): number {
  const so =
    n.kind === "W" ? dl.wips.find((w) => w.id === n.id)?.blocksCount :
    n.kind === "P" ? dl.packagings.find((p) => p.id === n.id)?.outputUnits :
    1;
  return Math.min(500, Math.max(1, Math.round(so || 1)));
}
