// ============================================================
// Tên file: src/lib/formDraft.ts
// Tên tiếng Việt: Tự lưu NHÁP form ghi (phiếu đang gõ dở) dưới máy
// Description: Per-user form draft autosave/restore (survives navigation, reload, logout)
// ============================================================
// VÌ SAO (người dùng yêu cầu 2026-10-16): đang gõ phiếu nhập hàng / sản xuất mà bấm sang
// trang khác rồi quay về là mất hết ⇒ ức chế. Mỗi form ghi tự lưu NHÁP (chưa vào sổ) theo
// từng tài khoản: chuyển trang, tải lại, đăng xuất rồi đăng nhập lại vẫn còn nguyên.
//
// Luật:
//   - Nháp nằm dưới máy (localStorage), khoá `bsf.draft.<form>.<tài khoản>` — chế độ demo
//     tự đổi sang `bsf-demo.*` (modeLocalKey). Đăng xuất KHÔNG xoá (auth không đụng khoá này).
//   - Nháp KHÔNG bao giờ tự ghi vào sổ: chỉ đổ lại vào form, người dùng vẫn phải bấm Lưu.
//   - Phiếu về TRỐNG (VD vừa Lưu xong, form mở phiếu mới) ⇒ nháp tự xoá.
//   - Tự lưu là thao tác trình bày ⇒ KHÔNG toast (quy tắc 13); màn hiện dải nhỏ khi vừa mở lại nháp.
import { useCallback, useEffect, useRef, useState } from "react";
import { modeLocalKey } from "@/lib/demoMode";
import { hasSupabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

const DRAFT_KEY_PREFIX = "bsf.draft.";
/** Nháp cũ hơn chừng này thì bỏ — phiếu gõ dở cả tháng trước không còn ý nghĩa. */
const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface StoredFormDraft<T> {
  savedAt: string;
  value: T;
}

/** Khoá nháp theo form + tài khoản (không đăng nhập ⇒ chung một nháp cho máy). */
export function formDraftKey(form: string, account: string): string {
  const who = account.trim().toLowerCase() || "local";
  return `${DRAFT_KEY_PREFIX}${form}.${who}`;
}

export function readFormDraft<T>(form: string, account: string, now = Date.now()): StoredFormDraft<T> | null {
  try {
    const raw = localStorage.getItem(modeLocalKey(formDraftKey(form, account)));
    if (!raw) return null;
    const d = JSON.parse(raw) as StoredFormDraft<T>;
    if (!d || typeof d !== "object" || !("value" in d)) return null;
    if (d.savedAt && now - Date.parse(d.savedAt) > DRAFT_MAX_AGE_MS) return null;
    return d;
  } catch {
    return null;
  }
}

export function writeFormDraft<T>(form: string, account: string, value: T, savedAt = new Date().toISOString()): boolean {
  try {
    localStorage.setItem(modeLocalKey(formDraftKey(form, account)), JSON.stringify({ savedAt, value }));
    return true;
  } catch {
    return false; // hết chỗ / chế độ riêng tư — nháp là tiện ích, không chặn thao tác
  }
}

export function clearFormDraft(form: string, account: string): void {
  try {
    localStorage.removeItem(modeLocalKey(formDraftKey(form, account)));
  } catch {
    /* bỏ qua */
  }
}

/**
 * Tự lưu + mở lại nháp của một form.
 *  - `accountReady` = đã biết tài khoản (hồ sơ nạp xong, hoặc chạy không đăng nhập). Trước
 *    đó KHÔNG đọc / ghi gì — kẻo phiếu trống lúc mới mở xoá mất nháp.
 *  - Lúc sẵn sàng: có nháp VÀ form đang trống ⇒ gọi `onRestore(nháp)` (một lần).
 *  - Sau đó mỗi lần `value` đổi: ghi nháp (gom 400 ms; rời trang / đóng tab ghi ngay);
 *    `isEmpty(value)` ⇒ xoá nháp.
 * Trả `restoredAt` (giờ lưu của nháp vừa mở lại, null nếu không) + `discard()` (xoá nháp —
 * màn tự đưa form về trống).
 */
export function useFormDraft<T>({
  form,
  account,
  accountReady,
  value,
  isEmpty,
  onRestore,
}: {
  form: string;
  account: string;
  accountReady: boolean;
  value: T;
  isEmpty: (v: T) => boolean;
  onRestore: (v: T) => void;
}): { restoredAt: string | null; discard: () => void; isReady: boolean } {
  const [isActive, setIsActive] = useState(false);
  const [restoredAt, setRestoredAt] = useState<string | null>(null);
  const latest = useRef({ value, isEmpty, form, account });
  latest.current = { value, isEmpty, form, account };

  // Mở lại nháp đúng MỘT lần khi đã biết tài khoản.
  useEffect(() => {
    if (!accountReady || isActive) return;
    const d = readFormDraft<T>(form, account);
    if (d && latest.current.isEmpty(latest.current.value)) {
      onRestore(d.value);
      setRestoredAt(d.savedAt);
    }
    setIsActive(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountReady]);

  const flush = useCallback(() => {
    const { value: v, isEmpty: empty, form: f, account: a } = latest.current;
    if (empty(v)) clearFormDraft(f, a);
    else writeFormDraft(f, a, v);
  }, []);

  // Tự lưu (gom phím gõ).
  useEffect(() => {
    if (!isActive) return;
    const t = window.setTimeout(flush, 400);
    return () => window.clearTimeout(t);
  }, [isActive, value, flush]);

  // Rời trang trong app (unmount) / đóng tab ⇒ ghi ngay bản mới nhất.
  useEffect(() => {
    if (!isActive) return;
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [isActive, flush]);

  // Phiếu về trống (đã lưu / bỏ) ⇒ thôi báo "đã mở lại nháp".
  useEffect(() => {
    if (restoredAt && isEmpty(value)) setRestoredAt(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const discard = useCallback(() => {
    clearFormDraft(latest.current.form, latest.current.account);
    setRestoredAt(null);
  }, []);

  // isReady: đã qua bước mở lại nháp — màn "tự mở phiếu trống" PHẢI đợi cờ này, không thì
  // phiếu trống đè lên nháp vừa đổ vào rồi nháp bị xoá (lỗi thử tay 2026-10-16).
  return { restoredAt, discard, isReady: isActive };
}

/**
 * Tài khoản để khoá nháp: tên đăng nhập; `accountReady` khi hồ sơ đã nạp (hoặc chạy không
 * đăng nhập). Dùng cho mọi màn gọi `useFormDraft` / `useDialogDraft`.
 */
export function useDraftAccount(): { account: string; accountReady: boolean } {
  const { profile } = useAuth();
  return { account: profile?.username ?? "", accountReady: profile !== null || !hasSupabase };
}

/**
 * Nháp cho FORM TRONG HỘP THOẠI (mẫu chung, quy tắc 17):
 *  - Đóng ngang (bấm ra ngoài / Esc) ⇒ `dismiss()` GIỮ số đang gõ; mở lại hộp gọi `takeKept()`
 *    để lấy lại thay cho phiếu mặc định.
 *  - Nút Hủy ⇒ `cancel()` bỏ hẳn (cả nháp). Lưu xong ⇒ `done()`.
 *  - Rời trang / đăng xuất rồi quay lại ⇒ hộp tự mở lại đúng số (onRestore = `setValue`).
 */
export function useDialogDraft<T>({
  form,
  value,
  setValue,
  isEmpty,
}: {
  form: string;
  value: T | null;
  setValue: (v: T | null) => void;
  /** Phiếu chưa gõ gì (so với phiếu mặc định / bản đã lưu). */
  isEmpty: (v: T) => boolean;
}) {
  const { account, accountReady } = useDraftAccount();
  const [kept, setKept] = useState<T | null>(null);
  const draft = useFormDraft<T | null>({
    form,
    account,
    accountReady,
    value: value ?? kept,
    isEmpty: (v) => v == null || isEmpty(v),
    onRestore: (v) => {
      if (v != null) setValue(v);
    },
  });
  return {
    restoredAt: draft.restoredAt,
    dismiss: () => {
      if (value != null) setKept(value);
      setValue(null);
    },
    cancel: () => {
      setKept(null);
      setValue(null);
      draft.discard();
    },
    takeKept: (): T | null => {
      const k = kept;
      setKept(null);
      return k;
    },
    done: () => {
      setKept(null);
      setValue(null);
    },
  };
}
