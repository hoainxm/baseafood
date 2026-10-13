// ============================================================
// Tên file: src/features/imports/BulkTypeChange.tsx
// Tên tiếng Việt: Đổi loại nguyên liệu hàng loạt
// Description: Bulk material-type reassignment for import rows
// ============================================================
import { useMemo, useState } from "react";
import type { MaterialImportItem, MaterialType } from "@/types";
import {
  Button,
  Combobox,
  DateRangeField,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  notify,
} from "@/design-system";
import { num, formatDateVN } from "@/lib/format";
import { Layers } from "lucide-react";

/**
 * Đổi loại nguyên liệu cho NHIỀU dòng sổ nhập một lần.
 *
 * Vì sao cần: migration `0019` tách "Bạch tuộc 2 da" thành lớn (80↑) / nhỏ
 * (80↓) và đổi TOÀN BỘ dữ liệu cũ sang size lớn — đó là chốt của người dùng,
 * nhưng thực tế một phần là hàng nhỏ. Sửa từng chuyến trong sổ là hàng trăm lần
 * mở hộp thoại; đây là chỗ tick một lượt.
 *
 * Chỉ đụng cột `materialTypeName` của sổ nhập. KHÔNG đụng kg, giá, ngày, chuyến.
 */
export function BulkTypeChangeDialog({
  rows,
  loaiNL: materialTypes,
  onCreateMaterialType: onAddMaterialType,
  materialTypeEdit: materialTypeEditor,
  onClose,
  onSave,
}: {
  rows: MaterialImportItem[];
  loaiNL: MaterialType[];
  onCreateMaterialType: (ten: string) => string;
  /** Bút chì sửa nhanh loại NL (từ `useQuickCatalogEdit("loaiNL", …, { theo: "ten" })` của màn gọi). */
  materialTypeEdit?: {
    openEdit: (value: string) => void;
    canEdit: (value: string) => boolean;
    editLabel: string;
  };
  onClose: () => void;
  onSave: (ids: string[], targetType: string) => void;
}) {
  const [sourceType, setSourceType] = useState("");
  const [targetType, setTargetType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  /** Tên loại NL có THẬT trong sổ + có trong danh mục — lọc theo cả hai nguồn. */
  const typeOptions = useMemo(() => {
    const ten = new Set<string>([
      ...rows.map((r) => r.materialTypeName).filter(Boolean),
      ...materialTypes.map((l) => l.name),
    ]);
    return [...ten].sort((a, b) => a.localeCompare(b, "vi")).map((t) => ({ value: t, label: t }));
  }, [rows, materialTypes]);

  const matchedRows = useMemo(() => {
    if (!sourceType) return [];
    return rows
      .filter((r) => r.materialTypeName === sourceType)
      .filter((r) => !fromDate || r.deliveryDate >= fromDate)
      .filter((r) => !toDate || r.deliveryDate <= toDate)
      .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate));
  }, [rows, sourceType, fromDate, toDate]);

  const doi = (id: string) =>
    setSelectedIds((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(id)) nextSet.delete(id);
      else nextSet.add(id);
      return nextSet;
    });

  const tickHet = () => setSelectedIds(new Set(matchedRows.map((r) => r.id)));
  const boHet = () => setSelectedIds(new Set());

  const totalKg = matchedRows.filter((r) => selectedIds.has(r.id)).reduce((s, r) => s + r.quantityKg, 0);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Đổi loại nguyên liệu hàng loạt</DialogTitle>
          <DialogDescription>
            Chọn loại đang ghi trong sổ, tick những chuyến thật ra là loại khác, rồi đổi
            sang loại đúng. Chỉ đổi TÊN LOẠI — khối lượng, đơn giá, ngày và chuyến giữ
            nguyên.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Combobox
            label="Đang ghi là loại"
            value={sourceType}
            onChange={(v) => {
              setSourceType(v);
              setSelectedIds(new Set());
            }}
            options={typeOptions}
          />
          <Combobox
            label="Đổi sang loại"
            value={targetType}
            onChange={setTargetType}
            options={typeOptions}
            onCreate={onAddMaterialType}
            onEditItem={materialTypeEditor?.openEdit}
            editLabel={materialTypeEditor?.editLabel}
            canEdit={materialTypeEditor?.canEdit}
          />
        </div>
        <DateRangeField
          label="Giới hạn khoảng ngày"
          hideRequiredMark
          startDate={fromDate}
          endDate={toDate}
          onChange={(tu, den) => {
            setFromDate(tu);
            setToDate(den);
            setSelectedIds(new Set());
          }}
        />

        {sourceType && matchedRows.length === 0 && (
          <EmptyState
            icon={Layers}
            title="Không có chuyến nào khớp"
            description="Đổi loại nguồn hoặc nới khoảng ngày."
          />
        )}

        {matchedRows.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                title="Tick hết các chuyến đang hiện trong danh sách." variant="outline" size="sm" onClick={tickHet}>
                Tick hết ({matchedRows.length})
              </Button>
              <Button
                title="Bỏ tick toàn bộ chuyến đang chọn." variant="outline" size="sm" onClick={boHet}>
                Bỏ tick
              </Button>
              <span className="text-base text-muted-foreground">
                Đã chọn {selectedIds.size} chuyến — {num(totalKg)} kg
              </span>
            </div>

            <div className="scroll-nice max-h-80 overflow-y-auto rounded-xl ring-1 ring-foreground/10">
              <table className="w-full border-collapse text-base">
                <thead>
                  <tr>
                    <th className="border-b-2 border-border bg-card px-3 py-2 text-left">Đổi</th>
                    <th className="border-b-2 border-border bg-card px-3 py-2 text-left">Ngày</th>
                    <th className="border-b-2 border-border bg-card px-3 py-2 text-left">
                      Đại lý
                    </th>
                    <th className="border-b-2 border-border bg-card px-3 py-2 text-left">
                      Phân xưởng
                    </th>
                    <th className="border-b-2 border-border bg-card px-3 py-2 text-right">kg</th>
                  </tr>
                </thead>
                <tbody>
                  {matchedRows.map((r) => (
                    <tr key={r.id}>
                      <td className="border-b border-border px-3 py-2">
                        <input
                          type="checkbox"
                          className="size-6"
                          checked={selectedIds.has(r.id)}
                          onChange={() => doi(r.id)}
                          aria-label={`Đổi loại chuyến ${r.supplierName} ngày ${formatDateVN(r.deliveryDate)}`}
                        />
                      </td>
                      <td className="border-b border-border px-3 py-2">
                        {formatDateVN(r.deliveryDate)}
                      </td>
                      <td className="border-b border-border px-3 py-2">{r.supplierName}</td>
                      <td className="border-b border-border px-3 py-2">{r.workshop}</td>
                      <td className="tnum border-b border-border px-3 py-2 text-right">
                        {num(r.quantityKg)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" size="lg" onClick={onClose}>
            Hủy
          </Button>
          <Button
            title="Đổi loại nguyên liệu của mọi chuyến đang tick sang loại đích. Sổ ghi lại theo loại mới."
            size="lg"
            onClick={() => {
              if (!targetType.trim()) {
                notify.error("Chưa chọn loại đích");
                return;
              }
              if (targetType === sourceType) {
                notify.error("Loại đích trùng loại nguồn");
                return;
              }
              if (selectedIds.size === 0) {
                notify.error("Chưa tick chuyến nào");
                return;
              }
              onSave([...selectedIds], targetType.trim());
            }}
          >
            Đổi {selectedIds.size} chuyến
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
