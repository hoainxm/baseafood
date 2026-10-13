// ============================================================
// Tên file: src/features/shared/UpdateBanner.tsx
// Tên tiếng Việt: Băng nhắc "đã có bản cập nhật mới → tải lại"
// Description: Detect a newer deploy (version.json) and prompt reload
// ============================================================
import { useEffect, useRef, useState } from "react";
import { Button } from "@/design-system";
import { RefreshCw } from "lucide-react";

/**
 * useKiemTraCapNhat — phát hiện có bản deploy mới.
 *
 * Bản đang chạy mang sẵn mã build `__BUILD_ID__` (nhúng lúc build). Máy chủ
 * luôn phục vụ `version.json` của bản MỚI NHẤT. Poll file đó rồi so mã: khác
 * nhau ⇒ đã có bản mới, người dùng cần tải lại để nhận HTML + bundle mới.
 *
 * Kiểm lúc mở, mỗi vài phút, và mỗi khi quay lại tab (hay gặp: mở tab cả ngày).
 * Dev không có version.json ⇒ fetch hỏng ⇒ bỏ qua, không báo nhầm.
 */
function useUpdateCheck(): boolean {
  const [hasNewVersion, setHasNewVersion] = useState(false);
  const runningVersion = useRef<string>(
    typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : ""
  );

  useEffect(() => {
    let huy = false;
    const url = `${import.meta.env.BASE_URL}version.json`;

    const checkForUpdate = async () => {
      try {
        const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { buildId?: string };
        const newBuildId = String(data?.buildId ?? "");
        // Chỉ báo khi biết chắc cả hai mã và chúng khác nhau.
        if (!huy && newBuildId && runningVersion.current && newBuildId !== runningVersion.current)
          setHasNewVersion(true);
      } catch {
        /* mạng chập chờn / dev chưa có file → im lặng, không báo nhầm */
      }
    };

    checkForUpdate();
    const id = window.setInterval(checkForUpdate, 3 * 60 * 1000);
    const onReturn = () => {
      if (document.visibilityState === "visible") checkForUpdate();
    };
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", checkForUpdate);

    return () => {
      huy = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", checkForUpdate);
    };
  }, []);

  return hasNewVersion;
}

/**
 * BangCapNhat — băng nhắc tải lại khi có bản mới. Đặt ở đầu vùng nội dung
 * (AppShell), ngoài khối đổi-trang nên không mất khi chuyển màn.
 */
export function BangCapNhat() {
  const hasNewVersion = useUpdateCheck();
  if (!hasNewVersion) return null;

  return (
    <div
      role="status"
      className="enter-down mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-primary/40 bg-accent px-4 py-3 text-accent-foreground"
    >
      <span className="flex items-center gap-2 text-base font-semibold">
        <RefreshCw className="size-5 shrink-0" aria-hidden />
        Đã có bản cập nhật mới. Tải lại trang để dùng tính năng mới nhất.
      </span>
      <Button
        title="Tải lại trang để dùng bản mới vừa được đưa lên. Dữ liệu đang gõ dở có thể mất — lưu trước cho chắc." size="lg" onClick={() => window.location.reload()}>
        <RefreshCw />
        Tải lại ngay
      </Button>
    </div>
  );
}
