// ============================================================
// Tên file: src/features/imports/DailyScrapSection.tsx
// Tên tiếng Việt: Khối phế liệu cân gộp cuối ngày (nội tạng / dạt)
// Tách khỏi MaterialImportScreen.tsx ngày 2026-09-21 — KHÔNG đổi logic.
// ============================================================
import { useMemo, useState } from "react";
import type { ScrapItem, Workshop } from "@/types";
import { newId } from "@/lib/store";
import {
  Button,
  RequiredLegend,
  Combobox,
  ConfirmDelete,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorSummary,
  Tag,
  NumberField,
  RecordTable,
  notify,
  type RecordTableColumn,
  type FieldError,
  type ComboboxOption,
} from "@/design-system";
import { kg, num, formatDateVN } from "@/lib/format";
import { Lock, Pencil, Plus, Scale } from "lucide-react";
import { SCRAP_SUGGESTIONS } from "./importHelpers";

/* ---------- Phế liệu cân gộp cuối ngày (nội tạng / dạt) ---------- */

export function DailyScrapSection({
  date,
  workshop,
  rows,
  onChange,
  isLocked,
  readOnly: isReadOnly = false,
}: {
  date: string;
  workshop: Workshop;
  rows: ScrapItem[];
  onChange: (n: ScrapItem[]) => void;
  isLocked: boolean;
  /** Chỉ hiển thị tóm tắt (ngoài trang) — ghi/sửa phế liệu làm trong dialog "Ghi nhập trong ngày". */
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState<ScrapItem | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [errors, setErrors] = useState<FieldError[]>([]);

  const dayScrapRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.source === "Nhập hàng" && r.date === date && r.workshop === workshop
      ),
    [rows, date, workshop]
  );

  const totalKg = dayScrapRows.reduce((s, r) => s + (r.quantityKg || 0), 0);
  const totalAmount = dayScrapRows.reduce(
    (s, r) => s + r.quantityKg * (r.sellingPrice ?? 0),
    0
  );

  /**
   * Dòng phế liệu mới. Loại mặc định "Nội tạng" (đa số phế liệu là nội tạng);
   * cân dạt thì người dùng đổi ở ô Loại. Riêng "ghi tiếp loại khác" truyền
   * `daGhi` để gợi ý loại chưa ghi (vừa ghi nội tạng ⇒ gợi ý Dạt).
   */
  const newScrapItem = (recordedNames: string[] = []): ScrapItem => ({
    id: newId(),
    periodId: "",
    name: SCRAP_SUGGESTIONS.find((t) => !recordedNames.includes(t)) ?? SCRAP_SUGGESTIONS[0],
    quantityKg: 0,
    sellingPrice: null,
    date,
    workshop,
    source: "Nhập hàng",
  });

  const typeOptions: ComboboxOption[] = SCRAP_SUGGESTIONS.map((t) => ({
    value: t,
    label: t,
  }));

  /** `ghiTiep`: lưu xong giữ hộp thoại mở để ghi loại khác (chỉ khi thêm mới). */
  const save = (keepEntering = false) => {
    if (!editing) return;
    const ls: FieldError[] = [];
    if (!editing.name.trim())
      ls.push({ field: "Loại phế liệu", message: "Chưa chọn loại phế liệu" });
    if (!(editing.quantityKg > 0))
      ls.push({ field: "Số lượng", message: "Phải lớn hơn 0 kg" });
    setErrors(ls);
    if (ls.length > 0) return;
    onChange(
      isAdding ? [...rows, editing] : rows.map((r) => (r.id === editing.id ? editing : r))
    );
    notify.saved(
      isAdding
        ? `Đã ghi phế liệu ${editing.name} — ${kg(editing.quantityKg)}`
        : "Đã lưu thay đổi"
    );
    if (isAdding && keepEntering) {
      // Ghi thêm loại khác: reset form, giữ hộp thoại mở, gợi ý loại chưa ghi.
      setEditing(newScrapItem([...dayScrapRows.map((r) => r.name), editing.name]));
      setErrors([]);
    } else {
      setEditing(null);
    }
  };

  const cols: RecordTableColumn<ScrapItem>[] = [
    {
      key: "category",
      header: "Loại phế liệu",
      primary: true,
      render: (r) => r.name,
      getSortValue: (r) => r.name,
    },
    {
      key: "sl",
      header: "Số lượng (kg)",
      numeric: true,
      render: (r) => num(r.quantityKg),
      getSortValue: (r) => r.quantityKg,
    },
    {
      key: "gia",
      header: "Đơn giá bán (đ)",
      numeric: true,
      render: (r) =>
        r.sellingPrice != null ? (
          num(r.sellingPrice)
        ) : (
          <Tag variant="error">Chưa có giá</Tag>
        ),
      getSortValue: (r) => r.sellingPrice ?? 0,
    },
    {
      key: "tien",
      header: "Thành tiền (đ)",
      numeric: true,
      render: (r) => num(r.quantityKg * (r.sellingPrice ?? 0)),
      getSortValue: (r) => r.quantityKg * (r.sellingPrice ?? 0),
    },
    {
      key: "ky",
      header: "Kỳ cân đối",
      render: (r) =>
        r.periodId ? (
          <Tag variant="done">Đã vào kỳ</Tag>
        ) : (
          <Tag variant="pending">Chưa vào kỳ</Tag>
        ),
    },
  ];

  return (
    <section className="space-y-4 rounded-xl border-2 border-border p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
        <div className="flex items-start gap-3">
          <Scale className="mt-1 size-6 text-muted-foreground" aria-hidden />
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Phế liệu cân trong ngày (nội tạng, dạt)
            </h2>
            <p className="text-base text-muted-foreground">
              Cân gộp cuối ngày cho xưởng {workshop}, ngày {formatDateVN(date)}. Màn
              Cân đối lấy lại số này — không nhập lại lần nữa.
            </p>
          </div>
        </div>
        {isLocked ? (
          <Tag variant="done" icon={Lock}>
            Ngày đã chốt
          </Tag>
        ) : isReadOnly ? (
          <Tag variant="source">Ghi ở “Ghi nhập trong ngày”</Tag>
        ) : (
          <Button
            title="Ghi một dòng phế liệu phát sinh trong ngày (đầu, da, vụn…) để kỳ cân đối hút sang."
            size="lg"
            onClick={() => {
              setEditing(newScrapItem());
              setIsAdding(true);
              setErrors([]);
            }}
          >
            <Plus />
            Thêm phế liệu
          </Button>
        )}
      </div>

      <RecordTable
        columns={cols}
        rows={dayScrapRows}
        getKey={(r) => r.id}
        rowMarkKey="phe-lieu-ngay"
        emptyText="Chưa cân phế liệu cho ngày này."
        actions={
          isLocked || isReadOnly
            ? undefined
            : (r) => (
                <>
                  <Button
                    title="Sửa dòng phế liệu này (tên · số kg · giá bán)."
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing({ ...r });
                      setIsAdding(false);
                      setErrors([]);
                    }}
                  >
                    <Pencil />
                    Sửa
                  </Button>
                  <ConfirmDelete
                    recordDescription={`${r.name} — ${kg(r.quantityKg)} — ngày ${formatDateVN(r.date)}`}
                    onConfirm={() => {
                      const prevRows = rows;
                      onChange(rows.filter((x) => x.id !== r.id));
                      notify.deleted(`Đã xóa phế liệu ${r.name}`, () =>
                        onChange(prevRows)
                      );
                    }}
                    title="Xóa dòng phế liệu này?"
                    confirmLabel="Xóa dòng"
                  />
                </>
              )
        }
      />

      {dayScrapRows.length > 0 && (
        <div className="flex flex-wrap justify-end gap-x-10 gap-y-3 rounded-xl bg-muted px-5 py-4">
          <div className="flex items-baseline gap-3">
            <span className="text-base text-muted-foreground">
              Tổng phế liệu
            </span>
            <span className="tnum text-xl font-semibold">{kg(totalKg)}</span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-base text-muted-foreground">Tổng tiền</span>
            <span className="tnum text-xl font-semibold">
              {num(totalAmount)} đ
            </span>
          </div>
        </div>
      )}

      <Dialog
        open={editing !== null}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
      >
        <DialogContent className="w-full sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {isAdding ? "Thêm phế liệu" : "Sửa phế liệu"}
            </DialogTitle>
            <DialogDescription className="text-base">
              Ngày {formatDateVN(date)} · xưởng {workshop}.
              {isAdding
                ? " Có cả nội tạng lẫn dạt: bấm “Lưu, ghi tiếp loại khác” cho loại đầu."
                : ""}
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-6 py-2">
              <ErrorSummary errors={errors} />
              <RequiredLegend />

              <Combobox
                label="Loại phế liệu"
                required
                hint="Mặc định Nội tạng — cân hàng dạt thì đổi sang Dạt. Loại khác: gõ tên rồi bấm Thêm mới."
                value={editing.name}
                onChange={(v) => setEditing((d) => (d ? { ...d, name: v } : d))}
                options={typeOptions}
                onCreate={(name) => name}
              />

              <div className="grid gap-6 sm:grid-cols-2">
                <NumberField
                  label="Số lượng"
                  required
                  unit="kg"
                  value={editing.quantityKg || null}
                  onChange={(v) =>
                    setEditing((d) => (d ? { ...d, quantityKg: v ?? 0 } : d))
                  }
                />
                <NumberField
                  label="Đơn giá bán"
                  unit="đ"
                  value={editing.sellingPrice}
                  onChange={(v) =>
                    setEditing((d) => (d ? { ...d, sellingPrice: v } : d))
                  }
                  hint="Bỏ trống nếu chưa chốt giá bán."
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="lg"
              onClick={() => setEditing(null)}
            >
              Hủy
            </Button>
            {isAdding && (
              <Button
                title="Lưu dòng này rồi để hộp thoại mở để ghi tiếp loại phế liệu khác (VD vừa ghi nội tạng, giờ ghi dạt)."
                variant="outline"
                size="lg"
                onClick={() => save(true)}
              >
                <Plus />
                Lưu, ghi tiếp loại khác
              </Button>
            )}
            <Button
              title={
                isAdding
                  ? "Lưu dòng phế liệu này vào sổ của ngày đang chọn rồi đóng hộp thoại."
                  : "Lưu thay đổi của dòng phế liệu này."
              }
              size="lg"
              onClick={() => save(false)}
            >
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
