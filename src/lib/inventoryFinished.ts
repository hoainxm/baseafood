// ============================================================
// Tên file: src/lib/inventoryFinished.ts
// Tên tiếng Việt: Sổ Nhập–Xuất–Tồn kho thành phẩm (bán thành phẩm cấp đông dự trữ)
// Description: Finished-goods (WIP reserve) NXT ledger — pure, no React
// ============================================================
import type {
  WipProductionItem,
  ExportOrder,
  ExportItem,
  SalesItem,
  FinishedGoodsOpeningStock,
  Product,
} from "@/types";

/**
 * VÌ SAO CÓ FILE NÀY — khép vòng phía THÀNH PHẨM (đối xứng inventoryMaterial.ts
 * cho nguyên liệu). Suy TỒN THÀNH PHẨM hoàn toàn từ dữ liệu đã ghi, không bắt
 * ghi tay lần hai:
 *
 *   Tồn cuối = Tồn đầu + Nhập kho − Xuất kho
 *
 *   - Nhập kho = BTP sản xuất đã DUYỆT vào kho (status "da-nhap"), theo ngày SX.
 *   - Xuất kho = Xuất đơn đặt (dòng lệnh, theo ngày lệnh xuất)
 *              + Bán hàng ngày (sổ Bán hàng, theo ngày xuất bán).
 *   - Tồn đầu = tồn đầu khai tay (số dư trước khi số hoá, ≤ ngày bắt đầu kỳ)
 *              + (nhập − xuất) của mọi ngày TRƯỚC kỳ (suy từ lịch sử).
 *
 * KHÔNG ĐẾM HAI LẦN: mỗi lần "Lệnh xuất" ở màn Đơn đặt vừa đẻ dòng lệnh (đơn)
 * VỪA đẻ một phiếu bán ở sổ Bán hàng để hiện trong báo cáo bán. Phiếu handoff đó
 * được đánh dấu sourceWarehouse = "Đơn đặt"; sổ này chỉ đếm xuất bán của các dòng
 * KHÔNG phải handoff, nên phần đơn đặt chỉ vào "xuất đơn" một lần.
 *
 * BỘ DÒ LỖI: tồn cuối < 0 = xuất nhiều hơn số đang trữ → chắc chắn sai ghi chép,
 * màn phải gọi tên (luật "màn tự giải thích").
 *
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
  xuatBan: number; // bán hàng ngày (không handoff) trong kỳ
  xuat: number; // xuatDon + xuatBan
  tonCuoi: number;
  tonDauBlock: number;
  nhapBlock: number;
  xuatBlock: number; // block xuất đơn (bán ngày không theo dõi block)
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
  opening: FinishedGoodsOpeningStock[];
  products: Product[];
  tuNgay: string;
  denNgay: string;
}

/**
 * Dựng sổ NXT thành phẩm theo (mặt hàng × quy cách) cho khoảng [tuNgay, denNgay].
 * Tồn đầu = khai tay (≤ tuNgay) + lịch sử nhập−xuất TRƯỚC tuNgay; nên chuyển kỳ
 * tự động, không phải chép tay tồn cuối kỳ trước.
 */
export function tinhSoTonTP(args: NxtTPArgs): SoTonTPRow[] {
  const { sanXuat, exportOrders, exportItems, salesItems, opening, products, tuNgay, denNgay } = args;
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

  // Xuất bán ngày = sổ Bán hàng KHÔNG phải handoff đơn đặt, theo ngày xuất bán
  for (const b of salesItems) {
    if (b.sourceWarehouse === "Đơn đặt") continue; // handoff đơn đặt: đã tính ở xuất đơn
    if (b.deliveryDate > denNgay) continue;
    const a = layAcc(map, b.productId, b.spec);
    if (b.deliveryDate < tuNgay) a.xuatBanTruocKg += b.quantityKg || 0;
    else a.xuatBanKyKg += b.quantityKg || 0;
  }

  const tenMH = (id: string) => products.find((m) => m.id === id);
  const rows: SoTonTPRow[] = [];
  for (const a of map.values()) {
    const tonDau = a.openKg + a.nhapTruocKg - a.xuatDonTruocKg - a.xuatBanTruocKg;
    const xuat = a.xuatDonKyKg + a.xuatBanKyKg;
    const tonCuoi = tonDau + a.nhapKyKg - xuat;
    const tonDauBlock = a.openBlock + a.nhapTruocBlock - a.xuatDonTruocBlock;
    const tonCuoiBlock = tonDauBlock + a.nhapKyBlock - a.xuatDonKyBlock;

    // Bỏ dòng hoàn toàn trống (không tồn, không phát sinh trong kỳ)
    if (
      tonDau === 0 &&
      a.nhapKyKg === 0 &&
      xuat === 0 &&
      tonCuoi === 0
    )
      continue;

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
    xuat: rows.reduce((s, r) => s + r.xuat, 0),
    tonCuoi: rows.reduce((s, r) => s + r.tonCuoi, 0),
    soMatHang: rows.length,
    soCanhBao: rows.filter((r) => r.canhBaoAm).length,
  };
}
