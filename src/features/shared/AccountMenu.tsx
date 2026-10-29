// ============================================================
// Tên file: src/features/shared/AccountMenu.tsx
// Tên tiếng Việt: Menu tài khoản ở avatar trên header
// Description: Avatar button opening the account menu (profile, display, password, admin, sign out)
// ============================================================
// Gom MỌI việc của riêng người đang đăng nhập về một chỗ (yêu cầu 2026-10-15):
// thông tin tài khoản · tùy chỉnh giao diện · đổi mật khẩu · vào khu quản trị
// (admin) · đăng xuất. Có ở MỌI cỡ màn (điện thoại trước đây không có nút đăng xuất
// ngoài drawer). Hộp thoại mở SAU khi đóng menu — không lồng hộp trong popover.
import { useState, type ReactNode } from "react";
import {
  Button,
  ConfirmAction,
  DisplaySettingsDialog,
  ErrorSummary,
  Field,
  FormDialog,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
  notify,
  type FieldError,
} from "@/design-system";
import { cn } from "@/lib/utils";
import { BadgeCheck, ChevronDown, KeyRound, LogOut, MonitorX, Palette, ShieldCheck, type LucideIcon } from "lucide-react";
import { DraftRestoredNotice } from "@/features/shared/DraftRestoredNotice";
import { useDialogDraft } from "@/lib/formDraft";
import { DISPLAY_NAME_MAX } from "@/lib/personName";

export interface AccountMenuProps {
  displayName: string;
  username?: string;
  role: string;
  /** Username để lưu cài đặt giao diện theo người dùng. */
  account?: string;
  /** Có ⇒ hiện "Đổi mật khẩu" (chỉ khi đăng nhập máy chủ). */
  onChangePassword?: (currentPassword: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  /**
   * Có ⇒ hiện "Đặt tên gọi" (đăng nhập máy chủ + máy chủ đã chạy 0086). Tên gọi chỉ để gọi người;
   * sổ, nhật ký, chứng từ vẫn đứng họ tên `fullName` (ba-spec 47).
   */
  nicknameEditor?: {
    current: string;
    fullName: string;
    onSave: (displayName: string) => Promise<{ ok: boolean; error?: string }>;
  };
  /** Có ⇒ hiện "Quản trị hệ thống" (chỉ admin). */
  onOpenAdmin?: () => void;
  onSignOut?: () => void;
  /** Có ⇒ hiện "Đăng xuất khỏi mọi máy" (máy để quên đăng nhập ở xưởng). */
  onSignOutEverywhere?: () => void;
}

/** Hai chữ đầu của hai từ CUỐI tên ("Nguyễn Như Thanh Trúc" → "TT"). */
function initialsOf(name: string): string {
  return (
    String(name || "?")
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?"
  );
}

function MenuItem({
  icon: Icon,
  label,
  title,
  onClick,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  title: string;
  onClick: () => void;
  tone?: "danger";
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "press-feedback flex min-h-10 w-full items-center gap-3 rounded-md px-2.5 text-left text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        tone === "danger" && "hover:text-destructive"
      )}
    >
      <Icon className="size-icon-sm shrink-0 text-muted-foreground" aria-hidden />
      {label}
    </button>
  );
}

type OpenDialog = "display" | "password" | "sign-out" | "sign-out-everywhere" | null;

export function AccountMenu({
  displayName,
  username,
  role,
  account,
  onChangePassword,
  nicknameEditor,
  onOpenAdmin,
  onSignOut,
  onSignOutEverywhere,
}: AccountMenuProps) {
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const openDialog = (d: OpenDialog) => {
    setMenuOpen(false);
    setDialog(d);
  };
  // Tên gọi: phiếu mở = khác null (mẫu nháp hộp thoại, quy tắc 17).
  const [nicknameForm, setNicknameForm] = useState<NicknameForm | null>(null);
  const nicknameDraft = useDialogDraft({
    form: "account-display-name",
    value: nicknameForm,
    setValue: setNicknameForm,
    isEmpty: (f) => f.value.trim() === f.initial,
  });
  const openNickname = () => {
    if (!nicknameEditor) return;
    setMenuOpen(false);
    const current = nicknameEditor.current;
    setNicknameForm(nicknameDraft.takeKept() ?? { value: current, initial: current });
  };

  return (
    <>
      <Popover open={isMenuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Tài khoản: ${displayName}`}
            title="Tài khoản của bạn: tùy chỉnh giao diện, đổi mật khẩu, đăng xuất."
            className="press-feedback flex shrink-0 items-center gap-2 rounded-full p-0.5 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring xl:rounded-lg xl:pr-2"
          >
            <span
              aria-hidden
              className="flex size-tap shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground"
            >
              {initialsOf(displayName)}
            </span>
            <span className="hidden min-w-0 max-w-48 text-right xl:block">
              <span className="block truncate text-sm font-semibold text-foreground">{displayName}</span>
              <span className="block truncate text-sm text-muted-foreground">{role}</span>
            </span>
            <ChevronDown className="hidden size-icon-sm text-muted-foreground xl:block" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 gap-1 p-2">
          <div className="flex items-center gap-3 px-2 py-2">
            <span
              aria-hidden
              className="flex size-tap shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground"
            >
              {initialsOf(displayName)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">{displayName}</p>
              {username && <p className="truncate text-sm text-muted-foreground">@{username}</p>}
              <p className="truncate text-sm text-muted-foreground">{role}</p>
            </div>
          </div>
          <Separator className="my-1" />
          <MenuItem
            icon={Palette}
            label="Tùy chỉnh giao diện"
            title="Đổi cỡ chữ, mật độ và bề rộng nội dung — nhớ riêng cho tài khoản của bạn."
            onClick={() => openDialog("display")}
          />
          {nicknameEditor && (
            <MenuItem
              icon={BadgeCheck}
              label="Đặt tên gọi"
              title="Đặt tên mọi người gọi bạn trên hệ thống (vd. biệt danh). Sổ sách, nhật ký, chứng từ vẫn ghi họ tên thật."
              onClick={openNickname}
            />
          )}
          {onChangePassword && (
            <MenuItem
              icon={KeyRound}
              label="Đổi mật khẩu"
              title="Đặt mật khẩu mới cho tài khoản của bạn (phải nhập mật khẩu hiện tại)."
              onClick={() => openDialog("password")}
            />
          )}
          {onOpenAdmin && (
            <MenuItem
              icon={ShieldCheck}
              label="Quản trị hệ thống"
              title="Mở khu quản trị: người dùng, vai trò & quyền, nhật ký thao tác."
              onClick={() => {
                setMenuOpen(false);
                onOpenAdmin();
              }}
            />
          )}
          {onSignOut && (
            <>
              <Separator className="my-1" />
              <MenuItem
                icon={LogOut}
                label="Đăng xuất"
                title="Thoát tài khoản và quay về màn đăng nhập."
                tone="danger"
                onClick={() => openDialog("sign-out")}
              />
              {onSignOutEverywhere && (
                <MenuItem
                  icon={MonitorX}
                  label="Đăng xuất khỏi mọi máy"
                  title="Quên đăng xuất ở máy khác (máy xưởng, máy mượn)? Thoát tài khoản trên MỌI máy, kể cả máy này."
                  tone="danger"
                  onClick={() => openDialog("sign-out-everywhere")}
                />
              )}
            </>
          )}
        </PopoverContent>
      </Popover>

      <DisplaySettingsDialog
        account={account}
        open={dialog === "display"}
        onOpenChange={(o) => setDialog(o ? "display" : null)}
      />
      {nicknameEditor && (
        <NicknameDialog
          form={nicknameForm}
          setForm={setNicknameForm}
          draft={nicknameDraft}
          editor={nicknameEditor}
        />
      )}
      {onChangePassword && (
        <ChangePasswordDialog
          open={dialog === "password"}
          onOpenChange={(o) => setDialog(o ? "password" : null)}
          onSubmit={onChangePassword}
        />
      )}
      {onSignOut && (
        <ConfirmAction
          open={dialog === "sign-out"}
          onOpenChange={(o) => setDialog(o ? "sign-out" : null)}
          title="Đăng xuất khỏi máy này?"
          description="Số liệu đã ghi vẫn còn. Vào lại phải nhập tên đăng nhập và mật khẩu."
          detail={`${displayName} · ${role}`}
          confirmLabel="Đăng xuất"
          cancelLabel="Ở lại"
          icon={LogOut}
          onConfirm={onSignOut}
        />
      )}
      {onSignOutEverywhere && (
        <ConfirmAction
          open={dialog === "sign-out-everywhere"}
          onOpenChange={(o) => setDialog(o ? "sign-out-everywhere" : null)}
          title="Đăng xuất khỏi mọi máy?"
          description="Mọi máy đang đăng nhập tài khoản này bị thoát (máy khác chậm nhất khoảng 1 giờ). Số liệu đã ghi vẫn còn. Nghi lộ mật khẩu thì đổi mật khẩu luôn — đổi mật khẩu cũng tự đăng xuất các máy khác."
          detail={`${displayName} · ${role}`}
          confirmLabel="Đăng xuất mọi máy"
          cancelLabel="Ở lại"
          icon={MonitorX}
          onConfirm={onSignOutEverywhere}
        />
      )}
    </>
  );
}

function ChangePasswordDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: NonNullable<AccountMenuProps["onChangePassword"]>;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [isSaving, setSaving] = useState(false);

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setErrors([]);
  };
  const close = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const submit = async () => {
    const ls: FieldError[] = [];
    if (!current) ls.push({ field: "Mật khẩu hiện tại", message: "Chưa nhập" });
    if (next.length < 6) ls.push({ field: "Mật khẩu mới", message: "Tối thiểu 6 ký tự" });
    if (next !== confirm) ls.push({ field: "Nhập lại mật khẩu mới", message: "Không khớp mật khẩu mới" });
    setErrors(ls);
    if (ls.length || isSaving) return;
    setSaving(true);
    const result = await onSubmit(current, next);
    setSaving(false);
    if (!result.ok) {
      setErrors([{ field: "Đổi mật khẩu", message: result.error ?? "Không đổi được mật khẩu" }]);
      return;
    }
    notify.saved("Đã đổi mật khẩu");
    close(false);
  };

  const field = (label: string, value: string, set: (v: string) => void, hint?: ReactNode, auto?: string) => (
    <Field label={label} required hint={typeof hint === "string" ? hint : undefined}>
      <Input
        type="password"
        value={value}
        onChange={(e) => set(e.target.value)}
        autoComplete={auto}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
    </Field>
  );

  return (
    <FormDialog
      open={open}
      onOpenChange={close}
      title="Đổi mật khẩu"
      description="Nhập mật khẩu hiện tại rồi đặt mật khẩu mới. Lần đăng nhập sau dùng mật khẩu mới; các máy khác đang đăng nhập tài khoản này bị đăng xuất."
      icon={KeyRound}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={() => close(false)}>
            Hủy
          </Button>
          <Button variant="save" onClick={submit} title="Kiểm mật khẩu hiện tại rồi đặt mật khẩu mới cho tài khoản của bạn.">
            {isSaving ? "Đang đổi…" : "Đổi mật khẩu"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <ErrorSummary errors={errors} />
        {field("Mật khẩu hiện tại", current, setCurrent, undefined, "current-password")}
        {field("Mật khẩu mới", next, setNext, "Tối thiểu 6 ký tự.", "new-password")}
        {field("Nhập lại mật khẩu mới", confirm, setConfirm, undefined, "new-password")}
      </div>
    </FormDialog>
  );
}

interface NicknameForm {
  value: string;
  /** Tên gọi đang lưu lúc mở — so để biết đã gõ gì chưa (nháp). */
  initial: string;
}

function NicknameDialog({
  form,
  setForm,
  draft,
  editor,
}: {
  form: NicknameForm | null;
  setForm: (f: NicknameForm | null) => void;
  draft: ReturnType<typeof useDialogDraft<NicknameForm>>;
  editor: NonNullable<AccountMenuProps["nicknameEditor"]>;
}) {
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [isSaving, setSaving] = useState(false);

  const submit = async () => {
    if (!form || isSaving) return;
    setSaving(true);
    const result = await editor.onSave(form.value);
    setSaving(false);
    if (!result.ok) {
      setErrors([{ field: "Tên gọi", message: result.error ?? "Không lưu được tên gọi" }]);
      return;
    }
    setErrors([]);
    notify.saved(form.value.trim() ? `Đã đặt tên gọi “${form.value.trim()}”` : "Đã bỏ tên gọi — mọi người gọi bạn bằng họ tên");
    draft.done();
  };

  return (
    <FormDialog
      open={!!form}
      onOpenChange={(o) => {
        if (o) return;
        setErrors([]);
        draft.dismiss();
      }}
      title="Đặt tên gọi"
      description="Tên gọi hiện ở lời chào, menu tài khoản và cạnh họ tên của bạn khi người khác chọn người. Sổ sách, nhật ký, chứng từ, chữ ký vẫn ghi họ tên thật; quyền sửa số của bạn không đổi. Để trống = gọi bằng họ tên."
      icon={BadgeCheck}
      size="md"
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => {
              setErrors([]);
              draft.cancel();
            }}
          >
            Hủy
          </Button>
          <Button variant="save" onClick={submit} title="Lưu tên gọi của bạn. Họ tên thật và số đã ghi không đổi.">
            {isSaving ? "Đang lưu…" : "Lưu tên gọi"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <DraftRestoredNotice savedAt={draft.restoredAt} onDiscard={draft.cancel} />
        <ErrorSummary errors={errors} />
        <Field label="Họ tên (ghi sổ, không đổi ở đây)">
          <Input value={editor.fullName} readOnly />
        </Field>
        <Field label="Tên gọi" hint={`Tối đa ${DISPLAY_NAME_MAX} ký tự; không trùng tên của người khác.`}>
          <Input
            value={form?.value ?? ""}
            maxLength={DISPLAY_NAME_MAX + 10}
            onChange={(e) => form && setForm({ ...form, value: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </Field>
      </div>
    </FormDialog>
  );
}
