// ============================================================
// Khung quét QR bằng camera — dùng chung (màn /qr + hộp gắn lô đầu vào).
// html5-qrcode tự dựng giao diện trong một phần tử có id; mỗi khung sinh id riêng
// nên hai khung trên cùng trang không đè nhau. Camera cần HTTPS + quyền camera;
// máy không có camera thì các màn luôn có đường GÕ TAY / CHỌN song song.
//
// `html5-qrcode` (~370 KB) được NẠP ĐỘNG lúc khung mount — file này nằm trong
// `features/shared` (mọi màn import) nên import tĩnh sẽ kéo cả lib vào chunk
// chính, phạt lần mở đầu trên điện thoại xưởng dù chưa ai bấm quét (P2-8 audit
// 2026-09-21). Cùng mẫu với exceljs / lib/ocr.ts.
// ============================================================
import { useEffect, useId, useRef } from "react";

type Scanner = import("html5-qrcode").Html5QrcodeScanner;

export function QrScanner({ onScan }: { onScan: (text: string) => void }) {
  const id = `qr-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  // Giữ callback mới nhất mà không phải dựng lại camera mỗi lần render.
  const callbackRef = useRef(onScan);
  useEffect(() => {
    callbackRef.current = onScan;
  });

  useEffect(() => {
    let scanner: Scanner | null = null;
    let isCancelled = false; // unmount trước khi lib tải xong ⇒ không dựng camera nữa
    import("html5-qrcode").then(({ Html5QrcodeScanner }) => {
      if (isCancelled) return;
      scanner = new Html5QrcodeScanner(id, { fps: 10, qrbox: 250 }, false);
      scanner.render(
        (decoded: string) => callbackRef.current(decoded.trim()),
        () => {
          /* lỗi từng khung hình — bỏ qua, không spam */
        }
      );
    });
    return () => {
      isCancelled = true;
      scanner?.clear().catch(() => {});
    };
  }, [id]);

  return <div id={id} className="max-w-md" />;
}
