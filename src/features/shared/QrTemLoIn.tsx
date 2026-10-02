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
import { PhieuInTem, type TemIn } from "@/design-system";
import { viDate } from "@/lib/format";
import { taoQrDataUrl } from "@/lib/qr";
import { TEN_LOAI, banGhiIn, nhanLoNl, noiDungQr, nutLo, type NutLo } from "@/lib/truyXuatLo";
import { useLabelPrints } from "@/lib/catalogRepo";
import { useAuth } from "@/lib/auth";
import { newId } from "@/lib/store";
import { useDuLieuTruyXuat } from "./useDuLieuTruyXuat";

const laLo = (n: NutLo) => n.kind === "S" || n.kind === "W" || n.kind === "P";

/** Các dòng chữ phụ in dưới mã lô. */
function dongTem(nut: NutLo): string[] {
  return [
    `${TEN_LOAI[nut.kind]} · ${nut.moTa}`,
    [nut.ngay && viDate(nut.ngay), nut.xuong && `xưởng ${nut.xuong}`, nut.kg ? `${Math.round(nut.kg * 10) / 10} kg` : ""]
      .filter(Boolean)
      .join(" · "),
    ...nut.chiTiet.filter((c) => c.nhan === "Đại lý" || c.nhan === "SSCC").map((c) => `${c.nhan}: ${c.giaTri}`),
  ].filter(Boolean);
}

/**
 * Tem cho MỘT hoặc NHIỀU lô (nút đã dựng bằng `nutLo`). Nhiều lô ⇒ in một lượt,
 * mỗi tem một nhãn (dùng cho "In tem hàng loạt" và in tem cả mẻ vừa lưu).
 */
export function TemLoQr({ nut, nuts, onClose }: { nut?: NutLo; nuts?: NutLo[]; onClose: () => void }) {
  const ds = (nuts ?? (nut ? [nut] : [])).filter(laLo);
  const khoa = ds.map((n) => `${n.kind}:${n.id}`).join("|");
  const [qr, setQr] = useState<Record<string, string>>({});
  useEffect(() => {
    let huy = false;
    // Tên miền lấy từ chính địa chỉ app đang chạy — không ghi cứng trong code.
    Promise.all(
      ds.map(async (n) => [`${n.kind}:${n.id}`, await taoQrDataUrl(noiDungQr(n.kind as LotKind, n.id, window.location.origin), 320)] as const)
    ).then((cap) => {
      if (!huy) setQr(Object.fromEntries(cap));
    });
    return () => {
      huy = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `khoa` đại diện đủ cho ds
  }, [khoa]);

  // Sổ in tem (mig 0049): bấm In là ghi mỗi lô một dòng — biết lô nào đã có tem,
  // và nhãn in ra lúc đó (nhãn BTP/TP suy lại từ bản ghi có thể đổi về sau).
  const [soIn, luuSoIn] = useLabelPrints();
  const { nguoiDung } = useAuth();
  const ghiSoIn = () => {
    const moi = banGhiIn(ds, nguoiDung?.fullName || nguoiDung?.username || "", new Date().toISOString(), newId);
    if (moi.length) luuSoIn([...soIn, ...moi]);
  };

  const tems: TemIn[] = ds.map((n) => ({ maLo: n.nhan, qrDataUrl: qr[`${n.kind}:${n.id}`] ?? "", dong: dongTem(n) }));
  return <PhieuInTem onClose={onClose} tems={tems} onIn={ghiSoIn} />;
}

/**
 * Tem lô NL của một chuyến nhập — giữ API cũ cho màn Nhập hàng. Dựng nút qua
 * `nutLo` để tem ghi đúng LOẠI hàng + tổng kg của chuyến; chuyến chưa có trong
 * dữ liệu chung (vừa lưu, chưa nạp lại) thì dựng tạm từ đầu chuyến.
 */
export function QrTemLoIn({ chuyen, onClose }: { chuyen: ImportShipment; onClose: () => void }) {
  const { dl } = useDuLieuTruyXuat();
  const daDung = nutLo("S", chuyen.id, dl);
  const nut: NutLo = !daDung.mat
    ? daDung
    : {
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
