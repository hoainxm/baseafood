// ============================================================
// Tên file: src/features/catalog/catalogConfig.tsx
// Tên tiếng Việt: Cấu hình 5 danh mục (trường, kiểm tra, bản ghi rỗng) — MỘT nguồn
// Dùng chung cho màn Danh mục (CatalogCrud) và hộp SỬA NHANH ở các màn nghiệp vụ
// (bút chì trong ô chọn — xem QuickCatalogEdit.tsx). Tách khỏi CatalogScreen.tsx
// ngày 2026-10-02, KHÔNG đổi trường / luật kiểm tra của màn Danh mục.
// 2026-10-06: thêm danh mục thứ 6 "Bột tẩm" (batter_types, mig 0051) + trường
// "Bột đi kèm" của mặt hàng.
// ============================================================
import { useMemo } from "react";
import { hasExportStorage } from "@/lib/exportFileStorage";
import type {
  BatterType,
  FinishedGood,
  Supplier,
  Customer,
  MaterialType,
  Product,
  StorageLocation,
  ImportSupplier,
  GoodsType,
} from "@/types";
import { CATEGORIES, PROCESSING_TYPES, STORAGE_KIND_LABELS, hasSplitComponents, blockSpec } from "@/types";
import { newId as uid } from "@/lib/store";
import { num } from "@/lib/format";
import { findOrCreateBatter, getProductBatterNames } from "@/lib/batter";
import {
  useBatterTypes,
  useSuppliers,
  useCustomers,
  useMaterialTypes,
  useProducts,
  useFinishedGoods,
  useStorageLocations,
  useExportDocumentKindStore,
  useGoodsTypeStore,
  useImportContracts,
  useImportSupplierStore,
} from "@/lib/catalogRepo";
import { canDeleteImportSupplier, emptyImportSupplier } from "@/lib/importPlanning";
import { documentKindList, documentKindRowsFromList, type DocumentKindOption } from "@/lib/exportPlanning";
import { sortGoodsTypes } from "@/lib/goodsTypes";
import {
  ChoiceGroup,
  Combobox,
  NumberField,
  notify,
  type FieldError,
  type CatalogField,
} from "@/design-system";
import { BatterPicker } from "./BatterPicker";

const MARKETS = ["Nhật", "EU", "Mỹ", "Hàn Quốc", "Trung Quốc", "Nội địa"];

export type CatalogKind = "product" | "customer" | "supplier" | "importSupplier" | "materialType" | "storageLocation" | "batter" | "documentKind" | "goodsType";

/** Đủ thứ để dựng màn CRUD một danh mục HOẶC hộp sửa nhanh một bản ghi. */
export interface CatalogConfig<T extends { id: string }> {
  title: string;
  description: string;
  entityName: string;
  rows: T[];
  onChange: (next: T[]) => void;
  fields: CatalogField<T>[];
  createEmpty: () => T;
  getSearchText: (r: T) => string;
  getRecordDescription: (r: T) => string;
  validate?: (editing: T, rows: T[], isAdding: boolean) => FieldError[];
  loading: boolean;
  /** Trường TÊN của bản ghi. */
  nameField: keyof T & string;
  /**
   * Sổ đã ghi nối với danh mục này bằng TÊN (không phải id) — đổi tên ở đây
   * KHÔNG đổi các dòng đã ghi. Hộp sửa nhanh khoá ô tên của loại này.
   * matHang nối bằng id ⇒ false.
   */
  linkedByName: boolean;
  /** Dòng này xóa được không (bỏ trống = mọi dòng). Không xóa được ⇒ bảng ẩn nút Xóa của dòng. */
  canDeleteRow?: (r: T) => boolean;
}

export interface CatalogConfigSet {
  product: CatalogConfig<Product>;
  customer: CatalogConfig<Customer>;
  supplier: CatalogConfig<Supplier>;
  /** NCC nhập khẩu (mig 0083) — danh mục riêng của Phòng Kế hoạch, khác Đại lý. */
  importSupplier: CatalogConfig<ImportSupplier>;
  materialType: CatalogConfig<MaterialType>;
  storageLocation: CatalogConfig<StorageLocation>;
  batter: CatalogConfig<BatterType>;
  /** Loại chứng từ xuất khẩu (mig 0081) — hàng = 10 loại hệ thống (đổi tên được) + loại tự thêm. */
  documentKind: CatalogConfig<DocumentKindOption>;
  goodsType: CatalogConfig<GoodsType>;
}

/** Cảnh báo khi mã số trùng với bản ghi khác (khách hàng / đại lý). Mã trống thì bỏ qua. */
export function checkDuplicateCode<T extends { id: string; code: string }>(
  editing: T,
  rows: T[],
  entityLabel: string
): FieldError[] {
  const code = (editing.code ?? "").trim();
  if (!code) return [];
  const isDuplicate = rows.some((r) => r.id !== editing.id && (r.code ?? "").trim() === code);
  return isDuplicate
    ? [
        {
          field: "Mã số",
          message: `Mã số "${code}" đã dùng cho ${entityLabel} khác — đổi số khác hoặc để trống.`,
        },
      ]
    : [];
}

/** Trùng TÊN (không phân hoa thường) với bản ghi khác — chỉ xét khi tên mới / vừa đổi. */
function checkDuplicateName<T extends { id: string }>(
  editing: T,
  rows: T[],
  field: keyof T & string,
  label: string,
  entityLabel: string
): FieldError[] {
  const name = String(editing[field] ?? "").trim().toLowerCase();
  if (!name) return [];
  const prev = rows.find((r) => r.id === editing.id);
  if (prev && String(prev[field] ?? "").trim().toLowerCase() === name) return []; // không đổi tên
  return rows.some((r) => r.id !== editing.id && String(r[field] ?? "").trim().toLowerCase() === name)
    ? [
        {
          field: label,
          message: `Đã có ${entityLabel} khác tên "${String(editing[field]).trim()}" — chọn ${entityLabel} đó thay vì đặt trùng tên.`,
        },
      ]
    : [];
}

/**
 * Bộ trường của 6 danh mục — hàm THUẦN (không hook): cần danh sách loại NL,
 * 141 mã TK 1551 và loại bột tẩm để dựng ô chọn trong form mặt hàng.
 * `themBot` có ⇒ ô "Bột đi kèm" cho tạo loại bột mới tại chỗ (trả về id).
 * `themLoaiNL` có ⇒ ô "Loại nguyên liệu" cho tạo loại NL mới tại chỗ (trả về id).
 * Cả hai PHẢI ghi qua đúng instance `useTable` của màn đang mở — không có thì ô
 * chỉ cho chọn (VD hộp sửa nhanh ở màn nghiệp vụ không nắm danh mục loại NL).
 */
export function buildCatalogFields(
  materialTypes: MaterialType[],
  finishedGoods: FinishedGood[],
  batterTypes: BatterType[] = [],
  addBatter?: (name: string) => string,
  addMaterialType?: (name: string) => string
) {
  const optTP141 = finishedGoods.map((t) => ({
    value: t.code,
    label: t.name,
    subLabel: `Mã ${t.code} · ${t.groupName}`,
  }));

  const productFields: CatalogField<Product>[] = [
    {
      key: "name",
      label: "Tên mặt hàng",
      required: true,
      example: "VD: 2 da cắt luộc 1000-1300",
    },
    {
      key: "tradeName",
      label: "Tên tiếng Anh mặc định",
      hideInTable: true,
      example: "VD: Frozen boiled octopus — dùng khi khách chưa có tên riêng (Tên hàng ở danh mục Khách hàng)",
    },
    {
      key: "materialTypeId",
      hideInTable: true,
      label: "Loại nguyên liệu",
      render: (value, changeValue) => (
        <Combobox
          label="Loại nguyên liệu"
          hint="Thành phẩm này thuộc loại NL nào (VD Bạch tuộc 2 da) — để lọc khi ghi sản lượng."
          value={value}
          onChange={changeValue}
          options={materialTypes.map((l) => ({
            value: l.id,
            label: l.name,
            subLabel: l.category || undefined,
          }))}
          onCreate={addMaterialType}
          placeholder="— Chọn loại nguyên liệu —"
          emptyText={
            addMaterialType
              ? "Chưa có loại NL — gõ tên rồi bấm Thêm mới."
              : "Chưa có loại NL — thêm ở tab Loại nguyên liệu."
          }
        />
      ),
      renderValue: (r) =>
        materialTypes.find((l) => l.id === r.materialTypeId)?.name || (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "category",
      label: "Loài",
      render: (value, changeValue) => (
        <Combobox
          label="Loài"
          hint="Bạch tuộc, Mực, Cá… Đây là cấp gom nhóm khi ghi thành phẩm."
          value={value}
          onChange={changeValue}
          options={CATEGORIES.map((l) => ({ value: l, label: l }))}
          onCreate={(t) => t}
          placeholder="— Chọn loài —"
        />
      ),
      hideOnMobile: true,
    },
    {
      key: "processingType",
      label: "Kiểu chế biến",
      render: (value, changeValue) => (
        <Combobox
          label="Kiểu chế biến"
          hint="Luộc, chần, cắt, tẩm bột… Chưa có thì gõ rồi Thêm mới."
          value={value}
          onChange={changeValue}
          options={PROCESSING_TYPES.map((k) => ({ value: k, label: k }))}
          onCreate={(t) => t}
          placeholder="— Chọn kiểu chế biến —"
        />
      ),
      renderValue: (r) =>
        r.processingType || <span className="text-muted-foreground">—</span>,
      hideOnMobile: true,
    },
    {
      key: "batterIds",
      label: "Bột đi kèm",
      render: (value, changeValue) => (
        <BatterPicker
          value={value}
          onChange={changeValue}
          batterTypes={batterTypes}
          onCreateBatter={addBatter}
        />
      ),
      renderValue: (r) => {
        const name = getProductBatterNames(r, batterTypes);
        return name.length > 0 ? (
          name.join(" + ")
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
      hideOnMobile: true,
    },
    {
      key: "splitComponents",
      hideInTable: true,
      label: "Tách râu + bao tử",
      render: (value, changeValue) => {
        const on = value === "1" || value === "true";
        return (
          <ChoiceGroup
            label="Tách râu + bao tử (cùng giá)"
            hint="Bật nếu mã này khi làm ra tách 2 thành phần râu + bao tử cùng 1 giá — màn ghi thành phẩm sẽ hiện ô tách. Mã thường để 'Không tách'."
            value={on ? "1" : "0"}
            onChange={(v) => changeValue(v === "1" ? "1" : "")}
            options={[
              { value: "1", label: "Có tách" },
              { value: "0", label: "Không tách" },
            ]}
            columns={2}
          />
        );
      },
      renderValue: (r) =>
        hasSplitComponents(r) ? (
          "Có tách"
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      hideOnMobile: true,
    },
    {
      key: "blockSpecKg",
      hideInTable: true,
      label: "Quy cách block (kg/khối)",
      render: (value, changeValue) => (
        <NumberField
          label="Quy cách mỗi block"
          unit="kg"
          hint="Kg mỗi khối khi đóng gói (VD 2, 5). Để trống nếu không cố định — màn ghi tính kg gợi ý = số block × quy cách."
          value={Number(value) > 0 ? Number(value) : null}
          onChange={(v) => changeValue(v == null ? "" : String(v))}
        />
      ),
      renderValue: (r) => {
        const q = blockSpec(r);
        return q ? (
          `${num(q)} kg/khối`
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
      hideOnMobile: true,
    },
    {
      key: "code",
      hideInTable: true,
      label: "Mã số",
      hideOnMobile: true,
      hint: "Nhập số để gọi nhanh. Gõ số này khi chọn mặt hàng là ra tên.",
      example: "VD: 12",
    },
    {
      key: "finishedGoodCode",
      label: "Mã thành phẩm (danh mục kế toán)",
      hideOnMobile: false,
      render: (value, changeValue) => (
        <Combobox
          label="Mã thành phẩm (danh mục kế toán)"
          hint={`Gõ tên hoặc mã để tìm trong ${finishedGoods.length} mã. Bỏ trống nếu chưa ánh xạ.`}
          value={value}
          onChange={changeValue}
          options={optTP141}
          placeholder="— Chưa ánh xạ —"
          emptyText="Không có mã nào khớp."
        />
      ),
      renderValue: (r) =>
        r.finishedGoodCode ? (
          <span className="tnum">{r.finishedGoodCode}</span>
        ) : (
          <span className="text-muted-foreground">Chưa ánh xạ</span>
        ),
    },
  ];

  const customerFields: CatalogField<Customer>[] = [
    { key: "name", label: "Tên khách hàng", required: true, example: "VD: Lucky" },
    {
      key: "code",
      label: "Mã số",
      hint: "Nhập số để gọi nhanh (VD: 1 = Hanwha). Gõ số này ở màn Bán hàng là ra tên.",
      example: "VD: 1",
    },
    {
      key: "market",
      label: "Thị trường",
      render: (value, changeValue) => (
        <Combobox
          label="Thị trường"
          hint="Chọn trong danh sách, hoặc gõ tên mới rồi bấm Thêm mới."
          value={value}
          onChange={changeValue}
          options={MARKETS.map((t) => ({ value: t, label: t }))}
          onCreate={(name) => name}
          placeholder="— Chọn thị trường —"
        />
      ),
    },
    // Thông tin xuất khẩu (mig 0075) — Phòng Kế hoạch dùng khi lập hợp đồng (điền sẵn cảng đích).
    { key: "country", group: "Xuất khẩu", label: "Quốc gia", hideInTable: true, example: "VD: Nhật Bản" },
    { key: "defaultPort", group: "Xuất khẩu", label: "Cảng đích mặc định", hideInTable: true, example: "VD: Tokyo" },
    { key: "paymentTerms", group: "Xuất khẩu", label: "Điều kiện thanh toán", hideInTable: true, example: "VD: TTR 100% sau chứng từ" },
    { key: "address", group: "Xuất khẩu", label: "Địa chỉ", hideInTable: true, span: "wide", example: "VD: 2-9-5 Irifune, Chuo-ku, Tokyo" },
    { key: "contactName", group: "Xuất khẩu", label: "Người liên hệ", hideInTable: true },
    { key: "contactEmail", group: "Xuất khẩu", label: "Email liên hệ", hideInTable: true },
  ];

  // Thứ tự = thứ tự trong hộp Thêm/Sửa: chia NHÓM, lưới nhiều cột (gọn chiều dọc).
  const supplierFields: CatalogField<Supplier>[] = [
    // Hàng 1 — gọi tên + liên hệ
    { key: "shortName", group: "Đại lý", label: "Tên đại lý (gọi tắt)", required: true, example: "VD: Hồng Phú" },
    {
      key: "code",
      group: "Đại lý",
      hideInTable: true,
      label: "Mã số gọi nhanh",
      hideOnMobile: true,
      example: "VD: 1 — gõ ở Nhập hàng ra tên",
    },
    { key: "phone", group: "Đại lý", label: "Điện thoại", hideOnMobile: true, example: "VD: 0913 xxx xxx" },
    { key: "email", group: "Đại lý", hideInTable: true, label: "Email", hideOnMobile: true, example: "VD: tenmien@gmail.com" },
    // Hàng 2–3 — thông tin ghi trên hóa đơn / phiếu
    {
      key: "billingName",
      group: "Ghi hóa đơn",
      span: "wide",
      label: "Tên ghi phiếu (đầy đủ)",
      example: "VD: Công ty TNHH TM Hồng Phú",
    },
    { key: "nationalId", group: "Ghi hóa đơn", label: "MST / CCCD", hideOnMobile: true, example: "VD: 3500424848" },
    {
      key: "issuedDate",
      group: "Ghi hóa đơn",
      hideInTable: true,
      label: "Ngày cấp CCCD",
      hideOnMobile: true,
      example: "VD: 12/05/2015",
    },
    {
      key: "address",
      group: "Ghi hóa đơn",
      span: "wide",
      hideInTable: true,
      label: "Địa chỉ",
      hideOnMobile: true,
      example: "Số nhà, đường, phường, tỉnh",
    },
    {
      key: "issuedPlace",
      group: "Ghi hóa đơn",
      span: "wide",
      hideInTable: true,
      label: "Nơi cấp CCCD",
      hideOnMobile: true,
      example: "VD: CA Bà Rịa - Vũng Tàu",
    },
    // Hàng 4 — chuyển khoản
    { key: "bankAccount", group: "Chuyển khoản", hideInTable: true, label: "Số tài khoản", hideOnMobile: true, example: "VD: 1914845758" },
    { key: "bankName", group: "Chuyển khoản", hideInTable: true, label: "Ngân hàng", hideOnMobile: true, example: "VD: VPBank" },
    { key: "bankBranch", group: "Chuyển khoản", span: "wide", hideInTable: true, label: "Chi nhánh", hideOnMobile: true, example: "VD: CN Kiên Giang" },
    // Hàng 5
    {
      key: "note",
      span: "full",
      hideInTable: true,
      label: "Ghi chú",
      hideOnMobile: true,
      example: "Tài khoản phụ, tên gọi khác, xe hay chở…",
    },
  ];

  const materialTypeFields: CatalogField<MaterialType>[] = [
    {
      key: "name",
      label: "Tên loại nguyên liệu",
      required: true,
      example: "VD: 2 da nguyên liệu",
    },
    {
      key: "category",
      label: "Loài",
      render: (value, changeValue) => (
        <Combobox
          label="Loài"
          hint="Bạch tuộc, Mực, Cá…"
          value={value}
          onChange={changeValue}
          options={CATEGORIES.map((l) => ({ value: l, label: l }))}
          placeholder="— Chọn loài —"
        />
      ),
    },
    { key: "note", label: "Ghi chú", hideOnMobile: true, example: "Ghi chú thêm" },
  ];

  const storageLocationFields: CatalogField<StorageLocation>[] = [
    { key: "code", label: "Mã số", example: "VD: KHP" },
    {
      key: "name",
      label: "Tên kho",
      required: true,
      example: "VD: Kho Hồng Phú",
      hint: "Tên này là chỗ nối dữ liệu — đổi tên ở đây KHÔNG tự đổi các dòng đã gán.",
    },
    {
      key: "kind",
      label: "Loại kho",
      render: (value, changeValue) => (
        <Combobox
          label="Loại kho"
          hint="Kho nhà = kho của xí nghiệp; kho thuê ngoài = kho lạnh gửi hàng."
          value={value || "internal"}
          onChange={changeValue}
          clearable={false}
          options={(Object.keys(STORAGE_KIND_LABELS) as (keyof typeof STORAGE_KIND_LABELS)[]).map(
            (k) => ({ value: k, label: STORAGE_KIND_LABELS[k] })
          )}
        />
      ),
      renderValue: (r) => STORAGE_KIND_LABELS[r.kind] ?? r.kind,
    },
    { key: "address", label: "Địa chỉ", hideOnMobile: true, example: "VD: Hồng Phú, Bà Rịa" },
    { key: "phone", hideInTable: true, label: "Điện thoại", hideOnMobile: true, example: "VD: 0254 123 456" },
    { key: "note", hideInTable: true, label: "Ghi chú", hideOnMobile: true, example: "Ghi chú thêm" },
  ];

  const batterFields: CatalogField<BatterType>[] = [
    {
      key: "name",
      label: "Tên loại bột",
      required: true,
      example: "VD: Bột 24V",
      hint: "Tên này là chỗ nối với sổ sản lượng — đổi tên ở đây KHÔNG tự đổi các dòng đã ghi.",
    },
    {
      key: "code",
      label: "Mã số",
      hint: "Mã in trên bao bột để gọi nhanh. Gõ mã này khi chọn bột là ra tên.",
      example: "VD: 24V",
    },
    { key: "note", label: "Ghi chú", hideOnMobile: true, example: "VD: Bột tẩm nước tương" },
  ];

  // NCC nhập khẩu (ba-spec 45 v2 R16) — "thừa hơn thiếu": chỉ tên gọi tắt bắt buộc.
  const importSupplierFields: CatalogField<ImportSupplier>[] = [
    { key: "shortName", group: "Thông tin chung", label: "Tên gọi tắt", required: true, example: "VD: Pacific Marine" },
    { key: "code", group: "Thông tin chung", label: "Mã", hideOnMobile: true, example: "VD: NK01" },
    { key: "fullName", group: "Thông tin chung", span: "wide", hideInTable: true, label: "Tên đầy đủ (như trên hợp đồng)", example: "VD: Pacific Marine Co., Ltd." },
    { key: "country", group: "Thông tin chung", label: "Quốc gia", example: "VD: Nhật Bản" },
    { key: "address", group: "Thông tin chung", span: "wide", hideInTable: true, label: "Địa chỉ", hideOnMobile: true, example: "Số nhà, đường, thành phố, nước" },
    { key: "taxId", group: "Thông tin chung", hideInTable: true, label: "Mã số thuế / số đăng ký", hideOnMobile: true, example: "VD: 0104-01-123456" },
    { key: "mainProducts", group: "Thông tin chung", hideInTable: true, label: "Mặt hàng chính", hideOnMobile: true, example: "VD: Bạch tuộc nguyên con đông lạnh" },
    { key: "loadingPort", group: "Thông tin chung", hideInTable: true, label: "Cảng xếp thường dùng", hideOnMobile: true, example: "VD: Tokyo, Nhật Bản" },
    { key: "contactName", group: "Liên hệ", label: "Người liên hệ", hideOnMobile: true, example: "VD: Mr. Tanaka" },
    { key: "contactTitle", group: "Liên hệ", hideInTable: true, label: "Chức vụ", hideOnMobile: true, example: "VD: Sales Manager" },
    { key: "email", group: "Liên hệ", hideInTable: true, label: "Email", hideOnMobile: true, example: "VD: sales@pacificmarine.jp" },
    { key: "phone", group: "Liên hệ", hideInTable: true, label: "Điện thoại", hideOnMobile: true, example: "VD: +81 3 1234 5678" },
    { key: "website", group: "Liên hệ", hideInTable: true, label: "Website", hideOnMobile: true, example: "VD: pacificmarine.jp" },
    { key: "bankName", group: "Ngân hàng thụ hưởng", hideInTable: true, label: "Ngân hàng", hideOnMobile: true, example: "VD: MUFG Bank" },
    { key: "bankAccount", group: "Ngân hàng thụ hưởng", hideInTable: true, label: "Số tài khoản", hideOnMobile: true, example: "VD: 1234567" },
    { key: "swiftCode", group: "Ngân hàng thụ hưởng", hideInTable: true, label: "Mã SWIFT", hideOnMobile: true, example: "VD: BOTKJPJT" },
    { key: "bankAddress", group: "Ngân hàng thụ hưởng", span: "wide", hideInTable: true, label: "Địa chỉ ngân hàng", hideOnMobile: true, example: "VD: Chiyoda-ku, Tokyo" },
    {
      key: "status",
      group: "Khác",
      label: "Trạng thái",
      render: (value, changeValue) => (
        <ChoiceGroup
          label="Trạng thái"
          hint="Ngừng giao dịch: không chọn được cho hợp đồng nhập mới, hợp đồng cũ giữ nguyên tên."
          value={value || "active"}
          onChange={changeValue}
          options={[
            { value: "active", label: "Đang giao dịch" },
            { value: "inactive", label: "Ngừng giao dịch" },
          ]}
        />
      ),
      renderValue: (r) => (r.status === "inactive" ? "Ngừng giao dịch" : "Đang giao dịch"),
    },
    { key: "note", group: "Khác", span: "wide", hideInTable: true, label: "Ghi chú", hideOnMobile: true, example: "VD: Bên thuê gia công" },
  ];

  const documentKindFields: CatalogField<DocumentKindOption>[] = [
    {
      key: "name",
      label: "Tên loại chứng từ",
      required: true,
      example: "VD: Giấy chứng nhận Halal",
      hint: "Tên hiện ở ô chọn Loại chứng từ (hợp đồng, bước 5 của chuyến). Chứng từ đã ghi nối theo mã nên đổi tên không tách sổ.",
    },
    { key: "note", label: "Ghi chú", hideOnMobile: true, example: "VD: Khách Malaysia yêu cầu từ 2026" },
  ];

  const goodsTypeFields: CatalogField<GoodsType>[] = [
    {
      key: "name",
      label: "Tên loại hàng",
      required: true,
      example: "VD: 1 da · Cá khô · Cá gia công",
      hint: "Tên hiện ở ô Loại hàng của dòng hàng hợp đồng xuất / nhập và ở cột Loại hàng khi xuất Excel. Dòng đã chọn nối theo mã nên đổi tên không tách sổ.",
    },
    { key: "note", label: "Ghi chú", hideOnMobile: true, example: "VD: Bạch tuộc nguyên con còn da" },
  ];

  return {
    product: productFields,
    customer: customerFields,
    supplier: supplierFields,
    importSupplier: importSupplierFields,
    materialType: materialTypeFields,
    storageLocation: storageLocationFields,
    batter: batterFields,
    documentKind: documentKindFields,
    goodsType: goodsTypeFields,
  };
}

const EXPORT_CUSTOMER_KEYS = new Set<string>(["country", "address", "defaultPort", "paymentTerms", "contactName", "contactEmail"]);
const hasExportCustomerColumns = (rows: readonly Customer[]) => !hasExportStorage || rows.some((r) => r.country !== undefined);
/** Mig 0076: máy chủ chưa có cột `products.trade_name` ⇒ ẩn ô Tên tiếng Anh mặc định, khỏi gửi cột chưa có (kẹt hàng chờ). */
const hasTradeNameColumn = (rows: readonly Product[]) => !hasExportStorage || rows.some((r) => r.tradeName !== undefined);

/** Nguồn dữ liệu của một danh mục — PHẢI là đúng instance `useTable` của màn đang mở. */
export interface CatalogSource<T> {
  rows: T[];
  onChange: (next: T[]) => void;
  loading: boolean;
}

/** Ráp cấu hình đầy đủ từ bộ trường + nguồn dữ liệu của từng danh mục. */
export function buildCatalogConfigs(
  fields: ReturnType<typeof buildCatalogFields>,
  n: {
    product: CatalogSource<Product>;
    customer: CatalogSource<Customer>;
    supplier: CatalogSource<Supplier>;
    importSupplier: CatalogSource<ImportSupplier> & { canDeleteRow?: (r: ImportSupplier) => boolean };
    materialType: CatalogSource<MaterialType>;
    storageLocation: CatalogSource<StorageLocation>;
    batter: CatalogSource<BatterType>;
    documentKind: CatalogSource<DocumentKindOption>;
    goodsType: CatalogSource<GoodsType>;
  }
): CatalogConfigSet {
  return {
    product: {
      title: "Mặt hàng",
      description: "Mặt hàng của xưởng — dùng khi ghi sản xuất, đóng gói, bán hàng, cân đối và nối dòng hàng hợp đồng xuất khẩu.",
      entityName: "mặt hàng",
      rows: n.product.rows,
      onChange: n.product.onChange,
      fields: hasTradeNameColumn(n.product.rows) ? fields.product : fields.product.filter((f) => f.key !== "tradeName"),
      loading: n.product.loading,
      validate: (editing, rows) => [
        ...checkDuplicateCode(editing, rows, "mặt hàng"),
        ...checkDuplicateName(editing, rows, "name", "Tên mặt hàng", "mặt hàng"),
      ],
      createEmpty: () => ({
        id: uid(),
        code: "",
        name: "",
        finishedGoodCode: "",
        category: "",
        materialTypeId: "",
        processingType: "",
        splitComponents: false,
        blockSpecKg: null,
        batterIds: [],
        ...(hasTradeNameColumn(n.product.rows) ? { tradeName: "" } : {}),
      }),
      getSearchText: (r) => `${r.code} ${r.name} ${r.finishedGoodCode} ${r.tradeName ?? ""}`,
      getRecordDescription: (r) => `${r.name}${r.code ? ` (mã ${r.code})` : ""}`,
      nameField: "name",
      linkedByName: false,
    },
    customer: {
      title: "Khách hàng",
      description: "Khách mua thành phẩm (đầu ra) — khác với đại lý cung cấp nguyên liệu.",
      entityName: "khách hàng",
      rows: n.customer.rows,
      onChange: n.customer.onChange,
      // Máy chủ chưa chạy 0075 (đọc khách không thấy cột xuất khẩu) ⇒ ẩn 6 ô xuất khẩu, khỏi gửi
      // cột chưa có làm kẹt hàng chờ. Chạy chỉ-máy-này thì luôn hiện.
      fields: hasExportCustomerColumns(n.customer.rows) ? fields.customer : fields.customer.filter((f) => !EXPORT_CUSTOMER_KEYS.has(f.key)),
      loading: n.customer.loading,
      validate: (editing, rows) => checkDuplicateCode(editing, rows, "khách hàng"),
      createEmpty: () => ({ id: uid(), code: "", name: "", market: "" }),
      getSearchText: (r) => `${r.code} ${r.name} ${r.market}`,
      getRecordDescription: (r) => `${r.name}${r.market ? ` — thị trường ${r.market}` : ""}`,
      nameField: "name",
      // Bán hàng/đơn đặt nối theo id, nhưng sản lượng /wip lưu customerName.
      linkedByName: true,
    },
    supplier: {
      title: "Đại lý cung cấp nguyên liệu",
      description: "Nơi giao hàng về xưởng — dùng khi ghi chuyến nguyên liệu hàng ngày.",
      entityName: "đại lý",
      rows: n.supplier.rows,
      onChange: n.supplier.onChange,
      fields: fields.supplier,
      loading: n.supplier.loading,
      validate: (editing, rows) => checkDuplicateCode(editing, rows, "đại lý"),
      createEmpty: () => ({
        id: uid(),
        code: "",
        shortName: "",
        billingName: "",
        address: "",
        nationalId: "",
        issuedDate: "",
        issuedPlace: "",
        phone: "",
        email: "",
        bankAccount: "",
        bankName: "",
        bankBranch: "",
        note: "",
      }),
      getSearchText: (r) =>
        `${r.code} ${r.shortName} ${r.billingName} ${r.address} ${r.phone} ${r.nationalId} ${r.email} ${r.bankAccount}`,
      getRecordDescription: (r) => r.shortName,
      nameField: "shortName",
      linkedByName: true, // import_shipments.supplier_name
    },
    importSupplier: {
      title: "NCC nhập khẩu",
      description:
        "Nhà cung cấp nước ngoài (và bên thuê gia công) của mảng Nhập khẩu — khác Đại lý của Nhập hàng. NCC đã có hợp đồng nhập thì không xóa được, chuyển Ngừng giao dịch.",
      entityName: "nhà cung cấp nhập khẩu",
      rows: n.importSupplier.rows,
      onChange: n.importSupplier.onChange,
      fields: fields.importSupplier,
      loading: n.importSupplier.loading,
      validate: (editing, rows) => [
        ...checkDuplicateCode(editing, rows, "nhà cung cấp"),
        ...checkDuplicateName(editing, rows, "shortName", "Tên gọi tắt", "nhà cung cấp nhập khẩu"),
      ],
      createEmpty: () => emptyImportSupplier(uid()),
      getSearchText: (r) => `${r.code} ${r.shortName} ${r.fullName} ${r.country} ${r.contactName} ${r.email} ${r.mainProducts}`,
      getRecordDescription: (r) => `${r.shortName}${r.country ? ` (${r.country})` : ""}`,
      nameField: "shortName",
      linkedByName: false, // HĐ nhập nối theo id, giữ chữ tên lúc ghi
      canDeleteRow: n.importSupplier.canDeleteRow,
    },
    materialType: {
      title: "Loại nguyên liệu",
      description: "Quy cách / size nguyên liệu. Đã nạp sẵn các loại thường gặp trong sổ.",
      entityName: "loại nguyên liệu",
      rows: n.materialType.rows,
      onChange: n.materialType.onChange,
      fields: fields.materialType,
      loading: n.materialType.loading,
      createEmpty: () => ({ id: uid(), name: "", category: "", note: "" }),
      getSearchText: (r) => `${r.name} ${r.category}`,
      getRecordDescription: (r) => `${r.name}${r.category ? ` (${r.category})` : ""}`,
      nameField: "name",
      linkedByName: true, // dòng nhập lưu materialTypeName
    },
    storageLocation: {
      title: "Kho lưu trữ",
      description: "Nơi hàng đang nằm: kho nhà (Kho Baseafood — tổng trong kho) và các kho lạnh thuê ngoài (Kho Hồng Phú, Kho Ánh Dương…). Dùng ở cột 'Kho lưu' của báo cáo Xuất–Nhập–Tồn.",
      entityName: "kho lưu trữ",
      rows: n.storageLocation.rows,
      onChange: n.storageLocation.onChange,
      fields: fields.storageLocation,
      loading: n.storageLocation.loading,
      validate: (editing, rows) => [
        ...checkDuplicateCode(editing, rows, "kho lưu trữ"),
        ...(rows.some(
          (r) =>
            r.id !== editing.id &&
            r.name.trim().toLowerCase() === (editing.name ?? "").trim().toLowerCase()
        )
          ? [
              {
                field: "Tên kho",
                message: `Tên "${editing.name}" đã có kho khác dùng — tên là chỗ nối dữ liệu nên không được trùng.`,
              },
            ]
          : []),
      ],
      createEmpty: (): StorageLocation => ({
        id: uid(),
        code: "",
        name: "",
        kind: "external",
        address: "",
        phone: "",
        note: "",
      }),
      getSearchText: (r) => `${r.code} ${r.name} ${r.address} ${r.phone}`,
      getRecordDescription: (r) => `${r.name} (${STORAGE_KIND_LABELS[r.kind] ?? r.kind})`,
      nameField: "name",
      linkedByName: true, // storageLocation lưu theo tên
    },
    batter: {
      title: "Bột tẩm",
      description: "Các loại bột dùng để tẩm thành phẩm (24V, 18V, 220H, 232, 20802…). Gắn bột đi kèm cho từng mặt hàng ở tab Mặt hàng — màn ghi thành phẩm sẽ hiện ô kg cho từng loại.",
      entityName: "loại bột",
      rows: n.batter.rows,
      onChange: n.batter.onChange,
      fields: fields.batter,
      loading: n.batter.loading,
      validate: (editing, rows) => [
        ...checkDuplicateCode(editing, rows, "loại bột"),
        ...checkDuplicateName(editing, rows, "name", "Tên loại bột", "loại bột"),
      ],
      createEmpty: (): BatterType => ({ id: uid(), code: "", name: "", note: "" }),
      getSearchText: (r) => `${r.code} ${r.name} ${r.note}`,
      getRecordDescription: (r) => `${r.name}${r.code ? ` (mã ${r.code})` : ""}`,
      nameField: "name",
      linkedByName: true, // production_wips.batter_kg lưu theo TÊN loại bột
    },
    documentKind: {
      title: "Loại chứng từ",
      description:
        "Loại chứng từ xuất khẩu khách yêu cầu (Commercial Invoice, B/L, H/C, C/O…). 10 loại gốc có luật riêng (VD Commercial Invoice bắt kg và tiền) — đổi tên được, xóa thì về tên gốc. Loại thêm mới tính như Chứng từ khác: cần số, ngày và file.",
      entityName: "loại chứng từ",
      rows: n.documentKind.rows,
      onChange: n.documentKind.onChange,
      fields: fields.documentKind,
      loading: n.documentKind.loading,
      validate: (editing, rows) => checkDuplicateName(editing, rows, "name", "Tên loại chứng từ", "loại chứng từ"),
      createEmpty: (): DocumentKindOption => ({ id: `doc-${uid()}`, name: "", isSystem: false, note: "", sortOrder: 0 }),
      getSearchText: (r) => `${r.name} ${r.note}`,
      getRecordDescription: (r) => r.name,
      nameField: "name",
      linkedByName: false, // chứng từ đã ghi lưu id loại
    },
    goodsType: {
      title: "Loại hàng",
      description:
        "Loại hàng của dòng hàng hợp đồng xuất / nhập (1 da, 2 da, mada, cá khô, cá gia công…) — để lọc khi xuất Excel. Thêm nhanh được ngay trong ô Loại hàng của phiếu hợp đồng.",
      entityName: "loại hàng",
      rows: n.goodsType.rows,
      onChange: n.goodsType.onChange,
      fields: fields.goodsType,
      loading: n.goodsType.loading,
      validate: (editing, rows) => checkDuplicateName(editing, rows, "name", "Tên loại hàng", "loại hàng"),
      createEmpty: (): GoodsType => ({ id: `goods-${uid()}`, name: "", sortOrder: 0, note: "" }),
      getSearchText: (r) => `${r.name} ${r.note}`,
      getRecordDescription: (r) => r.name,
      nameField: "name",
      linkedByName: false, // dòng hàng HĐ lưu id loại
    },
  };
}

/**
 * Nguồn danh mục loại chứng từ từ một instance store: hàng = danh sách đầy đủ; ghi ⇒ chỉ lưu loại tự
 * thêm + loại hệ thống đã đổi tên. Loại thêm mới (thứ tự 0) xếp cuối danh sách.
 */
export function documentKindSource(
  store: Pick<ReturnType<typeof useExportDocumentKindStore>, "kinds" | "setKinds" | "isLoading" | "isAvailable">,
): CatalogSource<DocumentKindOption> {
  const rows = documentKindList(store.kinds);
  return {
    rows,
    loading: store.isLoading,
    onChange: (next) => {
      // Máy chủ chưa có bảng ⇒ không ghi (khỏi kẹt hàng chờ); ô chọn vẫn đủ 10 loại gốc.
      if (!store.isAvailable) {
        notify.error("Máy chủ chưa chạy migration 0081 — chưa thêm / sửa loại chứng từ được. Báo chủ dự án.");
        return;
      }
      let max = Math.max(99, ...next.filter((k) => !k.isSystem).map((k) => k.sortOrder));
      store.setKinds(documentKindRowsFromList(next.map((k) => (!k.isSystem && !k.sortOrder ? { ...k, sortOrder: ++max } : k))));
    },
  };
}

/** Cấu hình 6 danh mục cho màn Danh mục — gọi trong component (dùng hook catalogRepo). */
export function useCatalogConfigs(): CatalogConfigSet {
  const [products, setProducts, { status: productStatus }] = useProducts();
  const [customers, setCustomers, { status: ttKH }] = useCustomers();
  const [suppliers, setSuppliers, { status: supplierStatus }] = useSuppliers();
  const [materialTypes, setMaterialTypes, { status: materialTypeStatus }] = useMaterialTypes();
  const [storageLocations, setStorageLocations, { status: ttKL }] = useStorageLocations();
  const [batterTypes, setBatterTypes, { status: ttBT }] = useBatterTypes();
  const documentKindStore = useExportDocumentKindStore();
  const goodsTypeStore = useGoodsTypeStore();
  const importSupplierStore = useImportSupplierStore();
  const [importContracts] = useImportContracts();
  const [finishedGoods] = useFinishedGoods();

  const isLoadingProducts = productStatus === "loading" && products.length === 0;
  const isLoadingCustomers = ttKH === "loading" && customers.length === 0;
  const isLoadingSuppliers = supplierStatus === "loading" && suppliers.length === 0;
  const isLoadingMaterials = materialTypeStatus === "loading" && materialTypes.length === 0;
  const isLoadingLocations = ttKL === "loading" && storageLocations.length === 0;
  const isLoadingBatters = ttBT === "loading" && batterTypes.length === 0;

  const fields = useMemo(() => {
    // Tạo loại bột tại chỗ từ ô "Bột đi kèm" — ghi qua ĐÚNG instance của tab Bột tẩm.
    const addBatter = (name: string): string => {
      const result = findOrCreateBatter(batterTypes, name);
      if (result.isNew) {
        setBatterTypes(result.rows);
        notify.saved(`Đã thêm loại bột "${result.batter.name}" vào danh mục`);
      }
      return result.batter.id;
    };
    // Tạo loại NL tại chỗ từ ô "Loại nguyên liệu" của form mặt hàng — ghi qua ĐÚNG
    // instance của tab Loại nguyên liệu. Trùng tên (không phân hoa thường) ⇒ dùng lại.
    const addMaterialType = (name: string): string => {
      const trimmedName = name.trim();
      const existing = materialTypes.find((l) => l.name.trim().toLowerCase() === trimmedName.toLowerCase());
      if (existing) return existing.id;
      const created: MaterialType = { id: uid(), name: trimmedName, category: "", note: "" };
      setMaterialTypes([...materialTypes, created]);
      notify.saved(`Đã thêm loại nguyên liệu "${trimmedName}" vào danh mục`);
      return created.id;
    };
    return buildCatalogFields(materialTypes, finishedGoods, batterTypes, addBatter, addMaterialType);
  }, [materialTypes, setMaterialTypes, finishedGoods, batterTypes, setBatterTypes]);
  return buildCatalogConfigs(fields, {
    product: { rows: products, onChange: setProducts, loading: isLoadingProducts },
    customer: { rows: customers, onChange: setCustomers, loading: isLoadingCustomers },
    supplier: { rows: suppliers, onChange: setSuppliers, loading: isLoadingSuppliers },
    importSupplier: {
      rows: importSupplierStore.suppliers,
      loading: importSupplierStore.isLoading,
      onChange: (next) => {
        // Máy chủ chưa chạy 0083 ⇒ không ghi (khỏi kẹt hàng chờ).
        if (!importSupplierStore.isAvailable) {
          notify.error("Máy chủ chưa chạy migration 0083 — chưa thêm / sửa NCC nhập khẩu được. Báo chủ dự án.");
          return;
        }
        importSupplierStore.setSuppliers(next);
      },
      canDeleteRow: (r) => canDeleteImportSupplier(importContracts, r.id),
    },
    materialType: { rows: materialTypes, onChange: setMaterialTypes, loading: isLoadingMaterials },
    storageLocation: { rows: storageLocations, onChange: setStorageLocations, loading: isLoadingLocations },
    batter: { rows: batterTypes, onChange: setBatterTypes, loading: isLoadingBatters },
    documentKind: documentKindSource(documentKindStore),
    goodsType: {
      rows: sortGoodsTypes(goodsTypeStore.goodsTypes),
      loading: goodsTypeStore.isLoading,
      onChange: (next) => {
        // Máy chủ chưa chạy 0089 ⇒ không ghi (khỏi kẹt hàng chờ).
        if (!goodsTypeStore.isAvailable) {
          notify.error("Máy chủ chưa chạy migration 0089 — chưa thêm / sửa loại hàng được. Báo chủ dự án.");
          return;
        }
        let max = Math.max(0, ...next.map((r) => r.sortOrder));
        goodsTypeStore.setGoodsTypes(next.map((r) => (r.sortOrder ? r : { ...r, sortOrder: (max += 10) })));
      },
    },
  });
}
