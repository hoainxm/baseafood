import { useMemo, useState } from "react";
import type { DongNhapNL, PhanXuong, Loai } from "@/types";
import { LOAI, thanhTien } from "@/types";
import { newId } from "@/lib/store";
import { uid } from "@/lib/db";
import { useDaiLy, useLoaiNL, useNhapNL } from "@/lib/danhMuc";
import {
  Badge,
  Button,
  ChoiceGroup,
  Combobox,
  ConfirmDelete,
  ContextBar,
  DateField,
  DateRangeField,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorSummary,
  Field,
  Input,
  NumberField,
  RecordTable,
  notify,
  type Cot,
  type LoiNhap,
} from "@/design-system";
import { kg, num, todayISO, viDate } from "@/lib/format";
import { ChevronDown, Pencil, Plus, Truck, X } from "lucide-react";

const PHAN_XUONG: PhanXuong[] = ["Đông", "Cá", "Khô"];

/** Xem sổ theo một ngày, hay theo cả khoảng ngày. */
type CheDoXem = "mot-ngay" | "khoang-ngay";

/** Đầu chuyến — dùng chung cho mọi dòng loại hàng trong cùng chuyến (1 đại lý, 1 xe). */
interface PhienChuyen {
  ngay: string;
  phanXuong: PhanXuong;
  daiLy: string;
  taiXe: string;
  bienSoXe: string;
  ghiChu: string;
}

/** Một dòng loại hàng đang nhập trong chuyến. */
interface DongMoi {
  loai: Loai;
  loaiNL: string;
  soLuongKg: number;
  donGia: number | null;
}

const DONG_MOI_RONG: DongMoi = {
  loai: "Bạch tuộc",
  loaiNL: "",
  soLuongKg: 0,
  donGia: null,
};

export default function NhapNguyenLieuScreen() {
  const [rows, persist] = useNhapNL();
  const [cheDo, setCheDo] = useState<CheDoXem>("mot-ngay");
  const [ngay, setNgay] = useState(todayISO());
  const [tuNgay, setTuNgay] = useState(todayISO());
  const [denNgay, setDenNgay] = useState(todayISO());
  const [phanXuong, setPhanXuong] = useState<PhanXuong | "Tất cả">("Đông");
  const [locDaiLy, setLocDaiLy] = useState("");
  const [locLoaiNL, setLocLoaiNL] = useState("");

  const [daiLy, setDaiLy] = useDaiLy();
  const [loaiNL, setLoaiNL] = useLoaiNL();

  // Sửa MỘT dòng đã ghi (bấm "Sửa" ở bảng).
  const [dang, setDang] = useState<DongNhapNL | null>(null);
  const [loi, setLoi] = useState<LoiNhap[]>([]);
  const [moPhu, setMoPhu] = useState(false);

  /* Ghi MỘT CHUYẾN = một đại lý đổ NHIỀU loại hàng (đúng sổ "Báo cáo tổng hợp
     nguyên liệu hàng ngày": STT theo đại lý, mỗi loại một dòng). Thêm loại nào
     LƯU LUÔN loại đó — không mất, không phải bấm mở lại từng dòng. */
  const [phien, setPhien] = useState<PhienChuyen | null>(null);
  const [dongMoi, setDongMoi] = useState<DongMoi>(DONG_MOI_RONG);
  const [idsPhien, setIdsPhien] = useState<string[]>([]);
  const [loiPhien, setLoiPhien] = useState<LoiNhap[]>([]);
  const [moPhuPhien, setMoPhuPhien] = useState(false);

  const view = useMemo(
    () =>
      rows
        .filter((r) => {
          const hopNgay =
            cheDo === "mot-ngay"
              ? r.ngay === ngay
              : r.ngay >= tuNgay && r.ngay <= denNgay;
          const hopXuong = phanXuong === "Tất cả" || r.phanXuong === phanXuong;
          const hopDaiLy = !locDaiLy || r.daiLy === locDaiLy;
          const hopLoai = !locLoaiNL || r.loaiNL === locLoaiNL;
          return hopNgay && hopXuong && hopDaiLy && hopLoai;
        })
        .sort(
          (a, b) => a.ngay.localeCompare(b.ngay) || a.id.localeCompare(b.id)
        ),
    [rows, cheDo, ngay, tuNgay, denNgay, phanXuong, locDaiLy, locLoaiNL]
  );

  /** Ngày mặc định khi ghi chuyến mới — theo bộ lọc đang xem. */
  const ngayGhi = cheDo === "mot-ngay" ? ngay : denNgay;
  const xuongGhi: PhanXuong = phanXuong === "Tất cả" ? "Đông" : phanXuong;

  const moTaPhamVi =
    cheDo === "mot-ngay"
      ? viDate(ngay)
      : `${viDate(tuNgay)} – ${viDate(denNgay)}`;

  const tong = useMemo(
    () => view.reduce((s, r) => s + (r.soLuongKg || 0), 0),
    [view]
  );
  const tongTien = useMemo(
    () => view.reduce((s, r) => s + thanhTien(r), 0),
    [view]
  );

  /* Dòng đã thêm trong chuyến đang ghi + tổng ngày của xưởng đó (như "TỔNG CỘNG"
     cuối sổ giấy). */
  const dongPhien = useMemo(
    () =>
      idsPhien
        .map((id) => rows.find((r) => r.id === id))
        .filter((r): r is DongNhapNL => Boolean(r)),
    [rows, idsPhien]
  );
  const tongChuyen = dongPhien.reduce((s, r) => s + (r.soLuongKg || 0), 0);
  const tongNgayPhien = phien
    ? rows
        .filter(
          (r) => r.ngay === phien.ngay && r.phanXuong === phien.phanXuong
        )
        .reduce((s, r) => s + (r.soLuongKg || 0), 0)
    : 0;

  /* ---- Danh mục: chọn sẵn, thiếu thì tạo ngay tại chỗ ----
     Lưu theo TÊN (không phải id) để dữ liệu cũ trong localStorage vẫn đọc được. */

  const optDaiLy = daiLy.map((d) => ({
    value: d.ten,
    label: d.ten,
    phu: d.dienThoai || undefined,
  }));

  const themDaiLy = (ten: string) => {
    setDaiLy([...daiLy, { id: uid(), ma: "", ten, dienThoai: "", ghiChu: "" }]);
    notify.daLuu(`Đã thêm đại lý "${ten}" vào danh mục`);
    return ten;
  };

  const optLoaiNL = loaiNL.map((l) => ({
    value: l.ten,
    label: l.ten,
    phu: l.loai || undefined,
  }));

  const themLoaiNL = (ten: string) => {
    setLoaiNL([...loaiNL, { id: uid(), ten, loai: "", ghiChu: "" }]);
    notify.daLuu(`Đã thêm loại nguyên liệu "${ten}" vào danh mục`);
    return ten;
  };

  /* ---- Thêm / sửa / xóa ---- */

  /* ---- Ghi chuyến: mở sổ, thêm từng loại (lưu ngay), sửa đầu chuyến ---- */

  const moThem = () => {
    setPhien({
      ngay: ngayGhi,
      phanXuong: xuongGhi,
      daiLy: "",
      taiXe: "",
      bienSoXe: "",
      ghiChu: "",
    });
    setDongMoi(DONG_MOI_RONG);
    setIdsPhien([]);
    setLoiPhien([]);
    setMoPhuPhien(false);
  };

  /** Đổi đầu chuyến (đại lý, ngày, xưởng, tài xế…) → áp cho MỌI dòng đã thêm
      trong chuyến này, giữ chuyến nhất quán. */
  const doiPhien = <K extends keyof PhienChuyen>(k: K, v: PhienChuyen[K]) => {
    setPhien((p) => (p ? { ...p, [k]: v } : p));
    if (idsPhien.length > 0) {
      const ids = new Set(idsPhien);
      persist(rows.map((r) => (ids.has(r.id) ? { ...r, [k]: v } : r)));
    }
  };

  const setDong = <K extends keyof DongMoi>(k: K, v: DongMoi[K]) =>
    setDongMoi((d) => ({ ...d, [k]: v }));

  /** Thêm một loại vào sổ — LƯU NGAY thành một dòng nhap_nguyen_lieu. */
  const themDong = () => {
    if (!phien) return;
    const ls: LoiNhap[] = [];
    if (!phien.daiLy.trim())
      ls.push({ truong: "Đại lý", thongBao: "Chưa chọn đại lý giao hàng" });
    if (!dongMoi.loaiNL.trim())
      ls.push({ truong: "Loại nguyên liệu", thongBao: "Chưa chọn loại hàng" });
    if (!(dongMoi.soLuongKg > 0))
      ls.push({ truong: "Số lượng", thongBao: "Phải lớn hơn 0 kg" });
    setLoiPhien(ls);
    if (ls.length > 0) return;

    const dong: DongNhapNL = {
      id: newId(),
      ngay: phien.ngay,
      phanXuong: phien.phanXuong,
      loai: dongMoi.loai,
      daiLy: phien.daiLy,
      loaiNL: dongMoi.loaiNL,
      soLuongKg: dongMoi.soLuongKg,
      donGia: dongMoi.donGia,
      taiXe: phien.taiXe,
      bienSoXe: phien.bienSoXe,
      ghiChu: phien.ghiChu,
    };
    persist([...rows, dong]);
    setIdsPhien((xs) => [...xs, dong.id]);
    notify.daLuu(`Đã ghi ${kg(dong.soLuongKg)} — ${dong.loaiNL}`);
    // Giữ đại lý/tài xế/xe + loài để đổ tiếp loại sau cho nhanh; xóa loại/kg/giá.
    setDongMoi((d) => ({ ...DONG_MOI_RONG, loai: d.loai }));
    setLoiPhien([]);
  };

  /** Bỏ một dòng vừa thêm trong chuyến (có Hoàn tác). */
  const boDongPhien = (r: DongNhapNL) => {
    const truoc = rows;
    persist(rows.filter((x) => x.id !== r.id));
    setIdsPhien((xs) => xs.filter((id) => id !== r.id));
    notify.daXoa(`Đã bỏ ${r.loaiNL} — ${kg(r.soLuongKg)}`, () => {
      persist(truoc);
      setIdsPhien((xs) => [...xs, r.id]);
    });
  };

  const moSua = (r: DongNhapNL) => {
    setDang({ ...r });
    setLoi([]);
    setMoPhu(Boolean(r.taiXe || r.bienSoXe || r.ghiChu));
  };

  const luu = () => {
    if (!dang) return;
    const ls: LoiNhap[] = [];
    if (!dang.daiLy.trim())
      ls.push({ truong: "Đại lý", thongBao: "Chưa chọn đại lý giao hàng" });
    if (!dang.loaiNL.trim())
      ls.push({ truong: "Loại nguyên liệu", thongBao: "Chưa chọn loại hàng" });
    if (!(dang.soLuongKg > 0))
      ls.push({ truong: "Số lượng", thongBao: "Phải lớn hơn 0 kg" });
    setLoi(ls);
    if (ls.length > 0) return;
    persist(rows.map((r) => (r.id === dang.id ? dang : r)));
    notify.daLuu("Đã lưu thay đổi");
    setDang(null);
  };

  const xoa = (r: DongNhapNL) => {
    const truoc = rows;
    persist(rows.filter((x) => x.id !== r.id));
    notify.daXoa(`Đã xóa chuyến ${r.loaiNL} — ${kg(r.soLuongKg)}`, () =>
      persist(truoc)
    );
  };

  const set = <K extends keyof DongNhapNL>(k: K, v: DongNhapNL[K]) =>
    setDang((d) => (d ? { ...d, [k]: v } : d));

  const cols: Cot<DongNhapNL>[] = [
    ...(cheDo === "khoang-ngay"
      ? [
          {
            key: "ngay",
            header: "Ngày",
            render: (r: DongNhapNL) => viDate(r.ngay),
            sapXep: (r: DongNhapNL) => r.ngay,
          },
        ]
      : []),
    {
      key: "loaiNL",
      header: "Loại nguyên liệu",
      chinh: true,
      render: (r) => r.loaiNL,
      sapXep: (r) => r.loaiNL,
    },
    {
      key: "daiLy",
      header: "Đại lý",
      render: (r) => r.daiLy,
      sapXep: (r) => r.daiLy,
    },
    {
      key: "loai",
      header: "Loài",
      render: (r) => <Badge>{r.loai}</Badge>,
      sapXep: (r) => r.loai,
    },
    {
      key: "sl",
      header: "Số lượng (kg)",
      so: true,
      render: (r) => num(r.soLuongKg),
      sapXep: (r) => r.soLuongKg,
    },
    {
      key: "gia",
      header: "Đơn giá (đ)",
      so: true,
      render: (r) =>
        r.donGia != null ? (
          num(r.donGia)
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      sapXep: (r) => r.donGia ?? 0,
    },
    {
      key: "tien",
      header: "Thành tiền (đ)",
      so: true,
      render: (r) => num(thanhTien(r)),
      sapXep: (r) => thanhTien(r),
    },
    {
      key: "xe",
      header: "Xe",
      anTrenDienThoai: true,
      render: (r) =>
        [r.taiXe, r.bienSoXe].filter(Boolean).join(" · ") || (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">
          Nhập hàng về xưởng
        </h1>
        <p className="mt-2 max-w-2xl text-base text-muted-foreground">
          Ghi theo sổ "Báo cáo tổng hợp nguyên liệu hàng ngày": mỗi chuyến là một
          đại lý, đổ nhiều loại hàng — mỗi loại một dòng.
        </p>
      </div>

      <ContextBar
        items={[
          { nhan: "Đang xem", giaTri: moTaPhamVi },
          { nhan: "Phân xưởng", giaTri: phanXuong },
          {
            nhan: "Số chuyến",
            giaTri: new Set(view.map((r) => r.daiLy)).size,
            so: true,
          },
          { nhan: "Số dòng", giaTri: view.length, so: true },
          { nhan: "Tổng", giaTri: kg(tong), so: true },
        ]}
        actions={
          <Button size="lg" onClick={moThem}>
            <Plus />
            Ghi chuyến hàng
          </Button>
        }
      />

      {/* Bộ lọc — mỗi hàng một câu hỏi, các ô cùng chiều cao nên thẳng hàng */}
      <div className="space-y-5 rounded-xl border-2 border-border p-5">
        <div className="grid gap-5 lg:grid-cols-2">
          <ChoiceGroup
            label="Xem theo"
            anNhanBatBuoc
            value={cheDo}
            onChange={(v) => setCheDo(v as CheDoXem)}
            options={[
              { value: "mot-ngay", label: "Một ngày" },
              { value: "khoang-ngay", label: "Khoảng ngày" },
            ]}
            cot={2}
          />
          <ChoiceGroup
            label="Phân xưởng"
            anNhanBatBuoc
            value={phanXuong}
            onChange={(v) => setPhanXuong(v as PhanXuong | "Tất cả")}
            options={[
              ...PHAN_XUONG.map((p) => ({ value: p, label: p })),
              { value: "Tất cả", label: "Tất cả" },
            ]}
            cot={4}
          />
        </div>

        {cheDo === "mot-ngay" ? (
          <DateField
            label="Ngày nhập hàng"
            anNhanBatBuoc
            value={ngay}
            onChange={setNgay}
          />
        ) : (
          <DateRangeField
            label="Khoảng ngày nhập hàng"
            anNhanBatBuoc
            tuNgay={tuNgay}
            denNgay={denNgay}
            onChange={(tu, den) => {
              setTuNgay(tu);
              setDenNgay(den);
            }}
          />
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          <Combobox
            label="Chỉ xem đại lý"
            anNhanBatBuoc
            value={locDaiLy}
            onChange={setLocDaiLy}
            options={optDaiLy}
            placeholder="Tất cả đại lý"
          />
          <Combobox
            label="Chỉ xem loại nguyên liệu"
            anNhanBatBuoc
            value={locLoaiNL}
            onChange={setLocLoaiNL}
            options={optLoaiNL}
            placeholder="Tất cả loại"
          />
        </div>

        {(locDaiLy || locLoaiNL || phanXuong === "Tất cả") && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setLocDaiLy("");
                setLocLoaiNL("");
                setPhanXuong("Đông");
              }}
            >
              <X />
              Bỏ hết bộ lọc
            </Button>
          </div>
        )}
      </div>

      {view.length === 0 ? (
        <EmptyState
          icon={Truck}
          tieuDe={`Chưa có chuyến nào trong ${moTaPhamVi}`}
          moTa={
            phanXuong === "Tất cả"
              ? "Bấm nút dưới để ghi chuyến đầu tiên."
              : `Phân xưởng ${phanXuong}. Bấm nút dưới để ghi chuyến đầu tiên.`
          }
          action={
            <Button size="lg" onClick={moThem}>
              <Plus />
              Ghi chuyến hàng
            </Button>
          }
        />
      ) : (
        <>
          <RecordTable
            columns={cols}
            rows={view}
            getKey={(r) => r.id}
            timKiem={(r) =>
              `${r.loaiNL} ${r.daiLy} ${r.loai} ${r.taiXe} ${r.bienSoXe} ${r.ghiChu}`
            }
            nhanTimKiem="Tìm theo loại hàng, đại lý, xe…"
            actions={(r) => (
              <>
                <Button variant="outline" size="sm" onClick={() => moSua(r)}>
                  <Pencil />
                  Sửa
                </Button>
                <ConfirmDelete
                  moTaBanGhi={`${r.loaiNL} — ${kg(r.soLuongKg)} — đại lý ${r.daiLy} — ngày ${viDate(r.ngay)}`}
                  onConfirm={() => xoa(r)}
                  tieuDe="Xóa chuyến hàng này?"
                  nhanNut="Xóa chuyến"
                />
              </>
            )}
          />

          <div className="flex flex-wrap justify-end gap-x-10 gap-y-3 rounded-xl bg-muted px-5 py-4">
            <div className="flex items-baseline gap-3">
              <span className="text-base text-muted-foreground">
                Tổng khối lượng
              </span>
              <span className="tnum text-xl font-semibold">{kg(tong)}</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-base text-muted-foreground">
                Tổng tiền hàng
              </span>
              <span className="tnum text-xl font-semibold">
                {num(tongTien)} đ
              </span>
            </div>
          </div>
        </>
      )}

      {/* Hộp thoại SỬA một dòng đã ghi */}
      <Dialog
        open={dang !== null}
        onOpenChange={(o) => {
          if (!o) setDang(null);
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto w-full sm:max-w-3xl lg:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Sửa dòng hàng</DialogTitle>
            <DialogDescription className="text-base">
              Sửa được ngày và phân xưởng ngay trong hộp thoại này.
            </DialogDescription>
          </DialogHeader>

          {dang && (
            <div className="space-y-6 py-2">
              <ErrorSummary loi={loi} />

              <div className="grid gap-6 sm:grid-cols-2">
                <DateField
                  label="Ngày nhập hàng"
                  required
                  value={dang.ngay}
                  onChange={(v) => set("ngay", v)}
                />
                <ChoiceGroup
                  label="Phân xưởng"
                  required
                  value={dang.phanXuong}
                  onChange={(v) => set("phanXuong", v as PhanXuong)}
                  options={PHAN_XUONG.map((p) => ({ value: p, label: p }))}
                  cot={3}
                />
              </div>

              <Combobox
                label="Đại lý giao hàng"
                required
                hint="Chọn trong danh mục. Chưa có thì gõ tên rồi bấm Thêm mới."
                value={dang.daiLy}
                onChange={(v) => set("daiLy", v)}
                options={optDaiLy}
                onCreate={themDaiLy}
                emptyText="Chưa có đại lý nào trong danh mục."
              />

              <Combobox
                label="Loại nguyên liệu"
                required
                hint="Quy cách / size hàng về, VD: 2 da nguyên liệu."
                value={dang.loaiNL}
                onChange={(v) => set("loaiNL", v)}
                options={optLoaiNL}
                onCreate={themLoaiNL}
              />

              <ChoiceGroup
                label="Loài"
                required
                value={dang.loai}
                onChange={(v) => set("loai", v as Loai)}
                options={LOAI.map((l) => ({ value: l, label: l }))}
                cot={3}
              />

              <div className="grid gap-6 sm:grid-cols-2">
                <NumberField
                  label="Số lượng"
                  required
                  unit="kg"
                  value={dang.soLuongKg || null}
                  onChange={(v) => set("soLuongKg", v ?? 0)}
                />
                <NumberField
                  label="Đơn giá"
                  unit="đ"
                  value={dang.donGia}
                  onChange={(v) => set("donGia", v)}
                  hint="Bỏ trống nếu chưa chốt giá."
                />
              </div>

              {dang.soLuongKg > 0 && dang.donGia ? (
                <div className="rounded-lg bg-accent px-4 py-3 text-base text-accent-foreground">
                  Thành tiền:{" "}
                  <span className="tnum text-lg font-semibold">
                    {num(dang.soLuongKg * dang.donGia)} đ
                  </span>
                </div>
              ) : null}

              {/* Thông tin phụ gập lại — ít khi cần, không nên chiếm màn */}
              <div className="rounded-xl border-2 border-border">
                <button
                  type="button"
                  onClick={() => setMoPhu((v) => !v)}
                  aria-expanded={moPhu}
                  className="flex min-h-14 w-full items-center justify-between px-4 text-base font-semibold"
                >
                  Xe và ghi chú (không bắt buộc)
                  <ChevronDown
                    className={`size-6 transition-transform ${moPhu ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>
                {moPhu && (
                  <div className="space-y-5 border-t-2 border-border p-4">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field label="Tài xế">
                        <Input
                          value={dang.taiXe}
                          onChange={(e) => set("taiXe", e.target.value)}
                          placeholder="Tên tài xế"
                        />
                      </Field>
                      <Field label="Biển số xe">
                        <Input
                          value={dang.bienSoXe}
                          onChange={(e) => set("bienSoXe", e.target.value)}
                          placeholder="VD: 86C 19555"
                        />
                      </Field>
                    </div>
                    <Field label="Ghi chú">
                      <Input
                        value={dang.ghiChu}
                        onChange={(e) => set("ghiChu", e.target.value)}
                        placeholder="Ghi chú thêm (nếu có)"
                      />
                    </Field>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setDang(null)}>
              Hủy
            </Button>
            <Button size="lg" onClick={luu}>
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hộp thoại GHI CHUYẾN — một đại lý, nhiều loại, thêm loại nào lưu ngay */}
      <Dialog
        open={phien !== null}
        onOpenChange={(o) => {
          if (!o) setPhien(null);
        }}
      >
        <DialogContent className="max-h-[92vh] w-full overflow-y-auto sm:max-w-3xl lg:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Ghi chuyến hàng</DialogTitle>
            <DialogDescription className="text-base">
              Một chuyến = một đại lý. Thêm từng loại hàng — bấm "Thêm vào sổ" là
              lưu ngay, không mất. Xong cả chuyến thì bấm "Hoàn thành".
            </DialogDescription>
          </DialogHeader>

          {phien && (
            <div className="space-y-6 py-2">
              {/* Đầu chuyến: ngày + xưởng + đại lý (áp cho mọi dòng của chuyến) */}
              <div className="grid gap-6 sm:grid-cols-2">
                <DateField
                  label="Ngày nhập hàng"
                  required
                  value={phien.ngay}
                  onChange={(v) => doiPhien("ngay", v)}
                />
                <ChoiceGroup
                  label="Phân xưởng"
                  required
                  value={phien.phanXuong}
                  onChange={(v) => doiPhien("phanXuong", v as PhanXuong)}
                  options={PHAN_XUONG.map((p) => ({ value: p, label: p }))}
                  cot={3}
                />
              </div>

              <Combobox
                label="Đại lý giao hàng"
                required
                hint="Chọn trong danh mục. Chưa có thì gõ tên rồi bấm Thêm mới."
                value={phien.daiLy}
                onChange={(v) => doiPhien("daiLy", v)}
                options={optDaiLy}
                onCreate={themDaiLy}
                emptyText="Chưa có đại lý nào trong danh mục."
              />

              {/* Xe + ghi chú của chuyến — gập lại */}
              <div className="rounded-xl border-2 border-border">
                <button
                  type="button"
                  onClick={() => setMoPhuPhien((v) => !v)}
                  aria-expanded={moPhuPhien}
                  className="flex min-h-14 w-full items-center justify-between px-4 text-base font-semibold"
                >
                  Xe và ghi chú của chuyến (không bắt buộc)
                  <ChevronDown
                    className={`size-6 transition-transform ${moPhuPhien ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>
                {moPhuPhien && (
                  <div className="space-y-5 border-t-2 border-border p-4">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field label="Tài xế">
                        <Input
                          value={phien.taiXe}
                          onChange={(e) => doiPhien("taiXe", e.target.value)}
                          placeholder="Tên tài xế"
                        />
                      </Field>
                      <Field label="Biển số xe">
                        <Input
                          value={phien.bienSoXe}
                          onChange={(e) => doiPhien("bienSoXe", e.target.value)}
                          placeholder="VD: 86C 19555"
                        />
                      </Field>
                    </div>
                    <Field label="Ghi chú">
                      <Input
                        value={phien.ghiChu}
                        onChange={(e) => doiPhien("ghiChu", e.target.value)}
                        placeholder="Ghi chú thêm (nếu có)"
                      />
                    </Field>
                  </div>
                )}
              </div>

              {/* Danh sách loại đã thêm trong chuyến */}
              {dongPhien.length > 0 && (
                <div className="space-y-2 rounded-xl border-2 border-border p-4">
                  <p className="text-base font-semibold">
                    Đã thêm {dongPhien.length} loại — chuyến này{" "}
                    <span className="tnum">{kg(tongChuyen)}</span>
                  </p>
                  <ul className="divide-y divide-border">
                    {dongPhien.map((r, i) => (
                      <li
                        key={r.id}
                        className="flex items-center justify-between gap-3 py-2"
                      >
                        <span className="min-w-0 flex-1 truncate text-base">
                          <span className="tnum text-muted-foreground">
                            {i + 1}.
                          </span>{" "}
                          {r.loaiNL} —{" "}
                          <span className="tnum font-semibold">
                            {num(r.soLuongKg)}
                          </span>{" "}
                          kg
                          {r.donGia != null && (
                            <span className="text-muted-foreground">
                              {" "}
                              · {num(r.donGia)} đ
                            </span>
                          )}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => boDongPhien(r)}
                        >
                          <X />
                          Bỏ
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Thêm một loại hàng vào chuyến */}
              <div className="space-y-5 rounded-xl border-2 border-primary/40 bg-accent/40 p-4">
                <p className="text-base font-semibold">Thêm loại hàng</p>
                <ErrorSummary loi={loiPhien} />

                <Combobox
                  label="Loại nguyên liệu"
                  required
                  hint="Quy cách / size hàng về, VD: 2 da nguyên liệu."
                  value={dongMoi.loaiNL}
                  onChange={(v) => setDong("loaiNL", v)}
                  options={optLoaiNL}
                  onCreate={themLoaiNL}
                />

                <ChoiceGroup
                  label="Loài"
                  required
                  value={dongMoi.loai}
                  onChange={(v) => setDong("loai", v as Loai)}
                  options={LOAI.map((l) => ({ value: l, label: l }))}
                  cot={3}
                />

                <div className="grid gap-6 sm:grid-cols-2">
                  <NumberField
                    label="Số lượng"
                    required
                    unit="kg"
                    value={dongMoi.soLuongKg || null}
                    onChange={(v) => setDong("soLuongKg", v ?? 0)}
                  />
                  <NumberField
                    label="Đơn giá"
                    unit="đ"
                    value={dongMoi.donGia}
                    onChange={(v) => setDong("donGia", v)}
                    hint="Bỏ trống nếu chưa chốt giá."
                  />
                </div>

                {dongMoi.soLuongKg > 0 && dongMoi.donGia ? (
                  <div className="rounded-lg bg-accent px-4 py-3 text-base text-accent-foreground">
                    Thành tiền:{" "}
                    <span className="tnum text-lg font-semibold">
                      {num(dongMoi.soLuongKg * dongMoi.donGia)} đ
                    </span>
                  </div>
                ) : null}

                <Button size="lg" className="w-full" onClick={themDong}>
                  <Plus />
                  Thêm loại này vào sổ
                </Button>
              </div>

              {/* Tổng ngày — như "TỔNG CỘNG" cuối sổ giấy */}
              <div className="flex flex-wrap items-baseline justify-end gap-x-8 gap-y-2 rounded-xl bg-muted px-5 py-4">
                <span className="text-base text-muted-foreground">
                  Tổng ngày {viDate(phien.ngay)} · xưởng {phien.phanXuong}
                </span>
                <span className="tnum text-2xl font-semibold">
                  {kg(tongNgayPhien)}
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button size="lg" onClick={() => setPhien(null)}>
              Hoàn thành
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
