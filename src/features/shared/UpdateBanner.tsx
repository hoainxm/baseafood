// ============================================================
// Tên file: src/features/shared/UpdateBanner.tsx
// Tên tiếng Việt: Hộp bật lên + băng nhắc "đã có bản cập nhật mới → tải lại"
// Description: Detect a newer deploy (version.json) and prompt reload — a popup first (a banner at the top of
//              the content was easy to miss), then a small banner after "Để sau".
// ============================================================
import { useEffect, useRef, useState } from "react";
import { Button, ConfirmAction } from "@/design-system";
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
function useUpdateCheck(): string {
  const [newVersion, setNewVersion] = useState("");
  const runningVersion = useRef<string>(
    typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : ""
  );

  useEffect(() => {
    let isCancelled = false;
    const url = `${import.meta.env.BASE_URL}version.json`;

    const checkForUpdate = async () => {
      try {
        const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { buildId?: string };
        const newBuildId = String(data?.buildId ?? "");
        // Chỉ báo khi biết chắc cả hai mã và chúng khác nhau.
        if (!isCancelled && newBuildId && runningVersion.current && newBuildId !== runningVersion.current)
          setNewVersion(newBuildId);
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
      isCancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", checkForUpdate);
    };
  }, []);

  return newVersion;
}

/**
 * UpdateBanner — nhắc tải lại khi có bản mới. Đặt ở đầu vùng nội dung (AppShell), ngoài khối đổi-trang nên
 * không mất khi chuyển màn.
 *
 * Bật HỘP giữa màn trước (2026-11-02: băng đầu trang kiểu cũ người dùng không để ý). "Để sau" ⇒ hộp đóng,
 * còn băng nhỏ ở đầu nội dung để tải lại lúc tiện; hộp chỉ bật lại khi có một bản MỚI HƠN nữa.
 * Tải lại không mất phiếu đang gõ: form ghi dữ liệu tự lưu nháp (quy tắc 17) và mở lại nháp sau khi tải.
 */
export function UpdateBanner() {
  const newVersion = useUpdateCheck();
  const [dismissedVersion, setDismissedVersion] = useState("");
  if (!newVersion) return null;
  const isPopupOpen = newVersion !== dismissedVersion;

  return (
    <>
      <ConfirmAction
        open={isPopupOpen}
        onOpenChange={(o) => !o && setDismissedVersion(newVersion)}
        icon={RefreshCw}
        title="Đã có bản cập nhật mới"
        description="Tải lại trang để dùng bản mới nhất — bản đang mở là bản cũ, có thể thiếu tính năng hoặc lỗi đã được sửa. Phiếu đang gõ dở được tự lưu nháp, tải lại xong mở lại được."
        confirmLabel="Tải lại ngay"
        cancelLabel="Để sau"
        onConfirm={() => window.location.reload()}
      />
      {!isPopupOpen && (
        <div
          role="status"
          className="enter-down mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-primary/40 bg-accent px-4 py-2 text-accent-foreground"
        >
          <span className="flex min-w-0 flex-1 items-center gap-2 font-semibold">
            <RefreshCw className="size-5 shrink-0" aria-hidden />
            Đã có bản cập nhật mới — tải lại trang để dùng.
          </span>
          <Button
            title="Tải lại trang để dùng bản mới vừa được đưa lên. Phiếu đang gõ dở được tự lưu nháp." onClick={() => window.location.reload()}>
            <RefreshCw />
            Tải lại ngay
          </Button>
        </div>
      )}
    </>
  );
}
