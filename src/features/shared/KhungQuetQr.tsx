// ============================================================
// Khung quét QR bằng camera — dùng chung (màn /qr + hộp gắn lô đầu vào).
// html5-qrcode tự dựng giao diện trong một phần tử có id; mỗi khung sinh id riêng
// nên hai khung trên cùng trang không đè nhau. Camera cần HTTPS + quyền camera;
// máy không có camera thì các màn luôn có đường GÕ TAY / CHỌN song song.
// ============================================================
import { useEffect, useId, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

export function KhungQuetQr({ onQuet }: { onQuet: (text: string) => void }) {
  const id = `qr-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  // Giữ callback mới nhất mà không phải dựng lại camera mỗi lần render.
  const goiLai = useRef(onQuet);
  useEffect(() => {
    goiLai.current = onQuet;
  });

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(id, { fps: 10, qrbox: 250 }, false);
    scanner.render(
      (decoded: string) => goiLai.current(decoded.trim()),
      () => {
        /* lỗi từng khung hình — bỏ qua, không spam */
      }
    );
    return () => {
      scanner.clear().catch(() => {});
    };
  }, [id]);

  return <div id={id} className="max-w-md" />;
}
