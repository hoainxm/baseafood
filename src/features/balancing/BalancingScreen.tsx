// ============================================================
// Tên file cũ: src/features/balancing/CanDoi.tsx
// Tên tiếng Việt: Màn hình Cân đối kỳ sản xuất 5 ngày
// Description: Balancing Period Management Screen
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type {
  BalancingPeriod,
  SalesItem,
  Product,
  Customer,
  SalesInvoice,
} from "@/types";
import { uid } from "@/lib/db";
import {
  useSalesItems,
  useCustomers,
  useBalancingPeriods,
  useMaterialTypes,
  useProducts,
  useBalancingInputs,
  useScraps,
  useSalesInvoices,
  useBalancingOutputs,
  useMaterialImports,
  useWipProductions,
} from "@/lib/catalogRepo";
import { usePeriodGrid } from "./usePeriodGrid";
import { LuoiNguyenLieu } from "./MaterialGrid";
import { LuoiBanThanhPham } from "./WipGrid";
import {
  ChuThichBatBuoc,
  Button,
  Card,
  Combobox,
  ConfirmDelete,
  DateRangeField,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorSummary,
  NumberField,
  RecordTable,
  SkeletonBang,
  dateToIso,
  notify,
  type Cot,
  type LoiNhap,
} from "@/design-system";
import { num, viDate } from "@/lib/format";
import {
  ChevronLeft,
  Columns2,
  FileText,
  Pencil,
  Plus,
  Redo2,
  Rows3,
  Scale,
  Lock,
  LockOpen,
  ArrowRightLeft,
  Undo2,
} from "lucide-react";
import { HopChotKy } from "./gridDialogs";
import BangCanDoi from "./BalancingTable";

/** Chuỗi ngày để in trên bảng, sinh từ khoảng ngày đã chọn. */
function moTaKhoang(tu?: string, den?: string): string {
  if (!tu) return "";
  if (!den || den === tu) return viDate(tu);
  return `${viDate(tu)} – ${viDate(den)}`;
}

export default function CanDoiScreen() {
  const [kyList, persistKy, { trangThai: ttKy }] = useBalancingPeriods();
  const dangTaiKy = ttKy === "dang-tai" && kyList.length === 0;
  const { periodId } = useParams<{ periodId?: string }>();
  const navigate = useNavigate();
  const selId = periodId || null;
  const setSelId = (id: string | null) => {
    if (id) {
      navigate(`/balancing/${id}`);
    } else {
      navigate("/balancing");
    }
  };
  const [loaiNLDanhMuc, setLoaiNLDanhMuc] = useMaterialTypes();

  /* Xóa kỳ phải xóa luôn dòng con của nó (NL vào / phế liệu / TP ra), nếu không
     các dòng này mồ côi trong kho — chiếm chỗ, sai tổng khi thống kê sau này. */
  const [tatCaNL, ghiNL] = useBalancingInputs();
  const [tatCaPL, ghiPL] = useScraps();
  const [tatCaTP, ghiTP] = useBalancingOutputs();
  /* Hai sổ nguồn: kỳ chỉ MƯỢN dòng của chúng bằng `balancingPeriodId`. */
  const [tatCaNhap, ghiNhap] = useMaterialImports();
  const [tatCaSanXuat, ghiSanXuat] = useWipProductions();

  /** Gõ loại mới trong ô chọn → LƯU LUÔN vào danh mục (rule 7), không để mồ côi. */
  const themLoaiNL = (ten: string) => {
    setLoaiNLDanhMuc([...loaiNLDanhMuc, { id: uid(), name: ten, category: "", note: "" }]);
    notify.daLuu(`Đã thêm loại nguyên liệu "${ten}" vào danh mục`);
    return ten;
  };

  const [dang, setDang] = useState<BalancingPeriod | null>(null);
  const [laThem, setLaThem] = useState(false);
  const [loi, setLoi] = useState<LoiNhap[]>([]);

  const moThem = () => {
    const homNay = dateToIso(new Date());
    setDang({
      id: uid(),
      materialTypeName: "",
      dateRangeDescription: "",
      startDate: homNay,
      endDate: homNay,
      totalInputKg: null,
      exchangeRate: 26000,
      processingCostPerKg: null,
      createdAt: new Date().toISOString(),
    });
    setLaThem(true);
    setLoi([]);
  };

  const luuKy = () => {
    if (!dang) return;
    const ls: LoiNhap[] = [];
    if (!dang.materialTypeName.trim())
      ls.push({ truong: "Loại nguyên liệu", thongBao: "Chưa chọn loại" });
    if (!dang.startDate)
      ls.push({ truong: "Ngày tiếp nhận", thongBao: "Chưa chọn ngày" });
    setLoi(ls);
    if (ls.length > 0) return;

    const ban: BalancingPeriod = {
      ...dang,
      dateRangeDescription: moTaKhoang(dang.startDate, dang.endDate),
    };
    if (laThem) {
      persistKy([ban, ...kyList]);
      notify.daLuu(`Đã tạo kỳ cân đối "${ban.materialTypeName}"`);
      setSelId(ban.id);
    } else {
      persistKy(kyList.map((k) => (k.id === ban.id ? ban : k)));
      notify.daLuu("Đã lưu thay đổi");
    }
    setDang(null);
  };

  const xoaKy = (k: BalancingPeriod) => {
    const truocKy = kyList;
    const truocNL = tatCaNL;
    const truocPL = tatCaPL;
    const truocTP = tatCaTP;
    const truocNhap = tatCaNhap;
    const truocSanXuat = tatCaSanXuat;
    persistKy(kyList.filter((x) => x.id !== k.id));
    ghiNL(tatCaNL.filter((r) => r.periodId !== k.id));
    /* Phế liệu cân ở màn Nhập hàng chỉ MƯỢN kỳ này — xóa kỳ thì gỡ liên kết,
       tuyệt đối không xóa theo, vì bản gốc là số cân của sổ nhập hàng. */
    ghiPL(
      tatCaPL
        .filter((r) => r.periodId !== k.id || r.source === "Nhập hàng")
        .map((r) =>
          r.periodId === k.id && r.source === "Nhập hàng" ? { ...r, periodId: "" } : r
        )
    );
    ghiTP(tatCaTP.filter((r) => r.periodId !== k.id));
    /* Sổ nhập hàng và sổ sản xuất cũng chỉ MƯỢN kỳ này: xóa kỳ phải NHẢ dòng
       ra, không thì chúng còn ghim vào một kỳ đã chết — mọi kỳ sau lọc theo
       "chưa gắn kỳ nào" sẽ không thấy chúng nữa và số liệu biến mất khỏi cân
       đối vĩnh viễn (dù sổ gốc vẫn còn nguyên). */
    ghiNhap(
      tatCaNhap.map((r) =>
        r.balancingPeriodId === k.id ? { ...r, balancingPeriodId: "" } : r
      )
    );
    ghiSanXuat(
      tatCaSanXuat.map((r) =>
        r.balancingPeriodId === k.id ? { ...r, balancingPeriodId: "" } : r
      )
    );
    notify.daXoa(
      `Đã xóa kỳ "${k.materialTypeName}" — số ở sổ nhập hàng và sổ sản xuất vẫn còn`,
      () => {
        persistKy(truocKy);
        ghiNL(truocNL);
        ghiPL(truocPL);
        ghiTP(truocTP);
        ghiNhap(truocNhap);
        ghiSanXuat(truocSanXuat);
      }
    );
  };

  const sel = kyList.find((k) => k.id === selId) || null;

  if (sel) {
    return (
      <KyDetail
        ky={sel}
        onBack={() => setSelId(null)}
        onChangeKy={(patch) =>
          persistKy(kyList.map((k) => (k.id === sel.id ? { ...k, ...patch } : k)))
        }
      />
    );
  }

  const cols: Cot<BalancingPeriod>[] = [
    {
      key: "loaiNL",
      header: "Loại nguyên liệu",
      chinh: true,
      render: (r) => r.materialTypeName,
      sapXep: (r) => r.materialTypeName,
    },
    {
      key: "ngay",
      header: "Ngày tiếp nhận",
      render: (r) =>
        r.dateRangeDescription || <span className="text-muted-foreground">Chưa ghi</span>,
      sapXep: (r) => r.startDate ?? "",
    },
    {
      key: "tongNLNhan",
      header: "Tổng NL nhận (kg)",
      so: true,
      anTrenDienThoai: true,
      render: (r) =>
        r.totalInputKg != null ? (
          num(r.totalInputKg)
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      sapXep: (r) => r.totalInputKg ?? 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Cân đối nguyên liệu
          </h1>
        </div>
        <Button size="lg" onClick={moThem}>
          <Plus />
          Tạo kỳ cân đối
        </Button>
      </div>

      {dangTaiKy ? (
        <SkeletonBang />
      ) : kyList.length === 0 ? (
        <EmptyState
          icon={Scale}
          tieuDe="Chưa có kỳ cân đối nào"
          moTa="Tạo kỳ đầu tiên: chọn loại nguyên liệu và khoảng ngày tiếp nhận."
          action={
            <Button size="lg" onClick={moThem}>
              <Plus />
              Tạo kỳ cân đối
            </Button>
          }
        />
      ) : (
        <RecordTable
          columns={cols}
          rows={kyList}
          getKey={(r) => r.id}
          timKiem={(r) => `${r.materialTypeName} ${r.dateRangeDescription}`}
          nhanTimKiem="Tìm kỳ theo loại nguyên liệu…"
          actions={(r) => (
            <>
              <Button size="sm" onClick={() => setSelId(r.id)}>
                Mở kỳ
              </Button>
              <Button
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
                moTaBanGhi={`Kỳ "${r.materialTypeName}" — ${r.dateRangeDescription || "chưa ghi ngày"}`}
                onConfirm={() => xoaKy(r)}
                tieuDe="Xóa kỳ cân đối này?"
                nhanNut="Xóa kỳ"
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
              {laThem ? "Tạo kỳ cân đối" : "Sửa kỳ cân đối"}
            </DialogTitle>
          </DialogHeader>

          {dang && (
            <div className="space-y-6 py-2">
              <ErrorSummary loi={loi} />
              <ChuThichBatBuoc />

              <Combobox
                label="Loại nguyên liệu"
                required
                hint="Lô nguyên liệu đem cân đối, VD: Bạch tuộc 2 da."
                value={dang.materialTypeName}
                onChange={(v) => setDang((d) => (d ? { ...d, materialTypeName: v } : d))}
                options={loaiNLDanhMuc.map((l) => ({
                  value: l.name,
                  label: l.name,
                  phu: l.category || undefined,
                }))}
                onCreate={themLoaiNL}
              />

              <DateRangeField
                label="Ngày tiếp nhận"
                required
                hint="Kỳ xưởng Đông thường 5 ngày — có nút chọn nhanh bên dưới."
                startDate={dang.startDate ?? ""}
                endDate={dang.endDate ?? ""}
                onChange={(tu, den) =>
                  setDang((d) => (d ? { ...d, startDate: tu, endDate: den } : d))
                }
              />

              <div className="grid gap-6 sm:grid-cols-2">
                <NumberField
                  label="Tổng NL nhận cả kỳ"
                  unit="kg"
                  value={dang.totalInputKg}
                  onChange={(v) =>
                    setDang((d) => (d ? { ...d, totalInputKg: v } : d))
                  }
                  hint="Lấy từ bảng phụ — để tính tỉ lệ thu hồi."
                />
                <NumberField
                  label="Chi phí chế biến / kg TP"
                  unit="đ"
                  value={dang.processingCostPerKg}
                  onChange={(v) =>
                    setDang((d) => (d ? { ...d, processingCostPerKg: v } : d))
                  }
                />
                <NumberField
                  label="Tỉ giá"
                  unit="đ/USD"
                  value={dang.exchangeRate}
                  onChange={(v) => setDang((d) => (d ? { ...d, exchangeRate: v } : d))}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setDang(null)}>
              Hủy
            </Button>
            <Button size="lg" onClick={luuKy}>
              {laThem ? "Tạo kỳ" : "Lưu thay đổi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Chi tiết một kỳ ---------- */

/**
 * Một kỳ cân đối = MỘT tờ: thông số kỳ · lưới nguyên liệu · lưới bán thành phẩm
 * · kết quả. Toàn bộ dữ liệu và thao tác nằm ở `usePeriodGrid`; chỗ này chỉ xếp
 * chỗ và nối danh mục.
 */
function KyDetail({
  ky,
  onBack,
  onChangeKy,
}: {
  ky: BalancingPeriod;
  onBack: () => void;
  onChangeKy: (patch: Partial<BalancingPeriod>) => void;
}) {
  const luoi = usePeriodGrid(ky);
  const [matHang, setMatHang] = useProducts();
  const [khach, setKhach] = useCustomers();
  const [loaiNLDanhMuc, setLoaiNLDanhMuc] = useMaterialTypes();
  const [showBang, setShowBang] = useState(false);
  /* Một công tắc cho CẢ HAI lưới: hai khối nằm trên cùng một tờ, cột ngày phải
     dóng thẳng nhau thì mới đối chiếu được NL vào ↔ BTP ra của cùng một ngày. */
  const [anCotNgay, setAnCotNgay] = useState(false);
  /* Xếp hai khối cạnh nhau (như file Excel gốc) — người dùng tự bật, không tự
     đổi theo bề rộng: bố cục nhảy khi thu cột là thứ gây mất phương hướng nhất. */
  const [xepNgang, setXepNgang] = useState(false);
  const [chotMo, setChotMo] = useState(false);

  /* Ctrl+Z / Ctrl+Y — nghe ở cấp màn, bỏ qua khi con trỏ đang trong hộp thoại. */
  useEffect(() => {
    const nghe = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        luoi.hoanTac();
      } else if (k === "y" || (k === "z" && e.shiftKey)) {
        e.preventDefault();
        luoi.lamLai();
      }
    };
    window.addEventListener("keydown", nghe);
    return () => window.removeEventListener("keydown", nghe);
  }, [luoi]);

  /* Sổ bán — seam cũ cho tình huống output = hàng đã bán ra. */
  const [tatCaBan] = useSalesItems();
  const [dsPhieu] = useSalesInvoices();
  const banChoHut = useMemo(() => {
    const phieuTheoId = new Map(dsPhieu.map((p) => [p.id, p]));
    const daHut = new Set(luoi.tp.map((t) => t.salesItemId).filter(Boolean));
    return tatCaBan
      .filter((b) => {
        const p = phieuTheoId.get(b.invoiceId);
        if (!p || daHut.has(b.id)) return false;
        return (
          !ky.startDate ||
          !ky.endDate ||
          (p.deliveryDate >= ky.startDate && p.deliveryDate <= ky.endDate)
        );
      })
      .map((b) => ({ ban: b, phieu: phieuTheoId.get(b.invoiceId)! }));
  }, [tatCaBan, dsPhieu, luoi.tp, ky.startDate, ky.endDate]);

  const hutBanVaoKy = (items: { ban: SalesItem; phieu: SalesInvoice }[]) => {
    luoi.ghiTP([
      ...luoi.tp,
      ...items.map(({ ban, phieu }) => ({
        id: uid(),
        periodId: ky.id,
        productId: ban.productId,
        customerId: phieu.customerId,
        channel: phieu.channel,
        quantityKg: ban.quantityKg,
        unitPrice: ban.unitPrice,
        spec: ban.spec,
        salesItemId: ban.id,
      })),
    ]);
    notify.daLuu(`Đã hút ${items.length} dòng bán vào kỳ này`);
  };

  const { kq } = luoi;
  /** Chưa có bán thành phẩm → định mức + lãi/lỗ chưa có nghĩa. */
  const chuaCoTP = kq.totalOutputKg <= 0;

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack}>
        <ChevronLeft />
        Danh sách kỳ
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{ky.materialTypeName}</h1>
          <p className="mt-2 text-base text-muted-foreground">
            Ngày tiếp nhận: {ky.dateRangeDescription || "chưa ghi"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="lg"
            onClick={luoi.hoanTac}
            disabled={!luoi.hoanTacDuoc}
            title="Ctrl+Z"
          >
            <Undo2 />
            Hoàn tác
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={luoi.lamLai}
            disabled={!luoi.lamLaiDuoc}
            title="Ctrl+Y"
          >
            <Redo2 />
            Làm lại
          </Button>
          <Button variant="outline" size="lg" onClick={() => setXepNgang((v) => !v)}>
            {xepNgang ? <Rows3 /> : <Columns2 />}
            {xepNgang ? "Xếp dọc" : "Xếp ngang"}
          </Button>
          <Button variant="outline" size="lg" onClick={() => setShowBang(true)}>
            <FileText />
            Xem / in bảng
          </Button>
        </div>
      </div>

      <Card className="p-5">
        <h2 className="mb-4 text-xl font-semibold">Thông số kỳ</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          <NumberField
            label="Tổng NL nhận cả kỳ"
            unit="kg"
            anNhanBatBuoc
            value={ky.totalInputKg}
            onChange={(v) => onChangeKy({ totalInputKg: v })}
          />
          <NumberField
            label="Chi phí chế biến / kg TP"
            unit="đ"
            anNhanBatBuoc
            value={ky.processingCostPerKg}
            onChange={(v) => onChangeKy({ processingCostPerKg: v })}
          />
          <NumberField
            label="Tỉ giá"
            unit="đ/USD"
            anNhanBatBuoc
            value={ky.exchangeRate}
            onChange={(v) => onChangeKy({ exchangeRate: v })}
          />
        </div>
      </Card>

      {/* Hai khối trong MỘT tờ: cùng khung, cùng công tắc cột ngày, chỉ ngăn nhau
          bằng một đường kẻ — đọc như một bảng cân đối liền mạch. */}
      <Card
        className={
          xepNgang
            ? "grid grid-cols-1 overflow-hidden p-0 2xl:grid-cols-2"
            : "overflow-hidden p-0"
        }
      >
        <LuoiNguyenLieu
          luoi={luoi}
          loaiNLDanhMuc={loaiNLDanhMuc}
          anNgay={anCotNgay}
          onDoiAnNgay={() => setAnCotNgay((v) => !v)}
          onThemLoaiNL={(ten) => {
            setLoaiNLDanhMuc([
              ...loaiNLDanhMuc,
              { id: uid(), name: ten, category: "", note: "" },
            ]);
            notify.daLuu(`Đã thêm loại nguyên liệu "${ten}" vào danh mục`);
            return ten;
          }}
        />
        <LuoiBanThanhPham
          luoi={luoi}
          matHang={matHang}
          khach={khach}
          choHutBan={banChoHut}
          onHutBan={hutBanVaoKy}
          anNgay={anCotNgay}
          onDoiAnNgay={() => setAnCotNgay((v) => !v)}
          onThemMatHang={(ten) => {
            const m: Product = { id: uid(), code: "", name: ten, finishedGoodCode: "" };
            setMatHang([...matHang, m]);
            notify.daLuu(`Đã thêm mặt hàng "${ten}" vào danh mục`);
            return m.id;
          }}
          onThemKhach={(ten) => {
            const k: Customer = { id: uid(), code: "", name: ten, market: "" };
            setKhach([...khach, k]);
            notify.daLuu(`Đã thêm khách hàng "${ten}" vào danh mục`);
            return k.id;
          }}
        />
      </Card>

      {/* Vòng gối đầu: phần kỳ trước đẩy sang được kéo vào đây bằng một nút, thay
          cho việc mở file kỳ cũ ra chép tay. */}
      {luoi.soDongChuyenKy > 0 && !luoi.daChot && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-base">
            Kỳ trước ({luoi.kyTruoc?.dateRangeDescription || "…"}) có{" "}
            <strong>{luoi.soDongChuyenKy}</strong> dòng đẩy sang kỳ này mà chưa kỳ nào
            nhận.
          </p>
          <Button size="lg" onClick={luoi.nhanChuyenKy}>
            <ArrowRightLeft />
            Nhận {luoi.soDongChuyenKy} dòng chuyển kỳ
          </Button>
        </Card>
      )}

      <Card className="p-5">
        <h2 className="mb-4 text-xl font-semibold">Kết quả cân đối</h2>
        <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          <KV k="Tổng nguyên liệu vào" v={`${num(kq.totalInputKg)} kg`} />
          <KV k="Tổng bán thành phẩm" v={`${num(kq.totalOutputKg)} kg`} />
          <KV k="Định mức chế biến" v={chuaCoTP ? "—" : num(kq.norm)} strong />
          <KV k="Tỉ lệ thu hồi" v={kq.yieldRate == null ? "—" : num(kq.yieldRate)} />
          <KV k="Giá trị nguyên liệu" v={`${num(kq.materialValue)} đ`} />
          <KV k="Giá thành" v={`${num(kq.costOfGoods)} đ`} />
          <KV k="Giá trị xuất" v={`${num(kq.exportValue)} đ`} />
          <KV
            k="Bình quân / kg NL"
            v={chuaCoTP ? "—" : `${num(kq.avgProfitPerKgMaterial)} đ`}
          />
        </div>
        {/* Chưa nhập bán thành phẩm thì KHÔNG kết luận lãi/lỗ — nếu không màn sẽ
            báo "Lỗ = toàn bộ tiền nguyên liệu" (đỏ, hù người dùng) dù kỳ mới nhập
            được một nửa. */}
        {chuaCoTP ? (
          <div className="mt-5 rounded-lg bg-muted px-5 py-4 text-base font-medium text-muted-foreground">
            Chưa có bán thành phẩm sản xuất — nhập khối 2 để tính được lãi/lỗ.
          </div>
        ) : (
          <div
            className={`mt-5 rounded-lg px-5 py-4 text-xl font-semibold ${
              kq.profitOrLoss >= 0
                ? "bg-success-surface text-success"
                : "bg-warning-surface text-destructive"
            }`}
          >
            {kq.profitOrLoss >= 0 ? "▲ Lãi" : "▼ Lỗ"}:{" "}
            <span className="tnum">{num(Math.abs(kq.profitOrLoss))}</span> đ
          </div>
        )}
      </Card>

      {/* Chốt kỳ đặt CUỐI màn — xem hết số rồi mới chốt, đúng chỗ của thanh chốt
          ngày ở sổ nhập hàng. */}
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="text-lg font-semibold">
            {ky.isLocked ? "Kỳ đã chốt" : "Kỳ đang mở"}
          </p>
          <p className="text-base text-muted-foreground">
            {ky.isLocked
              ? `Khoá lúc ${ky.lockedAt ? new Date(ky.lockedAt).toLocaleString("vi-VN") : "—"}${
                  ky.lockNote ? ` · ${ky.lockNote}` : ""
                }`
              : "Chốt khi đã đối chiếu xong và gửi kế toán — sau đó mọi ô trong lưới khoá lại."}
          </p>
          {ky.reopenReason && (
            <p className="text-base text-warning">Lần mở lại gần nhất: {ky.reopenReason}</p>
          )}
        </div>
        <Button
          variant={ky.isLocked ? "outline" : "default"}
          size="lg"
          onClick={() => setChotMo(true)}
        >
          {ky.isLocked ? <LockOpen /> : <Lock />}
          {ky.isLocked ? "Mở lại kỳ" : "Chốt kỳ"}
        </Button>
      </Card>

      {chotMo && (
        <HopChotKy
          daChot={Boolean(ky.isLocked)}
          tenKy={`${ky.materialTypeName} · ${ky.dateRangeDescription}`}
          tongTP={`${num(kq.totalOutputKg)} kg bán thành phẩm`}
          onClose={() => setChotMo(false)}
          onLuu={(ghiChu) => {
            /* Mở lại KHÔNG xoá dấu đã chốt — chỉ hạ cờ và ghi lý do, giữ vết. */
            onChangeKy(
              ky.isLocked
                ? { isLocked: false, reopenReason: ghiChu }
                : { isLocked: true, lockedAt: new Date().toISOString(), lockNote: ghiChu }
            );
            notify.daLuu(ky.isLocked ? "Đã mở lại kỳ" : "Đã chốt kỳ");
            setChotMo(false);
          }}
        />
      )}

      {showBang && (
        <BangCanDoi
          ky={ky}
          nlVao={luoi.nlVao}
          tp={luoi.tp}
          matHang={matHang}
          khach={khach}
          kq={kq}
          nhapDaGan={luoi.nhapDaGan}
          sanXuatDaGan={luoi.sanXuatDaGan}
          onClose={() => setShowBang(false)}
        />
      )}
    </div>
  );
}

function KV({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2.5">
      <span className="text-base text-muted-foreground">{k}</span>
      <span
        className={`tnum text-right ${
          strong ? "text-xl font-semibold text-primary" : "text-base font-medium"
        }`}
      >
        {v}
      </span>
    </div>
  );
}

/* ---------- Mảnh dùng chung cho 3 khối ---------- */

