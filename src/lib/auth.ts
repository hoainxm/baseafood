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
import { emailToUsername, normalizeUsername, usernameToEmail } from "@/lib/username";
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

/**
 * Vì sao chưa vào được dù đã đăng nhập (màn "Chưa được cấp quyền" nói rõ cho người dùng):
 * - `username-taken`: tài khoản này CHƯA có hồ sơ, tự tạo thì trùng tên đăng nhập với
 *   hồ sơ của một tài khoản KHÁC (index duy nhất site_id + username) — thường là một
 *   người có 2 tài khoản đăng nhập (sự cố 2026-10-15). Admin xử lý ở màn Người dùng.
 * - `create-failed`: chưa có hồ sơ và tạo hụt vì lỗi khác.
 */
export type ProfileIssue = "username-taken" | "create-failed";

/** Lấy hồ sơ của tài khoản đang đăng nhập; chưa có thì tạo (vai trò rỗng).
 * Họ tên/username lấy từ metadata lúc đăng ký (nếu có), không thì suy từ email. */
async function getOrCreateProfile(
  session: Session
): Promise<{ profile: UserProfile | null; issue?: ProfileIssue }> {
  if (!supabase) return { profile: null };
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
  if (error) return { profile: null };
  if (data) return { profile: profileFromRow(data as Record<string, unknown>) };

  // Chưa có hồ sơ thật sự ⇒ tạo mới; ignoreDuplicates: dòng đã có (máy khác vừa
  // tạo / select hụt) thì GIỮ NGUYÊN, không bao giờ đè vai trò.
  const row = { id, site_id: SITE_ID, full_name: fullName, username, roles: "" };
  const { error: createError } = await supabase
    .from("user_profiles")
    .upsert(row, { onConflict: "id", ignoreDuplicates: true });
  const profile = { id, fullName, username, roles: [] };
  // Trước đây lỗi này bị nuốt ⇒ tưởng "chưa gán vai trò" trong khi tên đăng nhập đang
  // gắn với hồ sơ của tài khoản khác. Giờ nói rõ để người dùng báo đúng việc cho admin.
  if (createError) {
    console.warn("[auth] Không tạo được hồ sơ người dùng", createError);
    return { profile, issue: createError.code === "23505" ? "username-taken" : "create-failed" };
  }
  return { profile };
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
  const [profileIssue, setProfileIssue] = useState<ProfileIssue | undefined>(undefined);
  const [isInitialized, setIsInitialized] = useState(!hasSupabase);
  // Id tài khoản đã nạp xong hồ sơ (thành công HAY lỗi) — phân biệt "đang nạp"
  // với "nạp xong mà vai trò rỗng" (màn Chưa được cấp quyền).
  const [loadedProfileUid, setLoadedProfileUid] = useState<string | null>(null);

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
      if (!isCancelled) {
        setProfile(nd.profile);
        setProfileIssue(nd.issue);
        setLoadedProfileUid(session.user.id);
      }
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
      const u = normalizeUsername(username);
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
      // Chỉ chữ thường không dấu + số — không dấu chấm (chốt 2026-10-15, lib/username.ts).
      const u = normalizeUsername(username);
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

  /**
   * Người đang đăng nhập tự đổi mật khẩu. Kiểm mật khẩu HIỆN TẠI trước (đăng nhập
   * lại bằng chính tài khoản này) — máy để quên đăng nhập thì người khác không đổi
   * được. Đổi mật khẩu người KHÁC cần service role ⇒ chưa làm (spec role-permissions).
   */
  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<AuthResult> => {
      if (!supabase) return { ok: false, error: "Chưa cấu hình máy chủ" };
      const email = session?.user.email;
      if (!email) return { ok: false, error: "Chưa đăng nhập" };
      if (!currentPassword) return { ok: false, error: "Nhập mật khẩu hiện tại" };
      if (newPassword.length < 6) return { ok: false, error: "Mật khẩu mới tối thiểu 6 ký tự" };
      if (newPassword === currentPassword)
        return { ok: false, error: "Mật khẩu mới phải khác mật khẩu hiện tại" };
      const check = await supabase.auth.signInWithPassword({ email, password: currentPassword });
      if (check.error) {
        return {
          ok: false,
          error: /invalid login credentials/i.test(check.error.message)
            ? "Mật khẩu hiện tại không đúng"
            : translateError(check.error.message),
        };
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { ok: false, error: translateSignUpError(error.message) };
      appendAuditEntries([
        { action: "change-password", entity: "auth", entityKey: emailToUsername(email), summary: "Đổi mật khẩu" },
      ]);
      return { ok: true };
    },
    [session]
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
    /** Tài khoản chưa có hồ sơ và tạo hụt — lý do để màn "Chưa được cấp quyền" nói rõ. */
    profileIssue,
    /** Đã đăng nhập, hồ sơ (vai trò) chưa nạp xong. */
    isProfileLoading: hasSupabase && !!uid && loadedProfileUid !== uid,
    /** Có cần đăng nhập không (chỉ khi đã cấu hình Supabase). */
    requiresLogin: hasSupabase,
    isAdmin: rolesList(profile?.roles).includes("admin"),
    signIn,
    createAccount,
    changePassword,
    signOut,
  };
}

/* ---------- Tài khoản đăng nhập chưa có hồ sơ (mig 0063) — CHỈ admin ---------- */

export interface OrphanAccount {
  id: string;
  email: string;
  username: string;
  fullName: string;
  createdAt: string;
  lastSignInAt: string;
  /** Hồ sơ có sẵn cùng tên đăng nhập (hoặc trùng khi bỏ dấu chấm) — gợi ý "gắn sang". */
  suggestedProfile: { id: string; username: string; fullName: string; roles: Role[]; accountLastSignInAt: string } | null;
}

/** Một loại dữ liệu liên quan tới tài khoản (mig 0064 `orphan_account_usage`). */
export interface AccountUsage {
  category: string; // profile · self · user_permissions · reconciliation · storage · audit_log · row_marks · operator:<bảng> · recent_sign_in
  label: string;
  rowCount: number;
  lastAt: string;
  /** true = còn thứ gắn cứng với id tài khoản ⇒ máy chủ TỪ CHỐI xóa. */
  blocking: boolean;
}

const usageFromRow = (r: Record<string, unknown>): AccountUsage => ({
  category: s(r.category),
  label: s(r.label),
  rowCount: Number(r.row_count) || 0,
  lastAt: s(r.last_at),
  blocking: Boolean(r.blocking),
});

const orphanFromRow = (r: Record<string, unknown>): OrphanAccount => ({
  id: s(r.id),
  email: s(r.email),
  username: s(r.username),
  fullName: s(r.full_name),
  createdAt: s(r.created_at),
  lastSignInAt: s(r.last_sign_in_at),
  suggestedProfile: r.suggested_profile_id
    ? {
        id: s(r.suggested_profile_id),
        username: s(r.suggested_profile_username),
        fullName: s(r.suggested_profile_full_name),
        roles: rolesFromCsv(s(r.suggested_profile_roles)),
        accountLastSignInAt: s(r.suggested_account_last_sign_in_at),
      }
    : null,
});

/**
 * Tài khoản Auth chưa có hồ sơ — chỉ admin (hàm SQL tự kiểm `la_admin()`). Máy chưa
 * chạy 0063 / không phải admin / chạy localStorage ⇒ `available = false`, màn ẩn mục.
 * `relink(from, to)`: chuyển hồ sơ có sẵn sang tài khoản đúng (một câu UPDATE ở máy chủ).
 */
export function useOrphanAccounts(enabled: boolean) {
  const [accounts, setAccounts] = useState<OrphanAccount[]>([]);
  const [isAvailable, setAvailable] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!supabase || !enabled) return;
    let isCancelled = false;
    supabase.rpc("list_orphan_auth_accounts").then(({ data, error }) => {
      if (isCancelled) return;
      if (error) {
        console.warn("[auth] Không đọc được tài khoản chưa có hồ sơ (0063 chưa chạy?)", error);
        setAvailable(false);
        return;
      }
      setAvailable(true);
      setAccounts(((data ?? []) as Record<string, unknown>[]).map(orphanFromRow));
    });
    return () => {
      isCancelled = true;
    };
  }, [enabled, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  const relink = useCallback(async (fromProfileId: string, toAccountId: string): Promise<AuthResult> => {
    if (!supabase) return { ok: false, error: "Chưa cấu hình máy chủ" };
    const { error } = await supabase.rpc("relink_user_profile", { p_from: fromProfileId, p_to: toAccountId });
    if (error) return { ok: false, error: error.message };
    appendAuditEntries([
      {
        action: "update",
        entity: "user_profiles",
        entityKey: toAccountId,
        summary: `Chuyển hồ sơ ${fromProfileId} sang tài khoản đăng nhập ${toAccountId}`,
      },
    ]);
    return { ok: true };
  }, []);

  /** Báo cáo dữ liệu liên quan trước khi xóa (0064). Lỗi (chưa chạy 0064…) ⇒ `ok: false`. */
  const usage = useCallback(async (accountId: string): Promise<{ ok: boolean; rows: AccountUsage[]; error?: string }> => {
    if (!supabase) return { ok: false, rows: [], error: "Chưa cấu hình máy chủ" };
    const { data, error } = await supabase.rpc("orphan_account_usage", { p_user_id: accountId });
    if (error) return { ok: false, rows: [], error: error.message };
    return { ok: true, rows: ((data ?? []) as Record<string, unknown>[]).map(usageFromRow) };
  }, []);

  /**
   * XÓA VĨNH VIỄN tài khoản đăng nhập mồ côi (0064). Máy chủ tự kiểm lại dữ liệu chặn
   * ngay lúc xóa. Không hoàn tác được ⇒ ghi nhật ký kèm tóm tắt dữ liệu đã thấy.
   */
  const remove = useCallback(async (account: OrphanAccount, seen: AccountUsage[]): Promise<AuthResult> => {
    if (!supabase) return { ok: false, error: "Chưa cấu hình máy chủ" };
    const { error } = await supabase.rpc("delete_orphan_auth_account", { p_user_id: account.id });
    if (error) return { ok: false, error: error.message };
    const kept = seen.map((u) => `${u.label}: ${u.rowCount}`).join("; ");
    appendAuditEntries([
      {
        action: "delete",
        entity: "auth",
        entityKey: account.id,
        summary: `Xóa tài khoản đăng nhập chưa có hồ sơ ${account.email}${kept ? ` — dữ liệu liên quan giữ nguyên: ${kept}` : ""}`,
      },
    ]);
    return { ok: true };
  }, []);

  return { accounts: isAvailable ? accounts : [], isAvailable, reload, relink, usage, remove };
}
