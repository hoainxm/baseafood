// ============================================================
// Tên file: src/features/documents/CompanyProfileView.tsx
// Tên tiếng Việt: Tab Thông tin công ty — logo, pháp nhân, người ký, tài khoản ngân hàng (một nguồn cho chứng từ)
// Description: Company profile tab of /documents (mig 0099, ba-spec 67)
// ============================================================
// Đổi logo = chỉ chọn một ảnh (R3). Gỡ logo ⇒ chứng từ về logo có sẵn của phần mềm (audit 2026-11-06). Cả hai có
// Hoàn tác: file logo cũ KHÔNG xóa khỏi kho file (vài chục KB) để Hoàn tác trỏ lại được. Sửa thông tin = một phiếu (nháp tự lưu — luật 17). Tài khoản ngân hàng =
// danh sách chọn `bank-account` mà invoice Xuất khẩu dùng (R4), quản lý ở đây theo quyền Sửa thông tin công ty.
import { useEffect, useRef, useState } from "react";
import { Button, ConfirmAction, Field, FormDialog, Input, ReadOnlyBadge, notify } from "@/design-system";
import { CatalogCrudFor } from "@/features/catalog/CatalogCrudFor";
import { exportOptionListConfig, useCatalogConfigs } from "@/features/catalog/catalogConfig";
import { DraftRestoredNotice } from "@/features/shared/DraftRestoredNotice";
import { useCan } from "@/features/shared/PermissionProvider";
import { useCompanyProfileStore } from "@/lib/catalogRepo";
import { getCompanyAssetUrl, uploadCompanyLogo } from "@/lib/companyAssets";
import { COMPANY_LOGO_TYPES, logoErrors } from "@/lib/companyProfile";
import { useDialogDraft } from "@/lib/formDraft";
import type { CompanyProfile } from "@/types";
import { Building2, ImageOff, ImageUp, Pencil, Save } from "lucide-react";

type Key = Exclude<keyof CompanyProfile, "id" | "logoPath">;
const FIELDS: readonly { key: Key; label: string; hint?: string }[] = [
  { key: "nameVietnamese", label: "Tên công ty (tiếng Việt)" },
  { key: "nameEn", label: "Tên công ty (tiếng Anh)", hint: "In đầu Invoice, Packing list (viết hoa tự động)." },
  { key: "shortNameEn", label: "Tên viết tắt (tiếng Anh)", hint: "In ở chỗ ký trên chứng từ." },
  { key: "taxCode", label: "Mã số thuế" },
  { key: "addressVietnamese", label: "Địa chỉ (tiếng Việt)" },
  { key: "addressEn", label: "Địa chỉ (tiếng Anh)", hint: "In đầu chứng từ xuất khẩu (viết hoa tự động)." },
  { key: "issuePlace", label: "Nơi lập chứng từ", hint: "In trước ngày, VD \"Ba Ria, November 03, 2026\"." },
  { key: "phone", label: "Điện thoại" },
  { key: "fax", label: "Fax" },
  { key: "email", label: "Email" },
  { key: "website", label: "Website" },
  { key: "signerName", label: "Người ký chứng từ" },
  { key: "signerTitle", label: "Chức danh người ký" },
  { key: "note", label: "Ghi chú" },
];

interface InfoForm {
  value: CompanyProfile;
  initial: string;
}

export function CompanyProfileView() {
  const { profile, saveProfile, isAvailable } = useCompanyProfileStore();
  const allowed = useCan("company-profile");
  const canEdit = allowed.update && isAvailable;
  const c = useCatalogConfigs();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isRemovingLogo, setIsRemovingLogo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<InfoForm | null>(null);
  const draft = useDialogDraft({ form: "company-profile", value: form, setValue: setForm, isEmpty: (f) => JSON.stringify(f.value) === f.initial });

  useEffect(() => {
    let alive = true;
    if (!profile.logoPath) {
      setLogoUrl(`${import.meta.env.BASE_URL}invoice-logo.jpg`);
      return;
    }
    void getCompanyAssetUrl(profile.logoPath, 3600).then((u) => alive && setLogoUrl(u));
    return () => {
      alive = false;
    };
  }, [profile.logoPath]);

  const openEdit = () => {
    const fresh: InfoForm = { value: { ...profile }, initial: JSON.stringify(profile) };
    const kept = draft.takeKept();
    setForm(kept ?? fresh);
  };

  const saveInfo = () => {
    if (!form) return;
    if (saveProfile(form.value)) {
      notify.saved("Đã lưu thông tin công ty — chứng từ lập từ giờ dùng thông tin mới");
      draft.done();
    }
  };

  const changeLogo = async (file: File | undefined) => {
    if (!file) return;
    const errors = logoErrors(file);
    if (errors.length) {
      notify.error(errors.join(" "));
      return;
    }
    setUploading(true);
    const r = await uploadCompanyLogo(file);
    setUploading(false);
    if ("error" in r) {
      notify.error(r.error);
      return;
    }
    const prev = profile;
    if (saveProfile({ ...profile, logoPath: r.path })) {
      notify.saved("Đã đổi logo — chứng từ PDF / Word lập từ giờ dùng logo mới", () => saveProfile(prev));
    }
  };

  /** Gỡ logo riêng ⇒ chứng từ dùng logo có sẵn của phần mềm. File giữ ở kho để Hoàn tác. */
  const removeLogo = () => {
    const prev = profile;
    if (!prev.logoPath) return;
    if (saveProfile({ ...prev, logoPath: "" })) {
      notify.deleted("Đã gỡ logo — chứng từ lập từ giờ dùng logo có sẵn của phần mềm", () => saveProfile(prev));
    }
  };

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
      {!isAvailable && (
        <p role="status" className="rounded-lg bg-warning-surface px-4 py-3 text-warning">
          Máy chủ chưa chạy migration 0099 — đang hiện giá trị mặc định (đang in trên invoice), chưa sửa được. Báo quản trị.
        </p>
      )}
      {isAvailable && !allowed.update && <ReadOnlyBadge />}

      <section data-tour="company-logo" className="grid gap-3 rounded-xl border-2 border-border bg-card p-4 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-center">
        <div className="flex h-28 items-center justify-center rounded-lg border border-border bg-background p-2">
          {logoUrl ? <img src={logoUrl} alt="Logo công ty" className="max-h-full max-w-full object-contain" /> : <Building2 className="size-10 text-muted-foreground" aria-hidden />}
        </div>
        <div className="grid gap-2">
          <h2 className="text-lg font-semibold">Logo</h2>
          <p className="text-muted-foreground">
            {profile.logoPath ? "Logo đã lưu — in trên Invoice, Packing list bản PDF / Word." : "Chưa lưu logo riêng — chứng từ đang dùng logo có sẵn của phần mềm."}
          </p>
          {canEdit && (
            <div>
              <input ref={fileRef} type="file" accept={COMPANY_LOGO_TYPES.join(",")} className="hidden" onChange={(e) => void changeLogo(e.target.files?.[0])} />
              <Button variant="edit" disabled={uploading} onClick={() => fileRef.current?.click()} title="Chọn một ảnh logo (PNG / JPG / WEBP, tối đa 5 MB). Không cần điền gì thêm.">
                <ImageUp className="mr-2 h-4 w-4" aria-hidden />
                {uploading ? "Đang tải lên…" : "Đổi logo"}
              </Button>
              {profile.logoPath && (
                <Button
                  variant="danger"
                  className="ml-2"
                  onClick={() => setIsRemovingLogo(true)}
                  title="Gỡ logo đã lưu, chứng từ quay về logo có sẵn của phần mềm. Hỏi trước, có Hoàn tác."
                >
                  <ImageOff className="mr-2 h-4 w-4" aria-hidden />
                  Gỡ logo
                </Button>
              )}
            </div>
          )}
          <ConfirmAction
            open={isRemovingLogo}
            onOpenChange={setIsRemovingLogo}
            title="Gỡ logo đã lưu?"
            description="Invoice, Packing list bản PDF / Word lập từ giờ dùng logo có sẵn của phần mềm. Chứng từ đã tải không đổi. File logo không bị xóa, bấm Hoàn tác là dùng lại."
            confirmLabel="Gỡ logo"
            destructive
            icon={ImageOff}
            onConfirm={() => {
              setIsRemovingLogo(false);
              removeLogo();
            }}
          />
        </div>
      </section>

      <section data-tour="company-info" className="grid gap-3 rounded-xl border-2 border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Thông tin pháp nhân</h2>
          {canEdit && (
            <Button variant="edit" onClick={openEdit} title="Sửa tên, mã số thuế, địa chỉ, liên hệ, người ký. Chứng từ lập sau khi lưu dùng thông tin mới; chứng từ đã tải không đổi.">
              <Pencil className="mr-2 h-4 w-4" aria-hidden />
              Sửa thông tin
            </Button>
          )}
        </div>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[14rem_minmax(0,1fr)]">
          {FIELDS.map((f) => (
            <div key={f.key} className="contents">
              <dt className="text-muted-foreground">{f.label}</dt>
              <dd className="min-w-0 break-words">{profile[f.key] || "—"}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section data-tour="company-banks" className="grid gap-3 rounded-xl border-2 border-border bg-card p-4">
        <h2 className="text-lg font-semibold">Tài khoản ngân hàng thụ hưởng</h2>
        <p className="text-muted-foreground">Invoice Xuất khẩu chọn một tài khoản trong danh sách này. Ghi chú của mỗi tài khoản là khối in dưới "Please make TT to:".</p>
        {/* Máy chủ chưa chạy 0099 ⇒ RLS chưa mở cho quyền Thông tin công ty ⇒ theo quyền ghi Xuất khẩu như cũ (khỏi kẹt hàng chờ). */}
        {isAvailable ? (
          <CatalogCrudFor cfg={exportOptionListConfig(c.exportOption, "bank-account")} rowMarkKey="company-bank-accounts" resource="company-profile" writeAction="update" />
        ) : (
          <CatalogCrudFor cfg={exportOptionListConfig(c.exportOption, "bank-account")} rowMarkKey="company-bank-accounts" resource="export-plans" />
        )}
      </section>

      <FormDialog
        open={!!form}
        onOpenChange={(o) => {
          if (o) return;
          draft.dismiss();
        }}
        title="Sửa thông tin công ty"
        description="Chứng từ lập sau khi lưu dùng thông tin mới; chứng từ đã tải không đổi. Mọi lần sửa có ghi nhật ký."
        icon={Building2}
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => draft.cancel()}>
              Hủy
            </Button>
            <Button variant="save" onClick={saveInfo} title="Lưu thông tin công ty.">
              <Save className="mr-2 h-4 w-4" aria-hidden />
              Lưu
            </Button>
          </>
        }
      >
        <DraftRestoredNotice savedAt={draft.restoredAt} onDiscard={draft.cancel} />
        {form && (
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <Field key={f.key} label={f.label} hint={f.hint} hideRequiredMark>
                <Input value={form.value[f.key]} onChange={(e) => setForm((x) => (x ? { ...x, value: { ...x.value, [f.key]: e.target.value } } : x))} />
              </Field>
            ))}
          </div>
        )}
      </FormDialog>
    </div>
  );
}
