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
        <Button
          size="lg"
          onClick={openAdd}
          title={`Mở hộp thoại tạo một ${entityName} mới. Lưu xong dùng được ngay ở mọi màn có ô chọn ${entityName}.`}
        >
          <Plus />
          Thêm {entityName}
        </Button>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState
          title={`Chưa có ${entityName} nào`}
          description={`Bấm "Thêm ${entityName}" để tạo mục đầu tiên.`}
          action={
            <Button
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
          actions={(r) => (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openEdit(r)}
                title={`Sửa thông tin ${entityName} "${getRecordDescription(r)}". Sổ đã ghi trước đó giữ nguyên tên cũ — không hồi tố.`}
              >
                <Pencil />
                Sửa
              </Button>
              <ConfirmDelete
                recordDescription={getRecordDescription(r)}
                onConfirm={() => remove(r)}
                title={`Xóa ${entityName} này?`}
                confirmLabel={`Xóa ${entityName}`}
              />
            </>
          )}
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
            {fields.map((f) => {
              const value = String(editing[f.key] ?? "");
              if (lockedField?.key === f.key)
                return (
                  <Field key={f.key} label={f.label} hint={lockedField.reason}>
                    <Input value={value} readOnly aria-readonly className="bg-muted" />
                  </Field>
                );
              const changeValue = (v: string) =>
                onChange((d) => (d ? { ...d, [f.key]: v } : d));
              return f.render ? (
                <div key={f.key}>{f.render(value, changeValue, !isAdding)}</div>
              ) : (
                <Field key={f.key} label={f.label} required={f.required} hint={f.hint}>
                  <Input
                    value={value}
                    onChange={(e) => changeValue(e.target.value)}
                    placeholder={f.example}
                  />
                </Field>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="lg" onClick={onClose}>
            Hủy
          </Button>
          <Button
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
