// ============================================================
// Tên file: src/features/auth/SetOwnPasswordScreen.tsx
// Tên tiếng Việt tương đương: Màn đặt mật khẩu riêng sau khi admin đặt lại
// Description: Forced own-password screen after an admin reset (must_change_password flag, mig 0080)
// ============================================================
import { useState } from "react";
import { Button, Card, ErrorSummary, Field, Input, Logo, notify, type FieldError } from "@/design-system";
import type { AuthResult } from "@/lib/auth";
import { KeyRound, LogOut } from "lucide-react";

/**
 * Admin vừa đặt mật khẩu tạm (màn Người dùng → Mật khẩu, chọn "Bắt đổi") ⇒ lần vào tới
 * che toàn app tới khi người dùng đặt mật khẩu riêng — mật khẩu tạm đã đi qua tay admin /
 * tin nhắn nên không giữ lâu. Không lưu nháp (mật khẩu). Đăng xuất được nếu nhầm người.
 */
export default function SetOwnPasswordScreen({
  displayName,
  onSubmit,
  onSignOut,
}: {
  displayName: string;
  onSubmit: (newPassword: string) => Promise<AuthResult>;
  onSignOut: () => void;
}) {
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [isSaving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ls: FieldError[] = [];
    if (next.length < 6) ls.push({ field: "Mật khẩu mới", message: "Tối thiểu 6 ký tự" });
    if (next !== confirm) ls.push({ field: "Nhập lại mật khẩu mới", message: "Không khớp mật khẩu mới" });
    setErrors(ls);
    if (ls.length || isSaving) return;
    setSaving(true);
    const result = await onSubmit(next);
    setSaving(false);
    if (!result.ok) {
      setErrors([{ field: "Đặt mật khẩu", message: result.error ?? "Không đặt được mật khẩu" }]);
      return;
    }
    notify.saved("Đã đặt mật khẩu riêng — lần sau đăng nhập bằng mật khẩu này");
  };

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <Card className="w-full max-w-md space-y-8 p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo heightClass="h-14" subtitle="Xí nghiệp BSF1" />
          <h1 className="text-2xl font-semibold text-foreground">Đặt mật khẩu riêng</h1>
          <p className="text-base text-muted-foreground">
            Chào {displayName}. Quản trị vừa đặt lại mật khẩu cho bạn. Đặt mật khẩu của riêng bạn trước khi vào làm việc.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <ErrorSummary errors={errors} />
          <Field label="Mật khẩu mới" required hint="Tối thiểu 6 ký tự, khác mật khẩu tạm quản trị đưa.">
            <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" autoFocus />
          </Field>
          <Field label="Nhập lại mật khẩu mới" required>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </Field>
          <Button
            variant="save"
            type="submit"
            size="lg"
            className="w-full"
            title="Ghi mật khẩu riêng của bạn rồi vào app."
          >
            <KeyRound />
            {isSaving ? "Đang đặt…" : "Đặt mật khẩu và vào app"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="w-full"
            onClick={onSignOut}
            title="Không phải bạn? Thoát tài khoản này, quay về màn đăng nhập."
          >
            <LogOut />
            Đăng xuất
          </Button>
        </form>
      </Card>
    </div>
  );
}
