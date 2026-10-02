// ============================================================
// Tên file: src/features/shared/SuaThanhPhamNhanh.tsx
// Tên tiếng Việt: Hộp sửa nhanh một thành phẩm (mặt hàng) ngay tại màn ghi SX
// ============================================================
// Sửa BẢN GHI MẶT HÀNG (bảng `products`, danh mục MỞ — tầng 3) chứ KHÔNG sửa
// 141 mã kế toán TK 1551 (chỉ chọn để ánh xạ). Dòng sản lượng lưu `productId`
// nên đổi tên / loài / kiểu chế biến ở đây hiện đúng ở MỌI dòng đã ghi — cùng
// một nguồn với Danh mục › Mặt hàng, không sinh bản sao.
import { useMemo, useState } from "react";
import type { Product } from "@/types";
import { CATEGORIES, KIEU_CHE_BIEN, laCoTach, quyCachBlock } from "@/types";
import { useFinishedGoods } from "@/lib/catalogRepo";
import {
  Button,
  ChoiceGroup,
  Combobox,
  ErrorSummary,
  Field,
  FormDialog,
  Input,
  NumberField,
  notify,
  type LoiNhap,
} from "@/design-system";
import { Pencil } from "lucide-react";

const chuan = (s: string) => s.trim().toLocaleLowerCase("vi");

export function SuaThanhPhamNhanh({
  thanhPham,
  tatCa,
  soDongDaGhi,
  onLuu,
  onClose,
}: {
  thanhPham: Product;
  /** Mọi mặt hàng — để kiểm trùng tên / mã số. */
  tatCa: Product[];
  /** Số dòng sản lượng đã lưu dùng thành phẩm này — báo cho người sửa biết tầm ảnh hưởng. */
  soDongDaGhi: number;
  onLuu: (p: Product) => void;
  onClose: () => void;
}) {
  const [dang, setDang] = useState<Product>({ ...thanhPham });
  const [loi, setLoi] = useState<LoiNhap[]>([]);
  const [thanhPham141] = useFinishedGoods();
  const dat = (patch: Partial<Product>) => setDang((d) => ({ ...d, ...patch }));

  const optTP141 = useMemo(
    () =>
      thanhPham141.map((t) => ({
        value: t.code,
        label: t.name,
        phu: `Mã ${t.code} · ${t.groupName}`,
      })),
    [thanhPham141]
  );
  const optCheBien = useMemo(
    () =>
      [...new Set([...KIEU_CHE_BIEN, ...tatCa.map((m) => (m.processingType || "").trim())])]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "vi"))
        .map((v) => ({ value: v, label: v })),
    [tatCa]
  );

  const luu = () => {
    const ls: LoiNhap[] = [];
    const ten = dang.name.trim();
    if (!ten) ls.push({ truong: "Tên thành phẩm", thongBao: "Chưa nhập tên" });
    else if (tatCa.some((m) => m.id !== dang.id && chuan(m.name) === chuan(ten)))
      ls.push({
        truong: "Tên thành phẩm",
        thongBao: `Đã có thành phẩm khác tên "${ten}" — chọn thành phẩm đó thay vì đặt trùng tên.`,
      });
    const ma = (dang.code ?? "").trim();
    if (ma && tatCa.some((m) => m.id !== dang.id && (m.code ?? "").trim() === ma))
      ls.push({
        truong: "Mã số",
        thongBao: `Mã số "${ma}" đã dùng cho thành phẩm khác — đổi số khác hoặc để trống.`,
      });
    setLoi(ls);
    if (ls.length) return;
    onLuu({ ...dang, name: ten, code: ma });
    notify.daLuu(`Đã lưu thành phẩm "${ten}"`);
    onClose();
  };

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      icon={Pencil}
      tieuDe="Sửa thành phẩm"
      moTa={
        soDongDaGhi > 0
          ? `Sửa ở đây là sửa trong Danh mục — ${soDongDaGhi} dòng sản lượng đã ghi với thành phẩm này sẽ hiện theo thông tin mới.`
          : "Sửa ở đây là sửa trong Danh mục — áp cho mọi màn dùng thành phẩm này."
      }
      rong="rong"
      chan={
        <>
          <Button variant="outline" size="lg" onClick={onClose}>
            Hủy
          </Button>
          <Button
            size="lg"
            title="Lưu thông tin thành phẩm vào Danh mục mặt hàng."
            onClick={luu}
          >
            Lưu
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <ErrorSummary loi={loi} />
        <div className="grid gap-5 sm:grid-cols-[1fr_10rem] [&>*]:min-w-0">
          <Field label="Tên thành phẩm" required hint="VD: 2 da cắt luộc 1000-1300">
            <Input value={dang.name} onChange={(e) => dat({ name: e.target.value })} />
          </Field>
          <Field label="Mã số" hint="Gõ số này khi chọn là ra tên.">
            <Input value={dang.code} onChange={(e) => dat({ code: e.target.value })} />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 [&>*]:min-w-0">
          <Combobox
            label="Loài"
            hint="Cấp gom nhóm khi ghi thành phẩm."
            value={dang.category ?? ""}
            onChange={(v) => dat({ category: v })}
            options={CATEGORIES.map((l) => ({ value: l, label: l }))}
            onCreate={(t) => t}
            placeholder="— Chọn loài —"
          />
          <Combobox
            label="Kiểu chế biến"
            hint="Luộc, chần, cắt… Chưa có thì gõ rồi Thêm mới."
            value={dang.processingType ?? ""}
            onChange={(v) => dat({ processingType: v })}
            options={optCheBien}
            onCreate={(t) => t}
            placeholder="— Chọn kiểu chế biến —"
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 [&>*]:min-w-0">
          <ChoiceGroup
            label="Tách râu + bao tử"
            hint="Có tách: khi ghi sẽ tự mở ô râu + bao tử."
            value={laCoTach(dang) ? "1" : "0"}
            onChange={(v) => dat({ splitComponents: v === "1" })}
            options={[
              { value: "1", label: "Có tách" },
              { value: "0", label: "Không tách" },
            ]}
          />
          <NumberField
            label="Quy cách mỗi block"
            unit="kg"
            hint="Để trống nếu không cố định."
            value={quyCachBlock(dang) ?? null}
            onChange={(v) => dat({ blockSpecKg: v })}
          />
        </div>
        <Combobox
          label="Mã thành phẩm kế toán (TK 1551)"
          hint={`Chỉ CHỌN để ánh xạ trong ${thanhPham141.length} mã — không sửa mã kế toán ở đây.`}
          value={dang.finishedGoodCode}
          onChange={(v) => dat({ finishedGoodCode: v })}
          options={optTP141}
          placeholder="— Chưa ánh xạ —"
          emptyText="Không có mã nào khớp."
        />
      </div>
    </FormDialog>
  );
}
