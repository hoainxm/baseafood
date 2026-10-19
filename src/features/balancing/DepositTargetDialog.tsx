// ============================================================
// Tên file: src/features/balancing/DepositTargetDialog.tsx
// Tên tiếng Việt: Hộp "Gửi đông vào sổ kho" — chọn NL gửi + bảng của Sổ kho tháng
// Description: Freeze-deposit target picker (material, warehouse, ledger group)
// ============================================================
// VÌ SAO (người dùng yêu cầu 2026-10-16): lô gửi đông trước luôn vào nhóm riêng "Nguyên
// liệu gửi đông" và muốn xem sổ kho thì phải sang màn Sổ kho tháng rồi quay lại. Hộp này
// mở NGAY Ở CÂN ĐỐI bảng sổ kho của tháng, chia theo nhóm (Nguyên liệu mua ngoài / nhập
// khẩu / Hàng tạm…): bấm một nhóm để gửi vào nhóm đó, bấm một dòng để gửi cùng nhóm, cùng
// tên hàng, cùng kho với dòng ấy. Giá gửi KHÔNG gõ ở đây nữa (2026-10-19): kế toán tính giá
// theo từng ngày gửi ⇒ gõ ở hàng "Giá gửi" ngay dưới dòng Gửi đông trên lưới, mỗi lô GĐ-ngày
// lưu giá ngày đó (một chỗ gõ giá, khỏi nhầm "ô tổng").
import { useMemo, useState } from "react";
import {
  Button,
  Combobox,
  FormDialog,
  HorizontalScroll,
  Input,
  Field,
} from "@/design-system";
import { cn } from "@/lib/utils";
import { num } from "@/lib/format";
import {
  joinDepositLocation,
  shortLocationName,
  type DepositTargetGroup,
  type DepositTargetRow,
} from "@/lib/balancingStockLines";

export interface DepositTargetValue {
  /** Tên NL gửi = tên lô trong Sổ kho tháng. */
  name: string;
  /** Nhóm (bảng) của Sổ kho tháng. */
  category: string;
  /** Kho "<sổ kho>|<vị trí>". */
  stockLocation: string;
}

/** Số dòng hiện tối đa mỗi nhóm khi chưa gõ tìm (nhóm nhập khẩu có cả trăm dòng). */
const MAX_ROWS_PER_GROUP = 40;

export function DepositTargetDialog({
  open,
  onOpenChange,
  month,
  groups,
  initial,
  materialOptions,
  locationOptions,
  onCreateMaterial,
  onEditMaterial,
  canEditMaterial,
  editMaterialLabel,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: string;
  groups: DepositTargetGroup[];
  initial: DepositTargetValue;
  materialOptions: { value: string; label: string; subLabel?: string }[];
  locationOptions: { value: string; label: string; subLabel?: string }[];
  onCreateMaterial?: (name: string) => string;
  onEditMaterial?: (value: string) => void;
  canEditMaterial?: (value: string) => boolean;
  editMaterialLabel?: string;
  onSave: (v: DepositTargetValue) => void;
}) {
  const [value, setValue] = useState<DepositTargetValue>(initial);
  const [pickedRowId, setPickedRowId] = useState("");
  const [search, setSearch] = useState("");

  /* Tên hàng lấy từ dòng sổ (VD "2 DA <80GR") có thể chưa có trong danh mục loại NL —
     thêm tạm vào danh sách để ô chọn hiện đúng tên đang chọn. */
  const nameOptions = useMemo(
    () =>
      value.name && !materialOptions.some((o) => o.value === value.name)
        ? [{ value: value.name, label: value.name, subLabel: "tên hàng trong sổ kho" }, ...materialOptions]
        : materialOptions,
    [materialOptions, value.name]
  );

  const query = search.trim().toLowerCase();
  const matches = (r: DepositTargetRow) =>
    !query ||
    [r.itemName, r.size, r.origin, r.warehouse, r.storageLocation].some((x) => x.toLowerCase().includes(query));

  const pickRow = (r: DepositTargetRow) => {
    setPickedRowId(r.id);
    setValue((v) => ({
      ...v,
      category: r.category,
      name: `${r.itemName}${r.size ? ` ${r.size}` : ""}`.trim(),
      stockLocation: joinDepositLocation(r.warehouse, r.storageLocation),
    }));
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title="Gửi đông vào sổ kho"
      description={`Chọn bảng của Sổ kho tháng ${month.slice(5)}/${month.slice(0, 4)} để lô gửi vào. Bấm tên bảng để gửi vào bảng đó; bấm một dòng để gửi cùng bảng, cùng tên hàng và kho với dòng ấy. Mỗi ngày gửi thành một lô riêng (invoice GĐ-ngày).`}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            variant="save"
            title="Lưu nguyên liệu, kho và bảng sổ kho cho dòng Gửi đông này — lô trong Sổ kho tháng đổi theo."
            onClick={() => {
              onSave(value);
              onOpenChange(false);
            }}
          >
            Lưu chỗ gửi
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Combobox
            label="Nguyên liệu gửi"
            value={value.name}
            onChange={(v) => setValue((x) => ({ ...x, name: v }))}
            options={nameOptions}
            onCreate={onCreateMaterial}
            onEditItem={onEditMaterial}
            canEdit={canEditMaterial}
            editLabel={editMaterialLabel}
            clearable={false}
            emptyText="Chưa có loại này — gõ tên rồi Thêm mới."
          />
          <Combobox
            label="Kho"
            value={value.stockLocation}
            onChange={(v) => setValue((x) => ({ ...x, stockLocation: v }))}
            options={locationOptions}
            clearable={false}
          />
        </div>

        <Field label="Tìm trong sổ kho" hideRequiredMark>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tên hàng, invoice, kho…" />
        </Field>

        <div className="grid gap-3">
          {groups.map((g) => {
            const rows = g.rows.filter(matches);
            const isSelected = g.category === value.category;
            const shown = query ? rows : rows.slice(0, MAX_ROWS_PER_GROUP);
            return (
              <section
                key={g.category}
                className={cn("rounded-lg border", isSelected ? "border-primary ring-1 ring-primary" : "border-border")}
              >
                <button
                  type="button"
                  aria-pressed={isSelected}
                  title={`Gửi lô vào bảng "${g.category}" của Sổ kho tháng.`}
                  onClick={() => {
                    setPickedRowId("");
                    setValue((v) => ({ ...v, category: g.category }));
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-t-lg px-4 py-2 text-left font-semibold",
                    isSelected ? "bg-primary/10 text-foreground" : "hover:bg-muted"
                  )}
                >
                  <span>
                    {isSelected ? "● " : "○ "}
                    {g.category}
                  </span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {g.rows.length ? `${num(g.rows.length)} dòng` : "bảng trống"}
                  </span>
                </button>
                {/* Chỉ mở bảng của nhóm đang chọn (hoặc khi đang tìm) — khỏi một hộp dài cả trăm dòng. */}
                {(isSelected || query) && shown.length > 0 && (
                  <HorizontalScroll>
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-left text-muted-foreground">
                        <tr>
                          <th className="px-3 py-1.5 font-medium">Tên hàng</th>
                          <th className="px-3 py-1.5 font-medium">Invoice</th>
                          <th className="px-3 py-1.5 font-medium">Kho</th>
                          <th className="px-3 py-1.5 text-right font-medium">Tồn cuối (kg)</th>
                          <th className="px-3 py-1.5 text-right font-medium">Đơn giá</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map((r) => (
                          <tr
                            key={r.id}
                            onClick={() => pickRow(r)}
                            title="Gửi cùng bảng, cùng tên hàng và kho với dòng này."
                            className={cn(
                              "cursor-pointer border-t border-border hover:bg-muted",
                              pickedRowId === r.id && "bg-primary/10"
                            )}
                          >
                            <td className="px-3 py-1.5">
                              {r.itemName}
                              {r.size ? ` ${r.size}` : ""}
                            </td>
                            <td className="px-3 py-1.5 text-muted-foreground">{r.origin || "—"}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{shortLocationName(r)}</td>
                            <td className="tnum px-3 py-1.5 text-right">{num(r.closeKg)}</td>
                            <td className="tnum px-3 py-1.5 text-right">{r.unitPrice != null ? num(r.unitPrice) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </HorizontalScroll>
                )}
                {(isSelected || query) && rows.length > shown.length && (
                  <p className="px-4 py-1.5 text-sm text-muted-foreground">
                    Còn {num(rows.length - shown.length)} dòng — gõ ô tìm để lọc.
                  </p>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </FormDialog>
  );
}
