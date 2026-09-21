// ============================================================
// Tên file: src/features/imports/KhoiPheLieuNgay.tsx
// Tên tiếng Việt: Khối phế liệu cân gộp cuối ngày (nội tạng / dạt)
// Tách khỏi MaterialImportScreen.tsx ngày 2026-09-21 — KHÔNG đổi logic.
// ============================================================
import { useMemo, useState } from "react";
import type { ScrapItem, Workshop } from "@/types";
import { newId } from "@/lib/store";
import {
  Badge,
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
  const [dang, setDang] = useState<ScrapItem | null>(null);
  const [laThem, setLaThem] = useState(false);
  const [loi, setLoi] = useState<LoiNhap[]>([]);

  const cuaNgay = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.source === "Nhập hàng" && r.date === ngay && r.workshop === phanXuong
      ),
    [rows, ngay, phanXuong]
  );

  const tongKg = cuaNgay.reduce((s, r) => s + (r.quantityKg || 0), 0);
  const tongTien = cuaNgay.reduce(
    (s, r) => s + r.quantityKg * (r.sellingPrice ?? 0),
    0
  );

  const optLoai: MucChon[] = PHE_LIEU_GOI_Y.map((t) => ({
    value: t,
    label: t,
  }));

  const luu = () => {
    if (!dang) return;
    const ls: LoiNhap[] = [];
    if (!dang.name.trim())
      ls.push({ truong: "Loại phế liệu", thongBao: "Chưa chọn loại phế liệu" });
    if (!(dang.quantityKg > 0))
      ls.push({ truong: "Số lượng", thongBao: "Phải lớn hơn 0 kg" });
    setLoi(ls);
    if (ls.length > 0) return;
    onChange(
      laThem ? [...rows, dang] : rows.map((r) => (r.id === dang.id ? dang : r))
    );
    notify.daLuu(
      laThem
        ? `Đã ghi phế liệu ${dang.name} — ${kg(dang.quantityKg)}`
        : "Đã lưu thay đổi"
    );
    if (laThem) {
      // Thêm được NHIỀU loại trong một lần: reset form, giữ hộp thoại mở.
      setDang({
        id: newId(),
        periodId: "",
        name: "",
        quantityKg: 0,
        sellingPrice: null,
        date: ngay,
        workshop: phanXuong,
        source: "Nhập hàng",
      });
      setLoi([]);
    } else {
      setDang(null);
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
          <Badge variant="outline">Chưa có giá</Badge>
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
          <Badge variant="secondary">Đã vào kỳ</Badge>
        ) : (
          <Badge variant="outline">Chưa vào kỳ</Badge>
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
          <Badge variant="secondary">
            <Lock aria-hidden />
            Ngày đã chốt
          </Badge>
        ) : chiXem ? (
          <Badge variant="outline">Ghi ở “Ghi nhập trong ngày”</Badge>
        ) : (
          <Button
            title="Ghi một dòng phế liệu phát sinh trong ngày (đầu, da, vụn…) để kỳ cân đối hút sang."
            size="lg"
            onClick={() => {
              setDang({
                id: newId(),
                periodId: "",
                name: "",
                quantityKg: 0,
                sellingPrice: null,
                date: ngay,
                workshop: phanXuong,
                source: "Nhập hàng",
              });
              setLaThem(true);
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
        rows={cuaNgay}
        getKey={(r) => r.id}
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
                      setDang({ ...r });
                      setLaThem(false);
                      setLoi([]);
                    }}
                  >
                    <Pencil />
                    Sửa
                  </Button>
                  <ConfirmDelete
                    moTaBanGhi={`${r.name} — ${kg(r.quantityKg)} — ngày ${viDate(r.date)}`}
                    onConfirm={() => {
                      const truoc = rows;
                      onChange(rows.filter((x) => x.id !== r.id));
                      notify.daXoa(`Đã xóa phế liệu ${r.name}`, () =>
                        onChange(truoc)
                      );
                    }}
                    tieuDe="Xóa dòng phế liệu này?"
                    nhanNut="Xóa dòng"
                  />
                </>
              )
        }
      />

      {cuaNgay.length > 0 && (
        <div className="flex flex-wrap justify-end gap-x-10 gap-y-3 rounded-xl bg-muted px-5 py-4">
          <div className="flex items-baseline gap-3">
            <span className="text-base text-muted-foreground">
              Tổng phế liệu
            </span>
            <span className="tnum text-xl font-semibold">{kg(tongKg)}</span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-base text-muted-foreground">Tổng tiền</span>
            <span className="tnum text-xl font-semibold">
              {num(tongTien)} đ
            </span>
          </div>
        </div>
      )}

      <Dialog
        open={dang !== null}
        onOpenChange={(o) => {
          if (!o) setDang(null);
        }}
      >
        <DialogContent className="w-full sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {laThem ? "Thêm phế liệu" : "Sửa phế liệu"}
            </DialogTitle>
            <DialogDescription className="text-base">
              Ngày {viDate(ngay)} · xưởng {phanXuong}.
              {laThem
                ? " Thêm được nhiều loại — mỗi loại bấm “Thêm loại này”, xong bấm “Xong”."
                : ""}
            </DialogDescription>
          </DialogHeader>

          {dang && (
            <div className="space-y-6 py-2">
              <ErrorSummary loi={loi} />
              <ChuThichBatBuoc />

              <Combobox
                label="Loại phế liệu"
                required
                hint="Chưa có trong danh sách thì gõ tên rồi bấm Thêm mới."
                value={dang.name}
                onChange={(v) => setDang((d) => (d ? { ...d, name: v } : d))}
                options={optLoai}
                onCreate={(ten) => ten}
              />

              <div className="grid gap-6 sm:grid-cols-2">
                <NumberField
                  label="Số lượng"
                  required
                  unit="kg"
                  value={dang.quantityKg || null}
                  onChange={(v) =>
                    setDang((d) => (d ? { ...d, quantityKg: v ?? 0 } : d))
                  }
                />
                <NumberField
                  label="Đơn giá bán"
                  unit="đ"
                  value={dang.sellingPrice}
                  onChange={(v) =>
                    setDang((d) => (d ? { ...d, sellingPrice: v } : d))
                  }
                  hint="Bỏ trống nếu chưa chốt giá bán."
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              title="Đóng hộp thoại, không ghi gì." variant="outline" size="lg" onClick={() => setDang(null)}>
              {laThem ? "Xong" : "Hủy"}
            </Button>
            <Button
              title="Ghi dòng phế liệu này vào sổ của ngày đang chọn." size="lg" onClick={luu}>
              {laThem ? <Plus /> : null}
              {laThem ? "Thêm loại này" : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
