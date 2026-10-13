// ============================================================
// Tên file: src/features/balancing/gridDialogs.tsx
// Tên tiếng Việt: Hộp thoại phụ của lưới cân đối
// Description: Dialogs used by the balancing grid blocks
// ============================================================
import { useState } from "react";
import type { Customer, MaterialImportItem, Product, SalesChannel } from "@/types";
import {
  Button,
  Combobox,
  ConfirmDelete,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Tag,
  Textarea,
  notify,
} from "@/design-system";
import { num, formatDateVN } from "@/lib/format";
import { OTHER_CUSTOMER_ID, type MaterialGridRow } from "@/lib/balancingGrid";
import { Trash2 } from "lucide-react";

/* ---------- Thêm dòng nguyên liệu / dòng giảm ---------- */

export function AddMaterialRowDialog({
  isDecrease,
  title,
  goiY,
  onCreateMaterialType: onAddMaterialType,
  materialTypeEdit: materialTypeEditor,
  onClose,
  onSave,
}: {
  isDecrease: boolean;
  title: string;
  /** Danh mục loại NL + tên các dòng đã có trong kỳ. */
  goiY: { value: string; label: string }[];
  onCreateMaterialType: (ten: string) => string;
  /** Bút chì sửa nhanh loại NL (useQuickCatalogEdit của màn, theo TÊN) — mục không có trong danh mục thì không có bút. */
  materialTypeEdit?: { openEdit: (v: string) => void; canEdit: (v: string) => boolean; editLabel: string };
  onClose: () => void;
  onSave: (ten: string) => void;
}) {
  const [ten, setTen] = useState("");
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {isDecrease
              ? "Chọn đúng loại nguyên liệu đang có trong kỳ. Số nhập vào lưới sẽ được TRỪ khỏi kỳ và nhập về kho xưởng để dùng cho kỳ sau."
              : "Chọn trong danh mục, chưa có thì thêm mới ngay tại đây."}
          </DialogDescription>
        </DialogHeader>
        {/* Luôn là Combobox, kể cả dòng giảm: gõ tự do là cách chắc chắn nhất
            để "Bạch tuộc 2 da lớn" và "BT 2 da lon" thành hai dòng khác nhau. */}
        <Combobox
          label="Loại nguyên liệu"
          value={ten}
          onChange={setTen}
          options={goiY}
          onCreate={onAddMaterialType}
          onEditItem={materialTypeEditor?.openEdit}
          canEdit={materialTypeEditor?.canEdit}
          editLabel={materialTypeEditor?.editLabel}
        />
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={onClose}>
            Hủy
          </Button>
          <Button
            title="Thêm dòng nguyên liệu vừa chọn vào lưới của kỳ."
            size="lg"
            onClick={() => {
              const t = ten.trim();
              if (!t) {
                notify.error("Chưa chọn loại nguyên liệu");
                return;
              }
              onSave(t);
            }}
          >
            Thêm dòng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Chọn tay dòng sổ nhập để hút ---------- */

export function PickImportRowsDialog({
  dong: inputRows,
  otherPeriodIds: heldIds,
  isSameFamily,
  periodMaterialType: periodMaterialTypeName,
  onClose,
  onSave,
}: {
  dong: MaterialImportItem[];
  /** Id các dòng đang thuộc kỳ KHÁC — tick là kéo về kỳ đang mở. */
  otherPeriodIds: Set<string>;
  /** Dòng có cùng họ nguyên liệu với kỳ không. */
  isSameFamily: (r: MaterialImportItem) => boolean;
  /** Tên loại NL của kỳ (để nói rõ "khác loại" so với cái gì). */
  periodMaterialType: string;
  onClose: () => void;
  onSave: (ids: string[]) => void;
}) {
  /* Dòng CÙNG loại lên trước, dòng khác loại xuống cuối — mắt đọc từ trên xuống. */
  const dong = [...inputRows].sort(
    (a, b) => Number(isSameFamily(b)) - Number(isSameFamily(a)) || a.deliveryDate.localeCompare(b.deliveryDate)
  );
  /* Chỉ tick sẵn dòng CÙNG loại mà chưa kỳ nào giữ. Trước đây tick sẵn MỌI dòng chưa
     gắn kỳ — kể cả khác loại — nên kỳ "Bạch tuộc 2 da" tạo trùng ngày bấm vào là kéo
     luôn các chuyến 1 da. Dòng khác loại / đang thuộc kỳ khác: người dùng tự tick. */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(dong.filter((r) => !heldIds.has(r.id) && isSameFamily(r)).map((r) => r.id))
  );
  const otherTypeCheckedCount = dong.filter((r) => selectedIds.has(r.id) && !isSameFamily(r)).length;
  const doi = (id: string) =>
    setSelectedIds((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(id)) nextSet.delete(id);
      else nextSet.add(id);
      return nextSet;
    });
  const totalKg = dong
    .filter((r) => selectedIds.has(r.id))
    .reduce((s, r) => s + r.quantityKg, 0);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Chọn dòng nhập hàng đưa vào kỳ</DialogTitle>
          <DialogDescription>
            Các chuyến nhập trong khoảng ngày của kỳ nhưng khác loại nguyên liệu, hoặc
            đang thuộc một kỳ khác. Kỳ này là <strong>{periodMaterialTypeName}</strong> — dòng khác loại
            chỉ tick khi chắc đó là chuyến ghi nhầm tên. Dòng đang thuộc kỳ khác mà tick
            thì sẽ được KÉO khỏi kỳ đó.
          </DialogDescription>
        </DialogHeader>

        <div className="scroll-nice max-h-96 overflow-y-auto rounded-xl ring-1 ring-foreground/10">
          <table className="w-full border-collapse text-base">
            <thead>
              <tr>
                <th className="border-b-2 border-border bg-card px-3 py-2 text-left">Lấy</th>
                <th className="border-b-2 border-border bg-card px-3 py-2 text-left">Ngày</th>
                <th className="border-b-2 border-border bg-card px-3 py-2 text-left">
                  Loại nguyên liệu
                </th>
                <th className="border-b-2 border-border bg-card px-3 py-2 text-left">Đại lý</th>
                <th className="border-b-2 border-border bg-card px-3 py-2 text-right">kg</th>
                <th className="border-b-2 border-border bg-card px-3 py-2 text-left">
                  Tình trạng
                </th>
              </tr>
            </thead>
            <tbody>
              {dong.map((r) => (
                <tr key={r.id}>
                  <td className="border-b border-border px-3 py-2">
                    <input
                      type="checkbox"
                      className="size-6"
                      checked={selectedIds.has(r.id)}
                      onChange={() => doi(r.id)}
                      aria-label={`Lấy dòng ${r.materialTypeName} ngày ${formatDateVN(r.deliveryDate)}`}
                    />
                  </td>
                  <td className="border-b border-border px-3 py-2">{formatDateVN(r.deliveryDate)}</td>
                  <td className="border-b border-border px-3 py-2">{r.materialTypeName}</td>
                  <td className="border-b border-border px-3 py-2">{r.supplierName}</td>
                  <td className="tnum border-b border-border px-3 py-2 text-right">
                    {num(r.quantityKg)}
                  </td>
                  <td className="border-b border-border px-3 py-2">
                    <span className="inline-flex flex-wrap gap-1">
                      {!isSameFamily(r) && <Tag variant="loi">Khác loại</Tag>}
                      {heldIds.has(r.id) ? (
                        <Tag variant="luu-y">Đang thuộc kỳ khác</Tag>
                      ) : (
                        <Tag variant="cho">Chưa gắn kỳ</Tag>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-base text-muted-foreground">
          Đã chọn {selectedIds.size} dòng — {num(totalKg)} kg
        </p>
        {otherTypeCheckedCount > 0 && (
          <p className="rounded-lg bg-warning-surface px-4 py-2.5 text-base font-medium text-destructive">
            ⚠ Đang tick {otherTypeCheckedCount} dòng KHÁC loại {periodMaterialTypeName} — số của chúng sẽ cộng vào
            nguyên liệu của kỳ này.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" size="lg" onClick={onClose}>
            Hủy
          </Button>
          <Button
            title="Đưa các dòng đang tick từ sổ nhập vào kỳ cân đối này."
            size="lg"
            onClick={() => {
              if (selectedIds.size === 0) {
                notify.error("Chưa tick dòng nào");
                return;
              }
              onSave([...selectedIds]);
            }}
          >
            Đưa {selectedIds.size} dòng vào kỳ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Sửa / xoá dòng nhập tay của khối nguyên liệu ---------- */

/**
 * Gom việc ít làm (xoá dòng tay, đổi kho nhận của dòng giảm) vào MỘT hộp — trước
 * đây là một dải thẻ dưới lưới lặp lại tên mọi dòng, làm khối nguyên liệu rối mắt.
 */
export function ManualRowsDialog({
  dong,
  getRowName: rowLabelOf,
  workshopWarehouses: workshopWarehouseOptions,
  hasWarehouse: hasStock,
  onChangeWarehouse,
  onDelete,
  onClose,
}: {
  dong: MaterialGridRow[];
  getRowName: (h: MaterialGridRow) => string;
  workshopWarehouses: { value: string; label: string }[];
  /** Dòng giảm nào có ô "Kho nhận" — mặc định mọi dòng giảm (Bán nội địa: bán đi, không vào kho). */
  hasWarehouse?: (h: MaterialGridRow) => boolean;
  onChangeWarehouse: (id: string, warehouse: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dòng nhập tay</DialogTitle>
          <DialogDescription>
            Dòng lấy từ sổ nhập hàng không xoá ở đây — sửa ở màn Nhập hàng.
          </DialogDescription>
        </DialogHeader>
        <ul className="divide-y divide-border">
          {dong.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-3 py-2">
              <span className="min-w-0 flex-1">
                {rowLabelOf(h)}
                <span className="tnum ml-2 text-sm text-muted-foreground">{num(h.tong)} kg</span>
              </span>
              {h.laGiam && !h.loaiKho && (hasStock?.(h) ?? true) && (
                <Combobox
                  label={`Kho nhận — ${rowLabelOf(h)}`}
                  hideLabel
                  value={h.khoGiam}
                  onChange={(v) => onChangeWarehouse(h.id, v)}
                  options={workshopWarehouseOptions}
                  placeholder="Chọn kho nhận"
                  clearable={false}
                  className="w-48"
                />
              )}
              <ConfirmDelete
                recordDescription={`${rowLabelOf(h)} — ${num(h.tong)} kg`}
                onConfirm={() => onDelete(h.id)}
                trigger={
                  <Button
                    title="Xoá dòng này khỏi lưới của kỳ (có Hoàn tác)."
                    variant="ghost"
                    size="sm"
                    className="min-h-11 min-w-11"
                    aria-label={`Xoá dòng ${rowLabelOf(h)}`}
                  >
                    <Trash2 />
                  </Button>
                }
              />
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={onClose}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Thêm mặt hàng vào lưới bán thành phẩm ---------- */

export function AddProductDialog({
  matHang: products,
  customers,
  onCreateProduct: onAddProduct,
  onCreateCustomer: onAddCustomer,
  onEditProduct,
  onEditCustomer,
  onClose,
  onSave,
}: {
  matHang: Product[];
  customers: Customer[];
  onCreateProduct: (ten: string) => string;
  onCreateCustomer: (ten: string) => string;
  /** Bút chì sửa nhanh bản ghi danh mục (value = id). */
  onEditProduct?: (id: string) => void;
  onEditCustomer?: (id: string) => void;
  onClose: () => void;
  onSave: (productId: string, customerId: string, spec: string, kenh: SalesChannel) => void;
}) {
  const [productId, setProductId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [spec, setSpec] = useState("");
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm mặt hàng vào lưới</DialogTitle>
          <DialogDescription>
            Một mặt hàng × một quy cách là một dòng. Sản lượng từng ngày gõ thẳng vào lưới.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Combobox
            label="Mặt hàng"
            value={productId}
            onChange={setProductId}
            options={products.map((m) => ({ value: m.id, label: m.name }))}
            onCreate={onAddProduct}
            onEditItem={onEditProduct}
            editLabel="Sửa thông tin mặt hàng này — lưu thẳng vào Danh mục."
          />
          <Field label="Quy cách">
            <Input
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              placeholder="230-250"
            />
          </Field>
          <Combobox
            label="Khách hàng"
            required
            hint="Chưa rõ khách thì chọn “Khác”."
            value={customerId}
            onChange={setCustomerId}
            options={[...customers.map((k) => ({ value: k.id, label: k.name })), { value: OTHER_CUSTOMER_ID, label: "Khác" }]}
            onCreate={onAddCustomer}
            clearable={false}
            onEditItem={onEditCustomer}
            canEdit={(v) => v !== OTHER_CUSTOMER_ID}
            editLabel="Sửa thông tin khách hàng này — lưu thẳng vào Danh mục."
          />
        </div>
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={onClose}>
            Hủy
          </Button>
          <Button
            title="Thêm mặt hàng vừa chọn vào lưới thành phẩm của kỳ."
            size="lg"
            onClick={() => {
              if (!productId) {
                notify.error("Chưa chọn mặt hàng");
                return;
              }
              if (!customerId) {
                notify.error("Chưa chọn khách hàng — chưa rõ thì chọn “Khác”");
                return;
              }
              onSave(productId, customerId, spec.trim(), "Xuất khẩu");
            }}
          >
            Thêm vào lưới
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Lý do ghi bù khi sửa ngày đã chốt ---------- */

export function BackdateReasonDialog({
  date,
  onClose,
  onSave,
}: {
  date: string;
  onClose: () => void;
  onSave: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ngày {formatDateVN(date)} đã chốt</DialogTitle>
          <DialogDescription>
            Số của ngày này đã được chốt và có thể đã gửi đi. Sửa vẫn được, nhưng phải ghi
            lý do để sau này giải trình được.
          </DialogDescription>
        </DialogHeader>
        <Field label="Lý do ghi bù">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Cân lại ca chiều, sót một mẻ"
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={onClose}>
            Hủy
          </Button>
          <Button
            title="Ghi số vừa sửa kèm lý do. Lý do được lưu vết để đối chiếu về sau."
            size="lg"
            onClick={() => {
              if (!reason.trim()) {
                notify.error("Chưa ghi lý do");
                return;
              }
              onSave(reason.trim());
            }}
          >
            Lưu số mới
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Chốt kỳ / mở lại kỳ ---------- */

export function PeriodLockDialog({
  isLocked,
  periodName,
  outputTotal: totalFinishedGood,
  onClose,
  onSave,
}: {
  isLocked: boolean;
  periodName: string;
  outputTotal: string;
  onClose: () => void;
  onSave: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isLocked ? "Mở lại kỳ đã chốt?" : "Chốt kỳ này?"}</DialogTitle>
          <DialogDescription>
            {isLocked
              ? `Kỳ "${periodName}" đang khoá. Mở lại để sửa số — hệ thống giữ vết ai mở và vì sao, không xoá dấu đã chốt.`
              : `Chốt kỳ "${periodName}" (${totalFinishedGood}). Sau khi chốt, mọi ô trong lưới khoá lại để số đã gửi kế toán không bị đổi âm thầm. Vẫn mở lại được.`}
          </DialogDescription>
        </DialogHeader>
        <Field label={isLocked ? "Lý do mở lại" : "Ghi chú khi chốt"}>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={isLocked ? "Kế toán báo lệch 12 kg mặt hàng luộc 230-250" : "Đã đối chiếu với bảng phụ, gửi kế toán"}
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={onClose}>
            Hủy
          </Button>
          <Button
            title="Khóa kỳ lại để chốt số, hoặc mở khóa nếu cần sửa. Mở lại BẮT BUỘC ghi lý do."
            size="lg"
            onClick={() => {
              /* Mở lại BẮT BUỘC có lý do — giống mở lại ngày đã chốt ở sổ nhập.
                 Chốt thì ghi chú không bắt buộc. */
              if (isLocked && !note.trim()) {
                notify.error("Chưa ghi lý do mở lại");
                return;
              }
              onSave(note.trim());
            }}
          >
            {isLocked ? "Mở lại kỳ" : "Chốt kỳ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
