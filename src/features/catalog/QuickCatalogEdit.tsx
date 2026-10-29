// ============================================================
// Tên file: src/features/catalog/QuickCatalogEdit.tsx
// Tên tiếng Việt: Sửa nhanh một bản ghi danh mục ngay tại màn nghiệp vụ
// ============================================================
// Mở từ bút chì trong ô chọn (`Combobox.onEditItem`) hoặc nút cạnh ô. Dùng ĐÚNG
// bộ trường + luật kiểm tra của màn Danh mục (catalogConfig.tsx) — một nguồn.
//
// ⚠️ Ghi qua `rows` / `onChange` CỦA MÀN GỌI (đúng instance `useTable` đang mở):
// mỗi `useTable` giữ state riêng, tự gọi useCustomers() ở đây thì màn không thấy
// thay đổi và lần ghi kế tiếp của màn sẽ đè bản cũ lên.
//
// Danh mục nối với sổ đã ghi bằng TÊN (đại lý, loại NL, khách hàng, kho lưu, bột
// tẩm): ô tên CHỈ ĐỌC ở đây — đổi tên sẽ tách các dòng đã ghi khỏi danh mục.
import { useMemo, useState, type ReactNode } from "react";
import type {
  BatterType,
  Customer,
  MaterialType,
  Product,
  StorageLocation,
  Supplier,
} from "@/types";
import { useBatterTypes, useFinishedGoods, useMaterialTypes } from "@/lib/catalogRepo";
import { CatalogEditDialog, notify, type FieldError } from "@/design-system";
import type { DocumentKindOption } from "@/lib/exportPlanning";
import { useCan } from "@/features/shared/PermissionProvider";
import {
  buildCatalogConfigs,
  buildCatalogFields,
  type CatalogConfig,
  type CatalogKind,
  type CatalogSource,
} from "./catalogConfig";

export interface CatalogRecordMap {
  product: Product;
  customer: Customer;
  supplier: Supplier;
  materialType: MaterialType;
  storageLocation: StorageLocation;
  batter: BatterType;
  documentKind: DocumentKindOption;
}

/**
 * Danh mục bột tẩm CỦA MÀN GỌI — để ô "Bột đi kèm" trong hộp sửa mặt hàng thấy
 * ngay loại bột vừa tạo tại màn, và tạo mới qua đúng instance `useTable` của màn.
 */
export interface BatterSource {
  rows: BatterType[];
  create: (name: string) => string; // trả về id loại bột (mới hoặc có sẵn)
}

/** Nguồn rỗng cho các danh mục không sửa trong hộp này (chỉ để ráp cấu hình). */
const emptySource = <T,>(): CatalogSource<T> => ({ rows: [], onChange: () => {}, loading: false });

function QuickEditDialog<K extends CatalogKind>({
  catalogKind: kind,
  id,
  rows,
  onChange,
  onClose,
  onSaved,
  getDescription: description,
  batterSource,
}: {
  catalogKind: K;
  id: string;
  rows: CatalogRecordMap[K][];
  onChange: (next: CatalogRecordMap[K][]) => void;
  onClose: () => void;
  onSaved?: (updated: CatalogRecordMap[K], prev: CatalogRecordMap[K]) => void;
  getDescription?: (r: CatalogRecordMap[K]) => ReactNode;
  batterSource?: BatterSource;
}) {
  type T = CatalogRecordMap[K];
  // Chỉ ĐỌC để dựng ô chọn trong form mặt hàng — không ghi qua các instance này.
  const [materialTypes] = useMaterialTypes();
  const [finishedGoods] = useFinishedGoods();
  const [batterTypesRead] = useBatterTypes();
  const batterTypes = batterSource?.rows ?? batterTypesRead;
  const addBatter = batterSource?.create;
  const cfg = useMemo(() => {
    // KHÔNG truyền `themLoaiNL`: danh mục loại NL ở đây chỉ là bản ĐỌC (không phải
    // instance của màn gọi) — ghi qua nó thì màn không thấy và lần ghi kế tiếp của
    // màn sẽ đè mất loại vừa tạo. Ô "Loại nguyên liệu" trong hộp sửa nhanh mặt hàng
    // vì vậy chỉ cho CHỌN; thêm loại mới ở ô loại NL của màn hoặc tab Danh mục.
    const fields = buildCatalogFields(materialTypes, finishedGoods, batterTypes, addBatter);
    const configs = buildCatalogConfigs(fields, {
      product: emptySource(),
      customer: emptySource(),
      supplier: emptySource(),
      materialType: emptySource(),
      storageLocation: emptySource(),
      batter: emptySource(),
      documentKind: emptySource(),
    });
    return configs[kind] as unknown as CatalogConfig<T>;
  }, [kind, materialTypes, finishedGoods, batterTypes, addBatter]);

  const original = rows.find((r) => r.id === id);
  const [editing, setEditing] = useState<T | null>(original ? { ...original } : null);
  const [errors, setErrors] = useState<FieldError[]>([]);
  if (!original) return null;

  const save = () => {
    if (!editing) return;
    const ls: FieldError[] = [
      ...cfg.fields
        .filter((f) => f.required && !String(editing[f.key] ?? "").trim())
        .map((f) => ({ field: f.label, message: `Chưa nhập ${f.label.toLowerCase()}` })),
      ...(cfg.validate?.(editing, rows, false) ?? []),
    ];
    setErrors(ls);
    if (ls.length) return;
    onChange(rows.map((r) => (r.id === editing.id ? editing : r)));
    notify.saved(`Đã lưu ${cfg.entityName} "${cfg.getRecordDescription(editing)}"`);
    onSaved?.(editing, original);
    onClose();
  };

  return (
    <CatalogEditDialog<T>
      editing={editing}
      isAdding={false}
      fields={cfg.fields}
      entityName={cfg.entityName}
      errors={errors}
      onChange={setEditing}
      onSave={save}
      onClose={onClose}
      description={
        description?.(original) ??
        `Sửa ở đây là sửa trong Danh mục — áp cho mọi màn dùng ${cfg.entityName} này.`
      }
      lockedField={
        cfg.linkedByName
          ? {
              key: cfg.nameField,
              reason: "Tên là chỗ nối với sổ đã ghi nên không đổi tại chỗ được (đổi tên sẽ tách các dòng cũ khỏi danh mục). Các thông tin khác sửa bình thường.",
            }
          : undefined
      }
    />
  );
}

/**
 * Bật sửa nhanh một danh mục ở màn nghiệp vụ:
 *
 *   const editor = useQuickCatalogEdit("customer", customers, setCustomers, { matchBy: "name" });
 *   <Combobox … onEditItem={editor.openEdit} canEdit={editor.canEdit} editLabel={editor.editLabel} />
 *   {editor.dialog}
 *
 * `theo`: value trong ô chọn là `id` (mặc định) hay TÊN bản ghi.
 */
/** Loại danh mục ⇄ tài nguyên phân quyền (lib/permissions.ts). */
const KIND_RESOURCE: Record<CatalogKind, string> = {
  product: "catalog.products",
  customer: "catalog.customers",
  supplier: "catalog.suppliers",
  materialType: "catalog.material-types",
  storageLocation: "catalog.storage-locations",
  batter: "catalog.batters",
  // Loại chứng từ thuộc khu Xuất khẩu (mig 0081, RLS theo export-plans) — không có tab quyền riêng.
  documentKind: "export-plans",
};

/**
 * Phân quyền (spec role-permissions §5 lớp 2): bút chì chỉ hiện khi có quyền SỬA tab
 * danh mục đó (`canEdit` trả false ⇒ Combobox ẩn bút chì); `canCreate` để màn gọi
 * truyền `onCreate={editor.canCreate ? addX : undefined}` (không quyền ⇒ ô chỉ chọn).
 */
export function useQuickCatalogEdit<K extends CatalogKind>(
  catalogKind: K,
  rows: CatalogRecordMap[K][],
  onChange: (next: CatalogRecordMap[K][]) => void,
  opts: {
    matchBy?: "id" | "name";
    onSaved?: (updated: CatalogRecordMap[K], prev: CatalogRecordMap[K]) => void;
    getDescription?: (r: CatalogRecordMap[K]) => ReactNode;
    /** Hộp sửa MẶT HÀNG: danh mục bột của màn (thấy + tạo loại bột tại chỗ). */
    batterSource?: BatterSource;
  } = {}
) {
  const [id, setId] = useState<string | null>(null);
  const allowed = useCan(KIND_RESOURCE[catalogKind]);
  const KIND_NAMES: Record<CatalogKind, string> = {
    product: "mặt hàng",
    customer: "khách hàng",
    supplier: "đại lý",
    materialType: "loại nguyên liệu",
    storageLocation: "kho lưu trữ",
    batter: "loại bột",
    documentKind: "loại chứng từ",
  };

  const openEdit = (value: string) => {
    if (!value) return;
    const r =
      opts.matchBy === "name"
        ? rows.find((x) => nameOf(catalogKind, x).trim() === value.trim())
        : rows.find((x) => x.id === value);
    if (r) setId(r.id);
    else notify.warning(`Không tìm thấy ${KIND_NAMES[catalogKind]} này trong danh mục.`);
  };

  const dialog = id ? (
    <QuickEditDialog
      key={id}
      catalogKind={catalogKind}
      id={id}
      rows={rows}
      onChange={onChange}
      onClose={() => setId(null)}
      onSaved={opts.onSaved}
      getDescription={opts.getDescription}
      batterSource={opts.batterSource}
    />
  ) : null;

  /** Value này có bản ghi trong danh mục không — truyền vào `Combobox.canEdit`. */
  const isEditable = (value: string) =>
    allowed.update &&
    (opts.matchBy === "name"
      ? rows.some((x) => nameOf(catalogKind, x).trim() === value.trim())
      : rows.some((x) => x.id === value));

  return {
    openEdit,
    canEdit: isEditable,
    /** Có quyền THÊM vào danh mục này — để bật/tắt "Tạo mới tại chỗ" (`onCreate`). */
    canCreate: allowed.create,
    dialog,
    editLabel: `Sửa thông tin ${KIND_NAMES[catalogKind]} này — lưu thẳng vào Danh mục.`,
  };
}

function nameOf(catalogKind: CatalogKind, r: CatalogRecordMap[CatalogKind]): string {
  return catalogKind === "supplier" ? (r as Supplier).shortName : (r as { name: string }).name;
}
