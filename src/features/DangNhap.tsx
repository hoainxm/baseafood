import { useState } from "react";
import { Button, Card, Field, Input, Logo } from "@/design-system";
import type { KetQuaDangNhap } from "@/lib/auth";
import { hoTenToUsername } from "@/lib/username";
import { LogIn, TriangleAlert, UserPlus } from "lucide-react";

type CheDo = "dang-nhap" | "dang-ky";

/**
 * Màn xác thực — che toàn app khi đã cấu hình Supabase mà chưa có phiên.
 * Hai chế độ: đăng nhập (username + mật khẩu) và đăng ký (họ tên · tên đăng
 * nhập · mật khẩu · xác nhận). Tên đăng nhập gợi ý từ họ tên, sửa được; app
 * ghép đuôi `@bsf1.local` thành email tổng hợp cho Supabase Auth.
 */
export default function DangNhap({
  dangNhap,
  dangKy,
}: {
  dangNhap: (username: string, matKhau: string) => Promise<KetQuaDangNhap>;
  dangKy: (
    hoTen: string,
    username: string,
    matKhau: string
  ) => Promise<KetQuaDangNhap>;
}) {
  const [cheDo, setCheDo] = useState<CheDo>("dang-nhap");
  const [hoTen, setHoTen] = useState("");
  const [username, setUsername] = useState("");
  const [usernameTuSua, setUsernameTuSua] = useState(false);
  const [matKhau, setMatKhau] = useState("");
  const [xacNhan, setXacNhan] = useState("");
  const [loi, setLoi] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [dangGui, setDangGui] = useState(false);

  const laDangKy = cheDo === "dang-ky";

  const doiCheDo = (cd: CheDo) => {
    setCheDo(cd);
    setLoi(null);
    setOk(null);
  };

  // Đăng ký: gợi ý tên đăng nhập từ họ tên cho tới khi người dùng sửa tay.
  const doiHoTen = (v: string) => {
    setHoTen(v);
    if (!usernameTuSua) setUsername(hoTenToUsername(v));
  };

  const gui = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoi(null);
    setOk(null);

    if (laDangKy && matKhau !== xacNhan) {
      setLoi("Mật khẩu nhập lại không khớp");
      return;
    }

    setDangGui(true);
    const kq = laDangKy
      ? await dangKy(hoTen, username, matKhau)
      : await dangNhap(username, matKhau);
    setDangGui(false);

    if (!kq.ok) {
      setLoi(kq.loi ?? (laDangKy ? "Đăng ký thất bại" : "Đăng nhập thất bại"));
      return;
    }
    // Đăng ký mà chưa có phiên (email confirm còn bật) → chuyển sang đăng nhập.
    if (laDangKy && !kq.coPhien) {
      doiCheDo("dang-nhap");
      setOk("Đã tạo tài khoản. Đăng nhập bằng tên đăng nhập và mật khẩu.");
      setMatKhau("");
      setXacNhan("");
    }
    // Có phiên → App tự chuyển vào trong (theo trạng thái đăng nhập).
  };

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <Card className="w-full max-w-md space-y-8 p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo cao="h-14" phuDe="Xí nghiệp BSF1" />
          <h1 className="text-2xl font-semibold text-foreground">
            {laDangKy ? "Đăng ký tài khoản" : "Đăng nhập"}
          </h1>
          <p className="text-base text-muted-foreground">
            {laDangKy
              ? "Điền họ tên và đặt mật khẩu. Vai trò do quản trị gán sau."
              : "Nhập tên đăng nhập và mật khẩu."}
          </p>
        </div>

        <form onSubmit={gui} className="space-y-5">
          {ok && (
            <p
              role="status"
              className="rounded-lg bg-success-surface px-4 py-3 text-base font-medium text-success"
            >
              {ok}
            </p>
          )}
          {loi && (
            <p
              role="alert"
              className="flex items-start gap-3 rounded-lg bg-warning-surface px-4 py-3 text-base font-medium text-destructive"
            >
              <TriangleAlert className="mt-0.5 size-6 shrink-0" aria-hidden />
              {loi}
            </p>
          )}

          {laDangKy && (
            <Field label="Họ tên">
              <Input
                value={hoTen}
                onChange={(e) => doiHoTen(e.target.value)}
                autoFocus
                placeholder="VD: Phan Nguyễn Hoài Nam"
              />
            </Field>
          )}

          <Field
            label="Tên đăng nhập"
            hint={laDangKy ? "Gợi ý từ họ tên — sửa được nếu muốn." : undefined}
          >
            <Input
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (laDangKy) setUsernameTuSua(true);
              }}
              autoFocus={!laDangKy}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Tên đăng nhập"
            />
          </Field>

          <Field label="Mật khẩu" hint={laDangKy ? "Tối thiểu 6 ký tự." : undefined}>
            <Input
              type="password"
              value={matKhau}
              onChange={(e) => setMatKhau(e.target.value)}
              placeholder="Mật khẩu"
            />
          </Field>

          {laDangKy && (
            <Field label="Nhập lại mật khẩu">
              <Input
                type="password"
                value={xacNhan}
                onChange={(e) => setXacNhan(e.target.value)}
                placeholder="Nhập lại mật khẩu"
              />
            </Field>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={dangGui}>
            {laDangKy ? <UserPlus /> : <LogIn />}
            {dangGui
              ? laDangKy
                ? "Đang tạo…"
                : "Đang đăng nhập…"
              : laDangKy
                ? "Tạo tài khoản"
                : "Đăng nhập"}
          </Button>
        </form>

        <div className="text-center text-base">
          {laDangKy ? (
            <button
              type="button"
              onClick={() => doiCheDo("dang-nhap")}
              className="font-medium text-primary hover:underline"
            >
              Đã có tài khoản? Đăng nhập
            </button>
          ) : (
            <button
              type="button"
              onClick={() => doiCheDo("dang-ky")}
              className="font-medium text-primary hover:underline"
            >
              Chưa có tài khoản? Đăng ký
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}
