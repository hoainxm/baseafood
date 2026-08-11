// ============================================================
// Tên file cũ: src/features/auth/DangNhap.tsx
// Tên tiếng Việt: Màn hình Đăng nhập hệ thống
// Description: System Login Screen
// ============================================================
import { useState } from "react";
import { Button, Card, Field, Input, Logo } from "@/design-system";
import type { KetQuaDangNhap } from "@/lib/auth";
import { LogIn, TriangleAlert } from "lucide-react";

/**
 * Màn đăng nhập — che toàn app khi đã cấu hình Supabase mà chưa có phiên.
 * KHÔNG mở đăng ký tự do: tài khoản do admin tạo (màn Người dùng). Người dùng
 * chỉ gõ tên đăng nhập; app ghép đuôi `@bsf1.local` thành email tổng hợp cho
 * Supabase Auth (xem src/lib/auth.ts).
 */
export default function DangNhap({
  dangNhap,
}: {
  dangNhap: (username: string, matKhau: string) => Promise<KetQuaDangNhap>;
}) {
  const [username, setUsername] = useState("");
  const [matKhau, setMatKhau] = useState("");
  const [loi, setLoi] = useState<string | null>(null);
  const [dangGui, setDangGui] = useState(false);

  const gui = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoi(null);
    setDangGui(true);
    const kq = await dangNhap(username, matKhau);
    setDangGui(false);
    if (!kq.ok) setLoi(kq.loi ?? "Đăng nhập thất bại");
  };

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <Card className="w-full max-w-md space-y-8 p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo cao="h-14" phuDe="Xí nghiệp BSF1" />
          <h1 className="text-2xl font-semibold text-foreground">Đăng nhập</h1>
          <p className="text-base text-muted-foreground">
            Nhập tên đăng nhập và mật khẩu.
          </p>
        </div>

        <form onSubmit={gui} className="space-y-5">
          {loi && (
            <p
              role="alert"
              className="flex items-start gap-3 rounded-lg bg-warning-surface px-4 py-3 text-base font-medium text-destructive"
            >
              <TriangleAlert className="mt-0.5 size-6 shrink-0" aria-hidden />
              {loi}
            </p>
          )}

          <Field label="Tên đăng nhập" required>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Tên đăng nhập"
            />
          </Field>

          <Field label="Mật khẩu" required>
            <Input
              type="password"
              value={matKhau}
              onChange={(e) => setMatKhau(e.target.value)}
              placeholder="Mật khẩu"
            />
          </Field>

          <Button type="submit" size="lg" className="w-full" disabled={dangGui}>
            <LogIn />
            {dangGui ? "Đang đăng nhập…" : "Đăng nhập"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
