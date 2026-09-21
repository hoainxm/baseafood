// ============================================================
// Tên file: src/lib/qr.ts
// Sinh ảnh QR (dataURL) từ chuỗi — dùng để in tem mã lô + hiển thị.
// Bọc thư viện `qrcode`; lỗi thì trả chuỗi rỗng (màn tự xử "chưa có QR").
// `qrcode` NẠP ĐỘNG lúc gọi (hàm vốn async) — file này được kéo vào chunk chính
// qua features/shared (tem QR), nạp tĩnh là phạt lần mở đầu (P2-8 audit 2026-09-21).
// ============================================================

export async function taoQrDataUrl(text: string, size = 240): Promise<string> {
  if (!text) return "";
  try {
    const { default: QRCode } = await import("qrcode");
    return await QRCode.toDataURL(text, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
    });
  } catch {
    return "";
  }
}
