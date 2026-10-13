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
import { SkeletonBang } from "./Loading";
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
    value: string,
    changeValue: (v: string) => void,
    isEditing: boolean
  ) => React.ReactNode;
  /** Hiện thế nào trong bảng. Mặc định in nguyên văn. */
  hienThi?: (row: T) => React.ReactNode;
  /** Ẩn cột này trên thẻ điện thoại (xem qua nút "Chi tiết") */
  anTrenDienThoai?: boolean;
  /** Cột phụ — ẩn khỏi BẢNG desktop cho gọn, xem qua nút "Chi tiết" cuối dòng */
  anTrenBang?: boolean;
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
  dangTai = false,
  kiemTraThem,
  toMau,
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
  /** Đang tải danh sách từ máy chủ (chưa có dữ liệu local) → hiện skeleton. */
  dangTai?: boolean;
  /** Kiểm tra thêm (ngoài ô bắt buộc) — vd trùng mã số. Trả về danh sách lỗi. */
  kiemTraThem?: (editing: T, rows: T[], isAdding: boolean) => LoiNhap[];
  /** Tô màu dòng "đã dò" — khoá ổn định của bảng danh mục (VD "danh-muc-khach-hang"). */
  toMau?: string;
}) {
  const [editing, setEditing] = React.useState<T | null>(null);
  const [isAdding, setIsAdding] = React.useState(false);
  const [loi, setLoi] = React.useState<LoiNhap[]>([]);

  const openAdd = () => {
    setEditing(taoMoi());
    setIsAdding(true);
    setLoi([]);
  };

  const openEdit = (r: T) => {
    setEditing({ ...r });
    setIsAdding(false);
    setLoi([]);
  };

  const save = () => {
    if (!editing) return;
    const ls: LoiNhap[] = fields
      .filter((f) => f.batBuoc && !String(editing[f.key] ?? "").trim())
      .map((f) => ({ truong: f.nhan, thongBao: `Chưa nhập ${f.nhan.toLowerCase()}` }));
    const extraErrors = kiemTraThem?.(editing, rows, isAdding) ?? [];
    const allRows = [...ls, ...extraErrors];
    setLoi(allRows);
    if (allRows.length > 0) return;

    if (isAdding) {
      onChange([...rows, editing]);
      notify.daLuu(`Đã thêm ${tenDonVi}`);
    } else {
      onChange(rows.map((r) => (r.id === editing.id ? editing : r)));
      notify.daLuu(`Đã lưu thay đổi`);
    }
    setEditing(null);
  };

  const remove = (r: T) => {
    const prevRows = rows;
    onChange(rows.filter((x) => x.id !== r.id));
    notify.daXoa(`Đã xóa ${tenDonVi}`, () => onChange(prevRows));
  };

  const cols: Cot<T>[] = [
    ...fields.map<Cot<T>>((f) => ({
      key: f.key,
      header: f.nhan,
      chinh: f === fields.find((x) => x.batBuoc) || undefined,
      anTrenDienThoai: f.anTrenDienThoai,
      phu: f.anTrenBang,
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
        <Button
          size="lg"
          onClick={openAdd}
          title={`Mở hộp thoại tạo một ${tenDonVi} mới. Lưu xong dùng được ngay ở mọi màn có ô chọn ${tenDonVi}.`}
        >
          <Plus />
          Thêm {tenDonVi}
        </Button>
      </div>

      {dangTai ? (
        <SkeletonBang />
      ) : rows.length === 0 ? (
        <EmptyState
          tieuDe={`Chưa có ${tenDonVi} nào`}
          moTa={`Bấm "Thêm ${tenDonVi}" để tạo mục đầu tiên.`}
          action={
            <Button
              size="lg"
              onClick={openAdd}
              title={`Mở hộp thoại tạo một ${tenDonVi} mới — mục đầu tiên của danh mục này.`}
            >
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
          toMau={toMau}
          actions={(r) => (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openEdit(r)}
                title={`Sửa thông tin ${tenDonVi} "${moTaBanGhi(r)}". Sổ đã ghi trước đó giữ nguyên tên cũ — không hồi tố.`}
              >
                <Pencil />
                Sửa
              </Button>
              <ConfirmDelete
                moTaBanGhi={moTaBanGhi(r)}
                onConfirm={() => remove(r)}
                tieuDe={`Xóa ${tenDonVi} này?`}
                nhanNut={`Xóa ${tenDonVi}`}
              />
            </>
          )}
        />
      )}

      <HopSuaDanhMuc
        dang={editing}
        laThem={isAdding}
        fields={fields}
        tenDonVi={tenDonVi}
        loi={loi}
        onDoi={setEditing}
        onLuu={save}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

/**
 * Hộp thoại Thêm / Sửa MỘT bản ghi danh mục theo bộ trường `fields` — cùng một
 * dáng ở màn Danh mục (DanhMucCrud) và ở hộp SỬA NHANH mở từ bút chì trong ô
 * chọn (`Combobox.onSuaMuc`). Kiểm tra + ghi do nơi gọi lo (`onLuu`), hộp chỉ
 * hiện `loi`.
 *
 * `khoaTruong`: hiện một trường ở dạng CHỈ ĐỌC kèm lý do (VD tên là chỗ nối với
 * sổ đã ghi nên không đổi tại chỗ được).
 */
export function HopSuaDanhMuc<T extends { id: string }>({
  dang,
  laThem,
  fields,
  tenDonVi,
  loi,
  onDoi,
  onLuu,
  onClose,
  moTa,
  khoaTruong,
}: {
  dang: T | null;
  laThem: boolean;
  fields: TruongDanhMuc<T>[];
  tenDonVi: string;
  loi: LoiNhap[];
  onDoi: (fn: (d: T | null) => T | null) => void;
  onLuu: () => void;
  onClose: () => void;
  /** Câu mô tả dưới tiêu đề. Mặc định nhắc ô dấu *. */
  moTa?: React.ReactNode;
  khoaTruong?: { key: keyof T & string; lyDo: string };
}) {
  return (
    <Dialog
      open={dang !== null}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-h-[92dvh] overflow-y-auto w-full sm:max-w-3xl lg:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {laThem ? `Thêm ${tenDonVi}` : `Sửa ${tenDonVi}`}
          </DialogTitle>
          <DialogDescription>{moTa ?? "Ô có dấu * phải nhập mới lưu được."}</DialogDescription>
        </DialogHeader>

        {dang && (
          <div className="space-y-5 py-2">
            <ErrorSummary loi={loi} />
            {fields.map((f) => {
              const value = String(dang[f.key] ?? "");
              if (khoaTruong?.key === f.key)
                return (
                  <Field key={f.key} label={f.nhan} hint={khoaTruong.lyDo}>
                    <Input value={value} readOnly aria-readonly className="bg-muted" />
                  </Field>
                );
              const changeValue = (v: string) =>
                onDoi((d) => (d ? { ...d, [f.key]: v } : d));
              return f.render ? (
                <div key={f.key}>{f.render(value, changeValue, !laThem)}</div>
              ) : (
                <Field key={f.key} label={f.nhan} required={f.batBuoc} hint={f.goiY}>
                  <Input
                    value={value}
                    onChange={(e) => changeValue(e.target.value)}
                    placeholder={f.viDu}
                  />
                </Field>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="lg" onClick={onClose}>
            Hủy
          </Button>
          <Button
            size="lg"
            onClick={onLuu}
            title={laThem ? `Lưu ${tenDonVi} mới vào danh mục.` : `Lưu các thay đổi của ${tenDonVi} này vào danh mục.`}
          >
            {laThem ? `Thêm ${tenDonVi}` : "Lưu thay đổi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
