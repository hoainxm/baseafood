// ============================================================
// Tên file: src/lib/qr.ts
// Sinh ảnh QR (dataURL) từ chuỗi — dùng để in tem mã lô + hiển thị.
// Bọc thư viện `qrcode`; lỗi thì trả chuỗi rỗng (màn tự xử "chưa có QR").
// ============================================================
import QRCode from "qrcode";

export async function taoQrDataUrl(text: string, size = 240): Promise<string> {
  if (!text) return "";
  try {
    return await QRCode.toDataURL(text, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
    });
  } catch {
    return "";
  }
}
