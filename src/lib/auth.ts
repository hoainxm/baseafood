import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, hasSupabase, SITE_ID, taoClientTam } from "@/lib/supabase";
import type { NguoiDung, VaiTro } from "@/types";
import { vaiTroTuChuoi, vaiTroThanhChuoi } from "@/types";
import { emailToUsername, usernameToEmail } from "@/lib/username";

/**
 * Đăng nhập qua Supabase Auth (email tổng hợp `<username>@bsf1.vn`).
 *
 * Tài khoản (email + mật khẩu) tạo ở Supabase Dashboard; bảng `nguoi_dung` giữ
 * hồ sơ nghiệp vụ (họ tên, username, vai trò), khóa `id` = auth user id. Lần đầu
 * đăng nhập, app tự tạo hồ sơ (vai trò rỗng — admin gán sau).
 *
 * Chưa cấu hình Supabase (chạy localStorage ở xưởng) ⇒ KHÔNG chặn đăng nhập:
 * `hasSupabase = false` thì gate ở App bỏ qua, app dùng được ngay.
 */

const s = (v: unknown) => (v == null ? "" : String(v));

function hoSoTuRow(r: Record<string, unknown>): NguoiDung {
  return {
    id: s(r.id),
    hoTen: s(r.ho_ten),
    username: s(r.username),
    vaiTro: vaiTroTuChuoi(s(r.vai_tro)),
  };
}

/** Lấy hồ sơ của tài khoản đang đăng nhập; chưa có thì tạo (vai trò rỗng).
 * Họ tên/username lấy từ metadata lúc đăng ký (nếu có), không thì suy từ email. */
async function layHoacTaoHoSo(session: Session): Promise<NguoiDung | null> {
  if (!supabase) return null;
  const id = session.user.id;
  const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
  const username = s(meta.username) || emailToUsername(session.user.email ?? "");
  const hoTen = s(meta.ho_ten);

  const { data, error } = await supabase
    .from("nguoi_dung")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!error && data) return hoSoTuRow(data as Record<string, unknown>);

  const row = { id, xi_nghiep_id: SITE_ID, ho_ten: hoTen, username, vai_tro: "" };
  await supabase.from("nguoi_dung").upsert(row, { onConflict: "id" });
  return { id, hoTen, username, vaiTro: [] };
}

/** Dịch lỗi Supabase Auth sang tiếng Việt cho người dùng đọc được. */
function dichLoi(msg: string): string {
  if (/invalid login credentials/i.test(msg))
    return "Sai tên đăng nhập hoặc mật khẩu";
  if (/email not confirmed/i.test(msg))
    return "Tài khoản chưa kích hoạt — báo quản trị";
  if (/rate limit|too many/i.test(msg))
    return "Thử lại quá nhiều lần — chờ một lát rồi đăng nhập lại";
  return msg;
}

function dichLoiTaoTK(msg: string): string {
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

export interface KetQuaDangNhap {
  ok: boolean;
  loi?: string;
  /** Hồ sơ vừa tạo (taoTaiKhoan) — để màn admin cập nhật danh sách ngay. */
  nguoiDung?: NguoiDung;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [nguoiDung, setNguoiDung] = useState<NguoiDung | null>(null);
  const [daKhoiTao, setDaKhoiTao] = useState(!hasSupabase);

  useEffect(() => {
    if (!supabase) return;
    let huy = false;
    supabase.auth.getSession().then(({ data }) => {
      if (huy) return;
      setSession(data.session);
      setDaKhoiTao(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s2) => {
      // KHÔNG gọi supabase async thẳng trong callback (dễ deadlock) — chỉ set
      // session, hồ sơ nạp ở effect theo user id bên dưới.
      setSession(s2);
      setDaKhoiTao(true);
    });
    return () => {
      huy = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const uid = session?.user.id;
  useEffect(() => {
    if (!supabase) return;
    if (!session) {
      setNguoiDung(null);
      return;
    }
    let huy = false;
    (async () => {
      const nd = await layHoacTaoHoSo(session);
      if (!huy) setNguoiDung(nd);
    })();
    return () => {
      huy = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const dangNhap = useCallback(
    async (username: string, matKhau: string): Promise<KetQuaDangNhap> => {
      if (!supabase) return { ok: false, loi: "Chưa cấu hình máy chủ" };
      if (!username.trim() || !matKhau)
        return { ok: false, loi: "Nhập tên đăng nhập và mật khẩu" };
      const { error } = await supabase.auth.signInWithPassword({
        email: usernameToEmail(username),
        password: matKhau,
      });
      if (error) return { ok: false, loi: dichLoi(error.message) };
      return { ok: true };
    },
    []
  );

  /**
   * ADMIN tạo tài khoản cho người khác. Đăng ký KHÔNG mở tự do — chỉ gọi từ màn
   * Người dùng (admin). Dùng client PHỤ để signUp nên KHÔNG đá văng phiên admin
   * trên client chính. Hồ sơ `nguoi_dung` tạo với vai trò rỗng (admin gán sau).
   */
  const taoTaiKhoan = useCallback(
    async (
      hoTen: string,
      username: string,
      matKhau: string,
      vaiTro: VaiTro[] = []
    ): Promise<KetQuaDangNhap> => {
      if (!supabase) return { ok: false, loi: "Chưa cấu hình máy chủ" };
      const u = username.trim().toLowerCase();
      if (!hoTen.trim()) return { ok: false, loi: "Nhập họ tên" };
      if (!u) return { ok: false, loi: "Nhập tên đăng nhập" };
      if (matKhau.length < 6)
        return { ok: false, loi: "Mật khẩu tối thiểu 6 ký tự" };

      // Check trùng tên đăng nhập trước (thông báo rõ hơn lỗi Auth).
      const { data: trung } = await supabase
        .from("nguoi_dung")
        .select("id")
        .eq("username", u)
        .maybeSingle();
      if (trung) return { ok: false, loi: "Tên đăng nhập đã tồn tại" };

      const phu = taoClientTam();
      if (!phu) return { ok: false, loi: "Chưa cấu hình máy chủ" };
      const { data, error } = await phu.auth.signUp({
        email: usernameToEmail(u),
        password: matKhau,
        options: { data: { ho_ten: hoTen.trim(), username: u } },
      });
      if (error) return { ok: false, loi: dichLoiTaoTK(error.message) };

      // Lưu hồ sơ qua client CHÍNH (phiên admin) — vai trò rỗng.
      const uid = data.user?.id;
      if (!uid) return { ok: false, loi: "Tạo tài khoản không thành công" };
      await supabase.from("nguoi_dung").upsert(
        {
          id: uid,
          xi_nghiep_id: SITE_ID,
          ho_ten: hoTen.trim(),
          username: u,
          vai_tro: vaiTroThanhChuoi(vaiTro),
        },
        { onConflict: "id" }
      );
      return {
        ok: true,
        nguoiDung: { id: uid, hoTen: hoTen.trim(), username: u, vaiTro },
      };
    },
    []
  );

  const dangXuat = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  return {
    session,
    nguoiDung,
    dangTai: hasSupabase && !daKhoiTao,
    /** Có cần đăng nhập không (chỉ khi đã cấu hình Supabase). */
    canDangNhap: hasSupabase,
    laAdmin: nguoiDung?.vaiTro.includes("admin") ?? false,
    dangNhap,
    taoTaiKhoan,
    dangXuat,
  };
}
