// ============================================================
// Tên file: src/lib/companyProfile.ts
// Tên tiếng Việt: Thông tin công ty — giá trị mặc định, người bán in trên chứng từ, kiểm ảnh logo
// Description: Pure helpers for the company profile (mig 0099, ba-spec 67)
// ============================================================
// Chưa có bản ghi (máy chủ chưa chạy 0099 / chưa lưu) ⇒ giá trị đang in trên invoice 236/26 (R1). Chứng từ
// lấy người bán qua `companySellerOf` — đổi thông tin ⇒ chứng từ lập SAU đó in thông tin mới (R5).
import type { CompanyProfile } from "@/types";

export const COMPANY_PROFILE_ID = "company";

export const COMPANY_DEFAULTS: CompanyProfile = {
  id: COMPANY_PROFILE_ID,
  nameVietnamese: "CÔNG TY TNHH BASEAFOOD 1",
  nameEn: "BASEAFOOD 1 COMPANY LIMITED",
  shortNameEn: "BASEAFOOD 1 CO.,LTD",
  taxCode: "3502297423",
  addressVietnamese: "321 Trần Xuân Độ, Khu phố 2, Phường Bà Rịa, TP. Hồ Chí Minh",
  addressEn: "321 Tran Xuan Do Street, Quarter 2, Ba Ria Ward, Ho Chi Minh City, Vietnam",
  issuePlace: "Ba Ria",
  phone: "84.254.3826217",
  fax: "84.254.3825545",
  email: "",
  website: "",
  signerName: "Hồ Chí Phương",
  signerTitle: "Vice Director",
  logoPath: "",
  note: "",
};

/** Bản ghi đang dùng: có bản ghi ⇒ bản ghi đó (ô trống lấy mặc định ở các ô chứng từ bắt buộc); chưa có ⇒ mặc định. */
export function effectiveCompanyProfile(rows: readonly CompanyProfile[]): CompanyProfile {
  return rows.find((r) => r.id === COMPANY_PROFILE_ID) ?? rows[0] ?? COMPANY_DEFAULTS;
}

export interface CompanySeller {
  name: string;
  address: string;
  place: string;
  signature: string;
}

const upper = (v: string) => v.trim().replace(/\s+/g, " ").toUpperCase();

/** Người bán in trên chứng từ xuất khẩu (R6): tên + địa chỉ EN viết hoa, nơi lập, viết tắt EN để ký. */
export function companySellerOf(profile: CompanyProfile | null | undefined): CompanySeller {
  const p = profile ?? COMPANY_DEFAULTS;
  return {
    name: upper(p.nameEn) || upper(COMPANY_DEFAULTS.nameEn),
    address: upper(p.addressEn) || upper(COMPANY_DEFAULTS.addressEn),
    place: p.issuePlace.trim() || COMPANY_DEFAULTS.issuePlace,
    signature: p.shortNameEn.trim() || COMPANY_DEFAULTS.shortNameEn,
  };
}

export const COMPANY_LOGO_MAX_BYTES = 5 * 1024 * 1024;
export const COMPANY_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/** Kiểm ảnh logo trước khi lưu (R3) — chỉ ảnh, không bắt điền trường nào khác. */
export function logoErrors(file: { size: number; type: string }): string[] {
  const errors: string[] = [];
  if (!(COMPANY_LOGO_TYPES as readonly string[]).includes(file.type)) errors.push("Chỉ nhận ảnh PNG, JPG hoặc WEBP.");
  if (file.size > COMPANY_LOGO_MAX_BYTES) errors.push("Ảnh lớn hơn 5 MB — thu nhỏ rồi chọn lại.");
  return errors;
}
