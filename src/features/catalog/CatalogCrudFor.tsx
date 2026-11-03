// ============================================================
// Tên file: src/features/catalog/CatalogCrudFor.tsx
// Tên tiếng Việt: Bảng quản lý một danh mục dựng từ cấu hình (dùng ở màn Danh mục + tab Danh mục của Xuất khẩu)
// Description: CatalogCrud bound to a CatalogConfig and a permission resource
// ============================================================
import type { ReactNode } from "react";
import { CatalogCrud } from "@/design-system";
import { useCan } from "@/features/shared/PermissionProvider";
import type { CatalogConfig } from "./catalogConfig";

/** Dựng CatalogCrud từ một cấu hình danh mục (giữ nguyên mọi prop cũ). */
export function CatalogCrudFor<T extends { id: string }>({
  cfg,
  rowMarkKey,
  resource,
  rowActions,
  writeAction,
}: {
  cfg: CatalogConfig<T>;
  /** Nút riêng của từng dòng (VD "Tên hàng" của khách). */
  rowActions?: (row: T) => ReactNode;
  /** Khoá bảng tô màu dòng — một khoá cho mỗi tab, đừng đổi (mất dấu cũ). */
  rowMarkKey: string;
  /** Tài nguyên phân quyền của tab (catalog.*). */
  resource: string;
  /** Tài nguyên chỉ có một quyền ghi (VD `company-profile` chỉ có Sửa) ⇒ thêm / sửa / xóa cùng theo quyền này. */
  writeAction?: "update";
}) {
  const allowed = useCan(resource);
  return (
    <CatalogCrud
      canCreate={writeAction ? allowed[writeAction] : allowed.create}
      canUpdate={allowed.update}
      canDelete={writeAction ? allowed[writeAction] : allowed.delete}
      canDeleteRow={cfg.canDeleteRow}
      rowMarkKey={rowMarkKey}
      loading={cfg.loading}
      title={cfg.title}
      description={cfg.description}
      entityName={cfg.entityName}
      rows={cfg.rows}
      onChange={cfg.onChange}
      fields={cfg.fields}
      validate={cfg.validate}
      createEmpty={cfg.createEmpty}
      getSearchText={cfg.getSearchText}
      getRecordDescription={cfg.getRecordDescription}
      rowActions={rowActions}
      filters={cfg.filters}
    />
  );
}
