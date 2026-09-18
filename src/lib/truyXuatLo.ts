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
// Mối nối giữa các tầng: bảng lot_inputs (mig 0046) + export_items.wip_id (đã có).
// ============================================================
import type {
  Customer,
  ExportItem,
  ExportOrder,
  ImportShipment,
  LotInput,
  LotKind,
  MaterialImportItem,
  Packaging,
  Product,
  SalesOrder,
  WipProductionItem,
  Workshop,
} from "@/types";

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
}

/** X = một dòng lệnh xuất (lá cuối của cây truy xuôi — hàng đã rời xưởng). */
export type LoaiNut = LotKind | "X";

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
  X: "Xuất đi",
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

/** Dựng một nút lô từ loại + id. Bản ghi đã mất thì trả nút `mat` với nhãn từ lot_inputs. */
export function nutLo(kind: LoaiNut, id: string, dl: DuLieuTruyXuat): NutLo {
  const mat = (nhan: string): NutLo => ({
    kind, id, nhan, moTa: "(bản ghi không còn)", ngay: "", xuong: "", kg: 0, chiTiet: [], mat: true,
  });
  if (kind === "S") {
    const s = dl.shipments.find((x) => x.id === id);
    if (!s) return mat(dl.lotInputs.find((l) => l.inputKind === "S" && l.inputId === id)?.inputLabel || id);
    const dong = dl.imports.filter((m) => m.shipmentId === id);
    const loai = [...new Set(dong.map((m) => m.materialTypeName || m.category).filter(Boolean))];
    const kg = dong.reduce((t, m) => t + (m.quantityKg || 0), 0);
    return {
      kind, id, nhan: nhanLoNl(s), moTa: loai.join(", ") || "nguyên liệu",
      ngay: s.deliveryDate, xuong: s.workshop, kg, mat: false,
      chiTiet: [
        { nhan: "Đại lý", giaTri: s.supplierName || "—" },
        { nhan: "Ngày về", giaTri: s.deliveryDate },
        { nhan: "Xe · tài xế", giaTri: [s.licensePlate, s.driverName].filter(Boolean).join(" · ") || "—" },
        ...dong.map((m) => ({ nhan: m.materialTypeName || m.category, giaTri: kgChu(m.quantityKg || 0) })),
        ...(s.ssccCode ? [{ nhan: "SSCC", giaTri: s.ssccCode }] : []),
        ...(s.operator ? [{ nhan: "Người ghi", giaTri: s.operator }] : []),
      ],
    };
  }
  if (kind === "W") {
    const w = dl.wips.find((x) => x.id === id);
    if (!w) return mat(dl.lotInputs.find((l) => l.inputKind === "W" && l.inputId === id)?.inputLabel || id);
    return {
      kind, id, nhan: nhanLoBtp(w), moTa: tenMatHang(dl, w.productId),
      ngay: w.productionDate, xuong: w.workshop, kg: w.quantityKg || 0, mat: false,
      chiTiet: [
        { nhan: "Mặt hàng", giaTri: tenMatHang(dl, w.productId) },
        ...(w.spec ? [{ nhan: "Quy cách", giaTri: w.spec }] : []),
        { nhan: "Ngày sản xuất", giaTri: w.productionDate },
        { nhan: "Sản lượng", giaTri: `${kgChu(w.quantityKg || 0)}${w.blocksCount ? ` · ${w.blocksCount} block` : ""}` },
        ...(w.warehouse ? [{ nhan: "Kho", giaTri: w.warehouse }] : []),
        ...(w.processingType ? [{ nhan: "Kiểu chế biến", giaTri: w.processingType }] : []),
        ...(w.operator ? [{ nhan: "Người ghi", giaTri: w.operator }] : []),
      ],
    };
  }
  if (kind === "P") {
    const p = dl.packagings.find((x) => x.id === id);
    if (!p) return mat(id);
    return {
      kind, id, nhan: nhanLoTp(p), moTa: tenMatHang(dl, p.toProductId),
      ngay: p.date, xuong: p.workshop, kg: p.outputKg || 0, mat: false,
      chiTiet: [
        { nhan: "Thành phẩm", giaTri: tenMatHang(dl, p.toProductId) },
        ...(p.toSpec ? [{ nhan: "Quy cách", giaTri: p.toSpec }] : []),
        { nhan: "Ngày đóng gói", giaTri: p.date },
        { nhan: "Ra", giaTri: `${kgChu(p.outputKg || 0)}${p.outputUnits ? ` · ${p.outputUnits} đơn vị` : ""}` },
        { nhan: "Từ BTP", giaTri: `${tenMatHang(dl, p.fromProductId)} · ${kgChu(p.inputKg || 0)}` },
        ...(p.warehouse ? [{ nhan: "Kho", giaTri: p.warehouse }] : []),
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
    kind, id, nhan: `Xuất ${lenh?.exportDate ?? ""} → ${khach?.name ?? "khách ?"}`,
    moTa: tenMatHang(dl, x.productId), ngay: lenh?.exportDate ?? "", xuong: "", kg: x.quantityKg || 0, mat: false,
    chiTiet: [
      { nhan: "Khách", giaTri: khach ? `${khach.name}${khach.market ? ` (${khach.market})` : ""}` : "—" },
      { nhan: "Ngày xuất", giaTri: lenh?.exportDate ?? "—" },
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
    return n.mat && !dl.lotInputs.some((l) => l.inputId === ma.id || l.outputId === ma.id) ? [] : [n];
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

/**
 * Truy XUÔI: lô này đã đi vào những đâu (NL → mẻ SX → đóng gói / lệnh xuất → khách).
 * Cây này là thứ cần khi THU HỒI: chỉ ra đúng phạm vi hàng bị ảnh hưởng.
 */
export function truyXuoi(kind: LoaiNut, id: string, dl: DuLieuTruyXuat, sau = 5, daQua = new Set<string>()): NhanhCay[] {
  if (sau <= 0 || kind === "X") return [];
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
  return [...quaBienDoi, ...quaXuat];
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

/** Cân bằng khối lượng theo lô (NL: nhận ↔ đã đưa vào SX · BTP: sản xuất ↔ đóng gói + xuất). */
export function canBangLo(kind: LoaiNut, id: string, dl: DuLieuTruyXuat): CanBang | null {
  if (kind !== "S" && kind !== "W") return null;
  const n = nutLo(kind, id, dl);
  if (n.mat) return null;
  const dung = dl.lotInputs.filter((l) => l.inputKind === kind && l.inputId === id);
  const ra: CanBang["ra"] = [];
  const coKg = dung.filter((l) => l.quantityKg != null);
  if (coKg.length)
    ra.push({
      nhan: kind === "S" ? "Đã đưa vào sản xuất" : "Đã đóng gói",
      kg: coKg.reduce((t, l) => t + (l.quantityKg ?? 0), 0),
    });
  if (kind === "W") {
    const xuat = dl.exportItems.filter((x) => x.wipId === id);
    if (xuat.length) ra.push({ nhan: "Đã xuất theo lệnh", kg: xuat.reduce((t, x) => t + (x.quantityKg || 0), 0) });
  }
  const tongRa = ra.reduce((t, r) => t + r.kg, 0);
  return { vao: n.kg, ra, chuaCan: dung.length - coKg.length, con: n.kg - tongRa };
}

// ---------- Danh sách lô để CHỌN khi gắn ----------

const lui = (iso: string, ngay: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - ngay);
  return d.toISOString().slice(0, 10);
};

/**
 * Lô NL gần đây để chọn khi gắn cho mẻ SX: cùng xưởng, về trong `soNgay` ngày tính
 * tới ngày SX, MỚI trước. (FIFO gợi ý lô CŨ trước là đợt 2 — cần tồn theo lô.)
 */
export function loNlDeChon(dl: DuLieuTruyXuat, xuong: Workshop, denNgay: string, soNgay = 45): NutLo[] {
  const tu = lui(denNgay, soNgay);
  return dl.shipments
    .filter((s) => s.workshop === xuong && s.deliveryDate >= tu && s.deliveryDate <= denNgay)
    .sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate))
    .map((s) => nutLo("S", s.id, dl));
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
