import type { KyCanDoi, DongNLVao, DongPheLieu, DongTP } from "@/types";

export interface KetQuaCanDoi {
  tongNLVao: number; // kg
  giaTriNL: number; // VND
  tongTP: number; // kg
  dinhMuc: number; // Tổng NL vào ÷ Tổng TP
  giaTriXuat: number; // VND (đã quy tỉ giá cho hàng USD)
  giaThanh: number; // VND
  laiLo: number; // VND ( + lãi / − lỗ )
  binhQuanKgNL: number; // giá thành / tổng NL vào
  tyLeThuHoi: number | null; // Tổng TP ÷ Tổng NL nhận (chỉ số ~0,45)
  giaTriPheLieu: number; // VND
}

export function tinhCanDoi(
  ky: KyCanDoi,
  nlVao: DongNLVao[],
  pheLieu: DongPheLieu[],
  tp: DongTP[],
): KetQuaCanDoi {
  const tiGia = ky.tiGia ?? 0;
  const chiPhiCB = ky.chiPhiCB ?? 0;

  const tongNLVao = nlVao.reduce((s, r) => s + (r.soLuongKg || 0), 0);
  const giaTriNL = nlVao.reduce((s, r) => s + r.soLuongKg * (r.donGia ?? 0), 0);
  const tongTP = tp.reduce((s, r) => s + (r.luongKg || 0), 0);

  const giaTriXuat = tp.reduce((s, r) => {
    const tien = r.luongKg * (r.donGia ?? 0);
    return s + (r.kenh === "Xuất khẩu" ? tien * tiGia : tien);
  }, 0);

  const giaThanh = tongTP * chiPhiCB + giaTriNL;
  const laiLo = giaTriXuat - giaThanh;

  const giaTriPheLieu = pheLieu.reduce(
    (s, r) => s + r.soLuongKg * (r.donGiaBan ?? 0),
    0,
  );

  return {
    tongNLVao,
    giaTriNL,
    tongTP,
    dinhMuc: tongTP > 0 ? tongNLVao / tongTP : 0,
    giaTriXuat,
    giaThanh,
    laiLo,
    binhQuanKgNL: tongNLVao > 0 ? giaThanh / tongNLVao : 0,
    tyLeThuHoi:
      ky.tongNLNhan && ky.tongNLNhan > 0 ? tongTP / ky.tongNLNhan : null,
    giaTriPheLieu,
  };
}
