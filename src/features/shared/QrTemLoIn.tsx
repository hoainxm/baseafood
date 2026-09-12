// ============================================================
// Tem mã lô QR in được (dùng chung: Nhập hàng + màn Quét lô).
// In ĐÚNG KHỔ TEM (không phải A4) qua PhieuInTem — chọn cỡ tem, xem trước phóng
// to, in ra tem nhãn thật. QR mã hóa mã lô nội bộ để khi sản xuất quét ra đúng lô.
// Kết nối trực tiếp máy in tem (WebUSB/ESC-POS) làm sau — hiện in qua hộp thoại in.
// ============================================================
import { useEffect, useState } from "react";
import type { ImportShipment } from "@/types";
import { PhieuInTem } from "@/design-system";
import { viDate } from "@/lib/format";
import { taoQrDataUrl } from "@/lib/qr";

export function QrTemLoIn({
  chuyen,
  onClose,
}: {
  chuyen: ImportShipment;
  onClose: () => void;
}) {
  const [qr, setQr] = useState("");
  useEffect(() => {
    let huy = false;
    taoQrDataUrl(chuyen.lotCode || "", 320).then((d) => {
      if (!huy) setQr(d);
    });
    return () => {
      huy = true;
    };
  }, [chuyen.lotCode]);

  const dong = [
    `${chuyen.supplierName || "—"} · xưởng ${chuyen.workshop}`,
    `Ngày về: ${viDate(chuyen.deliveryDate)}`,
    ...(chuyen.ssccCode ? [`SSCC: ${chuyen.ssccCode}`] : []),
  ];

  return (
    <PhieuInTem onClose={onClose} maLo={chuyen.lotCode || ""} qrDataUrl={qr} dong={dong} />
  );
}
