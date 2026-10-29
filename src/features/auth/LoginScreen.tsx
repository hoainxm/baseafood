// ============================================================
// Tên file cũ: src/features/auth/LoginScreen.tsx
// Tên tiếng Việt: Màn hình Đăng nhập hệ thống
// Description: System Login Screen
// ============================================================
import { useState } from "react";
import { Button, Card, Field, Input, Logo } from "@/design-system";
import type { AuthResult } from "@/lib/auth";
import { Eye, EyeOff, KeyRound, LogIn, TriangleAlert } from "lucide-react";

/**
 * Màn đăng nhập — che toàn app khi đã cấu hình Supabase mà chưa có phiên.
 * KHÔNG mở đăng ký tự do: tài khoản do admin tạo (màn Người dùng). Người dùng
 * chỉ gõ tên đăng nhập; app ghép đuôi `@bsf1.vn` thành email tổng hợp cho
 * Supabase Auth (xem src/lib/auth.ts). Email tổng hợp không có hòm thư ⇒ quên mật khẩu
 * KHÔNG gửi link qua email được: báo admin đặt mật khẩu tạm (màn Người dùng, mig 0080).
 */
export default function LoginScreen({
  login: signIn,
}: {
  login: (username: string, password: string) => Promise<AuthResult>;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isPasswordVisible, setPasswordVisible] = useState(false);
  const [isForgotOpen, setForgotOpen] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSending(true);
    const result = await signIn(username, password);
    setIsSending(false);
    if (!result.ok) setError(result.error ?? "Đăng nhập thất bại");
  };

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <Card className="w-full max-w-md space-y-8 p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo heightClass="h-14" subtitle="Xí nghiệp BSF1" />
          <h1 className="text-2xl font-semibold text-foreground">Đăng nhập</h1>
          <p className="text-base text-muted-foreground">
            Nhập tên đăng nhập và mật khẩu.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-5">
          {error && (
            <p
              role="alert"
              className="flex items-start gap-3 rounded-lg bg-warning-surface px-4 py-3 text-base font-medium text-destructive"
            >
              <TriangleAlert className="mt-0.5 size-6 shrink-0" aria-hidden />
              {error}
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
            <div className="relative">
              <Input
                type={isPasswordVisible ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mật khẩu"
                autoComplete="current-password"
                className="pr-12"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute right-1 top-1/2 -translate-y-1/2"
                onClick={() => setPasswordVisible((v) => !v)}
                aria-label={isPasswordVisible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                title={isPasswordVisible ? "Ẩn mật khẩu đang gõ." : "Hiện mật khẩu đang gõ để kiểm gõ đúng chưa."}
              >
                {isPasswordVisible ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          </Field>

          <Button
            title="Đăng nhập bằng tên tài khoản và mật khẩu vừa nhập." type="submit" size="lg" className="w-full" disabled={isSending}>
            <LogIn />
            {isSending ? "Đang đăng nhập…" : "Đăng nhập"}
          </Button>

          <div className="space-y-3 text-center">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setForgotOpen((v) => !v)}
              aria-expanded={isForgotOpen}
              title="Cách lấy lại quyền vào khi quên mật khẩu."
            >
              <KeyRound />
              Quên mật khẩu?
            </Button>
            {isForgotOpen && (
              <div className="rounded-lg bg-muted px-4 py-3 text-left text-base text-foreground">
                <p>
                  Báo <strong>quản trị (admin)</strong> qua Zalo hoặc gặp trực tiếp, kèm tên đăng nhập của bạn.
                  Admin đặt mật khẩu tạm ở màn Người dùng rồi gửi lại cho bạn.
                </p>
                <p className="mt-2 text-muted-foreground">
                  Đăng nhập bằng mật khẩu tạm, app sẽ bắt bạn đặt mật khẩu riêng trước khi vào làm việc.
                </p>
              </div>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
