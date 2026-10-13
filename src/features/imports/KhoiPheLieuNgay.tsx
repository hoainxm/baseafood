// ============================================================
// Tên file: src/features/imports/KhoiPheLieuNgay.tsx
// Tên tiếng Việt: Khối phế liệu cân gộp cuối ngày (nội tạng / dạt)
// Tách khỏi MaterialImportScreen.tsx ngày 2026-09-21 — KHÔNG đổi logic.
// ============================================================
import { useMemo, useState } from "react";
import type { ScrapItem, Workshop } from "@/types";
import { newId } from "@/lib/store";
import {
  Button,
  ChuThichBatBuoc,
  Combobox,
  ConfirmDelete,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorSummary,
  Nhan,
  NumberField,
  RecordTable,
  notify,
  type Cot,
  type LoiNhap,
  type MucChon,
} from "@/design-system";
import { kg, num, viDate } from "@/lib/format";
import { Lock, Pencil, Plus, Scale } from "lucide-react";
import { PHE_LIEU_GOI_Y } from "./importHelpers";

/* ---------- Phế liệu cân gộp cuối ngày (nội tạng / dạt) ---------- */

export function KhoiPheLieuNgay({
  ngay,
  phanXuong,
  rows,
  onChange,
  khoa,
  chiXem = false,
}: {
  ngay: string;
  phanXuong: Workshop;
  rows: ScrapItem[];
  onChange: (n: ScrapItem[]) => void;
  khoa: boolean;
  /** Chỉ hiển thị tóm tắt (ngoài trang) — ghi/sửa phế liệu làm trong dialog "Ghi nhập trong ngày". */
  chiXem?: boolean;
}) {
  const [editing, setEditing] = useState<ScrapItem | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [loi, setLoi] = useState<LoiNhap[]>([]);

  const dayScrapRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.source === "Nhập hàng" && r.date === ngay && r.workshop === phanXuong
      ),
    [rows, ngay, phanXuong]
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
    name: PHE_LIEU_GOI_Y.find((t) => !recordedNames.includes(t)) ?? PHE_LIEU_GOI_Y[0],
    quantityKg: 0,
    sellingPrice: null,
    date: ngay,
    workshop: phanXuong,
    source: "Nhập hàng",
  });

  const typeOptions: MucChon[] = PHE_LIEU_GOI_Y.map((t) => ({
    value: t,
    label: t,
  }));

  /** `ghiTiep`: lưu xong giữ hộp thoại mở để ghi loại khác (chỉ khi thêm mới). */
  const save = (keepEntering = false) => {
    if (!editing) return;
    const ls: LoiNhap[] = [];
    if (!editing.name.trim())
      ls.push({ truong: "Loại phế liệu", thongBao: "Chưa chọn loại phế liệu" });
    if (!(editing.quantityKg > 0))
      ls.push({ truong: "Số lượng", thongBao: "Phải lớn hơn 0 kg" });
    setLoi(ls);
    if (ls.length > 0) return;
    onChange(
      isAdding ? [...rows, editing] : rows.map((r) => (r.id === editing.id ? editing : r))
    );
    notify.daLuu(
      isAdding
        ? `Đã ghi phế liệu ${editing.name} — ${kg(editing.quantityKg)}`
        : "Đã lưu thay đổi"
    );
    if (isAdding && keepEntering) {
      // Ghi thêm loại khác: reset form, giữ hộp thoại mở, gợi ý loại chưa ghi.
      setEditing(newScrapItem([...dayScrapRows.map((r) => r.name), editing.name]));
      setLoi([]);
    } else {
      setEditing(null);
    }
  };

  const cols: Cot<ScrapItem>[] = [
    {
      key: "category",
      header: "Loại phế liệu",
      chinh: true,
      render: (r) => r.name,
      sapXep: (r) => r.name,
    },
    {
      key: "sl",
      header: "Số lượng (kg)",
      so: true,
      render: (r) => num(r.quantityKg),
      sapXep: (r) => r.quantityKg,
    },
    {
      key: "gia",
      header: "Đơn giá bán (đ)",
      so: true,
      render: (r) =>
        r.sellingPrice != null ? (
          num(r.sellingPrice)
        ) : (
          <Nhan loai="loi">Chưa có giá</Nhan>
        ),
      sapXep: (r) => r.sellingPrice ?? 0,
    },
    {
      key: "tien",
      header: "Thành tiền (đ)",
      so: true,
      render: (r) => num(r.quantityKg * (r.sellingPrice ?? 0)),
      sapXep: (r) => r.quantityKg * (r.sellingPrice ?? 0),
    },
    {
      key: "ky",
      header: "Kỳ cân đối",
      render: (r) =>
        r.periodId ? (
          <Nhan loai="xong">Đã vào kỳ</Nhan>
        ) : (
          <Nhan loai="cho">Chưa vào kỳ</Nhan>
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
              Cân gộp cuối ngày cho xưởng {phanXuong}, ngày {viDate(ngay)}. Màn
              Cân đối lấy lại số này — không nhập lại lần nữa.
            </p>
          </div>
        </div>
        {khoa ? (
          <Nhan loai="xong" icon={Lock}>
            Ngày đã chốt
          </Nhan>
        ) : chiXem ? (
          <Nhan loai="nguon">Ghi ở “Ghi nhập trong ngày”</Nhan>
        ) : (
          <Button
            title="Ghi một dòng phế liệu phát sinh trong ngày (đầu, da, vụn…) để kỳ cân đối hút sang."
            size="lg"
            onClick={() => {
              setEditing(newScrapItem());
              setIsAdding(true);
              setLoi([]);
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
        toMau="phe-lieu-ngay"
        emptyText="Chưa cân phế liệu cho ngày này."
        actions={
          khoa || chiXem
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
                      setLoi([]);
                    }}
                  >
                    <Pencil />
                    Sửa
                  </Button>
                  <ConfirmDelete
                    moTaBanGhi={`${r.name} — ${kg(r.quantityKg)} — ngày ${viDate(r.date)}`}
                    onConfirm={() => {
                      const prevRows = rows;
                      onChange(rows.filter((x) => x.id !== r.id));
                      notify.daXoa(`Đã xóa phế liệu ${r.name}`, () =>
                        onChange(prevRows)
                      );
                    }}
                    tieuDe="Xóa dòng phế liệu này?"
                    nhanNut="Xóa dòng"
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
              Ngày {viDate(ngay)} · xưởng {phanXuong}.
              {isAdding
                ? " Có cả nội tạng lẫn dạt: bấm “Lưu, ghi tiếp loại khác” cho loại đầu."
                : ""}
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-6 py-2">
              <ErrorSummary loi={loi} />
              <ChuThichBatBuoc />

              <Combobox
                label="Loại phế liệu"
                required
                hint="Mặc định Nội tạng — cân hàng dạt thì đổi sang Dạt. Loại khác: gõ tên rồi bấm Thêm mới."
                value={editing.name}
                onChange={(v) => setEditing((d) => (d ? { ...d, name: v } : d))}
                options={typeOptions}
                onCreate={(ten) => ten}
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
