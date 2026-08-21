// ============================================================
// Tên file cũ: src/design-system/patterns/DanhMucCrud.tsx
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
import { RecordTable, type Cot } from "./RecordTable";
import { ConfirmDelete } from "./ConfirmDelete";
import { ErrorSummary, type LoiNhap } from "./ErrorSummary";
import { EmptyState } from "./EmptyState";
import { notify } from "./notify";
import { Pencil, Plus } from "lucide-react";

export interface TruongDanhMuc<T> {
  key: keyof T & string;
  nhan: string;
  batBuoc?: boolean;
  goiY?: string;
  viDu?: string;
  /** Ô nhập riêng (combobox, chọn ngày…). Mặc định là ô chữ. */
  render?: (
    giaTri: string,
    doiGiaTri: (v: string) => void,
    dangSua: boolean
  ) => React.ReactNode;
  /** Hiện thế nào trong bảng. Mặc định in nguyên văn. */
  hienThi?: (row: T) => React.ReactNode;
  /** Ẩn cột này trên thẻ điện thoại */
  anTrenDienThoai?: boolean;
}

/**
 * DanhMucCrud — một khuôn cho MỌI danh mục (mặt hàng, khách hàng, đại lý,
 * loại nguyên liệu). Thêm / Sửa / Xóa / Tìm đủ bộ, cùng một cách thao tác ở
 * mọi màn — người lớn tuổi học một lần dùng được hết.
 *
 * Thêm và Sửa dùng CHUNG một hộp thoại: chỉ khác tiêu đề. Học một thao tác,
 * không phải hai.
 */
export function DanhMucCrud<T extends { id: string }>({
  tieuDe,
  moTa,
  rows,
  onChange,
  fields,
  taoMoi,
  timTheo,
  moTaBanGhi,
  tenDonVi,
}: {
  tieuDe: string;
  moTa?: string;
  rows: T[];
  onChange: (next: T[]) => void;
  fields: TruongDanhMuc<T>[];
  /** Tạo bản ghi rỗng (kèm id). */
  taoMoi: () => T;
  /** Chuỗi dùng để tìm kiếm. */
  timTheo: (row: T) => string;
  /** Mô tả bản ghi trong hộp xác nhận xóa. */
  moTaBanGhi: (row: T) => string;
  /** Danh từ đơn vị, vd "mặt hàng" → nút "Thêm mặt hàng". */
  tenDonVi: string;
}) {
  const [dang, setDang] = React.useState<T | null>(null);
  const [laThem, setLaThem] = React.useState(false);
  const [loi, setLoi] = React.useState<LoiNhap[]>([]);

  const moThem = () => {
    setDang(taoMoi());
    setLaThem(true);
    setLoi([]);
  };

  const moSua = (r: T) => {
    setDang({ ...r });
    setLaThem(false);
    setLoi([]);
  };

  const luu = () => {
    if (!dang) return;
    const ls: LoiNhap[] = fields
      .filter((f) => f.batBuoc && !String(dang[f.key] ?? "").trim())
      .map((f) => ({ truong: f.nhan, thongBao: `Chưa nhập ${f.nhan.toLowerCase()}` }));
    setLoi(ls);
    if (ls.length > 0) return;

    if (laThem) {
      onChange([...rows, dang]);
      notify.daLuu(`Đã thêm ${tenDonVi}`);
    } else {
      onChange(rows.map((r) => (r.id === dang.id ? dang : r)));
      notify.daLuu(`Đã lưu thay đổi`);
    }
    setDang(null);
  };

  const xoa = (r: T) => {
    const truoc = rows;
    onChange(rows.filter((x) => x.id !== r.id));
    notify.daXoa(`Đã xóa ${tenDonVi}`, () => onChange(truoc));
  };

  const cols: Cot<T>[] = [
    ...fields.map<Cot<T>>((f) => ({
      key: f.key,
      header: f.nhan,
      chinh: f === fields.find((x) => x.batBuoc) || undefined,
      anTrenDienThoai: f.anTrenDienThoai,
      sapXep: (r) => String(r[f.key] ?? ""),
      render: (r) =>
        f.hienThi ? (
          f.hienThi(r)
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
          <h2 className="text-xl font-semibold text-foreground">{tieuDe}</h2>
          {moTa && <p className="mt-1 text-sm text-muted-foreground">{moTa}</p>}
        </div>
        <Button size="lg" onClick={moThem}>
          <Plus />
          Thêm {tenDonVi}
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          tieuDe={`Chưa có ${tenDonVi} nào`}
          moTa={`Bấm "Thêm ${tenDonVi}" để tạo mục đầu tiên.`}
          action={
            <Button size="lg" onClick={moThem}>
              <Plus />
              Thêm {tenDonVi}
            </Button>
          }
        />
      ) : (
        <RecordTable
          columns={cols}
          rows={rows}
          getKey={(r) => r.id}
          timKiem={timTheo}
          nhanTimKiem={`Tìm ${tenDonVi}…`}
          actions={(r) => (
            <>
              <Button variant="outline" size="sm" onClick={() => moSua(r)}>
                <Pencil />
                Sửa
              </Button>
              <ConfirmDelete
                moTaBanGhi={moTaBanGhi(r)}
                onConfirm={() => xoa(r)}
                tieuDe={`Xóa ${tenDonVi} này?`}
                nhanNut={`Xóa ${tenDonVi}`}
              />
            </>
          )}
        />
      )}

      <Dialog
        open={dang !== null}
        onOpenChange={(o) => {
          if (!o) setDang(null);
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto w-full sm:max-w-3xl lg:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {laThem ? `Thêm ${tenDonVi}` : `Sửa ${tenDonVi}`}
            </DialogTitle>
            <DialogDescription>
              Ô có dấu * phải nhập mới lưu được.
            </DialogDescription>
          </DialogHeader>

          {dang && (
            <div className="space-y-5 py-2">
              <ErrorSummary loi={loi} />
              {fields.map((f) => {
                const giaTri = String(dang[f.key] ?? "");
                const doiGiaTri = (v: string) =>
                  setDang((d) => (d ? { ...d, [f.key]: v } : d));
                return f.render ? (
                  <div key={f.key}>{f.render(giaTri, doiGiaTri, !laThem)}</div>
                ) : (
                  <Field
                    key={f.key}
                    label={f.nhan}
                    required={f.batBuoc}
                    hint={f.goiY}
                  >
                    <Input
                      value={giaTri}
                      onChange={(e) => doiGiaTri(e.target.value)}
                      placeholder={f.viDu}
                    />
                  </Field>
                );
              })}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setDang(null)}>
              Hủy
            </Button>
            <Button size="lg" onClick={luu}>
              {laThem ? `Thêm ${tenDonVi}` : "Lưu thay đổi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
