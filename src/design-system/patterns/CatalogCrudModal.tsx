// ============================================================
// Tên file cũ: src/design-system/patterns/CatalogCrud.tsx
// Tên tiếng Việt: Modal thêm mới danh mục tại chỗ
// Description: Quick Catalog Item CRUD Dialog
// ============================================================
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "./Field";
import { RecordTable, type RecordTableColumn } from "./RecordTable";
import { ConfirmDelete } from "./ConfirmDelete";
import { ErrorSummary, type FieldError } from "./ErrorSummary";
import { EmptyState } from "./EmptyState";
import { TableSkeleton } from "./Loading";
import { ReadOnlyBadge } from "./ReadOnlyBadge";
import { notify } from "./notify";
import { Pencil, Plus } from "lucide-react";

export interface CatalogField<T> {
  key: keyof T & string;
  label: string;
  required?: boolean;
  hint?: string;
  example?: string;
  /** Ô nhập riêng (combobox, chọn ngày…). Mặc định là ô chữ. */
  render?: (
    value: string,
    changeValue: (v: string) => void,
    isEditing: boolean
  ) => React.ReactNode;
  /** Hiện thế nào trong bảng. Mặc định in nguyên văn. */
  renderValue?: (row: T) => React.ReactNode;
  /** Ẩn cột này trên thẻ điện thoại (xem qua nút "Chi tiết") */
  hideOnMobile?: boolean;
  /** Cột phụ — ẩn khỏi BẢNG desktop cho gọn, xem qua nút "Chi tiết" cuối dòng */
  hideInTable?: boolean;
  /**
   * Nhóm trong hộp Thêm/Sửa (VD "Ghi hóa đơn", "Ngân hàng") — các trường cùng nhóm
   * đứng chung dưới một tiêu đề nhỏ. Trường liền nhau cùng nhóm mới gộp; bỏ trống ⇒
   * không tiêu đề.
   */
  group?: string;
  /**
   * Bề ngang trong lưới hộp Thêm/Sửa (2 cột từ sm; từ lg 3 cột, hoặc 4 cột khi danh
   * mục có chia `group`). Mặc định một ô; `wide` = 2 ô; `full` = trọn hàng.
   */
  span?: "wide" | "full";
}

/**
 * CatalogCrud — một khuôn cho MỌI danh mục (mặt hàng, khách hàng, đại lý,
 * loại nguyên liệu). Thêm / Sửa / Xóa / Tìm đủ bộ, cùng một cách thao tác ở
 * mọi màn — người lớn tuổi học một lần dùng được hết.
 *
 * Thêm và Sửa dùng CHUNG một hộp thoại: chỉ khác tiêu đề. Học một thao tác,
 * không phải hai.
 */
export function CatalogCrud<T extends { id: string }>({
  title,
  description,
  rows,
  onChange,
  fields,
  createEmpty,
  getSearchText,
  getRecordDescription,
  entityName,
  loading = false,
  validate,
  rowMarkKey,
  canCreate = true,
  canUpdate = true,
  canDelete = true,
  rowActions,
}: {
  title: string;
  description?: string;
  rows: T[];
  onChange: (next: T[]) => void;
  fields: CatalogField<T>[];
  /** Tạo bản ghi rỗng (kèm id). */
  createEmpty: () => T;
  /** Chuỗi dùng để tìm kiếm. */
  getSearchText: (row: T) => string;
  /** Mô tả bản ghi trong hộp xác nhận xóa. */
  getRecordDescription: (row: T) => string;
  /** Danh từ đơn vị, vd "mặt hàng" → nút "Thêm mặt hàng". */
  entityName: string;
  /** Đang tải danh sách từ máy chủ (chưa có dữ liệu local) → hiện skeleton. */
  loading?: boolean;
  /** Kiểm tra thêm (ngoài ô bắt buộc) — vd trùng mã số. Trả về danh sách lỗi. */
  validate?: (editing: T, rows: T[], isAdding: boolean) => FieldError[];
  /** Tô màu dòng "đã dò" — khoá ổn định của bảng danh mục (VD "danh-muc-khach-hang"). */
  rowMarkKey?: string;
  /** Phân quyền (spec role-permissions §5 lớp 2): không có quyền ⇒ ẨN nút (không làm mờ).
   *  Không có cả ba ⇒ nhãn "Chỉ xem". Mặc định cho phép (giữ hành vi cũ). */
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
  /**
   * Nút RIÊNG của từng dòng, đứng trước Sửa / Xóa (VD "Tên hàng" của một khách — mở danh sách
   * con). Nút phải có nhãn chữ + `title` (luật §9).
   */
  rowActions?: (row: T) => React.ReactNode;
}) {
  const [editing, setEditing] = React.useState<T | null>(null);
  const [isAdding, setIsAdding] = React.useState(false);
  const [errors, setErrors] = React.useState<FieldError[]>([]);

  const openAdd = () => {
    setEditing(createEmpty());
    setIsAdding(true);
    setErrors([]);
  };

  const openEdit = (r: T) => {
    setEditing({ ...r });
    setIsAdding(false);
    setErrors([]);
  };

  const save = () => {
    if (!editing) return;
    const ls: FieldError[] = fields
      .filter((f) => f.required && !String(editing[f.key] ?? "").trim())
      .map((f) => ({ field: f.label, message: `Chưa nhập ${f.label.toLowerCase()}` }));
    const extraErrors = validate?.(editing, rows, isAdding) ?? [];
    const allRows = [...ls, ...extraErrors];
    setErrors(allRows);
    if (allRows.length > 0) return;

    if (isAdding) {
      onChange([...rows, editing]);
      notify.saved(`Đã thêm ${entityName}`);
    } else {
      onChange(rows.map((r) => (r.id === editing.id ? editing : r)));
      notify.saved(`Đã lưu thay đổi`);
    }
    setEditing(null);
  };

  const remove = (r: T) => {
    const prevRows = rows;
    onChange(rows.filter((x) => x.id !== r.id));
    notify.deleted(`Đã xóa ${entityName}`, () => onChange(prevRows));
  };

  const cols: RecordTableColumn<T>[] = [
    ...fields.map<RecordTableColumn<T>>((f) => ({
      key: f.key,
      header: f.label,
      primary: f === fields.find((x) => x.required) || undefined,
      hideOnMobile: f.hideOnMobile,
      secondary: f.hideInTable,
      getSortValue: (r) => String(r[f.key] ?? ""),
      render: (r) =>
        f.renderValue ? (
          f.renderValue(r)
        ) : String(r[f.key] ?? "").trim() ? (
          String(r[f.key])
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    })),
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {canCreate ? (
          <Button
            size="lg"
            onClick={openAdd}
            title={`Mở hộp thoại tạo một ${entityName} mới. Lưu xong dùng được ngay ở mọi màn có ô chọn ${entityName}.`}
          >
            <Plus />
            Thêm {entityName}
          </Button>
        ) : (
          !canUpdate && !canDelete && <ReadOnlyBadge />
        )}
      </div>

      {loading ? (
        <TableSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState
          title={`Chưa có ${entityName} nào`}
          description={canCreate ? `Bấm "Thêm ${entityName}" để tạo mục đầu tiên.` : undefined}
          action={
            canCreate && <Button
              size="lg"
              onClick={openAdd}
              title={`Mở hộp thoại tạo một ${entityName} mới — mục đầu tiên của danh mục này.`}
            >
              <Plus />
              Thêm {entityName}
            </Button>
          }
        />
      ) : (
        <RecordTable
          columns={cols}
          rows={rows}
          getKey={(r) => r.id}
          getSearchText={getSearchText}
          searchLabel={`Tìm ${entityName}…`}
          rowMarkKey={rowMarkKey}
          actions={
            canUpdate || canDelete || rowActions
              ? (r) => (
                  <>
                    {rowActions?.(r)}
                    {canUpdate && (
                      <Button
                        variant="edit"
                        size="sm"
                        onClick={() => openEdit(r)}
                        title={`Sửa thông tin ${entityName} "${getRecordDescription(r)}". Sổ đã ghi trước đó giữ nguyên tên cũ — không hồi tố.`}
                      >
                        <Pencil />
                        Sửa
                      </Button>
                    )}
                    {canDelete && (
                      <ConfirmDelete
                        recordDescription={getRecordDescription(r)}
                        onConfirm={() => remove(r)}
                        title={`Xóa ${entityName} này?`}
                        confirmLabel={`Xóa ${entityName}`}
                      />
                    )}
                  </>
                )
              : undefined
          }
        />
      )}

      <CatalogEditDialog
        editing={editing}
        isAdding={isAdding}
        fields={fields}
        entityName={entityName}
        errors={errors}
        onChange={setEditing}
        onSave={save}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

/** Gom các trường LIỀN NHAU cùng `group` thành một khối (giữ thứ tự khai báo). */
function groupFields<T>(fields: CatalogField<T>[]): { group: string; items: CatalogField<T>[] }[] {
  const out: { group: string; items: CatalogField<T>[] }[] = [];
  for (const f of fields) {
    const g = f.group ?? "";
    const last = out[out.length - 1];
    if (last && last.group === g) last.items.push(f);
    else out.push({ group: g, items: [f] });
  }
  return out;
}

/**
 * Hộp thoại Thêm / Sửa MỘT bản ghi danh mục theo bộ trường `fields` — cùng một
 * dáng ở màn Danh mục (CatalogCrud) và ở hộp SỬA NHANH mở từ bút chì trong ô
 * chọn (`Combobox.onEditItem`). Kiểm tra + ghi do nơi gọi lo (`onLuu`), hộp chỉ
 * hiện `loi`.
 *
 * `khoaTruong`: hiện một trường ở dạng CHỈ ĐỌC kèm lý do (VD tên là chỗ nối với
 * sổ đã ghi nên không đổi tại chỗ được).
 */
export function CatalogEditDialog<T extends { id: string }>({
  editing,
  isAdding,
  fields,
  entityName,
  errors,
  onChange,
  onSave,
  onClose,
  description,
  lockedField,
}: {
  editing: T | null;
  isAdding: boolean;
  fields: CatalogField<T>[];
  entityName: string;
  errors: FieldError[];
  onChange: (fn: (d: T | null) => T | null) => void;
  onSave: () => void;
  onClose: () => void;
  /** Câu mô tả dưới tiêu đề. Mặc định nhắc ô dấu *. */
  description?: React.ReactNode;
  lockedField?: { key: keyof T & string; reason: string };
}) {
  return (
    <Dialog
      open={editing !== null}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-h-[92dvh] overflow-y-auto w-full sm:max-w-3xl lg:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {isAdding ? `Thêm ${entityName}` : `Sửa ${entityName}`}
          </DialogTitle>
          <DialogDescription>{description ?? "Ô có dấu * phải nhập mới lưu được."}</DialogDescription>
        </DialogHeader>

        {editing && (
          <div className="space-y-5 py-2">
            <ErrorSummary errors={errors} />
            {/* GỌN theo chiều dọc (2026-10-14): trường xếp LƯỚI 2 cột (sm) / 3 cột (lg),
                gom theo `group` dưới tiêu đề nhỏ — thay cho một cột dài phải cuộn. */}
            {(() => {
              // Danh mục chia nhóm (nhiều trường ngắn như đại lý) ⇒ 4 cột ở lg cho đỡ dài.
              const isGrouped = fields.some((f) => f.group);
              const gridClass = isGrouped
                ? "grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4"
                : "grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3";
              const spanClass = (f: CatalogField<T>) =>
                f.span === "wide"
                  ? "sm:col-span-2"
                  : f.span === "full"
                    ? isGrouped
                      ? "sm:col-span-2 lg:col-span-4"
                      : "sm:col-span-2 lg:col-span-3"
                    : undefined;
              return groupFields(fields).map(({ group, items }, gi) => (
              <section key={`${group}-${gi}`} className="space-y-3">
                {group && (
                  <h3 className="border-b border-border pb-1 text-sm font-semibold text-muted-foreground">
                    {group}
                  </h3>
                )}
                <div className={gridClass}>
                  {items.map((f) => {
                    const value = String(editing[f.key] ?? "");
                    if (lockedField?.key === f.key)
                      return (
                        <div key={f.key} className={spanClass(f)}>
                          <Field label={f.label} hint={lockedField.reason}>
                            <Input value={value} readOnly aria-readonly className="bg-muted" />
                          </Field>
                        </div>
                      );
                    const changeValue = (v: string) =>
                      onChange((d) => (d ? { ...d, [f.key]: v } : d));
                    return (
                      <div key={f.key} className={spanClass(f)}>
                        {f.render ? (
                          f.render(value, changeValue, !isAdding)
                        ) : (
                          <Field label={f.label} required={f.required} hint={f.hint}>
                            <Input
                              value={value}
                              onChange={(e) => changeValue(e.target.value)}
                              placeholder={f.example}
                            />
                          </Field>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
              ));
            })()}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="lg" onClick={onClose}>
            Hủy
          </Button>
          <Button
            variant="save"
            size="lg"
            onClick={onSave}
            title={isAdding ? `Lưu ${entityName} mới vào danh mục.` : `Lưu các thay đổi của ${entityName} này vào danh mục.`}
          >
            {isAdding ? `Thêm ${entityName}` : "Lưu thay đổi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
