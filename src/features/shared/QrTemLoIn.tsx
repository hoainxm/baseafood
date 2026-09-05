// ============================================================
// Tem mã lô QR in được (dùng chung: Nhập hàng + màn Quét lô).
// Phủ A4 (PhieuIn) có nút In / Xuất PDF; in ra máy in tem/siêu thị được.
// QR mã hóa mã lô nội bộ để khi sản xuất quét ra đúng lô.
// ============================================================
import { useEffect, useState } from "react";
import type { ImportShipment } from "@/types";
import { PhieuIn } from "@/design-system";
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

  return (
    <PhieuIn tieuDe={`Tem lô ${chuyen.lotCode || "(chưa có mã)"}`} phuDe="Baseafood BSF1" onClose={onClose}>
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-8 text-center">
        {qr ? (
          <img src={qr} alt={`QR mã lô ${chuyen.lotCode}`} className="size-64" />
        ) : (
          <div className="flex size-64 items-center justify-center border-2 border-dashed border-slate-300 text-sm text-slate-500">
            Chưa có mã lô để tạo QR
          </div>
        )}
        <p className="tnum text-3xl font-bold tracking-wide">{chuyen.lotCode}</p>
        <div className="space-y-1 text-base">
          <p className="font-semibold">
            {chuyen.supplierName || "—"} · xưởng {chuyen.workshop}
          </p>
          <p>Ngày về: {viDate(chuyen.deliveryDate)}</p>
          {chuyen.ssccCode ? <p>SSCC: {chuyen.ssccCode}</p> : null}
        </div>
      </div>
    </PhieuIn>
  );
}
