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
  useMonthlyStock,
  useWipProductions,
} from "@/lib/catalogRepo";
import { dongBoSoKho } from "@/lib/khoCanDoi";
import { usePeriodGrid } from "./usePeriodGrid";
import { LuoiNguyenLieu } from "./MaterialGrid";
import { hoNguyenLieu } from "@/lib/balancingGrid";
import type { BalancingResult } from "@/lib/balancingCalc";
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
import { useSuaDanhMuc } from "@/features/catalog/SuaDanhMucNhanh";
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
  ArrowDownToLine,
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
  /* Sổ kho tháng: dòng Lấy xả đông / Gửi đông của kỳ đã ghi thẳng vào đây. */
  const [soKho, ghiSoKho] = useMonthlyStock();

  /** Gõ loại mới trong ô chọn → LƯU LUÔN vào danh mục (rule 7), không để mồ côi. */
  const themLoaiNL = (ten: string) => {
    setLoaiNLDanhMuc([...loaiNLDanhMuc, { id: uid(), name: ten, category: "", note: "" }]);
    notify.daLuu(`Đã thêm loại nguyên liệu "${ten}" vào danh mục`);
    return ten;
  };

  /* Chọn loại NL cho kỳ: GỘP biến thể size về HỌ — "Bạch tuộc 2 da lớn (80↑)" +
     "… nhỏ (80↓)" chỉ hiện MỘT mục "Bạch tuộc 2 da" (cân đối không tách size, chốt
     với chủ dự án). Tên không có mốc 80↑/↓ giữ nguyên. Value = tên họ nên chọn xong
     ô hiển thị đúng và lưu thẳng tên họ. Danh mục gốc (sổ nhập) vẫn giữ đủ size. */
  const optLoaiNL = useMemo(() => {
    const daCo = new Set<string>();
    const ra: { value: string; label: string; phu?: string }[] = [];
    for (const l of loaiNLDanhMuc) {
      const ho = hoNguyenLieu(l.name) || l.name;
      const khoa = ho.toLowerCase();
      if (daCo.has(khoa)) continue;
      daCo.add(khoa);
      ra.push({ value: ho, label: ho, phu: l.category || undefined });
    }
    return ra;
  }, [loaiNLDanhMuc]);

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
      // QUY TẮC: kỳ dùng tên HỌ nguyên liệu — "Bạch tuộc 2 da lớn (80↑)" và
      // "… nhỏ (80↓)" đều là "Bạch tuộc 2 da", một kỳ gộp cả hai size. Chuẩn hoá
      // ở đây để dù chọn biến thể size nào, tên kỳ vẫn là họ (khớp cách hút theo
      // họ ở nhapHangHopLe/kyLienTruoc). Tên khác (không có mốc 80↑/↓) giữ nguyên.
      materialTypeName: hoNguyenLieu(dang.materialTypeName.trim()),
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
    const truocKho = soKho;
    /* Trả lại Sổ kho tháng phần kỳ này đã lấy xả đông (cột xuất của lô) / gửi đông (lô
       gửi theo ngày) — xoá kỳ mà để nguyên thì tồn kho lệch vĩnh viễn. */
    const traKho = dongBoSoKho(
      soKho,
      tatCaNL.filter((r) => r.periodId === k.id),
      [],
      {
        nhanKy: `${k.materialTypeName} ${k.dateRangeDescription ?? ""}`.trim(),
        hoNL: hoNguyenLieu(k.materialTypeName),
      }
    );
    if (traKho.doi) ghiSoKho(traKho.lines);
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
        if (traKho.doi) ghiSoKho(truocKho);
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
        <Button
          title="Mở một kỳ cân đối mới (thường ~5 ngày một lô): khai khoảng ngày rồi hút số liệu nhập · sản xuất · bán vào." size="lg" onClick={moThem}>
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
            <Button
              title="Mở kỳ cân đối đầu tiên." size="lg" onClick={moThem}>
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
              <Button
                title="Mở lưới cân đối của kỳ này để nhập số và xem định mức, lãi lỗ." size="sm" onClick={() => setSelId(r.id)}>
                Mở kỳ
              </Button>
              <Button
                title="Sửa thông tin kỳ (tên kỳ, khoảng ngày, loại nguyên liệu)."
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
                hint="Lô đem cân đối. Lớn/nhỏ (80↑/80↓) gộp chung — kỳ tự dùng tên họ, VD: Bạch tuộc 2 da."
                value={dang.materialTypeName}
                onChange={(v) =>
                  setDang((d) => {
                    if (!d) return d;
                    // optLoaiNL đã gộp về HỌ nên `v` là tên họ (VD "Bạch tuộc 2 da")
                    // — vừa hiển thị đúng, vừa lưu thẳng. luuKy vẫn chuẩn hoá lần nữa
                    // (phòng khi gõ tay tên có size).
                    const next = { ...d, materialTypeName: v };
                    // Prefill chi phí chế biến + tỉ giá từ kỳ gần nhất CÙNG HỌ
                    // NL, chỉ khi chi phí còn trống (chưa gõ) — khỏi gõ lại mỗi
                    // kỳ, vẫn sửa được. kyList mới-nhất-trước nên find lấy kỳ gần.
                    if (d.processingCostPerKg == null) {
                      const ho = hoNguyenLieu(v);
                      const truoc = kyList.find(
                        (k) => hoNguyenLieu(k.materialTypeName) === ho
                      );
                      if (truoc) {
                        next.processingCostPerKg = truoc.processingCostPerKg;
                        if (truoc.exchangeRate) next.exchangeRate = truoc.exchangeRate;
                      }
                    }
                    return next;
                  })
                }
                options={optLoaiNL}
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
            <Button
              title="Ghi kỳ cân đối này vào sổ." size="lg" onClick={luuKy}>
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
  /** Bút chì sửa nhanh mặt hàng / khách trong lưới bán thành phẩm (nối theo id). */
  const suaMH = useSuaDanhMuc("matHang", matHang, setMatHang);
  const suaKH = useSuaDanhMuc("khachHang", khach, setKhach);
  const [loaiNLDanhMuc, setLoaiNLDanhMuc] = useMaterialTypes();
  const [showBang, setShowBang] = useState(false);
  /* Công tắc cột ngày RIÊNG từng khối — cả hai MẶC ĐỊNH MỞ (chốt 2026-10-06: kế
     toán đối chiếu theo ngày). Thu lại thì khối NL gõ thẳng Số lượng như bảng giấy. */
  const [anNgayNL, setAnNgayNL] = useState(false);
  const [anNgayTP, setAnNgayTP] = useState(false);
  /* Mặc định xếp NGANG như bảng giấy (NL + ô GHI CHÚ bên trái, BTP bên phải — từ màn
     2xl). Người dùng vẫn đổi tay được; không tự nhảy theo bề rộng. */
  const [xepNgang, setXepNgang] = useState(true);
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
  /** Lệch giữa Tổng NL nhận (thông số kỳ) và Tổng NL vào lưới (khối 1) — hiện
   *  sẵn để khỏi nhẩm tay khi đối chiếu. */
  const lechNL = ky.totalInputKg != null ? ky.totalInputKg - kq.totalInputKg : null;
  /** Số dòng ở hai sổ nguồn tự động còn chờ hút vào kỳ. */
  const soNguonChoHut = luoi.nhapChoHut.length + luoi.sanXuatChoHut.length;

  return (
    <div className="space-y-6">
      <Button
        title="Quay về danh sách các kỳ cân đối." variant="ghost" size="lg" onClick={onBack}>
        <ChevronLeft />
        Danh sách kỳ
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Bảng cân đối {ky.materialTypeName}</h1>
          <p className="mt-1 text-base text-muted-foreground">
            {ky.dateRangeDescription || "Chưa ghi ngày tiếp nhận"}
            {ky.isLocked && " · đã chốt"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Một chạm kéo cả hai sổ nguồn tự động (nhập + sản xuất) vào kỳ. Không gộp sổ bán. */}
          {!luoi.daChot && soNguonChoHut > 0 && (
            <Button
              title={`Hút ${luoi.nhapChoHut.length} dòng sổ nhập hàng và ${luoi.sanXuatChoHut.length} dòng sổ sản xuất trong khoảng ngày của kỳ vào lưới.`}
              size="lg"
              onClick={luoi.hutTatCaNguon}
            >
              <ArrowDownToLine />
              Lấy {soNguonChoHut} dòng từ sổ
            </Button>
          )}
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
          <Button
            title="Xoay bảng ngang / dọc cho vừa màn hình — chỉ đổi cách nhìn, không đụng số." variant="outline" size="lg" onClick={() => setXepNgang((v) => !v)}>
            {xepNgang ? <Rows3 /> : <Columns2 />}
            {xepNgang ? "Xếp dọc" : "Xếp ngang"}
          </Button>
          <Button
            title="Xem bảng cân đối đúng khổ in A4 rồi in giấy hoặc lưu PDF." variant="outline" size="lg" onClick={() => setShowBang(true)}>
            <FileText />
            Xem / in bảng
          </Button>
        </div>
      </div>

      {/* Hai khối trong MỘT tờ: cùng khung, cùng công tắc cột ngày, chỉ ngăn nhau
          bằng một đường kẻ — đọc như một bảng cân đối liền mạch. */}
      {/* Xếp ngang (mặc định, từ 2xl) theo file cân đối của kế toán: hàng trên = khối NL
          (cột A–E) cạnh ô GHI CHÚ (cột K–L) — hai khối hẹp, đứng chung thì THẤY HẾT,
          không cắt cột tiền như khi NL chia đôi hàng với khối BTP; hàng dưới = khối BTP
          trải hết bề ngang (nhiều cột: khách, giá, ngày, Trả, Nợ). Màn hẹp: NL → GHI CHÚ → BTP. */}
      <Card
        className={
          xepNgang
            ? "grid grid-cols-1 overflow-hidden p-0 2xl:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]"
            : "overflow-hidden p-0"
        }
      >
        <LuoiNguyenLieu
          luoi={luoi}
          loaiNLDanhMuc={loaiNLDanhMuc}
          anNgay={anNgayNL}
          onDoiAnNgay={() => setAnNgayNL((v) => !v)}
          onThemLoaiNL={(ten) => {
            setLoaiNLDanhMuc([
              ...loaiNLDanhMuc,
              { id: uid(), name: ten, category: "", note: "" },
            ]);
            notify.daLuu(`Đã thêm loại nguyên liệu "${ten}" vào danh mục`);
            return ten;
          }}
        />
        <GhiChuKetQua
          ky={ky}
          kyTruoc={luoi.kyTruoc}
          kq={kq}
          chuaCoTP={chuaCoTP}
          lechNL={lechNL}
          xepNgang={xepNgang}
          daChot={luoi.daChot}
          onChangeKy={onChangeKy}
        />
        <div className={xepNgang ? "2xl:col-span-2" : undefined}>
          <LuoiBanThanhPham
            luoi={luoi}
            matHang={matHang}
            khach={khach}
            onSuaMatHang={suaMH.moSua}
            onSuaKhach={suaKH.moSua}
            choHutBan={banChoHut}
            onHutBan={hutBanVaoKy}
            anNgay={anNgayTP}
            onDoiAnNgay={() => setAnNgayTP((v) => !v)}
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
        </div>
      </Card>

      {/* Vòng gối đầu: phần kỳ trước đẩy sang được kéo vào đây bằng một nút, thay
          cho việc mở file kỳ cũ ra chép tay. */}
      {luoi.soDongChuyenKy > 0 && !luoi.daChot && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-base">
            Kỳ trước ({luoi.kyTruoc?.dateRangeDescription || "…"}) có{" "}
            <strong>{luoi.soDongChuyenKy}</strong> dòng chuyển sang chưa nhận.
          </p>
          <Button
            title="Nhận phần tồn chuyển từ kỳ trước sang làm số đầu kỳ này." size="lg" onClick={luoi.nhanChuyenKy}>
            <ArrowRightLeft />
            Nhận {luoi.soDongChuyenKy} dòng chuyển kỳ
          </Button>
        </Card>
      )}

      {/* Chốt kỳ đặt CUỐI màn — xem hết số rồi mới chốt, đúng chỗ của thanh chốt
          ngày ở sổ nhập hàng. */}
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-lg font-semibold">
            {ky.isLocked ? "Kỳ đã chốt" : "Kỳ đang mở"}
          </p>
          {ky.isLocked && (
            <p className="text-base text-muted-foreground">
              Khoá lúc {ky.lockedAt ? new Date(ky.lockedAt).toLocaleString("vi-VN") : "—"}
              {ky.lockNote ? ` · ${ky.lockNote}` : ""}
            </p>
          )}
          {ky.reopenReason && (
            <p className="text-base text-warning">Lần mở lại gần nhất: {ky.reopenReason}</p>
          )}
        </div>
        <Button
          title="Chốt khi đã đối chiếu xong và gửi kế toán — mọi ô trong lưới khoá lại. Kỳ đã chốt thì bấm để mở lại (phải ghi lý do)."
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
          moTaDongKho={luoi.moTaDongKho}
          onClose={() => setShowBang(false)}
        />
      )}
      {suaMH.hop}
      {suaKH.hop}
    </div>
  );
}

/**
 * Ô "GHI CHÚ" của file cân đối kế toán (cột K–L): đúng thứ tự kế toán đọc — Tổng thành
 * phẩm · Định mức chế biến · Chi phí CB/kg TP · Giá thành · Giá trị xuất · Lãi/Lỗ ·
 * Bình quân/kg NL · tỉ giá; phần phụ: NL vào · giá trị NL · NL nhận · thu hồi.
 *
 * Số ĐẦU VÀO của kỳ (chi phí CB, tỉ giá, NL nhận) sửa NGAY TẠI CHỖ hiển thị — bỏ thẻ
 * "Thông số kỳ" riêng (trước đây một chỗ sửa, một chỗ xem). Ô sửa được trông như ô
 * nhập; khác kỳ trước cùng họ NL thì ghi "kỳ trước …" để biết số đã đổi.
 */
function GhiChuKetQua({
  ky,
  kyTruoc,
  kq,
  chuaCoTP,
  lechNL,
  xepNgang,
  daChot,
  onChangeKy,
}: {
  ky: BalancingPeriod;
  kyTruoc: BalancingPeriod | null;
  kq: BalancingResult;
  chuaCoTP: boolean;
  lechNL: number | null;
  xepNgang: boolean;
  daChot: boolean;
  onChangeKy: (patch: Partial<BalancingPeriod>) => void;
}) {
  const lai = kq.profitOrLoss >= 0;
  return (
    <section
      className={`border-t-2 border-border p-5 ${xepNgang ? "2xl:border-t-0 2xl:border-l-2" : ""}`}
      aria-label="Ghi chú — kết quả cân đối"
    >
      <h2 className="mb-2 text-xl font-semibold">Ghi chú</h2>
      {/* Xếp ngang (2xl) ô này là cột phải hẹp (20–24rem) ⇒ về MỘT cột, không thì nhãn +
          số gãy dòng và số tiền dài tràn khung ở chữ 130%. */}
      <div className={`grid gap-x-8 sm:grid-cols-2 ${xepNgang ? "2xl:grid-cols-1" : ""}`}>
        <div>
          <KV k="Tổng thành phẩm" v={`${num(kq.totalOutputKg)} kg`} />
          <KV k="Định mức chế biến" v={chuaCoTP ? "—" : num(kq.norm)} strong />
          <KVNhap
            k="Chi phí CB / kg TP"
            unit="đ"
            value={ky.processingCostPerKg}
            truoc={kyTruoc?.processingCostPerKg}
            khoa={daChot}
            onChange={(v) => onChangeKy({ processingCostPerKg: v })}
          />
          <KV k="Giá thành" v={`${num(kq.costOfGoods)} đ`} />
          <KV k="Giá trị xuất" v={`${num(kq.exportValue)} đ`} />
          <KV
            k={chuaCoTP ? "Lãi / Lỗ" : lai ? "Lãi" : "Lỗ"}
            v={chuaCoTP ? "—" : `${num(Math.abs(kq.profitOrLoss))} đ`}
            mau={chuaCoTP ? undefined : lai ? "lai" : "lo"}
            strong
          />
          <KV k="Bình quân / kg NL" v={chuaCoTP ? "—" : `${num(kq.avgProfitPerKgMaterial)} đ`} />
          <KVNhap
            k="Tỉ giá"
            unit="đ/USD"
            value={ky.exchangeRate}
            truoc={kyTruoc?.exchangeRate}
            khoa={daChot}
            onChange={(v) => onChangeKy({ exchangeRate: v })}
          />
        </div>
        <div>
          <KV k="Tổng NL vào" v={`${num(kq.totalInputKg)} kg`} />
          <KV k="Giá trị NL" v={`${num(kq.materialValue)} đ`} />
          <KVNhap
            k="Tổng NL nhận cả kỳ"
            unit="kg"
            value={ky.totalInputKg}
            khoa={daChot}
            onChange={(v) => onChangeKy({ totalInputKg: v })}
            ghiChu={
              /* Đối chiếu NL nhận (bảng phụ) với NL vào lưới — bắt chỗ vênh khỏi nhẩm tay. */
              lechNL == null ? undefined : lechNL === 0 ? (
                <span className="text-success">✓ khớp NL vào</span>
              ) : (
                <span className="text-destructive">⚠ lệch NL vào {num(lechNL)} kg</span>
              )
            }
          />
          <KV k="Tỉ lệ thu hồi" v={kq.yieldRate == null ? "—" : num(kq.yieldRate)} />
        </div>
      </div>
    </section>
  );
}

function KV({
  k,
  v,
  strong,
  mau,
}: {
  k: string;
  v: string;
  strong?: boolean;
  mau?: "lai" | "lo";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-1.5">
      <span className="min-w-0 text-sm text-muted-foreground">{k}</span>
      <span
        className={`tnum shrink-0 whitespace-nowrap text-right text-base ${
          strong ? "font-semibold" : "font-medium"
        } ${mau === "lai" ? "text-success" : mau === "lo" ? "text-destructive" : strong ? "text-primary" : ""}`}
      >
        {v}
      </span>
    </div>
  );
}

/**
 * Dòng GHI CHÚ là số ĐẦU VÀO: nhãn nhìn thấy (gắn với ô) + ô nhập ngay bên phải, sửa
 * là kết quả tính lại tức thì. Kỳ đã chốt ⇒ chỉ hiện số.
 */
function KVNhap({
  k,
  unit,
  value,
  truoc,
  khoa,
  onChange,
  ghiChu,
}: {
  k: string;
  unit: string;
  value: number | null;
  /** Giá trị kỳ trước cùng họ NL — khác thì báo để người dùng biết số đã đổi. */
  truoc?: number | null;
  khoa: boolean;
  onChange: (v: number | null) => void;
  ghiChu?: React.ReactNode;
}) {
  const doi = truoc != null && value != null && truoc !== value;
  return (
    <div className="border-b border-border py-1.5">
      {khoa ? (
        <KVKhung k={k} v={value == null ? "—" : `${num(value)} ${unit}`} />
      ) : (
        <NumberField
          label={k}
          anNhanBatBuoc
          unit={unit}
          value={value}
          onChange={onChange}
          className="flex-row flex-wrap items-center justify-between gap-x-4 gap-y-1 [&>div:last-child]:w-44"
        />
      )}
      {(doi || ghiChu) && (
        <p className="mt-0.5 flex flex-wrap justify-end gap-x-3 text-right text-sm text-muted-foreground">
          {doi && <span>kỳ trước {num(truoc)} {unit}</span>}
          {ghiChu}
        </p>
      )}
    </div>
  );
}

function KVKhung({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="min-w-0 text-sm text-muted-foreground">{k}</span>
      <span className="tnum shrink-0 whitespace-nowrap text-right text-base font-medium">{v}</span>
    </div>
  );
}

/* ---------- Mảnh dùng chung cho 3 khối ---------- */

