// ============================================================
// Tên file: src/lib/auth.ts
// Tên tiếng Việt tương đương: Quản lý Xác thực Đăng nhập & Phân quyền User
// Description: Supabase Auth & User Profile State Hook
// ============================================================
import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
// Hồ sơ đăng nhập luôn ở site THẬT — kể cả khi đang chế độ demo (SITE_ID = site-demo).
import { supabase, hasSupabase, SITE_ID_THAT as SITE_ID, createTempClient } from "@/lib/supabase";
import type { UserProfile, Role } from "@/types";
import { rolesFromCsv, rolesToCsv, rolesList } from "@/types";
import { emailToUsername, usernameToEmail } from "@/lib/username";
import { setAuditOperator, appendAuditEntries } from "@/lib/audit";

/**
 * Đăng nhập qua Supabase Auth (email tổng hợp `<username>@bsf1.vn`).
 *
 * Tài khoản (email + mật khẩu) tạo ở Supabase Dashboard; bảng `user_profiles` giữ
 * hồ sơ nghiệp vụ (họ tên, username, vai trò), khóa `id` = auth user id. Lần đầu
 * đăng nhập, app tự tạo hồ sơ (vai trò rỗng — admin gán sau).
 *
 * Chưa cấu hình Supabase (chạy localStorage ở xưởng) ⇒ KHÔNG chặn đăng nhập:
 * `hasSupabase = false` thì gate ở App bỏ qua, app dùng được ngay.
 */

const s = (v: unknown) => (v == null ? "" : String(v));

function profileFromRow(r: Record<string, unknown>): UserProfile {
  return {
    id: s(r.id),
    fullName: s(r.full_name),
    username: s(r.username),
    roles: rolesFromCsv(s(r.roles)),
  };
}

/** Lấy hồ sơ của tài khoản đang đăng nhập; chưa có thì tạo (vai trò rỗng).
 * Họ tên/username lấy từ metadata lúc đăng ký (nếu có), không thì suy từ email. */
async function getOrCreateProfile(session: Session): Promise<UserProfile | null> {
  if (!supabase) return null;
  const id = session.user.id;
  const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
  const username = s(meta.username) || emailToUsername(session.user.email ?? "");
  const fullName = s(meta.ho_ten);

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  // Đọc LỖI (hết hạn token, rớt mạng, timeout) ≠ "chưa có hồ sơ": đừng ghi gì —
  // trước đây nhánh này upsert roles:"" đè mất vai trò thật của tài khoản.
  if (error) return null;
  if (data) return profileFromRow(data as Record<string, unknown>);

  // Chưa có hồ sơ thật sự ⇒ tạo mới; ignoreDuplicates: dòng đã có (máy khác vừa
  // tạo / select hụt) thì GIỮ NGUYÊN, không bao giờ đè vai trò.
  const row = { id, site_id: SITE_ID, full_name: fullName, username, roles: "" };
  await supabase
    .from("user_profiles")
    .upsert(row, { onConflict: "id", ignoreDuplicates: true });
  return { id, fullName, username, roles: [] };
}

/** Dịch lỗi Supabase Auth sang tiếng Việt cho người dùng đọc được. */
function translateError(msg: string): string {
  if (/invalid login credentials/i.test(msg))
    return "Sai tên đăng nhập hoặc mật khẩu";
  if (/email not confirmed/i.test(msg))
    return "Tài khoản chưa kích hoạt — báo quản trị";
  if (/rate limit|too many/i.test(msg))
    return "Thử lại quá nhiều lần — chờ một lát rồi đăng nhập lại";
  return msg;
}

function translateSignUpError(msg: string): string {
  if (/already registered|already exists|user_already_exists/i.test(msg))
    return "Tên đăng nhập đã tồn tại";
  if (/password.*(6|short|weak)|weak.?password/i.test(msg))
    return "Mật khẩu quá ngắn (tối thiểu 6 ký tự)";
  if (/signups? (are )?disabled/i.test(msg))
    return "Máy chủ đang tắt đăng ký — bật Email provider trong Supabase";
  // GoTrue cố gửi mail xác nhận tới email tổng hợp (hòm thư ảo) → dội trần SMTP.
  // Cách sửa: TẮT "Confirm email" (app nội bộ, không dùng mail xác nhận).
  if (/rate limit|over_email_send/i.test(msg))
    return 'Máy chủ chặn do gửi mail xác nhận quá nhiều. TẮT "Confirm email" trong Supabase (Authentication → Providers → Email) rồi thử lại.';
  if (/email.*invalid|invalid.*email|email_address_invalid/i.test(msg))
    return "Email tổng hợp không hợp lệ — kiểm tra đuôi email (đang dùng @bsf1.vn, KHÔNG dùng .local).";
  return msg;
}

export interface AuthResult {
  ok: boolean;
  error?: string;
  /** Hồ sơ vừa tạo (taoTaiKhoan) — để màn admin cập nhật danh sách ngay. */
  profile?: UserProfile;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isInitialized, setIsInitialized] = useState(!hasSupabase);

  useEffect(() => {
    if (!supabase) return;
    let isCancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (isCancelled) return;
      setSession(data.session);
      setIsInitialized(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s2) => {
      // KHÔNG gọi supabase async thẳng trong callback (dễ deadlock) — chỉ set
      // session, hồ sơ nạp ở effect theo user id bên dưới.
      setSession(s2);
      setIsInitialized(true);
    });
    return () => {
      isCancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const uid = session?.user.id;
  useEffect(() => {
    if (!supabase) return;
    if (!session) {
      setProfile(null);
      return;
    }
    let isCancelled = false;
    (async () => {
      const nd = await getOrCreateProfile(session);
      if (!isCancelled) setProfile(nd);
    })();
    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const signIn = useCallback(
    async (username: string, password: string): Promise<AuthResult> => {
      if (!supabase) return { ok: false, error: "Chưa cấu hình máy chủ" };
      if (!username.trim() || !password)
        return { ok: false, error: "Nhập tên đăng nhập và mật khẩu" };
      const { error } = await supabase.auth.signInWithPassword({
        email: usernameToEmail(username),
        password,
      });
      if (error) return { ok: false, error: translateError(error.message) };
      const u = username.trim().toLowerCase();
      setAuditOperator({ username: u });
      appendAuditEntries([{ action: "login", entity: "auth", entityKey: u, summary: `Đăng nhập: ${u}` }]);
      return { ok: true };
    },
    []
  );

  /**
   * ADMIN tạo tài khoản cho người khác. Đăng ký KHÔNG mở tự do — chỉ gọi từ màn
   * Người dùng (admin). Dùng client PHỤ để signUp nên KHÔNG đá văng phiên admin
   * trên client chính. Hồ sơ `user_profiles` tạo với vai trò rỗng (admin gán sau).
   */
  const createAccount = useCallback(
    async (
      fullName: string,
      username: string,
      password: string,
      roles: Role[] = []
    ): Promise<AuthResult> => {
      if (!supabase) return { ok: false, error: "Chưa cấu hình máy chủ" };
      const u = username.trim().toLowerCase();
      if (!fullName.trim()) return { ok: false, error: "Nhập họ tên" };
      if (!u) return { ok: false, error: "Nhập tên đăng nhập" };
      if (password.length < 6)
        return { ok: false, error: "Mật khẩu tối thiểu 6 ký tự" };

      // Check trùng tên đăng nhập trước (thông báo rõ hơn lỗi Auth).
      const { data: isDuplicate } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("username", u)
        .maybeSingle();
      if (isDuplicate) return { ok: false, error: "Tên đăng nhập đã tồn tại" };

      const phu = createTempClient();
      if (!phu) return { ok: false, error: "Chưa cấu hình máy chủ" };
      const { data, error } = await phu.auth.signUp({
        email: usernameToEmail(u),
        password,
        options: { data: { ho_ten: fullName.trim(), username: u } }, // naming-ok: khóa metadata Supabase Auth đã lưu, trigger 0006 đọc
      });
      if (error) return { ok: false, error: translateSignUpError(error.message) };

      // Lưu hồ sơ qua client CHÍNH (phiên admin) — vai trò rỗng.
      const uid = data.user?.id;
      if (!uid) return { ok: false, error: "Tạo tài khoản không thành công" };
      await supabase.from("user_profiles").upsert(
        {
          id: uid,
          site_id: SITE_ID,
          full_name: fullName.trim(),
          username: u,
          roles: rolesToCsv(roles),
        },
        { onConflict: "id" }
      );
      return {
        ok: true,
        profile: { id: uid, fullName: fullName.trim(), username: u, roles },
      };
    },
    []
  );

  const signOut = useCallback(async () => {
    appendAuditEntries([{ action: "logout", entity: "auth", entityKey: "", summary: "Đăng xuất" }]);
    await supabase?.auth.signOut();
    setAuditOperator(null);
  }, []);

  return {
    session,
    profile,
    isLoading: hasSupabase && !isInitialized,
    /** Có cần đăng nhập không (chỉ khi đã cấu hình Supabase). */
    requiresLogin: hasSupabase,
    isAdmin: rolesList(profile?.roles).includes("admin"),
    signIn,
    createAccount,
    signOut,
  };
}
