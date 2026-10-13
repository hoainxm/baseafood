// ============================================================
// Tên file: src/lib/dongChay.ts
// Tên tiếng Việt: Dòng chảy số liệu toàn chuỗi (nhập → SX → kho → đóng gói → bán)
// Description: Pure aggregations for the flow dashboard — sankey kg, 5-stage
//              pipeline, daily stock series, per-product norm, chain alerts.
// ============================================================
/**
 * Gom số cho màn Tổng quan "Dòng chảy số liệu" (spec docs/spec/che-do-demo.md §5b).
 * Hàm THUẦN: nhận dữ liệu qua tham số, không đọc/ghi repo. Tồn đi qua engine sẵn
 * có (`tinhSoTonTP`, `tinhTonTP`, `tinhTonChiTiet`, `theoGiaiDoan`) để con số khớp
 * các màn chuyên biệt. CHỈ CỘNG KG — không cộng tiền khác tiền tệ (XK USD ≠ NĐ VND).
 */
import type {
  BalancingInputItem,
  BalancingOutputItem,
  BalancingPeriod,
  DailyLock,
  FinishedGoodsOpeningStock,
  MaterialOpeningStock,
  ScrapItem,
  Workshop,
} from "@/types";
import { isBackdatedImport, isBackdatedWip } from "@/types";
import { KHO_BAN_LE, KHO_TP, locBanLe, tinhTonChiTiet, tinhTonTP, truTonBTP } from "@/lib/inventory";
import { tinhSoTonTP, tongSoTonTP } from "@/lib/inventoryFinished";
import { theoGiaiDoan, type DuLieuTruyXuat, type KhoaGiaiDoan } from "@/lib/truyXuatLo";
import { calculateBalancing, type BalancingResult } from "@/lib/balancingCalc";

/** Mọi bảng màn Dòng chảy cần — DuLieuTruyXuat + các sổ chốt/cân đối/tồn đầu. */
export interface DuLieuDongChay extends DuLieuTruyXuat {
  scraps: readonly ScrapItem[];
  dailyLocks: readonly DailyLock[];
  productionLocks: readonly DailyLock[];
  periods: readonly BalancingPeriod[];
  balancingInputs: readonly BalancingInputItem[];
  balancingOutputs: readonly BalancingOutputItem[];
  materialOpening: readonly MaterialOpeningStock[];
  finishedOpening: readonly FinishedGoodsOpeningStock[];
}

export interface KhoangXem {
  tu: string;
  den: string;
  /** Rỗng / undefined = cả 3 xưởng. */
  xuong?: Workshop | "";
}

/** Ngưỡng định mức lệch so với bình quân (chủ dự án chốt 2026-10-12: ±5%). */
export const NGUONG_DINH_MUC = 0.05;
/** BTP chờ duyệt nhập kho quá số ngày này thì cảnh báo. */
export const NGAY_CHO_DUYET = 3;

const trongKhoang = (ngay: string | undefined, k: KhoangXem) => !!ngay && ngay >= k.tu && ngay <= k.den;
const dungXuong = (x: Workshop | "" | undefined, k: KhoangXem) => !k.xuong || x === k.xuong;
const cong = <T>(ds: readonly T[], lay: (x: T) => number) => ds.reduce((s, x) => s + (lay(x) || 0), 0);

/** Các ngày yyyy-mm-dd từ `tu` tới `den` (gồm cả hai đầu), theo lịch UTC cho khỏi lệch múi giờ. */
export function cacNgay(tu: string, den: string): string[] {
  const ra: string[] = [];
  if (!tu || !den || tu > den) return ra;
  const d = new Date(`${tu}T00:00:00Z`);
  const cuoi = new Date(`${den}T00:00:00Z`).getTime();
  while (d.getTime() <= cuoi && ra.length < 1000) {
    ra.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return ra;
}

/** Lùi `soNgay` ngày từ một ngày yyyy-mm-dd. */
export function luiNgay(ngay: string, soNgay: number): string {
  const d = new Date(`${ngay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - soNgay);
  return d.toISOString().slice(0, 10);
}

/** Lọc các sổ theo khoảng + xưởng — MỘT chỗ để mọi hình dùng chung một tập dòng. */
function locSo(d: DuLieuDongChay, k: KhoangXem) {
  const xuongMe = new Map(d.wips.map((w) => [w.id, w.workshop]));
  const phieuBan = new Map((d.salesInvoices ?? []).map((v) => [v.id, v]));
  const ngayLenh = new Map(d.exportOrders.map((o) => [o.id, o.exportDate]));
  return {
    imports: d.imports.filter((r) => trongKhoang(r.deliveryDate, k) && dungXuong(r.workshop, k)),
    wips: d.wips.filter((w) => trongKhoang(w.productionDate, k) && dungXuong(w.workshop, k)),
    domestic: (d.domesticSales ?? []).filter((r) => trongKhoang(r.saleDate, k) && dungXuong(r.workshop, k)),
    scraps: d.scraps.filter((s) => trongKhoang(s.date, k) && !!s.workshop && dungXuong(s.workshop, k)),
    leftovers: d.productionLocks.filter((l) => trongKhoang(l.lockDate, k) && dungXuong(l.workshop, k)),
    packagings: d.packagings.filter((p) => trongKhoang(p.date, k) && dungXuong(p.workshop, k)),
    exportItems: d.exportItems.filter(
      (x) => trongKhoang(ngayLenh.get(x.exportId), k) && dungXuong(xuongMe.get(x.wipId), k),
    ),
    sales: (d.salesItems ?? []).filter(
      (b) => trongKhoang(b.deliveryDate, k) && dungXuong(phieuBan.get(b.invoiceId)?.workshop, k),
    ),
  };
}

// ---------- V3: sơ đồ dòng chảy kg (sankey) ----------

/** Nhóm nút — quyết định màu: nguồn vào · xưởng · khâu giữa · hàng ra · hao hụt · còn tồn. */
export type NhomNut = "nguon" | "xuong" | "giua" | "ra" | "hao" | "ton";

export interface NutDong {
  id: string;
  nhan: string;
  /** Cột (0 = trái). Cố định theo khâu để sơ đồ luôn đọc trái → phải. */
  tang: number;
  nhom: NhomNut;
  /** kg đi qua nút = max(vào, ra). */
  kg: number;
  /** Màn mở khi bấm nút (rỗng = không mở). */
  duongDan?: string;
}

export interface CanhDong {
  tu: string;
  den: string;
  kg: number;
}

export interface DongChay {
  nut: NutDong[];
  canh: CanhDong[];
  /** Tổng kg NL nhập trong khoảng (đầu dòng chảy). */
  tongNhap: number;
}

/** Số đại lý lớn nhất được vẽ riêng; còn lại gộp "Đại lý khác". */
const SO_DAI_LY = 5;

/**
 * Dòng chảy kg trong khoảng: đại lý → xưởng → {BTP · bán nội địa NL · phế liệu ·
 * còn dở · hao hụt} → kho dự trữ / chờ duyệt → {đóng gói · xuất đơn · bán block ·
 * tồn} → đóng gói → {bán hàng đóng gói · tồn TP · hao hụt}.
 *
 * BẤT BIẾN (có test): mọi nút giữa có Σ vào = Σ ra. Chỗ hụt được gọi tên bằng nút
 * cân bằng — vào > ra ⇒ "tồn / hao hụt"; ra > vào ⇒ "lấy từ tồn trước kỳ" — không
 * bao giờ nuốt số.
 */
export function dongChayKg(d: DuLieuDongChay, k: KhoangXem): DongChay {
  const s = locSo(d, k);
  const nut = new Map<string, NutDong>();
  const canh: CanhDong[] = [];
  const themNut = (id: string, nhan: string, tang: number, nhom: NhomNut, duongDan?: string) => {
    if (!nut.has(id)) nut.set(id, { id, nhan, tang, nhom, kg: 0, duongDan });
  };
  /** Nối hai nút; cùng cặp thì cộng dồn — một cặp chỉ một dải trên sơ đồ. */
  const noi = (tu: string, den: string, kg: number) => {
    if (!(kg > 0.0005)) return;
    const co = canh.find((c) => c.tu === tu && c.den === den);
    if (co) co.kg += kg;
    else canh.push({ tu, den, kg });
  };

  // Tầng 0 → 1: đại lý → xưởng
  const theoDaiLy = new Map<string, number>();
  for (const r of s.imports) theoDaiLy.set(r.supplierName || "(chưa ghi đại lý)", (theoDaiLy.get(r.supplierName || "(chưa ghi đại lý)") ?? 0) + (r.quantityKg || 0));
  const lon = new Set([...theoDaiLy.entries()].sort((a, b) => b[1] - a[1]).slice(0, SO_DAI_LY).map(([t]) => t));
  const idDaiLy = (ten: string) => (lon.has(ten) ? `dl:${ten}` : "dl:*");
  for (const r of s.imports) {
    const ten = r.supplierName || "(chưa ghi đại lý)";
    const id = idDaiLy(ten);
    themNut(id, lon.has(ten) ? ten : "Đại lý khác", 0, "nguon", "/imports");
    themNut(`x:${r.workshop}`, `Xưởng ${r.workshop}`, 1, "xuong", "/wip");
    noi(id, `x:${r.workshop}`, r.quantityKg || 0);
  }

  // Tầng 1 → 2: xưởng → kết quả xử lý NL
  themNut("btp", "Bán thành phẩm", 2, "giua", "/wip");
  const xuongs = new Set<Workshop>([
    ...s.imports.map((r) => r.workshop),
    ...s.wips.map((w) => w.workshop),
    ...s.domestic.map((r) => r.workshop),
  ]);
  for (const x of xuongs) {
    const id = `x:${x}`;
    themNut(id, `Xưởng ${x}`, 1, "xuong", "/wip");
    noi(id, "btp", cong(s.wips.filter((w) => w.workshop === x), (w) => w.quantityKg));
    const nd = cong(s.domestic.filter((r) => r.workshop === x), (r) => r.quantityKg);
    if (nd > 0) themNut("nd", "Bán nội địa NL", 2, "ra", "/wip");
    noi(id, "nd", nd);
    const pl = cong(s.scraps.filter((r) => r.workshop === x), (r) => r.quantityKg);
    if (pl > 0) themNut("pl", "Phế liệu", 2, "hao", "/imports");
    noi(id, "pl", pl);
    const cd = cong(s.leftovers.filter((r) => r.workshop === x), (r) => r.leftoverKg ?? 0);
    if (cd > 0) themNut("cd", "Còn dở / đông gửi", 2, "ton", "/nxt-nl");
    noi(id, "cd", cd);
  }

  // Tầng 2 → 3: BTP → kho dự trữ / chờ duyệt
  const daNhap = cong(s.wips.filter((w) => w.status === "da-nhap"), (w) => w.quantityKg);
  const choDuyet = cong(s.wips.filter((w) => w.status !== "da-nhap"), (w) => w.quantityKg);
  themNut("kho", "Kho dự trữ (BTP)", 3, "giua", "/warehouse");
  noi("btp", "kho", daNhap);
  if (choDuyet > 0) themNut("cho", "Chờ duyệt nhập kho", 3, "ton", "/warehouse");
  noi("btp", "cho", choDuyet);

  // Tầng 3 → 4: kho → đóng gói · xuất đơn · bán block thô
  const goiVao = cong(s.packagings, (p) => p.inputKg);
  const goiRa = cong(s.packagings, (p) => p.outputKg);
  if (goiVao > 0 || goiRa > 0) themNut("goi", "Đóng gói", 4, "giua", "/packaging");
  noi("kho", "goi", goiVao);
  const xuatDon = cong(s.exportItems, (x) => x.quantityKg);
  if (xuatDon > 0) themNut("xd", "Xuất theo đơn", 4, "ra", "/orders");
  noi("kho", "xd", xuatDon);
  const banBlock = cong(s.sales.filter((b) => b.sourceWarehouse === KHO_BAN_LE), (b) => b.quantityKg);
  if (banBlock > 0) themNut("bb", "Bán block thô", 4, "ra", "/sales");
  noi("kho", "bb", banBlock);

  // Tầng 4 → 5: đóng gói → {bán hàng đóng gói · tồn TP · hao hụt đóng gói}. Không vẽ
  // riêng nút "TP đóng gói" (thêm một cột làm nhãn chật): TP ra đi thẳng tới đích.
  const banTP = cong(s.sales.filter((b) => b.sourceWarehouse === KHO_TP), (b) => b.quantityKg);
  if (banTP > 0) themNut("btpb", "Bán hàng đóng gói", 5, "ra", "/sales");
  noi("goi", "btpb", Math.min(banTP, goiRa));
  if (goiRa > banTP) themNut("tonTp", "Tồn TP cuối kỳ", 5, "ton", "/packaging");
  noi("goi", "tonTp", goiRa - banTP);
  if (goiVao > goiRa) themNut("hdg", "Hao hụt đóng gói", 5, "hao", "/packaging");
  noi("goi", "hdg", goiVao - goiRa);
  // Bán nhiều hơn TP đóng ra trong kỳ ⇒ phần dư lấy từ TP đóng gói trước kỳ.
  if (banTP > goiRa) themNut("tonTpDau", "Tồn TP đầu kỳ", 4, "ton", "/packaging");
  noi("tonTpDau", "btpb", banTP - goiRa);

  // Cân bằng từng nút giữa, theo thứ tự trái → phải (nút cân bằng thêm sau không làm lệch nút trước).
  const canBang = (id: string, thua: [string, string, NhomNut, number], thieu: [string, string, NhomNut, number]) => {
    if (!nut.has(id)) return;
    const vao = cong(canh.filter((c) => c.den === id), (c) => c.kg);
    const ra = cong(canh.filter((c) => c.tu === id), (c) => c.kg);
    if (vao - ra > 0.0005) {
      themNut(thua[0], thua[1], thua[3], thua[2]);
      noi(id, thua[0], vao - ra);
    } else if (ra - vao > 0.0005) {
      themNut(thieu[0], thieu[1], thieu[3], thieu[2]);
      noi(thieu[0], id, ra - vao);
    }
  };
  for (const x of xuongs)
    canBang(`x:${x}`, ["hh", "Hao hụt / chưa ghi ra", "hao", 2], ["nlTruoc", "NL từ kho / kỳ trước", "ton", 0]);
  // Nút xưởng đã cân ⇒ "btp" luôn cân (vào = Σ mẻ = đã nhập + chờ duyệt).
  canBang("kho", ["tonBtp", "Tồn BTP cuối kỳ", "ton", 4], ["tonBtpDau", "Tồn BTP đầu kỳ", "ton", 2]);
  // Đóng gói ra nhiều hơn BTP vào (ghi nhầm) ⇒ phần dư gọi tên, không ẩn.
  if (goiRa > goiVao) {
    themNut("goiDu", "TP ra vượt BTP vào (soát lại)", 3, "hao", "/packaging");
    noi("goiDu", "goi", goiRa - goiVao);
  }

  for (const n of nut.values()) {
    const vao = cong(canh.filter((c) => c.den === n.id), (c) => c.kg);
    const ra = cong(canh.filter((c) => c.tu === n.id), (c) => c.kg);
    n.kg = Math.max(vao, ra);
  }
  // Bỏ nút không có cạnh nào (vd xưởng chỉ có số 0).
  const coCanh = new Set(canh.flatMap((c) => [c.tu, c.den]));
  return {
    nut: [...nut.values()].filter((n) => coCanh.has(n.id)),
    canh,
    tongNhap: cong(s.imports, (r) => r.quantityKg),
  };
}

// ---------- V3 bản dễ đọc: chia phần ra của một nhóm nút ----------

export interface PhanRa {
  /** id nút đích (vd "btp", "pl", "goi"). */
  id: string;
  nhan: string;
  nhom: NhomNut;
  kg: number;
  /** Phần của tổng (0–1). */
  tiLe: number;
}

/**
 * Gom mọi dải ĐI RA từ các nút thoả `laNguon` theo nút đích — để vẽ "thanh chia phần"
 * thay cho sơ đồ dòng chảy: VD `laNguon = id bắt đầu "x:"` ⇒ "100 kg nguyên liệu vào
 * xưởng ra thành bao nhiêu BTP, phế liệu, hao hụt…". Thứ tự theo `thuTu` (id không có
 * trong `thuTu` xếp sau, kg giảm dần). Σ tiLe = 1 khi tổng > 0.
 */
export function phanBoRa(dc: DongChay, laNguon: (id: string) => boolean, thuTu: readonly string[] = []): PhanRa[] {
  const gom = new Map<string, number>();
  for (const c of dc.canh) if (laNguon(c.tu)) gom.set(c.den, (gom.get(c.den) ?? 0) + c.kg);
  const tong = [...gom.values()].reduce((s, v) => s + v, 0);
  const nut = new Map(dc.nut.map((n) => [n.id, n]));
  const viTri = (id: string) => (thuTu.includes(id) ? thuTu.indexOf(id) : thuTu.length);
  return [...gom.entries()]
    .map(([id, kg]) => ({ id, nhan: nut.get(id)?.nhan ?? id, nhom: nut.get(id)?.nhom ?? "giua", kg, tiLe: tong > 0 ? kg / tong : 0 }))
    .sort((a, b) => viTri(a.id) - viTri(b.id) || b.kg - a.kg);
}

// ---------- V2: băng chuyền 5 khâu ----------

export interface KhauChuyen {
  khoa: KhoaGiaiDoan;
  ten: string;
  /** kg đã đi qua khâu trong khoảng. */
  kg: number;
  /** kg đang chờ ở khâu (BTP chờ duyệt) — 0 nếu không áp dụng. */
  kgCho: number;
  /** Số lô / dòng còn thiếu việc (tem, gắn lô, duyệt, quét kiểm) — từ `theoGiaiDoan`. */
  viecThieu: number;
  /** kg khâu này ÷ kg khâu nguồn (SX ÷ nhập · kho ÷ SX · đóng gói và xuất/bán ÷ kho); null ở khâu đầu. */
  tiLeChuyen: number | null;
  duongDan: string;
}

const DUONG_KHAU: Record<KhoaGiaiDoan, string> = {
  nhap: "/imports",
  "san-xuat": "/wip",
  kho: "/warehouse",
  "dong-goi": "/packaging",
  "xuat-ban": "/orders",
};

/** Năm khâu nhập → SX → kho → đóng gói → xuất/bán: kg qua, kg chờ, việc còn thiếu. */
export function bangChuyen(d: DuLieuDongChay, k: KhoangXem): KhauChuyen[] {
  const s = locSo(d, k);
  const giaiDoan = theoGiaiDoan(d, { tu: k.tu, den: k.den, xuong: k.xuong ?? "" });
  const thieu = new Map(giaiDoan.map((g) => [g.khoa, g.muc.filter((m) => m.thieu.length > 0).length]));
  const ten = new Map(giaiDoan.map((g) => [g.khoa, g.ten]));
  const kg: Record<KhoaGiaiDoan, [number, number]> = {
    nhap: [cong(s.imports, (r) => r.quantityKg), 0],
    "san-xuat": [cong(s.wips, (w) => w.quantityKg), 0],
    kho: [
      cong(s.wips.filter((w) => w.status === "da-nhap"), (w) => w.quantityKg),
      cong(s.wips.filter((w) => w.status !== "da-nhap"), (w) => w.quantityKg),
    ],
    "dong-goi": [cong(s.packagings, (p) => p.outputKg), 0],
    "xuat-ban": [cong(s.exportItems, (x) => x.quantityKg) + cong(s.sales, (b) => b.quantityKg) + cong(s.domestic, (r) => r.quantityKg), 0],
  };
  const thuTu: KhoaGiaiDoan[] = ["nhap", "san-xuat", "kho", "dong-goi", "xuat-ban"];
  // Mẫu số = khâu NGUỒN thật: đóng gói và xuất/bán đều rút từ kho dự trữ (không phải
  // xuất/bán ÷ đóng gói — xuất theo đơn đi thẳng từ kho, chia vậy ra > 100% vô nghĩa).
  const nguon: Partial<Record<KhoaGiaiDoan, KhoaGiaiDoan>> = { "san-xuat": "nhap", kho: "san-xuat", "dong-goi": "kho", "xuat-ban": "kho" };
  return thuTu.map((khoa) => {
    const truoc = nguon[khoa] ? kg[nguon[khoa]][0] : 0;
    return {
      khoa,
      ten: ten.get(khoa) ?? khoa,
      kg: kg[khoa][0],
      kgCho: kg[khoa][1],
      viecThieu: thieu.get(khoa) ?? 0,
      tiLeChuyen: truoc > 0 ? kg[khoa][0] / truoc : null,
      duongDan: DUONG_KHAU[khoa],
    };
  });
}

// ---------- V4 + V5: chuỗi theo ngày ----------

export interface MocNgay {
  ngay: string;
  /** kg NL nhập trong ngày. */
  nhap: number;
  /** kg BTP sản xuất trong ngày. */
  sanXuat: number;
  /** Tồn BTP kho dự trữ cuối ngày (engine sổ NXT BTP — gồm tồn đầu khai tay). */
  tonBtp: number;
  /** Tồn TP đóng gói cuối ngày. */
  tonTp: number;
}

/**
 * Mỗi ngày trong khoảng: nhập NL, sản xuất BTP, tồn BTP + TP cuối ngày. Tồn NL KHÔNG
 * vẽ: sổ NL chưa trừ lượng NL đưa vào sản xuất (cố ý từ 25/8) nên đường tồn NL chỉ
 * đi lên — vẽ ra là sai nghĩa.
 */
export function chuoiTheoNgay(d: DuLieuDongChay, k: KhoangXem): MocNgay[] {
  const s = locSo(d, k);
  const nhapNgay = new Map<string, number>();
  for (const r of s.imports) nhapNgay.set(r.deliveryDate, (nhapNgay.get(r.deliveryDate) ?? 0) + (r.quantityKg || 0));
  const sxNgay = new Map<string, number>();
  for (const w of s.wips) sxNgay.set(w.productionDate, (sxNgay.get(w.productionDate) ?? 0) + (w.quantityKg || 0));

  // Tồn theo xưởng: lọc mẻ/đóng gói theo xưởng; bán + xuất bám theo mẻ/phiếu nên lọc theo đó.
  const ds = <T>(x: readonly T[]) => [...x];
  const wipsX = d.wips.filter((w) => dungXuong(w.workshop, k));
  const meX = new Set(wipsX.map((w) => w.id));
  const goiX = d.packagings.filter((p) => dungXuong(p.workshop, k));
  const phieuBan = new Map((d.salesInvoices ?? []).map((v) => [v.id, v.workshop]));
  const banX = (d.salesItems ?? []).filter((b) => dungXuong(phieuBan.get(b.invoiceId), k));
  const xuatX = d.exportItems.filter((x) => !k.xuong || meX.has(x.wipId));
  const banTP = banX.filter((b) => b.sourceWarehouse === KHO_TP);

  return cacNgay(k.tu, k.den).map((ngay) => {
    const tonBtp = tongSoTonTP(
      tinhSoTonTP({
        sanXuat: ds(wipsX),
        exportOrders: ds(d.exportOrders),
        exportItems: ds(xuatX),
        salesItems: ds(banX),
        packagings: ds(goiX),
        opening: k.xuong ? [] : ds(d.finishedOpening),
        products: ds(d.products),
        tuNgay: ngay,
        denNgay: ngay,
      }),
    ).tonCuoi;
    const goiDen = goiX.filter((p) => p.date <= ngay);
    const banDen = locBanLe(banTP.filter((b) => b.deliveryDate <= ngay), KHO_TP, d.lotDispatches ?? []);
    const tonTp = cong(tinhTonTP(goiDen, banDen), (t) => t.conLai);
    return { ngay, nhap: nhapNgay.get(ngay) ?? 0, sanXuat: sxNgay.get(ngay) ?? 0, tonBtp, tonTp };
  });
}

// ---------- V8: định mức theo mặt hàng ----------

export interface DinhMucMatHang {
  productId: string;
  ten: string;
  /** kg NL đã gắn (qua lô) cho các mẻ của mặt hàng. */
  nlKg: number;
  /** kg BTP của các mẻ đó. */
  tpKg: number;
  /** NL ÷ TP. */
  dinhMuc: number;
  /** (định mức − bình quân) ÷ bình quân. */
  lech: number;
  vuotNguong: boolean;
}

/**
 * Định mức NL/TP theo mặt hàng, CHỈ từ mẻ đã gắn lô NL có cân kg (`lot_inputs`) —
 * mẻ chưa gắn lô không biết NL vào bao nhiêu nên không đoán. Bình quân = Σ NL ÷ Σ TP
 * (gia quyền theo kg), lệch vượt `nguong` thì gắn cờ.
 */
export function dinhMucTheoMatHang(d: DuLieuDongChay, k: KhoangXem, nguong = NGUONG_DINH_MUC): {
  dong: DinhMucMatHang[];
  binhQuan: number | null;
} {
  const s = locSo(d, k);
  const nlCuaMe = new Map<string, number>();
  for (const l of d.lotInputs) {
    if (l.outputKind !== "W" || l.inputKind !== "S" || l.quantityKg == null) continue;
    nlCuaMe.set(l.outputId, (nlCuaMe.get(l.outputId) ?? 0) + l.quantityKg);
  }
  const gom = new Map<string, { nl: number; tp: number }>();
  for (const w of s.wips) {
    const nl = nlCuaMe.get(w.id);
    if (!nl || !(w.quantityKg > 0)) continue;
    const g = gom.get(w.productId) ?? { nl: 0, tp: 0 };
    g.nl += nl;
    g.tp += w.quantityKg;
    gom.set(w.productId, g);
  }
  const tongNl = cong([...gom.values()], (g) => g.nl);
  const tongTp = cong([...gom.values()], (g) => g.tp);
  if (tongTp <= 0) return { dong: [], binhQuan: null };
  const binhQuan = tongNl / tongTp;
  const ten = new Map(d.products.map((p) => [p.id, p.name]));
  const dong = [...gom.entries()]
    .map(([productId, g]) => {
      const dinhMuc = g.nl / g.tp;
      const lech = (dinhMuc - binhQuan) / binhQuan;
      return {
        productId,
        ten: ten.get(productId) ?? `Mặt hàng ${productId}`,
        nlKg: g.nl,
        tpKg: g.tp,
        dinhMuc,
        lech,
        vuotNguong: Math.abs(lech) > nguong,
      };
    })
    .sort((a, b) => b.dinhMuc - a.dinhMuc);
  return { dong, binhQuan };
}

// ---------- V6 + V7: kết quả kỳ cân đối ----------

export interface KetQuaKy {
  period: BalancingPeriod;
  kq: BalancingResult;
  /** Chưa có thành phẩm ⇒ định mức + lãi/lỗ chưa có nghĩa (31-can-doi-ky §công thức). */
  coThanhPham: boolean;
}

/** Mọi kỳ cân đối (mới nhất trước) kèm kết quả `calculateBalancing` — không đổi công thức. */
export function ketQuaCacKy(d: DuLieuDongChay): KetQuaKy[] {
  return [...d.periods]
    .sort((a, b) => (b.startDate || b.createdAt || "").localeCompare(a.startDate || a.createdAt || ""))
    .map((period) => {
      const kq = calculateBalancing(
        period,
        d.balancingInputs.filter((r) => r.periodId === period.id),
        d.scraps.filter((r) => r.periodId === period.id),
        d.balancingOutputs.filter((r) => r.periodId === period.id),
      );
      return { period, kq, coThanhPham: kq.totalOutputKg > 0 };
    });
}

// ---------- V9: cảnh báo chuỗi ----------

export type LoaiCanhBao =
  | "chua-chot-nhap"
  | "chua-chot-sx"
  | "doi-sau-chot"
  | "ghi-bu"
  | "ban-vuot"
  | "lo-chua-gan"
  | "cho-duyet-lau"
  | "dinh-muc-lech"
  | "ky-dinh-muc-lech";

export interface CanhBao {
  /** Khoá ổn định (tô màu dòng / React key). */
  id: string;
  loai: LoaiCanhBao;
  /** "loi" = sổ sai cần sửa · "nhac" = việc chưa làm · "tin" = để biết. */
  muc: "loi" | "nhac" | "tin";
  tieuDe: string;
  chiTiet: string;
  ngay: string;
  xuong: Workshop | "";
  duongDan: string;
}

const NHAN_LOAI: Record<LoaiCanhBao, string> = {
  "chua-chot-nhap": "Ngày nhập chưa chốt",
  "chua-chot-sx": "Ngày sản xuất chưa chốt",
  "doi-sau-chot": "Sổ nhập đổi sau khi chốt",
  "ghi-bu": "Ghi bù",
  "ban-vuot": "Bán / xuất vượt tồn",
  "lo-chua-gan": "Chưa gắn lô",
  "cho-duyet-lau": "BTP chờ duyệt lâu",
  "dinh-muc-lech": "Định mức lệch",
  "ky-dinh-muc-lech": "Kỳ cân đối định mức lệch",
};
export const nhanLoaiCanhBao = (l: LoaiCanhBao) => NHAN_LOAI[l];

const fmtKg = (n: number) => `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(n)} kg`;
const fmtPt = (n: number) => `${n > 0 ? "+" : ""}${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(n * 100)}%`;

/**
 * Việc cần đốc trong khoảng — mỗi dòng trỏ tới đúng màn sửa. Ngày "hôm nay" truyền
 * vào (không đọc đồng hồ) để test được. Sắp: lỗi → nhắc → tin, mới trước.
 */
export function canhBaoChuoi(d: DuLieuDongChay, k: KhoangXem, homNay: string, nguong = NGUONG_DINH_MUC): CanhBao[] {
  const s = locSo(d, k);
  const ra: CanhBao[] = [];
  const daChot = (locks: readonly DailyLock[], ngay: string, x: Workshop) =>
    locks.some((l) => l.lockDate === ngay && l.workshop === x && l.isLocked);

  // 1. Ngày có nhập / sản xuất mà chưa chốt (không tính hôm nay — còn đang ghi).
  const ngayNhap = new Map<string, number>();
  for (const r of s.imports) ngayNhap.set(`${r.deliveryDate}|${r.workshop}`, (ngayNhap.get(`${r.deliveryDate}|${r.workshop}`) ?? 0) + (r.quantityKg || 0));
  for (const [khoa, kg] of ngayNhap) {
    const [ngay, x] = khoa.split("|") as [string, Workshop];
    if (ngay >= homNay) continue;
    const lock = d.dailyLocks.find((l) => l.lockDate === ngay && l.workshop === x && l.isLocked);
    if (!lock) {
      ra.push({ id: `ccn|${khoa}`, loai: "chua-chot-nhap", muc: "nhac", tieuDe: `Nhập ${fmtKg(kg)} chưa chốt ngày`, chiTiet: "Chốt ngày để khóa tổng nhập, kế toán mới lấy được số.", ngay, xuong: x, duongDan: "/imports" });
    } else if (Math.abs(lock.totalKgAtLock - kg) > 0.01) {
      // 3. Sổ đổi sau khi chốt: tổng hiện tại ≠ tổng lúc chốt.
      ra.push({ id: `dsc|${khoa}`, loai: "doi-sau-chot", muc: "loi", tieuDe: `Tổng nhập lệch ${fmtKg(kg - lock.totalKgAtLock)} so với lúc chốt`, chiTiet: `Lúc chốt ${fmtKg(lock.totalKgAtLock)}, nay ${fmtKg(kg)}. Soát lại dòng sửa sau chốt.`, ngay, xuong: x, duongDan: "/imports" });
    }
  }
  const ngaySx = new Map<string, number>();
  for (const w of s.wips) ngaySx.set(`${w.productionDate}|${w.workshop}`, (ngaySx.get(`${w.productionDate}|${w.workshop}`) ?? 0) + (w.quantityKg || 0));
  for (const [khoa, kg] of ngaySx) {
    const [ngay, x] = khoa.split("|") as [string, Workshop];
    if (ngay >= homNay || daChot(d.productionLocks, ngay, x)) continue;
    ra.push({ id: `ccs|${khoa}`, loai: "chua-chot-sx", muc: "nhac", tieuDe: `Sản xuất ${fmtKg(kg)} chưa chốt ngày`, chiTiet: "Chốt ngày sản xuất để ghi còn dở và khóa lô.", ngay, xuong: x, duongDan: "/wip" });
  }

  // 4. Ghi bù (nhập + sản xuất) — để biết, lý do đã bắt lúc ghi.
  const chuyen = d.shipments.filter((c) => trongKhoang(c.deliveryDate, k) && dungXuong(c.workshop, k) && isBackdatedImport(c));
  for (const c of chuyen)
    ra.push({ id: `gbn|${c.id}`, loai: "ghi-bu", muc: "tin", tieuDe: `Chuyến ${c.supplierName || ""} ghi bù ngày ${c.postingDate}`.trim(), chiTiet: c.backdateReason ? `Lý do: ${c.backdateReason}` : "Chưa ghi lý do.", ngay: c.deliveryDate, xuong: c.workshop, duongDan: "/imports" });
  for (const w of s.wips.filter(isBackdatedWip))
    ra.push({ id: `gbs|${w.id}`, loai: "ghi-bu", muc: "tin", tieuDe: `Mẻ ${fmtKg(w.quantityKg)} ghi bù ngày ${w.postingDate}`, chiTiet: w.backdateReason ? `Lý do: ${w.backdateReason}` : "Chưa ghi lý do.", ngay: w.productionDate, xuong: w.workshop, duongDan: "/wip" });

  // 5. Bán / đóng gói vượt tồn BTP (toàn bộ sổ — vượt là vượt, không theo khoảng).
  const ten = new Map(d.products.map((p) => [p.id, p.name]));
  const vuot = tinhTonChiTiet(
    [...d.wips],
    [...d.exportItems],
    truTonBTP([...(d.salesItems ?? [])], [...d.packagings], d.lotInputs, d.lotDispatches ?? []),
  ).banVuot;
  for (const v of vuot)
    ra.push({ id: `bv|${v.productId}|${v.spec}`, loai: "ban-vuot", muc: "loi", tieuDe: `${ten.get(v.productId) ?? v.productId}${v.spec ? ` · ${v.spec}` : ""} vượt tồn ${fmtKg(v.kg)}`, chiTiet: "Bán / đóng gói nhiều hơn lượng đã nhập kho. Soát ngày nhập kho hoặc dòng bán.", ngay: homNay, xuong: "", duongDan: "/warehouse" });

  // 6. Mẻ / phiếu đóng gói chưa gắn lô và chưa ghi lý do (đã qua ngày).
  const giaiDoan = theoGiaiDoan(d, { tu: k.tu, den: k.den, xuong: k.xuong ?? "" });
  for (const g of giaiDoan) {
    if (g.khoa !== "san-xuat" && g.khoa !== "dong-goi") continue;
    for (const m of g.muc) {
      if (!m.thieu.includes("lo") || m.nut.ngay >= homNay) continue;
      ra.push({ id: `lo|${m.nut.kind}|${m.nut.id}`, loai: "lo-chua-gan", muc: "nhac", tieuDe: `${m.nut.nhan} chưa gắn lô`, chiTiet: g.khoa === "san-xuat" ? "Gắn lô NL cho mẻ, hoặc ghi lý do khi chốt ngày." : "Gắn lô BTP cho phiếu đóng gói.", ngay: m.nut.ngay, xuong: m.nut.xuong, duongDan: g.khoa === "san-xuat" ? "/wip" : "/packaging" });
    }
  }

  // 7. BTP chờ duyệt nhập kho quá N ngày.
  const han = luiNgay(homNay, NGAY_CHO_DUYET);
  for (const w of s.wips.filter((w) => w.status === "cho-nhap" && w.productionDate < han))
    ra.push({ id: `cd|${w.id}`, loai: "cho-duyet-lau", muc: "nhac", tieuDe: `${ten.get(w.productId) ?? "BTP"} ${fmtKg(w.quantityKg)} chờ duyệt quá ${NGAY_CHO_DUYET} ngày`, chiTiet: "Thủ kho duyệt nhập kho để tồn dự trữ đủ.", ngay: w.productionDate, xuong: w.workshop, duongDan: `/warehouse?duyet=W:${w.id}` });

  // 8. Định mức mặt hàng lệch ngưỡng.
  const dm = dinhMucTheoMatHang(d, k, nguong);
  for (const r of dm.dong.filter((x) => x.vuotNguong))
    ra.push({ id: `dm|${r.productId}`, loai: "dinh-muc-lech", muc: r.lech > 0 ? "loi" : "tin", tieuDe: `${r.ten}: định mức ${r.dinhMuc.toFixed(2)} (${fmtPt(r.lech)})`, chiTiet: `Bình quân ${dm.binhQuan?.toFixed(2)}. ${r.lech > 0 ? "Tốn NL hơn mức chung — soát cân hoặc hao hụt." : "Ít NL hơn mức chung — soát lô gắn có thiếu không."}`, ngay: k.den < homNay ? k.den : homNay, xuong: "", duongDan: "/wip" });

  // 9. Kỳ cân đối có định mức lệch so với bình quân các kỳ cùng loại NL.
  const ky = ketQuaCacKy(d).filter((x) => x.coThanhPham);
  const theoLoai = new Map<string, KetQuaKy[]>();
  for (const x of ky) theoLoai.set(x.period.materialTypeName, [...(theoLoai.get(x.period.materialTypeName) ?? []), x]);
  for (const [loai, ds] of theoLoai) {
    if (ds.length < 2) continue;
    const bq = cong(ds, (x) => x.kq.totalInputKg) / cong(ds, (x) => x.kq.totalOutputKg);
    for (const x of ds) {
      const lech = (x.kq.norm - bq) / bq;
      const ngay = x.period.endDate || x.period.startDate || "";
      if (Math.abs(lech) <= nguong || (ngay && !trongKhoang(ngay, k))) continue;
      ra.push({ id: `kdm|${x.period.id}`, loai: "ky-dinh-muc-lech", muc: "tin", tieuDe: `${loai} · ${x.period.dateRangeDescription}: định mức ${x.kq.norm.toFixed(2)} (${fmtPt(lech)})`, chiTiet: `Bình quân các kỳ ${loai}: ${bq.toFixed(2)}.`, ngay, xuong: "", duongDan: `/balancing/${x.period.id}` });
    }
  }

  const thuTu = { loi: 0, nhac: 1, tin: 2 } as const;
  return ra.sort((a, b) => thuTu[a.muc] - thuTu[b.muc] || b.ngay.localeCompare(a.ngay) || a.id.localeCompare(b.id));
}

// ---------- V12: tuổi tồn kho ----------

export interface NhomTuoiTon {
  khoa: "duoi-30" | "30-60" | "60-90" | "tren-90";
  nhan: string;
  kg: number;
  soLo: number;
}

/**
 * Chia kg tồn theo số ngày lô đã nằm kho (tính từ ngày sản xuất tới `homNay`): dưới 30
 * · 30–60 · 60–90 · trên 90 ngày. Hàng nằm lâu phải đẩy trước (FIFO). Lô hết hàng bỏ qua.
 */
export function tuoiTon(los: readonly { ngaySX: string; conLai: number }[], homNay: string): NhomTuoiTon[] {
  const nhom: NhomTuoiTon[] = [
    { khoa: "duoi-30", nhan: "Dưới 30 ngày", kg: 0, soLo: 0 },
    { khoa: "30-60", nhan: "30–60 ngày", kg: 0, soLo: 0 },
    { khoa: "60-90", nhan: "60–90 ngày", kg: 0, soLo: 0 },
    { khoa: "tren-90", nhan: "Trên 90 ngày", kg: 0, soLo: 0 },
  ];
  const nay = new Date(`${homNay}T00:00:00Z`).getTime();
  for (const l of los) {
    if (!(l.conLai > 0) || !l.ngaySX) continue;
    const ngay = Math.floor((nay - new Date(`${l.ngaySX}T00:00:00Z`).getTime()) / 86_400_000);
    const g = nhom[ngay < 30 ? 0 : ngay < 60 ? 1 : ngay < 90 ? 2 : 3];
    g.kg += l.conLai;
    g.soLo += 1;
  }
  return nhom;
}

// ---------- V16: QC theo ngày ----------

export interface QcNgay {
  ngay: string;
  dat: number;
  tam: number;
  khongDat: number;
}

/** Đếm chỉ tiêu QC đạt / tạm / không đạt mỗi ngày trong [tu, den] của một xưởng ("" = mọi xưởng). */
export function qcTheoNgay(
  rows: readonly { date: string; workshop: Workshop; result: "dat" | "tam" | "khong-dat" }[],
  xuong: Workshop | "",
  tu: string,
  den: string,
): QcNgay[] {
  const m = new Map(cacNgay(tu, den).map((ngay) => [ngay, { ngay, dat: 0, tam: 0, khongDat: 0 }]));
  for (const r of rows) {
    if (xuong && r.workshop !== xuong) continue;
    const g = m.get(r.date);
    if (!g) continue;
    if (r.result === "dat") g.dat += 1;
    else if (r.result === "tam") g.tam += 1;
    else g.khongDat += 1;
  }
  return [...m.values()];
}
