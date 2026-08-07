import { useMemo, useState } from "react";
import type { ChotNgay, DongSanXuat, MatHang, PhanXuong } from "@/types";
import { laGhiBuSX } from "@/types";
import { newId } from "@/lib/store";
import { uid } from "@/lib/db";
import { useChotSX, useMatHang, useSanXuat } from "@/lib/danhMuc";
import {
  Badge,
  Button,
  Combobox,
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
  type MucChon,
} from "@/design-system";
import { kg, num, todayISO, viDate } from "@/lib/format";
import { KY_OPT, phamViKy, type KyXem } from "@/lib/ky";
import { Factory, Lock, LockOpen, Pencil, Plus, TriangleAlert } from "lucide-react";

const PHAN_XUONG: PhanXuong[] = ["Đông", "Cá", "Khô"];

interface DongMoi {
  ngay: string;
  ngayGhiSo: string;
  lyDoGhiBu: string;
  phanXuong: PhanXuong;
  matHangId: string;
  quyCach: string;
  luongKg: number;
  soBlock: number;
  ghiChu: string;
}

const rong = (ngay: string, xuong: PhanXuong): DongMoi => ({
  ngay,
  ngayGhiSo: todayISO(),
  lyDoGhiBu: "",
  phanXuong: xuong,
  matHangId: "",
  quyCach: "",
  luongKg: 0,
  soBlock: 0,
  ghiChu: "",
});

export default function SanXuatBTPScreen() {
  const [rows, persist] = useSanXuat();
  const [chot, persistChot] = useChotSX();
  const [matHang, setMatHang] = useMatHang();

  const [ky, setKy] = useState<KyXem>("ngay");
  const [ngay, setNgay] = useState(todayISO());
  const [tuNgay, setTuNgay] = useState(todayISO());
  const [denNgay, setDenNgay] = useState(todayISO());
  const [phanXuong, setPhanXuong] = useState<PhanXuong | "Tất cả">("Đông");

  const [dangMoi, setDangMoi] = useState<DongMoi | null>(null);
  const [suaId, setSuaId] = useState<string | null>(null);
  const [loi, setLoi] = useState<LoiNhap[]>([]);

  const [hoiChot, setHoiChot] = useState(false);
  const [ghiChuChot, setGhiChuChot] = useState("");
  const [hoiMoLai, setHoiMoLai] = useState(false);
  const [lyDoMoLai, setLyDoMoLai] = useState("");
  const [loiChot, setLoiChot] = useState<LoiNhap[]>([]);

  const [tuHieuLuc, denHieuLuc] = phamViKy(ky, ngay, tuNgay, denNgay);
  const laMotNgay = tuHieuLuc === denHieuLuc;

  const tenMH = (id: string) => matHang.find((m) => m.id === id)?.ten || "—";

  const view = useMemo(
    () =>
      rows
        .filter(
          (r) =>
            r.ngay >= tuHieuLuc &&
            r.ngay <= denHieuLuc &&
            (phanXuong === "Tất cả" || r.phanXuong === phanXuong)
        )
        .sort((a, b) => a.ngay.localeCompare(b.ngay) || a.id.localeCompare(b.id)),
    [rows, tuHieuLuc, denHieuLuc, phanXuong]
  );

  const tong = view.reduce((s, r) => s + (r.luongKg || 0), 0);
  const tongBlock = view.reduce((s, r) => s + (r.soBlock || 0), 0);
  const soChoNhap = view.filter((r) => r.trangThai === "cho-nhap").length;

  const moTaPhamVi = laMotNgay
    ? viDate(tuHieuLuc)
    : `${viDate(tuHieuLuc)} – ${viDate(denHieuLuc)}`;

  /* ---- Chốt ngày SX ---- */
  const xemMotNgayMotXuong = laMotNgay && phanXuong !== "Tất cả";
  const xuong: PhanXuong = phanXuong === "Tất cả" ? "Đông" : phanXuong;
  const banGhiChot = (n: string, x: PhanXuong): ChotNgay | undefined =>
    chot.find((c) => c.ngay === n && c.phanXuong === x);
  const chotHienTai = xemMotNgayMotXuong ? banGhiChot(tuHieuLuc, xuong) : undefined;
  const dangKhoa = Boolean(chotHienTai?.daChot);
  const tongNgayXuong = (n: string, x: PhanXuong) =>
    rows
      .filter((r) => r.ngay === n && r.phanXuong === x)
      .reduce((s, r) => s + (r.luongKg || 0), 0);
  const tongThucTe = xemMotNgayMotXuong ? tongNgayXuong(tuHieuLuc, xuong) : 0;
  const lechSauChot =
    chotHienTai?.daChot && tongThucTe !== chotHienTai.tongKgLucChot
      ? tongThucTe - chotHienTai.tongKgLucChot
      : 0;
  const daChot = (n: string, x: PhanXuong) => Boolean(banGhiChot(n, x)?.daChot);

  const optMatHang: MucChon[] = matHang.map((m) => ({
    value: m.id,
    label: m.ten,
    phu: m.ma || undefined,
  }));
  const optQuyCach: MucChon[] = useMemo(() => {
    const set = new Map<string, string>();
    for (const r of rows) if (r.quyCach) set.set(r.quyCach, r.quyCach);
    return [...set.values()].map((q) => ({ value: q, label: q }));
  }, [rows]);

  const themMatHang = (ten: string) => {
    const m: MatHang = { id: uid(), ma: "", ten, maTP: "" };
    setMatHang([...matHang, m]);
    notify.daLuu(`Đã thêm mặt hàng "${ten}" vào danh mục`);
    return m.id;
  };

  const ngayGhi = laMotNgay ? tuHieuLuc : denHieuLuc;
  const xuongGhi: PhanXuong = phanXuong === "Tất cả" ? "Đông" : phanXuong;

  const moThem = () => {
    setDangMoi(rong(ngayGhi, xuongGhi));
    setSuaId(null);
    setLoi([]);
  };
  const moSua = (r: DongSanXuat) => {
    setDangMoi({
      ngay: r.ngay,
      ngayGhiSo: r.ngayGhiSo || r.ngay,
      lyDoGhiBu: r.lyDoGhiBu,
      phanXuong: r.phanXuong,
      matHangId: r.matHangId,
      quyCach: r.quyCach,
      luongKg: r.luongKg,
      soBlock: r.soBlock,
      ghiChu: r.ghiChu,
    });
    setSuaId(r.id);
    setLoi([]);
  };
  const dat = <K extends keyof DongMoi>(k: K, v: DongMoi[K]) =>
    setDangMoi((d) => (d ? { ...d, [k]: v } : d));

  const luu = () => {
    if (!dangMoi) return;
    const d = dangMoi;
    const ls: LoiNhap[] = [];
    if (!d.matHangId) ls.push({ truong: "Mặt hàng", thongBao: "Chưa chọn mặt hàng" });
    if (!(d.luongKg > 0))
      ls.push({ truong: "Lượng", thongBao: "Phải lớn hơn 0 kg" });
    if (d.ngayGhiSo < d.ngay)
      ls.push({ truong: "Ngày ghi sổ", thongBao: "Không thể trước ngày sản xuất" });
    const canLyDo = laGhiBuSX(d) || daChot(d.ngay, d.phanXuong);
    if (canLyDo && !d.lyDoGhiBu.trim())
      ls.push({
        truong: "Lý do ghi bù",
        thongBao: daChot(d.ngay, d.phanXuong)
          ? "Ngày này đã chốt — ghi rõ vì sao ghi thêm"
          : "Ghi sau ngày SX — ghi rõ lý do",
      });
    setLoi(ls);
    if (ls.length > 0) return;

    if (suaId) {
      persist(
        rows.map((r) =>
          r.id === suaId
            ? {
                ...r,
                ngay: d.ngay,
                ngayGhiSo: d.ngayGhiSo,
                lyDoGhiBu: d.lyDoGhiBu,
                phanXuong: d.phanXuong,
                matHangId: d.matHangId,
                quyCach: d.quyCach,
                luongKg: d.luongKg,
                soBlock: d.soBlock,
                ghiChu: d.ghiChu,
              }
            : r
        )
      );
      notify.daLuu("Đã lưu thay đổi");
    } else {
      const moi: DongSanXuat = {
        id: newId(),
        ngay: d.ngay,
        ngayGhiSo: d.ngayGhiSo,
        lyDoGhiBu: d.lyDoGhiBu,
        phanXuong: d.phanXuong,
        matHangId: d.matHangId,
        quyCach: d.quyCach,
        luongKg: d.luongKg,
        soBlock: d.soBlock,
        kho: "",
        trangThai: "cho-nhap",
        ghiChu: d.ghiChu,
      };
      persist([...rows, moi]);
      notify.daLuu(`Đã ghi: ${tenMH(moi.matHangId)} — ${kg(moi.luongKg)}`);
      if (d.ngay < tuHieuLuc || d.ngay > denHieuLuc) {
        setKy("ngay");
        setNgay(d.ngay);
      }
    }
    setDangMoi(null);
  };

  const xoa = (r: DongSanXuat) => {
    const truoc = rows;
    persist(rows.filter((x) => x.id !== r.id));
    notify.daXoa(`Đã xóa ${tenMH(r.matHangId)} — ${kg(r.luongKg)}`, () =>
      persist(truoc)
    );
  };

  const chotNgay = () => {
    const bg = banGhiChot(tuHieuLuc, xuong);
    const ban: ChotNgay = {
      id: bg?.id ?? newId(),
      ngay: tuHieuLuc,
      phanXuong: xuong,
      daChot: true,
      chotLuc: todayISO(),
      tongKgLucChot: tongThucTe,
      lyDoMoLai: "",
      ghiChu: ghiChuChot,
    };
    persistChot(bg ? chot.map((c) => (c.id === bg.id ? ban : c)) : [...chot, ban]);
    notify.daLuu(
      `Đã chốt SX ${viDate(tuHieuLuc)} · xưởng ${xuong} — ${kg(tongThucTe)}`
    );
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
      chot.map((c) => (c.id === bg.id ? { ...c, daChot: false, lyDoMoLai } : c))
    );
    notify.canhBao(`Đã mở lại SX ${viDate(tuHieuLuc)} · xưởng ${xuong}`);
    setHoiMoLai(false);
    setLyDoMoLai("");
    setLoiChot([]);
  };

  const cols: Cot<DongSanXuat>[] = [
    {
      key: "mh",
      header: "Mặt hàng",
      chinh: true,
      render: (r) => tenMH(r.matHangId),
      sapXep: (r) => tenMH(r.matHangId),
    },
    {
      key: "qc",
      header: "Quy cách",
      render: (r) => r.quyCach || <span className="text-muted-foreground">—</span>,
    },
    { key: "kg", header: "Lượng (kg)", so: true, render: (r) => num(r.luongKg), sapXep: (r) => r.luongKg },
    { key: "bl", header: "Block", so: true, render: (r) => num(r.soBlock) },
    {
      key: "tt",
      header: "Trạng thái",
      render: (r) =>
        r.trangThai === "da-nhap" ? (
          <Badge variant="secondary">Đã nhập kho{r.kho ? ` · ${r.kho}` : ""}</Badge>
        ) : (
          <Badge variant="outline">Chờ nhập kho</Badge>
        ),
      sapXep: (r) => r.trangThai,
    },
  ];

  const dangSua = suaId !== null;
  const chotDangGhi = dangMoi ? daChot(dangMoi.ngay, dangMoi.phanXuong) : false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">
          Sản xuất bán thành phẩm
        </h1>
        <p className="mt-2 max-w-2xl text-base text-muted-foreground">
          Ghi sản lượng bán thành phẩm làm ra mỗi ngày (cấp đông, cất kho dự trữ —
          chưa bán). Thủ kho duyệt vào kho ở màn Kho dự trữ.
        </p>
      </div>

      <ContextBar
        items={[
          { nhan: "Đang xem", giaTri: moTaPhamVi },
          { nhan: "Phân xưởng", giaTri: phanXuong },
          { nhan: "Số dòng", giaTri: view.length, so: true },
          { nhan: "Chờ nhập", giaTri: soChoNhap, so: true },
          { nhan: "Tổng", giaTri: kg(tong), so: true },
        ]}
        actions={
          <Button size="lg" onClick={moThem}>
            <Plus />
            Ghi sản lượng
          </Button>
        }
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
              tuNgay={tuNgay}
              denNgay={denNgay}
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
          onChange={(v) => setPhanXuong(v as PhanXuong | "Tất cả")}
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
          moTa={`Phân xưởng ${phanXuong}. Bấm nút dưới để ghi dòng đầu tiên.`}
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
            timKiem={(r) => `${tenMH(r.matHangId)} ${r.quyCach}`}
            nhanTimKiem="Tìm theo mặt hàng / quy cách…"
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

      {/* Dialog ghi / sửa sản lượng */}
      <Dialog open={dangMoi !== null} onOpenChange={(o) => !o && setDangMoi(null)}>
        <DialogContent className="max-h-[92vh] w-full overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {dangSua ? "Sửa dòng sản lượng" : "Ghi sản lượng"}
            </DialogTitle>
            <DialogDescription className="text-base">
              Bán thành phẩm làm ra: mặt hàng, quy cách (size), khối lượng và số block.
            </DialogDescription>
          </DialogHeader>

          {dangMoi && (
            <div className="space-y-6 py-2">
              <ErrorSummary loi={loi} />

              {chotDangGhi && (
                <p className="flex items-start gap-3 rounded-lg bg-accent px-4 py-3 text-base text-accent-foreground">
                  <Lock className="mt-0.5 size-6 shrink-0" aria-hidden />
                  <span>
                    Ngày {viDate(dangMoi.ngay)} · xưởng {dangMoi.phanXuong}{" "}
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
                  value={dangMoi.ngayGhiSo}
                  onChange={(v) => dat("ngayGhiSo", v)}
                />
                <DateField
                  label="Ngày sản xuất"
                  required
                  info="Ngày làm ra thật — mọi tổng hợp tính theo ngày này."
                  value={dangMoi.ngay}
                  onChange={(v) => dat("ngay", v)}
                />
              </div>

              {(laGhiBuSX(dangMoi) || chotDangGhi) && (
                <Field label="Lý do ghi bù" required hint="VD: cuối ca mới cân xong.">
                  <Input
                    value={dangMoi.lyDoGhiBu}
                    onChange={(e) => dat("lyDoGhiBu", e.target.value)}
                    placeholder="Vì sao ghi sau ngày SX?"
                  />
                </Field>
              )}

              <Combobox
                label="Phân xưởng"
                required
                choPhepXoa={false}
                value={dangMoi.phanXuong}
                onChange={(v) => dat("phanXuong", v as PhanXuong)}
                options={PHAN_XUONG.map((p) => ({ value: p, label: p }))}
              />

              <Combobox
                label="Mặt hàng"
                required
                hint="Chưa có thì gõ tên rồi bấm Thêm mới."
                value={dangMoi.matHangId}
                onChange={(v) => dat("matHangId", v)}
                options={optMatHang}
                onCreate={themMatHang}
                emptyText="Chưa có mặt hàng nào trong danh mục."
              />

              <Combobox
                label="Quy cách"
                value={dangMoi.quyCach}
                onChange={(v) => dat("quyCach", v)}
                options={optQuyCach}
                onCreate={(t) => t}
                hint="Size/grade. VD: 18-20, 1000-1300. Gõ mới rồi Thêm."
                placeholder="— Chọn / gõ quy cách —"
              />

              <div className="grid gap-6 sm:grid-cols-2">
                <NumberField
                  label="Khối lượng"
                  required
                  unit="kg"
                  value={dangMoi.luongKg || null}
                  onChange={(v) => dat("luongKg", v ?? 0)}
                />
                <NumberField
                  label="Số block"
                  unit="block"
                  value={dangMoi.soBlock || null}
                  onChange={(v) => dat("soBlock", v ?? 0)}
                />
              </div>

              <Field label="Ghi chú">
                <Input
                  value={dangMoi.ghiChu}
                  onChange={(e) => dat("ghiChu", e.target.value)}
                  placeholder="Ghi chú thêm (nếu có)"
                />
              </Field>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setDangMoi(null)}>
              Hủy
            </Button>
            <Button size="lg" onClick={luu}>
              {dangSua ? "Lưu thay đổi" : "Ghi vào sổ"}
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
