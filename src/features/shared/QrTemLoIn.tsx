// ============================================================
// Tem mã lô QR in được — dùng chung cho MỌI loại lô (NL · BTP · TP).
// In ĐÚNG KHỔ TEM (không phải A4) qua PhieuInTem — chọn cỡ tem, xem trước phóng
// to, in ra tem nhãn thật. Kết nối thẳng máy in tem (WebUSB/ESC-POS) làm sau.
//
// QR chứa một ĐƯỜNG LINK tới hộ chiếu lô (kiểu GS1 Digital Link): camera điện thoại
// nào quét cũng mở thẳng app đúng lô, không cần mở app trước. Mã trong link là
// "loại:id" — DUY NHẤT (TCVN 13274), còn nhãn đọc được chỉ in cho người xem.
// Tem cũ (QR chỉ chứa mã lô trần) vẫn quét được: xem docMaQr ở lib/truyXuatLo.
// Thiết kế: docs/spec/qr-truy-xuat-lo.md
// ============================================================
import { useEffect, useState } from "react";
import type { ImportShipment, LotKind } from "@/types";
import { PhieuInTem } from "@/design-system";
import { viDate } from "@/lib/format";
import { taoQrDataUrl } from "@/lib/qr";
import { TEN_LOAI, nhanLoNl, noiDungQr, type NutLo } from "@/lib/truyXuatLo";

/** Tem cho một lô bất kỳ (nút đã dựng bằng `nutLo`). */
export function TemLoQr({ nut, onClose }: { nut: NutLo; onClose: () => void }) {
  const [qr, setQr] = useState("");
  const laLo = nut.kind === "S" || nut.kind === "W" || nut.kind === "P";
  useEffect(() => {
    if (!laLo) return;
    let huy = false;
    // Tên miền lấy từ chính địa chỉ app đang chạy — không ghi cứng trong code.
    taoQrDataUrl(noiDungQr(nut.kind as LotKind, nut.id, window.location.origin), 320).then((d) => {
      if (!huy) setQr(d);
    });
    return () => {
      huy = true;
    };
  }, [laLo, nut.kind, nut.id]);

  const dong = [
    `${TEN_LOAI[nut.kind]} · ${nut.moTa}`,
    [nut.ngay && viDate(nut.ngay), nut.xuong && `xưởng ${nut.xuong}`, nut.kg ? `${Math.round(nut.kg * 10) / 10} kg` : ""]
      .filter(Boolean)
      .join(" · "),
    ...nut.chiTiet.filter((c) => c.nhan === "Đại lý" || c.nhan === "SSCC").map((c) => `${c.nhan}: ${c.giaTri}`),
  ].filter(Boolean);

  return <PhieuInTem onClose={onClose} maLo={nut.nhan} qrDataUrl={qr} dong={dong} />;
}

/** Tem lô NL của một chuyến nhập — giữ API cũ cho màn Nhập hàng. */
export function QrTemLoIn({ chuyen, onClose }: { chuyen: ImportShipment; onClose: () => void }) {
  const nut: NutLo = {
    kind: "S",
    id: chuyen.id,
    nhan: nhanLoNl(chuyen),
    moTa: "nguyên liệu",
    ngay: chuyen.deliveryDate,
    xuong: chuyen.workshop,
    kg: 0,
    chiTiet: [
      { nhan: "Đại lý", giaTri: chuyen.supplierName || "—" },
      ...(chuyen.ssccCode ? [{ nhan: "SSCC", giaTri: chuyen.ssccCode }] : []),
    ],
    mat: false,
  };
  return <TemLoQr nut={nut} onClose={onClose} />;
}
