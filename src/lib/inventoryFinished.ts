// ============================================================
// Tên file: src/lib/inventoryFinished.ts
// Tên tiếng Việt: Sổ Nhập–Xuất–Tồn kho BÁN THÀNH PHẨM (cấp đông dự trữ)
// Description: WIP-reserve (BTP) NXT ledger — pure, no React
// ============================================================
import type {
  WipProductionItem,
  ExportOrder,
  ExportItem,
  SalesItem,
  FinishedGoodsOpeningStock,
  Product,
  Packaging,
} from "@/types";
import { KHO_BAN_LE } from "@/lib/inventory";

/**
 * VÌ SAO CÓ FILE NÀY — khép vòng phía KHO BTP DỰ TRỮ (đối xứng inventoryMaterial.ts
 * cho nguyên liệu). Suy TỒN hoàn toàn từ dữ liệu đã ghi, không ghi tay lần hai:
 *
 *   Tồn cuối = Tồn đầu + Nhập kho − Xuất kho
 *
 *   - Nhập kho = BTP sản xuất đã DUYỆT vào kho (status "da-nhap"), theo ngày SX.
 *   - Xuất kho (3 luồng, đúng mô hình 2 kho của inventory.ts):
 *       • Xuất đơn đặt   = dòng lệnh xuất container (theo ngày lệnh).
 *       • Xuất bán lẻ    = phiếu bán block thô rút từ KHO DỰ TRỮ
 *                          (sourceWarehouse === KHO_BAN_LE), theo ngày bán.
 *       • Xuất đóng gói  = BTP tiêu hao để đóng gói ra thành phẩm G3 (inputKg),
 *                          theo ngày đóng gói.
 *   - Tồn đầu = khai tay (≤ tuNgay) + (nhập − xuất) mọi ngày TRƯỚC kỳ (suy lịch sử).
 *
 * ĂN KHỚP: dùng ĐÚNG định nghĩa "xuất" như `inventory.tinhTon(... banLe = [
 *   ...locBanLe(banHang, KHO_BAN_LE), ...dongGoiTruTon(packagings) ])`, nên Tồn cuối
 *   ở đây == Tổng tồn ở màn Kho dự trữ / Kho lạnh. KHÔNG đếm hai lần: bán đóng gói
 *   (KHO_TP) rút từ kho THÀNH PHẨM riêng (tinhTonTP), không đụng kho này; handoff
 *   đơn đặt (KHO_TP/"Đơn đặt") cũng bỏ qua vì đã tính ở "xuất đơn".
 *
 * BỘ DÒ LỖI: tồn cuối < 0 = xuất nhiều hơn số đang trữ → sai ghi chép, màn gọi tên.
 * ⚠️ v1 — đối chiếu tay với một mặt hàng có số thật trước khi tin con số.
 */

export interface SoTonTPRow {
  productId: string;
  productCode: string;
  productName: string;
  spec: string;
  tonDau: number;
  nhap: number; // BTP da-nhap trong kỳ
  xuatDon: number; // xuất đơn đặt (dòng lệnh) trong kỳ
  xuatBan: number; // bán lẻ block rút kho dự trữ (KHO_BAN_LE) trong kỳ
  xuatDongGoi: number; // BTP tiêu hao để đóng gói TP (G3) trong kỳ
  xuat: number; // xuatDon + xuatBan + xuatDongGoi
  tonCuoi: number;
  tonDauBlock: number;
  nhapBlock: number;
  xuatBlock: number; // block xuất đơn (bán lẻ/đóng gói không theo dõi block chắc)
  tonCuoiBlock: number;
  canhBaoAm: boolean;
  seedTonDau: boolean; // có tồn đầu khai tay
}

interface Acc {
  productId: string;
  spec: string;
  openKg: number;
  openBlock: number;
  nhapTruocKg: number;
  nhapTruocBlock: number;
  nhapKyKg: number;
  nhapKyBlock: number;
  xuatDonTruocKg: number;
  xuatDonTruocBlock: number;
  xuatDonKyKg: number;
  xuatDonKyBlock: number;
  xuatBanTruocKg: number;
  xuatBanKyKg: number;
  xuatGoiTruocKg: number;
  xuatGoiKyKg: number;
  seed: boolean;
}

function khoaMH(productId: string, spec: string): string {
  return `${productId}|||${spec}`;
}

function layAcc(map: Map<string, Acc>, productId: string, spec: string): Acc {
  const k = khoaMH(productId, spec);
  let a = map.get(k);
  if (!a) {
    a = {
      productId,
      spec,
      openKg: 0,
      openBlock: 0,
      nhapTruocKg: 0,
      nhapTruocBlock: 0,
      nhapKyKg: 0,
      nhapKyBlock: 0,
      xuatDonTruocKg: 0,
      xuatDonTruocBlock: 0,
      xuatDonKyKg: 0,
      xuatDonKyBlock: 0,
      xuatBanTruocKg: 0,
      xuatBanKyKg: 0,
      xuatGoiTruocKg: 0,
      xuatGoiKyKg: 0,
      seed: false,
    };
    map.set(k, a);
  }
  return a;
}

export interface NxtTPArgs {
  sanXuat: WipProductionItem[];
  exportOrders: ExportOrder[];
  exportItems: ExportItem[];
  salesItems: SalesItem[];
  packagings: Packaging[];
  opening: FinishedGoodsOpeningStock[];
  products: Product[];
  tuNgay: string;
  denNgay: string;
}

/**
 * Dựng sổ NXT kho BTP dự trữ theo (mặt hàng × quy cách) cho khoảng [tuNgay, denNgay].
 * Tồn đầu = khai tay (≤ tuNgay) + lịch sử nhập−xuất TRƯỚC tuNgay ⇒ chuyển kỳ tự động.
 */
export function tinhSoTonTP(args: NxtTPArgs): SoTonTPRow[] {
  const { sanXuat, exportOrders, exportItems, salesItems, packagings, opening, products, tuNgay, denNgay } = args;
  const map = new Map<string, Acc>();

  // Ngày xuất của mỗi lệnh
  const ngayLenh = new Map<string, string>();
  for (const l of exportOrders) ngayLenh.set(l.id, l.exportDate);

  // Tồn đầu khai tay (áp cho mốc ≤ tuNgay)
  for (const o of opening) {
    if (o.asOfDate && o.asOfDate > tuNgay) continue;
    const a = layAcc(map, o.productId, o.spec);
    a.openKg += o.quantityKg || 0;
    a.openBlock += o.blocksCount || 0;
    a.seed = true;
  }

  // Nhập kho = BTP đã duyệt (da-nhap), theo ngày SX
  for (const s of sanXuat) {
    if (s.status !== "da-nhap") continue;
    if (s.productionDate > denNgay) continue;
    const a = layAcc(map, s.productId, s.spec);
    if (s.productionDate < tuNgay) {
      a.nhapTruocKg += s.quantityKg || 0;
      a.nhapTruocBlock += s.blocksCount || 0;
    } else {
      a.nhapKyKg += s.quantityKg || 0;
      a.nhapKyBlock += s.blocksCount || 0;
    }
  }

  // Xuất đơn đặt = dòng lệnh, theo ngày lệnh xuất
  for (const d of exportItems) {
    const ngay = ngayLenh.get(d.exportId);
    if (!ngay || ngay > denNgay) continue;
    const a = layAcc(map, d.productId, d.spec);
    if (ngay < tuNgay) {
      a.xuatDonTruocKg += d.quantityKg || 0;
      a.xuatDonTruocBlock += d.blocksCount || 0;
    } else {
      a.xuatDonKyKg += d.quantityKg || 0;
      a.xuatDonKyBlock += d.blocksCount || 0;
    }
  }

  // Xuất bán lẻ = phiếu bán block thô rút KHO DỰ TRỮ (marker KHO_BAN_LE), theo ngày bán
  for (const b of salesItems) {
    if (b.sourceWarehouse !== KHO_BAN_LE) continue; // chỉ bán lẻ rút kho dự trữ mới trừ tồn BTP
    if (b.deliveryDate > denNgay) continue;
    const a = layAcc(map, b.productId, b.spec);
    if (b.deliveryDate < tuNgay) a.xuatBanTruocKg += b.quantityKg || 0;
    else a.xuatBanKyKg += b.quantityKg || 0;
  }

  // Xuất đóng gói = BTP tiêu hao (inputKg) để đóng gói TP, theo ngày đóng gói
  for (const p of packagings) {
    if (p.date > denNgay) continue;
    const a = layAcc(map, p.fromProductId, p.fromSpec);
    if (p.date < tuNgay) a.xuatGoiTruocKg += p.inputKg || 0;
    else a.xuatGoiKyKg += p.inputKg || 0;
  }

  const tenMH = (id: string) => products.find((m) => m.id === id);
  const rows: SoTonTPRow[] = [];
  for (const a of map.values()) {
    const tonDau =
      a.openKg + a.nhapTruocKg - a.xuatDonTruocKg - a.xuatBanTruocKg - a.xuatGoiTruocKg;
    const xuat = a.xuatDonKyKg + a.xuatBanKyKg + a.xuatGoiKyKg;
    const tonCuoi = tonDau + a.nhapKyKg - xuat;
    const tonDauBlock = a.openBlock + a.nhapTruocBlock - a.xuatDonTruocBlock;
    const tonCuoiBlock = tonDauBlock + a.nhapKyBlock - a.xuatDonKyBlock;

    // Bỏ dòng hoàn toàn trống (không tồn, không phát sinh trong kỳ)
    if (tonDau === 0 && a.nhapKyKg === 0 && xuat === 0 && tonCuoi === 0) continue;

    const p = tenMH(a.productId);
    rows.push({
      productId: a.productId,
      productCode: p?.code || "",
      productName: p?.name || `Mặt hàng ${a.productId}`,
      spec: a.spec,
      tonDau,
      nhap: a.nhapKyKg,
      xuatDon: a.xuatDonKyKg,
      xuatBan: a.xuatBanKyKg,
      xuatDongGoi: a.xuatGoiKyKg,
      xuat,
      tonCuoi,
      tonDauBlock,
      nhapBlock: a.nhapKyBlock,
      xuatBlock: a.xuatDonKyBlock,
      tonCuoiBlock,
      canhBaoAm: tonCuoi < 0,
      seedTonDau: a.seed,
    });
  }

  rows.sort(
    (x, y) =>
      x.productName.localeCompare(y.productName, "vi") ||
      x.spec.localeCompare(y.spec, "vi")
  );
  return rows;
}

export interface TongSoTonTP {
  tonDau: number;
  nhap: number;
  xuatDon: number;
  xuatBan: number;
  xuatDongGoi: number;
  xuat: number;
  tonCuoi: number;
  soMatHang: number;
  soCanhBao: number;
}

export function tongSoTonTP(rows: SoTonTPRow[]): TongSoTonTP {
  return {
    tonDau: rows.reduce((s, r) => s + r.tonDau, 0),
    nhap: rows.reduce((s, r) => s + r.nhap, 0),
    xuatDon: rows.reduce((s, r) => s + r.xuatDon, 0),
    xuatBan: rows.reduce((s, r) => s + r.xuatBan, 0),
    xuatDongGoi: rows.reduce((s, r) => s + r.xuatDongGoi, 0),
    xuat: rows.reduce((s, r) => s + r.xuat, 0),
    tonCuoi: rows.reduce((s, r) => s + r.tonCuoi, 0),
    soMatHang: rows.length,
    soCanhBao: rows.filter((r) => r.canhBaoAm).length,
  };
}
