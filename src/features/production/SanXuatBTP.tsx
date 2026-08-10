import { useMemo, useState } from "react";
import type { DailyLock, WipProductionItem, Product, Workshop } from "@/types";
import { isBackdatedWip } from "@/types";
import { newId } from "@/lib/store";
import { uid } from "@/lib/db";
import { useProductionLocks, useMaterialTypes, useProducts, useWipProductions } from "@/lib/danhMuc";
import {
  Badge,
  Button,
  Combobox,
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
  ThongKe,
  notify,
  type Cot,
  type LoiNhap,
  type MucChon,
} from "@/design-system";
import { kg, num, todayISO, viDate } from "@/lib/format";
import { KY_OPT, phamViKy, type KyXem } from "@/lib/ky";
import {
  CalendarRange,
  CircleCheck,
  ClipboardList,
  Factory,
  Hourglass,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  Scale,
  TriangleAlert,
  Warehouse,
  X,
} from "lucide-react";

const PHAN_XUONG: Workshop[] = ["Đông", "Cá", "Khô"];

/** Đầu phiên ghi — chọn một lần, đổ nhiều thành phẩm bên dưới. */
interface DauPhien {
  productionDate: string;
  postingDate: string;
  backdateReason: string;
  workshop: Workshop;
  materialTypeId: string; // lọc thành phẩm theo loại nguyên liệu
}
/** Một dòng thành phẩm đang thêm. */
interface DongMoi {
  productId: string;
  quantityKg: number;
  blocksCount: number;
}
const DONG_RONG: DongMoi = { productId: "", quantityKg: 0, blocksCount: 0 };

export default function SanXuatBTPScreen() {
  const [rows, persist] = useWipProductions();
  const [chot, persistChot] = useProductionLocks();
  const [matHang, setMatHang] = useProducts();
  const [loaiNL] = useMaterialTypes();

  const [ky, setKy] = useState<KyXem>("ngay");
  const [ngay, setNgay] = useState(todayISO());
  const [tuNgay, setTuNgay] = useState(todayISO());
  const [denNgay, setDenNgay] = useState(todayISO());
  const [phanXuong, setPhanXuong] = useState<Workshop | "Tất cả">("Đông");

  /* Ghi nhiều dòng trong một phiên: đầu phiên chọn 1 lần, đổ nhiều thành phẩm. */
  const [phien, setPhien] = useState<DauPhien | null>(null);
  const [materialTypeGanNhat, setLoaiNLGanNhat] = useState(""); // nhớ loại NL lần trước, đỡ chọn lại
  const [phienIds, setPhienIds] = useState<string[]>([]);
  const [dongMoi, setDongMoi] = useState<DongMoi>(DONG_RONG);
  const [loiPhien, setLoiPhien] = useState<LoiNhap[]>([]);

  /* Sửa một dòng đã ghi (từ bảng). */
  const [sua, setSua] = useState<WipProductionItem | null>(null);
  const [suaMaterialTypeId, setSuaLoaiNLId] = useState("");
  const [loiSua, setLoiSua] = useState<LoiNhap[]>([]);

  const [hoiChot, setHoiChot] = useState(false);
  const [ghiChuChot, setGhiChuChot] = useState("");
  const [hoiMoLai, setHoiMoLai] = useState(false);
  const [lyDoMoLai, setLyDoMoLai] = useState("");
  const [loiChot, setLoiChot] = useState<LoiNhap[]>([]);

  const [tuHieuLuc, denHieuLuc] = phamViKy(ky, ngay, tuNgay, denNgay);
  const laMotNgay = tuHieuLuc === denHieuLuc;

  const tenMH = (id: string) => matHang.find((m) => m.id === id)?.name || "—";
  const tenMaterialType = (id: string) => loaiNL.find((l) => l.id === id)?.name || "";
  /** Thành phẩm gợi ý THEO LOẠI NGUYÊN LIỆU (chỉ thành phẩm đã gắn đúng loại NL).
   *  Chưa có thì gõ tên → Thêm mới, tự gắn vào loại NL đang nhập (cấu hình dần). */
  const matHangCuaLoaiNL = (materialTypeId: string): MucChon[] =>
    matHang
      .filter((m) => m.materialTypeId === materialTypeId)
      .map((m) => ({ value: m.id, label: m.name }));

  const optLoaiNL: MucChon[] = loaiNL.map((l) => ({
    value: l.id,
    label: l.name,
    phu: l.category || undefined,
  }));

  const view = useMemo(
    () =>
      rows
        .filter(
          (r) =>
            r.productionDate >= tuHieuLuc &&
            r.productionDate <= denHieuLuc &&
            (phanXuong === "Tất cả" || r.workshop === phanXuong)
        )
        .sort((a, b) => a.productionDate.localeCompare(b.productionDate) || a.id.localeCompare(b.id)),
    [rows, tuHieuLuc, denHieuLuc, phanXuong]
  );

  const tong = view.reduce((s, r) => s + (r.quantityKg || 0), 0);
  const tongBlock = view.reduce((s, r) => s + (r.blocksCount || 0), 0);
  const soChoNhap = view.filter((r) => r.status === "cho-nhap").length;

  const moTaPhamVi = laMotNgay
    ? viDate(tuHieuLuc)
    : `${viDate(tuHieuLuc)} – ${viDate(denHieuLuc)}`;

  /* ---- Chốt ngày SX ---- */
  const xemMotNgayMotXuong = laMotNgay && phanXuong !== "Tất cả";
  const xuong: Workshop = phanXuong === "Tất cả" ? "Đông" : phanXuong;
  const banGhiChot = (n: string, x: Workshop): DailyLock | undefined =>
    chot.find((c) => c.lockDate === n && c.workshop === x);
  const chotHienTai = xemMotNgayMotXuong ? banGhiChot(tuHieuLuc, xuong) : undefined;
  const dangKhoa = Boolean(chotHienTai?.isLocked);
  const tongNgayXuong = (n: string, x: Workshop) =>
    rows
      .filter((r) => r.productionDate === n && r.workshop === x)
      .reduce((s, r) => s + (r.quantityKg || 0), 0);
  const tongThucTe = xemMotNgayMotXuong ? tongNgayXuong(tuHieuLuc, xuong) : 0;
  const lechSauChot =
    chotHienTai?.isLocked && tongThucTe !== chotHienTai.totalKgAtLock
      ? tongThucTe - chotHienTai.totalKgAtLock
      : 0;
  const daChot = (n: string, x: Workshop) => Boolean(banGhiChot(n, x)?.isLocked);

  const ngayGhi = laMotNgay ? tuHieuLuc : denHieuLuc;
  const xuongGhi: Workshop = phanXuong === "Tất cả" ? "Đông" : phanXuong;

  /* ---- Thêm mặt hàng (thành phẩm) tại chỗ, gắn loại NL đang chọn ---- */
  const themMatHang = (ten: string, materialTypeId: string): string => {
    const loai = loaiNL.find((l) => l.id === materialTypeId)?.category || "";
    const m: Product = { id: uid(), code: "", name: ten, finishedGoodCode: "", category: loai, materialTypeId };
    setMatHang([...matHang, m]);
    notify.daLuu(`Đã thêm thành phẩm "${ten}"`);
    return m.id;
  };

  /* ---- Phiên ghi nhiều dòng ---- */
  const moThem = () => {
    setPhien({
      productionDate: ngayGhi,
      postingDate: todayISO(),
      backdateReason: "",
      workshop: xuongGhi,
      materialTypeId: materialTypeGanNhat || loaiNL[0]?.id || "",
    });
    setPhienIds([]);
    setDongMoi(DONG_RONG);
    setLoiPhien([]);
  };
  const datPhien = <K extends keyof DauPhien>(k: K, v: DauPhien[K]) =>
    setPhien((p) => (p ? { ...p, [k]: v } : p));

  const dongPhien = useMemo(
    () => rows.filter((r) => phienIds.includes(r.id)),
    [rows, phienIds]
  );
  const tongPhien = dongPhien.reduce((s, r) => s + (r.quantityKg || 0), 0);

  const themDong = () => {
    if (!phien) return;
    const ls: LoiNhap[] = [];
    if (!phien.materialTypeId)
      ls.push({ truong: "Loại nguyên liệu", thongBao: "Chưa chọn loại NL" });
    if (!dongMoi.productId)
      ls.push({ truong: "Thành phẩm", thongBao: "Chưa chọn thành phẩm" });
    if (!(dongMoi.quantityKg > 0))
      ls.push({ truong: "Khối lượng", thongBao: "Phải lớn hơn 0 kg" });
    if (phien.postingDate < phien.productionDate)
      ls.push({ truong: "Ngày ghi sổ", thongBao: "Không thể trước ngày sản xuất" });
    const canLyDo = isBackdatedWip({ productionDate: phien.productionDate, postingDate: phien.postingDate }) ||
      daChot(phien.productionDate, phien.workshop);
    if (canLyDo && !phien.backdateReason.trim())
      ls.push({ truong: "Lý do ghi bù", thongBao: "Ghi sau ngày SX / ngày đã chốt — ghi rõ lý do" });
    setLoiPhien(ls);
    if (ls.length > 0) return;

    // Cấu hình dần: thành phẩm chưa gắn loại NL → gắn theo loại NL đang nhập.
    const mh = matHang.find((m) => m.id === dongMoi.productId);
    if (mh && !mh.materialTypeId) {
      const category =
        mh.category || loaiNL.find((l) => l.id === phien.materialTypeId)?.category || "";
      setMatHang(
        matHang.map((m) =>
          m.id === mh.id
            ? { ...m, materialTypeId: phien.materialTypeId, category }
            : m
        )
      );
    }

    const moi: WipProductionItem = {
      id: newId(),
      productionDate: phien.productionDate,
      postingDate: phien.postingDate,
      backdateReason: phien.backdateReason,
      workshop: phien.workshop,
      productId: dongMoi.productId,
      spec: "",
      quantityKg: dongMoi.quantityKg,
      blocksCount: dongMoi.blocksCount,
      warehouse: "",
      status: "cho-nhap",
      note: "",
    };
    persist([...rows, moi]);
    setPhienIds((ids) => [...ids, moi.id]);
    notify.daLuu(`Đã vào sổ: ${tenMH(moi.productId)} — ${kg(moi.quantityKg)}`);
    setDongMoi(DONG_RONG); // giữ đầu phiên (ngày/xưởng/loại NL) để đổ tiếp
  };

  const boDongPhien = (r: WipProductionItem) => {
    const truoc = rows;
    persist(rows.filter((x) => x.id !== r.id));
    setPhienIds((ids) => ids.filter((id) => id !== r.id));
    notify.daXoa(`Đã bỏ ${tenMH(r.productId)} — ${kg(r.quantityKg)}`, () =>
      persist(truoc)
    );
  };

  const dongPhienLai = () => {
    const p = phien;
    // Dòng đã "Thêm vào sổ" đã lưu — thoát ra vẫn còn (lưu nháp cho ghi nhiều lần).
    if (p && dongPhien.length > 0 && (p.productionDate < tuHieuLuc || p.productionDate > denHieuLuc)) {
      setKy("ngay");
      setNgay(p.productionDate);
      if (phanXuong !== "Tất cả" && phanXuong !== p.workshop)
        setPhanXuong(p.workshop);
    }
    setPhien(null);
    setPhienIds([]);
    setDongMoi(DONG_RONG);
    setLoiPhien([]);
  };

  /* ---- Sửa / xóa một dòng đã ghi ---- */
  const moSua = (r: WipProductionItem) => {
    setSua({ ...r });
    setSuaLoaiNLId(matHang.find((m) => m.id === r.productId)?.materialTypeId || "");
    setLoiSua([]);
  };
  const luuSua = () => {
    if (!sua) return;
    const ls: LoiNhap[] = [];
    if (!sua.productId)
      ls.push({ truong: "Thành phẩm", thongBao: "Chưa chọn thành phẩm" });
    if (!(sua.quantityKg > 0))
      ls.push({ truong: "Khối lượng", thongBao: "Phải lớn hơn 0 kg" });
    setLoiSua(ls);
    if (ls.length > 0) return;
    persist(rows.map((r) => (r.id === sua.id ? sua : r)));
    notify.daLuu("Đã lưu thay đổi");
    setSua(null);
  };
  const xoa = (r: WipProductionItem) => {
    const truoc = rows;
    persist(rows.filter((x) => x.id !== r.id));
    notify.daXoa(`Đã xóa ${tenMH(r.productId)} — ${kg(r.quantityKg)}`, () =>
      persist(truoc)
    );
  };

  /* ---- Chốt / mở lại ngày ---- */
  const chotNgay = () => {
    const bg = banGhiChot(tuHieuLuc, xuong);
    const ban: DailyLock = {
      id: bg?.id ?? newId(),
      lockDate: tuHieuLuc,
      workshop: xuong,
      isLocked: true,
      lockedAt: todayISO(),
      totalKgAtLock: tongThucTe,
      reopenReason: "",
      note: ghiChuChot,
    };
    persistChot(bg ? chot.map((c) => (c.id === bg.id ? ban : c)) : [...chot, ban]);
    notify.daLuu(`Đã chốt SX ${viDate(tuHieuLuc)} · xưởng ${xuong} — ${kg(tongThucTe)}`);
    setHoiChot(false);
    setGhiChuChot("");
  };
  const moLaiNgay = () => {
    const bg = banGhiChot(tuHieuLuc, xuong);
    if (!bg) return;
    if (!lyDoMoLai.trim()) {
      setLoiChot([{ truong: "Lý do mở lại", thongBao: "Ghi rõ vì sao mở lại" }]);
      return;
    }
    persistChot(
      chot.map((c) => (c.id === bg.id ? { ...c, isLocked: false, lyDoMoLai } : c))
    );
    notify.canhBao(`Đã mở lại SX ${viDate(tuHieuLuc)} · xưởng ${xuong}`);
    setHoiMoLai(false);
    setLyDoMoLai("");
    setLoiChot([]);
  };

  const cols: Cot<WipProductionItem>[] = [
    {
      key: "mh",
      header: "Thành phẩm",
      chinh: true,
      render: (r) => tenMH(r.productId),
      sapXep: (r) => tenMH(r.productId),
    },
    { key: "kg", header: "Lượng (kg)", so: true, render: (r) => num(r.quantityKg), sapXep: (r) => r.quantityKg },
    { key: "bl", header: "Block", so: true, render: (r) => num(r.blocksCount) },
    {
      key: "tt",
      header: "Trạng thái",
      render: (r) =>
        r.status === "da-nhap" ? (
          <Badge variant="secondary">Đã nhập kho{r.warehouse ? ` · ${r.warehouse}` : ""}</Badge>
        ) : (
          <Badge variant="outline">Chờ nhập kho</Badge>
        ),
      sapXep: (r) => r.status,
    },
  ];

  const chotDangGhi = phien ? daChot(phien.productionDate, phien.workshop) : false;
  const canLyDoPhien =
    phien &&
    (isBackdatedWip({ productionDate: phien.productionDate, postingDate: phien.postingDate }) || chotDangGhi);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">
            Sản xuất bán thành phẩm
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="lg" onClick={moThem}>
            <Plus />
            Ghi sản lượng
          </Button>
        </div>
      </div>

      <ThongKe
        className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        the={[
          { nhan: "Đang xem", giaTri: moTaPhamVi, icon: CalendarRange, mau: "trung-tinh" },
          { nhan: "Phân xưởng", giaTri: phanXuong, icon: Warehouse, mau: "trung-tinh" },
          { nhan: "Số dòng BTP", giaTri: view.length, so: true, icon: ClipboardList, mau: "brand" },
          { nhan: "Chờ nhập kho", giaTri: soChoNhap, so: true, icon: Hourglass, mau: "warning" },
          { nhan: "Tổng sản lượng", giaTri: kg(tong), so: true, icon: Scale, mau: "success" },
        ]}
      />

      <div className="flex flex-wrap items-end gap-4 rounded-xl border-2 border-border p-4">
        <Combobox
          label="Kỳ xem sổ"
          anNhanBatBuoc
          choPhepXoa={false}
          value={ky}
          onChange={(v) => setKy(v as KyXem)}
          options={KY_OPT}
          className="min-w-[13rem]"
        />
        <div className="min-w-[220px] flex-1">
          {ky === "tuy-chon" ? (
            <DateRangeField
              label="Khoảng ngày sản xuất"
              anNhanBatBuoc
              presets={false}
              startDate={tuNgay}
              endDate={denNgay}
              onChange={(tu, den) => {
                setTuNgay(tu);
                setDenNgay(den);
              }}
            />
          ) : (
            <DateField
              label="Ngày sản xuất"
              anNhanBatBuoc
              hint={
                ky === "ngay"
                  ? undefined
                  : `Kỳ: ${viDate(tuHieuLuc)} – ${viDate(denHieuLuc)}`
              }
              value={ngay}
              onChange={setNgay}
            />
          )}
        </div>
        <Combobox
          label="Phân xưởng"
          anNhanBatBuoc
          choPhepXoa={false}
          value={phanXuong}
          onChange={(v) => setPhanXuong(v as Workshop | "Tất cả")}
          options={[
            ...PHAN_XUONG.map((p) => ({ value: p, label: p })),
            { value: "Tất cả", label: "Tất cả" },
          ]}
          className="min-w-[220px] flex-1"
        />
      </div>

      {view.length === 0 ? (
        <EmptyState
          icon={Factory}
          tieuDe={`Chưa ghi sản lượng trong ${moTaPhamVi}`}
          moTa={`Phân xưởng ${phanXuong}. Bấm nút dưới để ghi.`}
          action={
            <Button size="lg" onClick={moThem}>
              <Plus />
              Ghi sản lượng
            </Button>
          }
        />
      ) : (
        <>
          <RecordTable
            columns={cols}
            rows={view}
            getKey={(r) => r.id}
            timKiem={(r) => tenMH(r.productId)}
            nhanTimKiem="Tìm theo thành phẩm…"
            actions={(r) => (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => moSua(r)}>
                  <Pencil />
                  Sửa
                </Button>
                <Button variant="outline" size="sm" onClick={() => xoa(r)}>
                  Bỏ
                </Button>
              </div>
            )}
          />
          <div className="flex flex-wrap justify-end gap-x-10 gap-y-2 rounded-xl bg-muted px-5 py-4">
            <div className="flex items-baseline gap-3">
              <span className="text-base text-muted-foreground">Tổng khối lượng</span>
              <span className="tnum text-xl font-semibold">{kg(tong)}</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-base text-muted-foreground">Tổng block</span>
              <span className="tnum text-xl font-semibold">{num(tongBlock)}</span>
            </div>
          </div>
        </>
      )}

      {xemMotNgayMotXuong && (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl border-2 border-border px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {dangKhoa ? (
              <Lock className="size-6 shrink-0 text-primary" aria-hidden />
            ) : (
              <LockOpen className="size-6 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span className="text-lg font-semibold text-foreground">
              {dangKhoa ? "Đã chốt" : "Chưa chốt"} {viDate(tuHieuLuc)} · xưởng {xuong}
            </span>
            <span className="text-base text-muted-foreground">
              Tổng{" "}
              <span className="tnum font-semibold text-foreground">
                {kg(tongThucTe)}
              </span>
            </span>
            {lechSauChot !== 0 && (
              <span className="flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1 text-base text-accent-foreground">
                <TriangleAlert className="size-5 shrink-0" aria-hidden />
                Còn ghi bù {lechSauChot > 0 ? "+" : ""}
                {num(lechSauChot)} kg sau chốt
              </span>
            )}
          </div>
          {dangKhoa ? (
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                setHoiMoLai(true);
                setLyDoMoLai("");
                setLoiChot([]);
              }}
            >
              <LockOpen />
              Mở lại ngày
            </Button>
          ) : (
            <Button size="lg" onClick={() => setHoiChot(true)}>
              <Lock />
              Chốt ngày
            </Button>
          )}
        </div>
      )}

      {/* Dialog ghi nhiều dòng */}
      <Dialog open={phien !== null} onOpenChange={(o) => !o && dongPhienLai()}>
        <DialogContent className="max-h-[92vh] w-full overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Ghi sản lượng</DialogTitle>
            <DialogDescription className="text-base">
              Chọn ngày + loại nguyên liệu một lần, rồi đổ từng thành phẩm — mỗi
              cái bấm "Thêm vào sổ" là vào sổ ngay (thoát ra vẫn còn).
            </DialogDescription>
          </DialogHeader>

          {phien && (
            <div className="space-y-6 py-2">
              <ErrorSummary loi={loiPhien} />

              {chotDangGhi && (
                <p className="flex items-start gap-3 rounded-lg bg-accent px-4 py-3 text-base text-accent-foreground">
                  <Lock className="mt-0.5 size-6 shrink-0" aria-hidden />
                  <span>
                    Ngày {viDate(phien.productionDate)} · xưởng {phien.workshop}{" "}
                    <strong>đã chốt</strong> — ghi thêm là <strong>ghi bù</strong>,
                    bắt buộc lý do.
                  </span>
                </p>
              )}

              <div className="grid gap-6 sm:grid-cols-2">
                <DateField
                  label="Ngày ghi sổ"
                  required
                  info="Ngày ghi vào hệ thống. Khác ngày SX ⇒ ghi bù."
                  value={phien.postingDate}
                  onChange={(v) => datPhien("postingDate", v)}
                />
                <DateField
                  label="Ngày sản xuất"
                  required
                  info="Ngày làm ra thật — mọi tổng hợp tính theo ngày này."
                  value={phien.productionDate}
                  onChange={(v) => datPhien("productionDate", v)}
                />
              </div>

              {canLyDoPhien && (
                <Field label="Lý do ghi bù" required hint="VD: cuối ca mới cân xong.">
                  <Input
                    value={phien.backdateReason}
                    onChange={(e) => datPhien("backdateReason", e.target.value)}
                    placeholder="Vì sao ghi sau ngày SX?"
                  />
                </Field>
              )}

              <div className="grid gap-6 sm:grid-cols-2">
                <Combobox
                  label="Phân xưởng"
                  required
                  choPhepXoa={false}
                  value={phien.workshop}
                  onChange={(v) => datPhien("workshop", v as Workshop)}
                  options={PHAN_XUONG.map((p) => ({ value: p, label: p }))}
                />
                <Combobox
                  label="Loại nguyên liệu"
                  required
                  choPhepXoa={false}
                  info="Loại NL của bảng cân đối (VD Bạch tuộc 2 da). Thành phẩm lọc theo loại NL này. Chưa gắn thì hiện thành phẩm cùng loài để gợi ý."
                  value={phien.materialTypeId}
                  onChange={(v) => {
                    datPhien("materialTypeId", v);
                    setLoaiNLGanNhat(v);
                    setDongMoi(DONG_RONG); // đổi loại NL thì bỏ thành phẩm cũ
                  }}
                  options={optLoaiNL}
                  emptyText="Chưa có loại NL — thêm ở Danh mục."
                />
              </div>

              {/* Đã vào sổ trong phiên này */}
              {dongPhien.length > 0 && (
                <div className="space-y-3 rounded-xl border-2 border-border p-4">
                  <p className="flex items-center gap-2 text-base font-semibold text-foreground">
                    <CircleCheck className="size-6 text-primary" aria-hidden />
                    Đã vào sổ {dongPhien.length} thành phẩm —{" "}
                    <span className="tnum">{kg(tongPhien)}</span>
                  </p>
                  <ul className="divide-y divide-border">
                    {dongPhien.map((r, i) => (
                      <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                        <span className="min-w-0 flex-1 truncate text-base">
                          <span className="tnum text-muted-foreground">{i + 1}.</span>{" "}
                          {tenMH(r.productId)} —{" "}
                          <span className="tnum font-semibold">{num(r.quantityKg)}</span> kg
                          {r.blocksCount ? (
                            <span className="text-muted-foreground"> · {num(r.blocksCount)} block</span>
                          ) : null}
                        </span>
                        <Button variant="outline" size="sm" onClick={() => boDongPhien(r)}>
                          <X />
                          Bỏ
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Thêm một thành phẩm */}
              <div className="space-y-5 rounded-xl border-2 border-primary/40 bg-accent/40 p-4">
                <p className="text-base font-semibold">Thêm thành phẩm</p>
                <Combobox
                  label="Thành phẩm"
                  required
                  info="Gõ để tìm. Chưa có thì gõ tên rồi bấm Thêm mới — tự gắn vào loại NL đang nhập."
                  value={dongMoi.productId}
                  onChange={(v) => setDongMoi((d) => ({ ...d, productId: v }))}
                  options={matHangCuaLoaiNL(phien.materialTypeId)}
                  onCreate={(ten) => themMatHang(ten, phien.materialTypeId)}
                  emptyText={
                    phien.materialTypeId
                      ? `Chưa có thành phẩm của ${tenMaterialType(phien.materialTypeId)} — gõ tên rồi Thêm mới.`
                      : "Chọn loại nguyên liệu trước."
                  }
                />
                <div className="grid gap-6 sm:grid-cols-2">
                  <NumberField
                    label="Khối lượng"
                    required
                    unit="kg"
                    value={dongMoi.quantityKg || null}
                    onChange={(v) => setDongMoi((d) => ({ ...d, quantityKg: v ?? 0 }))}
                  />
                  <NumberField
                    label="Số block"
                    unit="block"
                    value={dongMoi.blocksCount || null}
                    onChange={(v) => setDongMoi((d) => ({ ...d, blocksCount: v ?? 0 }))}
                  />
                </div>
                <Button size="lg" className="w-full" onClick={themDong}>
                  <Plus />
                  Thêm vào sổ
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button size="lg" onClick={dongPhienLai}>
              Xong
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog sửa một dòng */}
      <Dialog open={sua !== null} onOpenChange={(o) => !o && setSua(null)}>
        <DialogContent className="max-h-[92vh] w-full overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Sửa dòng sản lượng</DialogTitle>
          </DialogHeader>
          {sua && (
            <div className="space-y-6 py-2">
              <ErrorSummary loi={loiSua} />
              <div className="grid gap-6 sm:grid-cols-2">
                <DateField
                  label="Ngày ghi sổ"
                  required
                  value={sua.postingDate || sua.productionDate}
                  onChange={(v) => setSua((d) => (d ? { ...d, postingDate: v } : d))}
                />
                <DateField
                  label="Ngày sản xuất"
                  required
                  value={sua.productionDate}
                  onChange={(v) => setSua((d) => (d ? { ...d, productionDate: v } : d))}
                />
              </div>
              <Combobox
                label="Phân xưởng"
                required
                choPhepXoa={false}
                value={sua.workshop}
                onChange={(v) => setSua((d) => (d ? { ...d, workshop: v as Workshop } : d))}
                options={PHAN_XUONG.map((p) => ({ value: p, label: p }))}
              />
              <Combobox
                label="Loại nguyên liệu"
                required
                value={suaMaterialTypeId}
                onChange={(v) => {
                  setSuaLoaiNLId(v);
                  setSua((d) => (d ? { ...d, productId: "" } : d));
                }}
                options={optLoaiNL}
              />
              <Combobox
                label="Thành phẩm"
                required
                value={sua.productId}
                onChange={(v) => setSua((d) => (d ? { ...d, productId: v } : d))}
                options={matHangCuaLoaiNL(suaMaterialTypeId)}
                onCreate={(ten) => themMatHang(ten, suaMaterialTypeId)}
                emptyText="Chưa có thành phẩm — gõ tên rồi Thêm mới."
              />
              <div className="grid gap-6 sm:grid-cols-2">
                <NumberField
                  label="Khối lượng"
                  required
                  unit="kg"
                  value={sua.quantityKg || null}
                  onChange={(v) => setSua((d) => (d ? { ...d, quantityKg: v ?? 0 } : d))}
                />
                <NumberField
                  label="Số block"
                  unit="block"
                  value={sua.blocksCount || null}
                  onChange={(v) => setSua((d) => (d ? { ...d, blocksCount: v ?? 0 } : d))}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setSua(null)}>
              Hủy
            </Button>
            <Button size="lg" onClick={luuSua}>
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog chốt ngày */}
      <Dialog open={hoiChot} onOpenChange={setHoiChot}>
        <DialogContent className="w-full sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">Chốt ngày sản xuất</DialogTitle>
            <DialogDescription className="text-base">
              Khoá {viDate(tuHieuLuc)} · xưởng {xuong} — tổng {kg(tongThucTe)}. Ghi
              thêm sau khi chốt phải ghi bù.
            </DialogDescription>
          </DialogHeader>
          <Field label="Ghi chú chốt">
            <Input
              value={ghiChuChot}
              onChange={(e) => setGhiChuChot(e.target.value)}
              placeholder="Ghi chú (nếu có)"
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setHoiChot(false)}>
              Hủy
            </Button>
            <Button size="lg" onClick={chotNgay}>
              <Lock />
              Chốt ngày
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog mở lại ngày */}
      <Dialog open={hoiMoLai} onOpenChange={setHoiMoLai}>
        <DialogContent className="w-full sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">Mở lại ngày đã chốt</DialogTitle>
            <DialogDescription className="text-base">
              {viDate(tuHieuLuc)} · xưởng {xuong}. Sửa xong nhớ chốt lại.
            </DialogDescription>
          </DialogHeader>
          <ErrorSummary loi={loiChot} />
          <Field label="Lý do mở lại" required>
            <Input
              value={lyDoMoLai}
              onChange={(e) => setLyDoMoLai(e.target.value)}
              placeholder="Vì sao mở lại ngày đã chốt?"
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setHoiMoLai(false)}>
              Hủy
            </Button>
            <Button size="lg" onClick={moLaiNgay}>
              <LockOpen />
              Mở lại
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
