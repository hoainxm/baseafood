// ============================================================
// Tên file: src/features/balancing/EditImportTripsDialog.tsx
// Tên tiếng Việt: Sửa chuyến nhập hàng ngay ở Cân đối — xem thay đổi, xác nhận rồi mới ghi
// Description: Edit material-import trips (kg, unit price) from the balancing screen with a confirm step
// ============================================================
// Người dùng yêu cầu 2026-10-20: "bổ sung chức năng sửa dữ liệu nhập hàng từ giao diện cân đối,
// hỏi trước khi xác nhận thực hiện và lưu log rõ ràng". Hai bước:
//   1) bảng các chuyến của dòng (ngày · đại lý · loại · kg · giá) — sửa kg / giá tại chỗ;
//   2) "Xem thay đổi" ⇒ liệt kê TRƯỚC → SAU từng chuyến, bấm "Lưu vào sổ Nhập hàng" mới ghi.
// Ghi qua usePeriodGrid.editImportTrips (nhật ký thao tác tự ghi + dòng vết ở Ghi chú chuyến,
// có Hoàn tác). Chuyến của ngày đã CHỐT ở Nhập hàng VẪN sửa được (kế toán 2026-10-20: thao tác dễ),
// nhưng gắn tag "ngày đã chốt" và dòng vết ghi rõ "SAU KHI CHỐT NGÀY" để lưu vết.
// Nháp (quy tắc 17): đóng ngang giữ số đang gõ, Hủy bỏ hẳn, ghi xong xoá.
import { useEffect, useState } from "react";
import type { MaterialImportItem } from "@/types";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorSummary,
  NumberField,
  Tag,
  type FieldError,
} from "@/design-system";
import { formatDayLabel } from "@/lib/balancingGrid";
import { num } from "@/lib/format";
import { useDialogDraft } from "@/lib/formDraft";
import type { ImportTripEdit } from "./usePeriodGrid";

export interface EditImportTripsTarget {
  rowId: string;
  rowName: string;
  trips: MaterialImportItem[];
}

interface TripsForm {
  key: string;
  step: "edit" | "confirm";
  values: Record<string, { kg: number | null; price: number | null }>;
  initial: Record<string, { kg: number | null; price: number | null }>;
}

const isUnchanged = (f: TripsForm) =>
  Object.entries(f.values).every(([id, v]) => v.kg === f.initial[id]?.kg && v.price === f.initial[id]?.price);

/** "Bạch tuộc 2 da lớn (80↑)" ⇒ "2 da lớn (80↑)" — bỏ phần loài trước con số đầu tiên. */
const shortType = (t: string) => t.replace(/^\D+?\s(?=\d)/u, "") || t;

export function EditImportTripsDialog({
  target,
  onClose,
  isDayLocked,
  canViewPrice,
  onSave,
}: {
  target: EditImportTripsTarget | null;
  onClose: () => void;
  isDayLocked: (date: string, workshop: string) => boolean;
  canViewPrice: boolean;
  /** Ghi vào sổ; trả false nếu bị từ chối (đã báo lỗi). */
  onSave: (changes: ImportTripEdit[]) => boolean;
}) {
  const [form, setForm] = useState<TripsForm | null>(null);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const draft = useDialogDraft({ form: "balancing-import-trips", value: form, setValue: setForm, isEmpty: isUnchanged });

  const trips = [...(target?.trips ?? [])]
    .filter((i) => i.quantityKg !== 0)
    .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate) || a.supplierName.localeCompare(b.supplierName));

  // Mở hộp: lấy lại số gõ dở của ĐÚNG dòng này nếu vừa đóng ngang, không thì số hiện có trong sổ.
  useEffect(() => {
    if (!target) return;
    const initial = Object.fromEntries(trips.map((i) => [i.id, { kg: i.quantityKg, price: i.unitPrice }]));
    const key = `${target.rowId}|${trips.map((i) => `${i.id}:${i.quantityKg}:${i.unitPrice ?? ""}`).join(",")}`;
    const kept = draft.takeKept();
    setForm(kept && kept.key === key ? kept : { key, step: "edit", values: initial, initial });
    setErrors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi mở hộp cho một dòng mới
  }, [target]);

  if (!target || !form) return null;

  const changed = trips.filter((i) => {
    const v = form.values[i.id];
    return v && (v.kg !== i.quantityKg || v.price !== i.unitPrice);
  });
  const setValue = (id: string, patch: Partial<{ kg: number | null; price: number | null }>) =>
    setForm((f) => (f ? { ...f, values: { ...f.values, [id]: { ...f.values[id], ...patch } } } : f));

  const review = () => {
    const errs: FieldError[] = [];
    if (changed.length === 0) errs.push({ field: "Chuyến nhập", message: "Chưa sửa số nào" });
    for (const i of changed) {
      const v = form.values[i.id];
      if (v.kg == null || v.kg <= 0)
        errs.push({ field: `${i.supplierName || "Chuyến"} ${formatDayLabel(i.deliveryDate)}`, message: "Số kg phải lớn hơn 0" });
      if (v.price != null && v.price < 0)
        errs.push({ field: `${i.supplierName || "Chuyến"} ${formatDayLabel(i.deliveryDate)}`, message: "Đơn giá không được âm" });
    }
    setErrors(errs);
    if (errs.length === 0) setForm({ ...form, step: "confirm" });
  };

  const save = () => {
    const ok = onSave(changed.map((i) => ({ id: i.id, quantityKg: form.values[i.id].kg ?? i.quantityKg, unitPrice: form.values[i.id].price })));
    if (ok) {
      draft.done();
      onClose();
    }
  };

  const close = () => {
    draft.dismiss();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[92dvh] w-full overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Sửa chuyến nhập — {target.rowName}</DialogTitle>
          <DialogDescription>
            {form.step === "edit"
              ? "Sửa kg / đơn giá từng chuyến rồi bấm “Xem thay đổi”. Số ghi thẳng vào sổ Nhập hàng sau khi bạn xác nhận."
              : "Kiểm lại các thay đổi dưới đây. Bấm “Lưu vào sổ Nhập hàng” để ghi — vẫn Hoàn tác được ngay sau đó."}
          </DialogDescription>
        </DialogHeader>
        <ErrorSummary errors={errors} />

        {form.step === "edit" ? (
          <div className="overflow-x-auto">
            <table className="tnum w-full text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2 text-left font-medium">Ngày</th>
                  <th className="py-1 pr-2 text-left font-medium">Đại lý · loại</th>
                  <th className="py-1 pr-2 text-right font-medium">kg</th>
                  {canViewPrice && <th className="py-1 text-right font-medium">Giá (đ/kg)</th>}
                </tr>
              </thead>
              <tbody>
                {trips.map((i) => {
                  const locked = isDayLocked(i.deliveryDate, i.workshop);
                  const v = form.values[i.id];
                  return (
                    <tr key={i.id} className="border-t border-border align-middle">
                      <td className="py-1 pr-2">{formatDayLabel(i.deliveryDate)}</td>
                      <td className="py-1 pr-2">
                        {i.supplierName || "—"} · {shortType(i.materialTypeName)}
                        {locked && (
                          <Tag variant="warning" className="ml-2" title="Ngày đã chốt ở Nhập hàng — vẫn sửa được, sửa sẽ ghi vết “sau khi chốt ngày” vào Ghi chú chuyến và nhật ký thao tác.">
                            ngày đã chốt
                          </Tag>
                        )}
                      </td>
                      <td className="w-32 py-1 pr-2 text-right">
                        <NumberField label={`kg — ${i.supplierName} ${formatDayLabel(i.deliveryDate)}`} hideLabel value={v?.kg ?? null} onChange={(x) => setValue(i.id, { kg: x })} />
                      </td>
                      {canViewPrice && (
                        <td className="w-36 py-1 text-right">
                          <NumberField
                            label={`Đơn giá — ${i.supplierName} ${formatDayLabel(i.deliveryDate)}`}
                            hideLabel
                            unit="đ"
                            value={v?.price ?? null}
                            onChange={(x) => setValue(i.id, { price: x })}
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <ul className="space-y-2 text-sm">
            {changed.map((i) => {
              const v = form.values[i.id];
              return (
                <li key={i.id} className="rounded-lg bg-muted px-3 py-2">
                  <span className="font-semibold">
                    {i.supplierName || "—"} · {formatDayLabel(i.deliveryDate)} · {shortType(i.materialTypeName)}
                  </span>
                  {isDayLocked(i.deliveryDate, i.workshop) && (
                    <Tag variant="warning" className="ml-2" title="Ngày đã chốt ở Nhập hàng — lần sửa này ghi vết “sau khi chốt ngày”.">
                      ngày đã chốt · ghi vết
                    </Tag>
                  )}
                  {v.kg !== i.quantityKg && (
                    <span className="tnum block">
                      kg: {num(i.quantityKg)} → <strong>{num(v.kg ?? 0)}</strong>
                    </span>
                  )}
                  {v.price !== i.unitPrice && (
                    <span className="tnum block">
                      Đơn giá: {i.unitPrice == null ? "—" : num(i.unitPrice)} → <strong>{v.price == null ? "—" : num(v.price)}</strong> đ/kg
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter>
          <Button variant="outline" size="lg" onClick={() => (draft.cancel(), onClose())}>
            Hủy
          </Button>
          {form.step === "edit" ? (
            <Button size="lg" onClick={review} title="Xem lại các chuyến đã sửa (trước → sau) trước khi ghi vào sổ Nhập hàng.">
              Xem thay đổi ({changed.length})
            </Button>
          ) : (
            <>
              <Button variant="outline" size="lg" onClick={() => setForm({ ...form, step: "edit" })} title="Quay lại bảng để sửa tiếp.">
                Quay lại sửa
              </Button>
              <Button variant="save" size="lg" onClick={save} title="Ghi các thay đổi vào sổ Nhập hàng — nhật ký thao tác lưu lại trước/sau, có Hoàn tác.">
                Lưu vào sổ Nhập hàng
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
