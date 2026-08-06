import { useMemo, useState } from "react";
import type { DongBan, KhachHang, MatHang, PhanXuong, Kenh, PhieuBan } from "@/types";
import { KENH, laGhiBuBan, thanhTienBan } from "@/types";
import { newId } from "@/lib/store";
import { uid } from "@/lib/db";
import {
  useBanHang,
  useKhachHang,
  useMatHang,
  usePhieuBan,
} from "@/lib/danhMuc";
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
  type MucChon,
} from "@/design-system";
import { kg, num, todayISO, viDate } from "@/lib/format";
import { KY_OPT, phamViKy, type KyXem } from "@/lib/ky";
import {
  CircleCheck,
  Pencil,
  Plus,
  ShoppingCart,
  Truck,
  X,
} from "lucide-react";

const PHAN_XUONG: PhanXuong[] = ["Đông", "Cá", "Khô"];

/** Đầu phiếu bán đang nhập — dùng chung cho mọi dòng mặt hàng của phiếu. */
interface DauPhieu {
  ngayGiao: string;
  ngayGhiSo: string;
  lyDoGhiBu: string;
  phanXuong: PhanXuong;
  khachId: string;
  kenh: Kenh;
  ghiChu: string;
}

/** Một dòng mặt hàng đang nhập trong phiếu. */
interface DongMoi {
  matHangId: string;
  quyCach: string;
  luongKg: number;
  donGia: number | null;
}

const DONG_MOI_RONG: DongMoi = {
  matHangId: "",
  quyCach: "",
  luongKg: 0,
  donGia: null,
};

/** Một phiếu bán hiện trên sổ, gom từ các dòng của nó. */
interface NhomPhieu {
  phieu: PhieuBan;
  dong: DongBan[];
  tongKg: number;
  tongTien: number;
  ghiBu: boolean;
}

function gomPhieu(rows: DongBan[], phieu: PhieuBan[]): NhomPhieu[] {
  const theoId = new Map(phieu.map((p) => [p.id, p]));
  const nhoms = new Map<string, NhomPhieu>();

  for (const r of rows) {
    const p = theoId.get(r.phieuId);
    if (!p) continue; // dòng mồ côi (phiếu đã xóa) — bỏ qua
    let nhom = nhoms.get(p.id);
    if (!nhom) {
      nhom = {
        phieu: p,
        dong: [],
        tongKg: 0,
        tongTien: 0,
        ghiBu: laGhiBuBan(p),
      };
      nhoms.set(p.id, nhom);
    }
    nhom.dong.push(r);
    nhom.tongKg += r.luongKg || 0;
    nhom.tongTien += thanhTienBan(r);
  }

  return [...nhoms.values()].sort(
    (a, b) =>
      a.phieu.ngayGiao.localeCompare(b.phieu.ngayGiao) ||
      a.phieu.id.localeCompare(b.phieu.id)
  );
}

/** Kiểm đầu phiếu — dùng chung lúc ghi mới và lúc sửa. */
function loiDauPhieu(d: DauPhieu): LoiNhap[] {
  const ls: LoiNhap[] = [];
  if (d.ngayGhiSo < d.ngayGiao)
    ls.push({
      truong: "Ngày ghi sổ",
      thongBao: "Ngày ghi sổ không thể trước ngày xuất bán",
    });
  if (laGhiBuBan(d) && !d.lyDoGhiBu.trim())
    ls.push({
      truong: "Lý do ghi bù",
      thongBao: "Ghi sau ngày xuất bán — phải ghi rõ lý do",
    });
  return ls;
}

export default function BanHangScreen() {
  const [rows, persist] = useBanHang();
  const [phieu, persistPhieu] = usePhieuBan();
  const [matHang, setMatHang] = useMatHang();
  const [khach, setKhach] = useKhachHang();

  // Kỳ xem sổ: ngày/tuần/tháng/năm/khoảng tự chọn
  const [ky, setKy] = useState<KyXem>("ngay");
  const [ngay, setNgay] = useState(todayISO());
  const [tuNgay, setTuNgay] = useState(todayISO());
  const [denNgay, setDenNgay] = useState(todayISO());
  const [phanXuong, setPhanXuong] = useState<PhanXuong | "Tất cả">("Đông");

  /* Phiên ghi phiếu: đầu phiếu + đổ từng dòng mặt hàng. */
  const [phien, setPhien] = useState<DauPhieu | null>(null);
  const [phieuIdPhien, setPhieuIdPhien] = useState<string | null>(null);
  const [suaRowIds, setSuaRowIds] = useState<string[] | null>(null);
  const [dongMoi, setDongMoi] = useState<DongMoi>(DONG_MOI_RONG);
  const [loiPhien, setLoiPhien] = useState<LoiNhap[]>([]);

  /* Sửa MỘT dòng mặt hàng — chỉ mặt hàng / quy cách / kg / giá. */
  const [dang, setDang] = useState<DongBan | null>(null);
  const [loi, setLoi] = useState<LoiNhap[]>([]);

  const [tuHieuLuc, denHieuLuc] = phamViKy(ky, ngay, tuNgay, denNgay);
  const laMotNgay = tuHieuLuc === denHieuLuc;

  const tenMatHang = (id: string) =>
    matHang.find((m) => m.id === id)?.ten || "—";
  const tenKhach = (id: string) => khach.find((k) => k.id === id)?.ten || "";

  const view = useMemo(
    () =>
      rows.filter((r) => {
        const p = phieu.find((x) => x.id === r.phieuId);
        if (!p) return false;
        const hopNgay = p.ngayGiao >= tuHieuLuc && p.ngayGiao <= denHieuLuc;
        const hopXuong = phanXuong === "Tất cả" || p.phanXuong === phanXuong;
        return hopNgay && hopXuong;
      }),
    [rows, phieu, tuHieuLuc, denHieuLuc, phanXuong]
  );

  const nhomView = useMemo(() => gomPhieu(view, phieu), [view, phieu]);

  const moTaPhamVi = laMotNgay
    ? viDate(tuHieuLuc)
    : `${viDate(tuHieuLuc)} – ${viDate(denHieuLuc)}`;

  const tong = useMemo(
    () => view.reduce((s, r) => s + (r.luongKg || 0), 0),
    [view]
  );
  const tongTien = useMemo(
    () => view.reduce((s, r) => s + thanhTienBan(r), 0),
    [view]
  );

  const ngayGhi = laMotNgay ? tuHieuLuc : denHieuLuc;
  const xuongGhi: PhanXuong = phanXuong === "Tất cả" ? "Đông" : phanXuong;

  /* ---- Danh mục: chọn sẵn, thiếu thì tạo ngay tại chỗ ---- */

  const optMatHang: MucChon[] = matHang.map((m) => ({
    value: m.id,
    label: m.ten,
    phu: m.ma || undefined,
  }));
  const optKhach: MucChon[] = khach.map((k) => ({
    value: k.id,
    label: k.ten,
    phu: k.thiTruong || undefined,
  }));

  const themMatHang = (ten: string) => {
    const m: MatHang = { id: uid(), ma: "", ten, maTP: "" };
    setMatHang([...matHang, m]);
    notify.daLuu(`Đã thêm mặt hàng "${ten}" vào danh mục`);
    return m.id;
  };
  const themKhach = (ten: string) => {
    const k: KhachHang = { id: uid(), ma: "", ten, thiTruong: "" };
    setKhach([...khach, k]);
    notify.daLuu(`Đã thêm khách hàng "${ten}" vào danh mục`);
    return k.id;
  };

  /* ---- Ghi phiếu ---- */

  const moThem = () => {
    setPhien({
      ngayGiao: ngayGhi,
      ngayGhiSo: todayISO(),
      lyDoGhiBu: "",
      phanXuong: xuongGhi,
      khachId: "",
      kenh: "Xuất khẩu",
      ghiChu: "",
    });
    setPhieuIdPhien(null);
    setSuaRowIds(null);
    setDongMoi(DONG_MOI_RONG);
    setLoiPhien([]);
  };

  const moSuaPhieu = (n: NhomPhieu) => {
    setPhien({
      ngayGiao: n.phieu.ngayGiao,
      ngayGhiSo: n.phieu.ngayGhiSo || n.phieu.ngayGiao,
      lyDoGhiBu: n.phieu.lyDoGhiBu,
      phanXuong: n.phieu.phanXuong,
      khachId: n.phieu.khachId,
      kenh: n.phieu.kenh,
      ghiChu: n.phieu.ghiChu,
    });
    setPhieuIdPhien(n.phieu.id);
    setSuaRowIds(n.dong.map((r) => r.id));
    setDongMoi(DONG_MOI_RONG);
    setLoiPhien([]);
  };

  const datPhien = <K extends keyof DauPhieu>(k: K, v: DauPhieu[K]) =>
    setPhien((p) => (p ? { ...p, [k]: v } : p));

  const dongPhien = useMemo(() => {
    if (suaRowIds) return rows.filter((r) => suaRowIds.includes(r.id));
    if (phieuIdPhien) return rows.filter((r) => r.phieuId === phieuIdPhien);
    return [];
  }, [rows, suaRowIds, phieuIdPhien]);

  const dangSuaPhieu = suaRowIds !== null;
  const tongPhien = dongPhien.reduce((s, r) => s + (r.luongKg || 0), 0);

  const setDong = <K extends keyof DongMoi>(k: K, v: DongMoi[K]) =>
    setDongMoi((d) => ({ ...d, [k]: v }));

  /** Thêm một dòng mặt hàng — LƯU NGAY thành một dòng ban_hang. */
  const themDong = () => {
    if (!phien) return;
    const ls: LoiNhap[] = [...loiDauPhieu(phien)];
    if (!dongMoi.matHangId)
      ls.push({ truong: "Mặt hàng", thongBao: "Chưa chọn mặt hàng" });
    if (!(dongMoi.luongKg > 0))
      ls.push({ truong: "Lượng", thongBao: "Phải lớn hơn 0 kg" });
    setLoiPhien(ls);
    if (ls.length > 0) return;

    let idPhieu = phieuIdPhien;
    if (phieuIdPhien) {
      // Phiếu đang tạo dở hoặc đang sửa → áp đầu phiếu vào bản ghi.
      persistPhieu(
        phieu.map((p) =>
          p.id === phieuIdPhien ? { ...p, ...phien, id: p.id } : p
        )
      );
    } else {
      // Phiếu mới: chỉ tạo khi có dòng đầu tiên — không để lại phiếu rỗng.
      idPhieu = newId();
      persistPhieu([...phieu, { id: idPhieu, ...phien }]);
      setPhieuIdPhien(idPhieu);
    }

    const dong: DongBan = {
      id: newId(),
      phieuId: idPhieu ?? "",
      ngay: phien.ngayGiao,
      matHangId: dongMoi.matHangId,
      quyCach: dongMoi.quyCach.trim(),
      luongKg: dongMoi.luongKg,
      donGia: dongMoi.donGia,
      khoNguon: "",
    };
    // Đồng bộ đầu phiếu cho MỌI dòng của phiếu (khách/ngày/kênh có thể vừa đổi
    // tại chỗ) rồi thêm dòng mới — giữ bất biến "đầu phiếu áp cả phiếu".
    const thuocPhieu = (r: DongBan) =>
      suaRowIds ? suaRowIds.includes(r.id) : r.phieuId === idPhieu;
    persist([
      ...rows.map((r) =>
        thuocPhieu(r) ? { ...r, ngay: phien.ngayGiao } : r
      ),
      dong,
    ]);
    if (suaRowIds) setSuaRowIds([...suaRowIds, dong.id]);
    notify.daLuu(`Đã vào sổ: ${tenMatHang(dong.matHangId)} — ${kg(dong.luongKg)}`);

    setDongMoi(DONG_MOI_RONG);
    setLoiPhien([]);
  };

  const boDongPhien = (r: DongBan) => {
    const truoc = rows;
    const truocIds = suaRowIds;
    persist(rows.filter((x) => x.id !== r.id));
    if (suaRowIds) setSuaRowIds(suaRowIds.filter((id) => id !== r.id));
    notify.daXoa(`Đã bỏ ${tenMatHang(r.matHangId)} — ${kg(r.luongKg)}`, () => {
      persist(truoc);
      if (truocIds) setSuaRowIds(truocIds);
    });
  };

  /** Đóng phiếu: bỏ phiếu rỗng, áp đầu phiếu lần cuối, kéo bộ lọc về phiếu vừa ghi. */
  const dongPhienLai = (mo: "dong" | "phieu-khac") => {
    const p = phien;
    if (p && phieuIdPhien && dongPhien.length === 0) {
      persistPhieu(phieu.filter((x) => x.id !== phieuIdPhien));
    }
    if (p && dongPhien.length > 0 && phieuIdPhien) {
      persistPhieu(
        phieu.map((x) => (x.id === phieuIdPhien ? { ...x, ...p, id: x.id } : x))
      );
      const thuoc = (r: DongBan) =>
        suaRowIds ? suaRowIds.includes(r.id) : r.phieuId === phieuIdPhien;
      persist(rows.map((r) => (thuoc(r) ? { ...r, ngay: p.ngayGiao } : r)));
    }
    if (p && dongPhien.length > 0) {
      if (p.ngayGiao < tuHieuLuc || p.ngayGiao > denHieuLuc) {
        setKy("ngay");
        setNgay(p.ngayGiao);
      }
      if (phanXuong !== "Tất cả" && phanXuong !== p.phanXuong)
        setPhanXuong(p.phanXuong);
    }

    if (mo === "dong") {
      setPhien(null);
      setPhieuIdPhien(null);
      setSuaRowIds(null);
      return;
    }
    // Ghi phiếu khác: giữ ngày + xưởng, làm mới khách.
    setPhien(p ? { ...p, khachId: "", ghiChu: "" } : null);
    setPhieuIdPhien(null);
    setSuaRowIds(null);
    setDongMoi(DONG_MOI_RONG);
    setLoiPhien([]);
  };

  const xoaPhieuDangSua = () => {
    if (!suaRowIds) return;
    const truocRows = rows;
    const truocPhieu = phieu;
    const ids = new Set(suaRowIds);
    persist(rows.filter((r) => !ids.has(r.id)));
    if (phieuIdPhien) persistPhieu(phieu.filter((x) => x.id !== phieuIdPhien));
    notify.daXoa(
      `Đã xóa phiếu ${tenKhach(phien?.khachId ?? "") || "(chưa có khách)"} — ${suaRowIds.length} dòng`,
      () => {
        persist(truocRows);
        persistPhieu(truocPhieu);
      }
    );
    setPhien(null);
    setPhieuIdPhien(null);
    setSuaRowIds(null);
  };

  /* ---- Sửa một dòng mặt hàng ---- */

  const luu = () => {
    if (!dang) return;
    const ls: LoiNhap[] = [];
    if (!dang.matHangId)
      ls.push({ truong: "Mặt hàng", thongBao: "Chưa chọn mặt hàng" });
    if (!(dang.luongKg > 0))
      ls.push({ truong: "Lượng", thongBao: "Phải lớn hơn 0 kg" });
    setLoi(ls);
    if (ls.length > 0) return;
    persist(rows.map((r) => (r.id === dang.id ? dang : r)));
    notify.daLuu("Đã lưu thay đổi");
    setDang(null);
  };

  const set = <K extends keyof DongBan>(k: K, v: DongBan[K]) =>
    setDang((d) => (d ? { ...d, [k]: v } : d));

  /** Kênh của phiếu đang mở — quyết định đơn vị đơn giá. */
  const donViGia = phien?.kenh === "Nội địa" ? "đ" : "USD";
  const donViGiaDong = (kenh: Kenh) => (kenh === "Nội địa" ? "đ" : "USD");

  const cotDong = (kenh: Kenh): Cot<DongBan>[] => [
    {
      key: "mh",
      header: "Mặt hàng",
      chinh: true,
      render: (r) => tenMatHang(r.matHangId),
      sapXep: (r) => tenMatHang(r.matHangId),
    },
    {
      key: "qc",
      header: "Quy cách",
      render: (r) =>
        r.quyCach || <span className="text-muted-foreground">—</span>,
      sapXep: (r) => r.quyCach,
    },
    {
      key: "sl",
      header: "Lượng (kg)",
      so: true,
      render: (r) => num(r.luongKg),
      sapXep: (r) => r.luongKg,
    },
    {
      key: "gia",
      header: `Đơn giá (${donViGiaDong(kenh)})`,
      so: true,
      render: (r) =>
        r.donGia != null ? (
          num(r.donGia)
        ) : (
          <Badge variant="outline">Chưa có giá</Badge>
        ),
      sapXep: (r) => r.donGia ?? 0,
    },
    {
      key: "tien",
      header: `Thành tiền (${donViGiaDong(kenh)})`,
      so: true,
      render: (r) => num(thanhTienBan(r)),
      sapXep: (r) => thanhTienBan(r),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">Bán hàng</h1>
        <p className="mt-2 max-w-2xl text-base text-muted-foreground">
          Ghi bán thành phẩm RA cho khách hằng ngày: mỗi phiếu là một khách,
          nhận nhiều mặt hàng — mỗi mặt hàng một dòng. Cuối kỳ, màn Cân đối hút
          bán theo khoảng ngày. (Khác "bán thành phẩm" = công đoạn sản xuất WIP,
          chưa số hoá.)
        </p>
      </div>

      <ContextBar
        items={[
          { nhan: "Đang xem", giaTri: moTaPhamVi },
          { nhan: "Phân xưởng", giaTri: phanXuong },
          { nhan: "Số phiếu", giaTri: nhomView.length, so: true },
          { nhan: "Số dòng", giaTri: view.length, so: true },
          { nhan: "Tổng", giaTri: kg(tong), so: true },
        ]}
        actions={
          <Button size="lg" onClick={moThem}>
            <Plus />
            Ghi phiếu bán
          </Button>
        }
      />

      {/* Bộ lọc — toolbar một hàng */}
      <div className="rounded-xl border-2 border-border p-4">
        <div className="flex flex-wrap items-end gap-4">
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
                label="Khoảng ngày xuất bán"
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
                label={
                  ky === "ngay"
                    ? "Ngày xuất bán"
                    : ky === "tuan"
                      ? "Ngày bất kỳ trong tuần"
                      : ky === "thang"
                        ? "Ngày bất kỳ trong tháng"
                        : "Ngày bất kỳ trong năm"
                }
                anNhanBatBuoc
                hint={
                  ky === "ngay"
                    ? undefined
                    : `Kỳ đang xem: ${viDate(tuHieuLuc)} – ${viDate(denHieuLuc)}`
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
      </div>

      {/* Sổ: mỗi phiếu một cụm */}
      {nhomView.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          tieuDe={`Chưa có phiếu bán nào trong ${moTaPhamVi}`}
          moTa={
            phanXuong === "Tất cả"
              ? "Bấm nút dưới để ghi phiếu bán đầu tiên."
              : `Phân xưởng ${phanXuong}. Bấm nút dưới để ghi phiếu bán đầu tiên.`
          }
          action={
            <Button size="lg" onClick={moThem}>
              <Plus />
              Ghi phiếu bán
            </Button>
          }
        />
      ) : (
        <>
          <div className="space-y-5">
            {nhomView.map((n, i) => (
              <section
                key={n.phieu.id}
                className="space-y-4 rounded-xl border-2 border-border p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="tnum text-base text-muted-foreground">
                        Phiếu {i + 1}
                      </span>
                      <span className="text-xl font-semibold text-foreground">
                        {tenKhach(n.phieu.khachId) || "(chưa có khách)"}
                      </span>
                      <span className="text-base text-muted-foreground">
                        {viDate(n.phieu.ngayGiao)} · xưởng {n.phieu.phanXuong}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{n.phieu.kenh}</Badge>
                      {n.ghiBu && (
                        <Badge variant="outline">
                          Ghi bù {viDate(n.phieu.ngayGhiSo)}
                        </Badge>
                      )}
                    </div>
                    {n.ghiBu && n.phieu.lyDoGhiBu && (
                      <p className="text-base text-muted-foreground">
                        Lý do ghi bù: {n.phieu.lyDoGhiBu}
                      </p>
                    )}
                    {n.phieu.ghiChu && (
                      <p className="text-base text-muted-foreground">
                        Ghi chú: {n.phieu.ghiChu}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-base text-muted-foreground">
                      Phiếu này
                    </span>
                    <span className="tnum text-xl font-semibold">
                      {kg(n.tongKg)}
                    </span>
                    <Button variant="outline" onClick={() => moSuaPhieu(n)}>
                      <Pencil />
                      Sửa phiếu
                    </Button>
                  </div>
                </div>

                <RecordTable
                  columns={cotDong(n.phieu.kenh)}
                  rows={n.dong}
                  getKey={(r) => r.id}
                />
              </section>
            ))}
          </div>

          <div className="flex flex-wrap justify-end gap-x-10 gap-y-3 rounded-xl bg-muted px-5 py-4">
            <div className="flex items-baseline gap-3">
              <span className="text-base text-muted-foreground">
                Tổng khối lượng
              </span>
              <span className="tnum text-xl font-semibold">{kg(tong)}</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-base text-muted-foreground">
                Tổng tiền bán
              </span>
              <span className="tnum text-xl font-semibold">
                {num(tongTien)}
              </span>
            </div>
          </div>
        </>
      )}

      {/* ---- Hộp thoại: ghi phiếu bán ---- */}
      <Dialog
        open={phien !== null}
        onOpenChange={(o) => {
          if (!o) dongPhienLai("dong");
        }}
      >
        <DialogContent className="max-h-[92vh] w-full overflow-y-auto sm:max-w-3xl lg:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {dangSuaPhieu ? "Sửa phiếu bán" : "Ghi phiếu bán"}
            </DialogTitle>
            <DialogDescription className="text-base">
              {dangSuaPhieu
                ? "Sửa đầu phiếu (áp cho mọi dòng), thêm hoặc bỏ mặt hàng ngay bên dưới."
                : "Điền đầu phiếu (khách, kênh, ngày) rồi đổ từng mặt hàng ngay bên dưới — mỗi mặt hàng bấm “Thêm mặt hàng vào sổ” là vào sổ ngay."}
            </DialogDescription>
          </DialogHeader>

          {phien && (
            <div className="space-y-6 py-2">
              <ErrorSummary loi={loiPhien} />

              <div className="grid gap-6 sm:grid-cols-2">
                <DateField
                  label="Ngày ghi sổ"
                  required
                  info="Ngày ghi vào hệ thống. Khác ngày xuất bán ⇒ ghi bù."
                  value={phien.ngayGhiSo}
                  onChange={(v) => datPhien("ngayGhiSo", v)}
                />
                <DateField
                  label="Ngày xuất bán"
                  required
                  info="Ngày hàng thực xuất bán — mọi tổng hợp tính theo ngày này."
                  value={phien.ngayGiao}
                  onChange={(v) => datPhien("ngayGiao", v)}
                />
              </div>

              {laGhiBuBan(phien) && (
                <Field
                  label="Lý do ghi bù"
                  required
                  hint="VD: xuất bán 29/7, 31/7 mới ghi sổ."
                >
                  <Input
                    value={phien.lyDoGhiBu}
                    onChange={(e) => datPhien("lyDoGhiBu", e.target.value)}
                    placeholder="Vì sao tới hôm nay mới ghi?"
                  />
                </Field>
              )}

              <div className="grid gap-6 sm:grid-cols-2">
                <Combobox
                  label="Phân xưởng"
                  required
                  choPhepXoa={false}
                  value={phien.phanXuong}
                  onChange={(v) => datPhien("phanXuong", v as PhanXuong)}
                  options={PHAN_XUONG.map((p) => ({ value: p, label: p }))}
                />
                <ChoiceGroup
                  label="Kênh bán"
                  value={phien.kenh}
                  onChange={(v) => datPhien("kenh", v as Kenh)}
                  options={KENH.map((k) => ({ value: k, label: k }))}
                  cot={2}
                />
              </div>

              <Combobox
                label="Khách hàng"
                hint="Chọn trong danh mục. Chưa có thì gõ tên rồi bấm Thêm mới. Bỏ trống nếu chưa xác định khách."
                value={phien.khachId}
                onChange={(v) => datPhien("khachId", v)}
                options={optKhach}
                onCreate={themKhach}
                emptyText="Chưa có khách hàng nào trong danh mục."
              />

              <Field label="Ghi chú phiếu">
                <Input
                  value={phien.ghiChu}
                  onChange={(e) => datPhien("ghiChu", e.target.value)}
                  placeholder="Ghi chú thêm (nếu có)"
                />
              </Field>

              <div className="border-t-2 border-border pt-1" />

              {/* Đã vào sổ */}
              {dongPhien.length > 0 && (
                <div className="space-y-3 rounded-xl border-2 border-border p-4">
                  <p className="flex items-center gap-2 text-base font-semibold text-foreground">
                    <CircleCheck className="size-6 text-primary" aria-hidden />
                    Đã vào sổ {dongPhien.length} mặt hàng — phiếu này{" "}
                    <span className="tnum">{kg(tongPhien)}</span>
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
                          {tenMatHang(r.matHangId)}
                          {r.quyCach ? (
                            <span className="text-muted-foreground">
                              {" "}
                              · {r.quyCach}
                            </span>
                          ) : null}{" "}
                          —{" "}
                          <span className="tnum font-semibold">
                            {num(r.luongKg)}
                          </span>{" "}
                          kg
                        </span>
                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setDang({ ...r });
                              setLoi([]);
                            }}
                          >
                            <Pencil />
                            Sửa
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => boDongPhien(r)}
                          >
                            <X />
                            Bỏ
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Thêm một mặt hàng — nút chính duy nhất trong thân */}
              <div className="space-y-5 rounded-xl border-2 border-primary/40 bg-accent/40 p-4">
                <p className="text-base font-semibold">Thêm mặt hàng</p>

                <Combobox
                  label="Mặt hàng"
                  required
                  hint="Chưa có trong danh mục thì gõ tên rồi bấm Thêm mới."
                  value={dongMoi.matHangId}
                  onChange={(v) => setDong("matHangId", v)}
                  options={optMatHang}
                  onCreate={themMatHang}
                  emptyText="Chưa có mặt hàng nào trong danh mục."
                />

                <Field
                  label="Quy cách"
                  hint="Size/grade của thành phẩm. VD: 18-20, 1000-1300, 1.5g."
                >
                  <Input
                    value={dongMoi.quyCach}
                    onChange={(e) => setDong("quyCach", e.target.value)}
                    placeholder="VD: 18-20"
                  />
                </Field>

                <div className="grid gap-6 sm:grid-cols-2">
                  <NumberField
                    label="Lượng"
                    required
                    unit="kg"
                    value={dongMoi.luongKg || null}
                    onChange={(v) => setDong("luongKg", v ?? 0)}
                  />
                  <NumberField
                    label="Đơn giá"
                    unit={donViGia}
                    value={dongMoi.donGia}
                    onChange={(v) => setDong("donGia", v)}
                    hint="Bỏ trống nếu chưa chốt giá."
                  />
                </div>

                {dongMoi.luongKg > 0 && dongMoi.donGia ? (
                  <div className="rounded-lg bg-accent px-4 py-3 text-base text-accent-foreground">
                    Thành tiền:{" "}
                    <span className="tnum text-lg font-semibold">
                      {num(dongMoi.luongKg * dongMoi.donGia)} {donViGia}
                    </span>
                  </div>
                ) : null}

                <Button size="lg" className="w-full" onClick={themDong}>
                  <Plus />
                  Thêm mặt hàng vào sổ
                </Button>
              </div>

              {/* Tổng phiếu */}
              <div className="flex flex-wrap items-baseline justify-end gap-x-8 gap-y-2 rounded-xl bg-muted px-5 py-4">
                <span className="text-base text-muted-foreground">
                  Tổng phiếu {viDate(phien.ngayGiao)} · xưởng {phien.phanXuong}
                </span>
                <span className="tnum text-2xl font-semibold">
                  {kg(tongPhien)}
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            {dangSuaPhieu ? (
              <ConfirmDelete
                moTaBanGhi={`Phiếu ${tenKhach(phien?.khachId ?? "") || "(chưa có khách)"} — ${viDate(phien?.ngayGiao ?? "")} — ${dongPhien.length} dòng — ${kg(tongPhien)}`}
                onConfirm={xoaPhieuDangSua}
                tieuDe="Xóa cả phiếu này?"
                nhanNut="Xóa phiếu"
              />
            ) : (
              <Button
                variant="outline"
                size="lg"
                onClick={() => dongPhienLai("phieu-khac")}
              >
                <Truck />
                Lưu &amp; thêm phiếu khác
              </Button>
            )}
            <Button size="lg" onClick={() => dongPhienLai("dong")}>
              {dangSuaPhieu ? "Xong" : "Xong phiếu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Hộp thoại: sửa một dòng mặt hàng ---- */}
      <Dialog
        open={dang !== null}
        onOpenChange={(o) => {
          if (!o) setDang(null);
        }}
      >
        <DialogContent className="max-h-[92vh] w-full overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Sửa dòng mặt hàng</DialogTitle>
            <DialogDescription className="text-base">
              Khách, kênh, ngày và xưởng thuộc về cả phiếu — sửa ở nút "Sửa
              phiếu" trên đầu cụm.
            </DialogDescription>
          </DialogHeader>

          {dang && (
            <div className="space-y-6 py-2">
              <ErrorSummary loi={loi} />

              <Combobox
                label="Mặt hàng"
                required
                hint="Chưa có trong danh mục thì gõ tên rồi bấm Thêm mới."
                value={dang.matHangId}
                onChange={(v) => set("matHangId", v)}
                options={optMatHang}
                onCreate={themMatHang}
                emptyText="Chưa có mặt hàng nào trong danh mục."
              />

              <Field
                label="Quy cách"
                hint="Size/grade của thành phẩm. VD: 18-20, 1000-1300."
              >
                <Input
                  value={dang.quyCach}
                  onChange={(e) => set("quyCach", e.target.value)}
                  placeholder="VD: 18-20"
                />
              </Field>

              <div className="grid gap-6 sm:grid-cols-2">
                <NumberField
                  label="Lượng"
                  required
                  unit="kg"
                  value={dang.luongKg || null}
                  onChange={(v) => set("luongKg", v ?? 0)}
                />
                <NumberField
                  label="Đơn giá"
                  unit={donViGia}
                  value={dang.donGia}
                  onChange={(v) => set("donGia", v)}
                  hint="Bỏ trống nếu chưa chốt giá."
                />
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
    </div>
  );
}
