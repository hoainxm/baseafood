import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import type {
  BalancingPeriod,
  SalesItem,
  BalancingInputItem,
  ScrapItem,
  BalancingOutputItem,
  Product,
  Customer,
  InputGroup,
  SalesChannel,
  SalesInvoice,
} from "@/types";
import { INPUT_GROUPS, SALES_CHANNELS } from "@/types";
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
} from "@/lib/danhMuc";
import { calculateBalancing } from "@/lib/canDoi";
import {
  Badge,
  Button,
  Card,
  ChoiceGroup,
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
  Field,
  Input,
  NumberField,
  RecordTable,
  dateToIso,
  notify,
  type Cot,
  type LoiNhap,
} from "@/design-system";
import { num, viDate } from "@/lib/format";
import { ChevronLeft, FileText, Pencil, Plus, Scale, X } from "lucide-react";
import BangCanDoi from "./BangCanDoi";

/** Chuỗi ngày để in trên bảng, sinh từ khoảng ngày đã chọn. */
function moTaKhoang(tu?: string, den?: string): string {
  if (!tu) return "";
  if (!den || den === tu) return viDate(tu);
  return `${viDate(tu)} – ${viDate(den)}`;
}

export default function CanDoiScreen() {
  const [kyList, persistKy] = useBalancingPeriods();
  const { kyId } = useParams<{ kyId?: string }>();
  const navigate = useNavigate();
  const selId = kyId || null;
  const setSelId = (id: string | null) => {
    if (id) {
      navigate(`/can-doi/${id}`);
    } else {
      navigate("/can-doi");
    }
  };
  const [loaiNLDanhMuc, setLoaiNLDanhMuc] = useMaterialTypes();

  /* Xóa kỳ phải xóa luôn dòng con của nó (NL vào / phế liệu / TP ra), nếu không
     các dòng này mồ côi trong kho — chiếm chỗ, sai tổng khi thống kê sau này. */
  const [tatCaNL, ghiNL] = useBalancingInputs();
  const [tatCaPL, ghiPL] = useScraps();
  const [tatCaTP, ghiTP] = useBalancingOutputs();

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
    notify.daXoa(`Đã xóa kỳ "${k.materialTypeName}" và toàn bộ dòng của kỳ`, () => {
      persistKy(truocKy);
      ghiNL(truocNL);
      ghiPL(truocPL);
      ghiTP(truocTP);
    });
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
          <h1 className="text-3xl font-semibold text-foreground">
            Cân đối nguyên liệu
          </h1>
          <p className="mt-2 max-w-2xl text-base text-muted-foreground">
            Mỗi kỳ là một lô nguyên liệu theo loại. Cân đối nguyên liệu vào với
            bán thành phẩm sản xuất ra để ra định mức chế biến và lãi/lỗ.
          </p>
        </div>
        <Button size="lg" onClick={moThem}>
          <Plus />
          Tạo kỳ cân đối
        </Button>
      </div>

      {kyList.length === 0 ? (
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
            <DialogTitle className="text-2xl">
              {laThem ? "Tạo kỳ cân đối" : "Sửa kỳ cân đối"}
            </DialogTitle>
          </DialogHeader>

          {dang && (
            <div className="space-y-6 py-2">
              <ErrorSummary loi={loi} />

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

function KyDetail({
  ky,
  onBack,
  onChangeKy,
}: {
  ky: BalancingPeriod;
  onBack: () => void;
  onChangeKy: (patch: Partial<BalancingPeriod>) => void;
}) {
  /* Repo trả về TOÀN BỘ dòng của mọi kỳ; màn này chỉ làm việc với dòng của kỳ
     đang mở, khi ghi thì ghép lại với dòng của các kỳ khác. */
  const [tatCaNL, ghiNL] = useBalancingInputs();
  const [tatCaPL, ghiPL] = useScraps();
  const [tatCaTP, ghiTP] = useBalancingOutputs();

  const nlVao = useMemo(
    () => tatCaNL.filter((r) => r.periodId === ky.id),
    [tatCaNL, ky.id]
  );
  const pheLieu = useMemo(
    () => tatCaPL.filter((r) => r.periodId === ky.id),
    [tatCaPL, ky.id]
  );
  const tp = useMemo(
    () => tatCaTP.filter((r) => r.periodId === ky.id),
    [tatCaTP, ky.id]
  );
  const [matHang, setMatHang] = useProducts();
  const [khach, setKhach] = useCustomers();
  const [loaiNLDanhMuc, setLoaiNLDanhMuc] = useMaterialTypes();
  const [showBang, setShowBang] = useState(false);

  /* Sổ bán — hút dòng bán trong khoảng ngày của kỳ vào khối thành phẩm ra,
     giống hút phế liệu: một số liệu, một nguồn chuẩn (sổ bán). */
  const [tatCaBan] = useSalesItems();
  const [dsPhieu] = useSalesInvoices();
  const phieuTheoId = useMemo(
    () => new Map(dsPhieu.map((p) => [p.id, p])),
    [dsPhieu]
  );
  /** Dòng bán đã hút vào bất kỳ kỳ nào — không gợi ý lại (chống hút trùng). */
  const banDaHut = useMemo(
    () => new Set(tatCaTP.map((t) => t.salesItemId).filter(Boolean)),
    [tatCaTP]
  );
  const banChoHut = useMemo(
    () =>
      tatCaBan
        .filter((b) => {
          const p = phieuTheoId.get(b.invoiceId);
          if (!p) return false;
          if (banDaHut.has(b.id)) return false;
          return (
            !ky.startDate ||
            !ky.endDate ||
            (p.deliveryDate >= ky.startDate && p.deliveryDate <= ky.endDate)
          );
        })
        .map((b) => ({ ban: b, phieu: phieuTheoId.get(b.invoiceId)! })),
    [tatCaBan, phieuTheoId, banDaHut, ky.startDate, ky.endDate]
  );

  const ghepLai = <T extends { periodId: string }>(tatCa: T[], kyRows: T[]) => [
    ...tatCa.filter((r) => r.periodId !== ky.id),
    ...kyRows,
  ];
  const persistNL = (n: BalancingInputItem[]) => ghiNL(ghepLai(tatCaNL, n));
  const persistPL = (n: ScrapItem[]) => ghiPL(ghepLai(tatCaPL, n));
  const persistTP = (n: BalancingOutputItem[]) => ghiTP(ghepLai(tatCaTP, n));

  /** Hút dòng bán trong khoảng ngày của kỳ → tạo dòng thành phẩm ra (bản sao,
      gắn banHangId để chống hút trùng). Bỏ khỏi kỳ = xóa bản sao, số gốc ở sổ bán. */
  const hutBanVaoKy = (items: { ban: SalesItem; phieu: SalesInvoice }[]) => {
    const them: BalancingOutputItem[] = items.map(({ ban, phieu }) => ({
      id: uid(),
      periodId: ky.id,
      productId: ban.productId,
      customerId: phieu.customerId,
      channel: phieu.channel,
      quantityKg: ban.quantityKg,
      unitPrice: ban.unitPrice,
      spec: ban.spec,
      salesItemId: ban.id,
    }));
    persistTP([...tp, ...them]);
    notify.daLuu(`Đã hút ${them.length} dòng bán vào kỳ này`);
  };

  /* Phế liệu cân ở màn Nhập hàng, chưa gắn kỳ nào, rơi trong khoảng ngày của
     kỳ này → gợi ý hút về. Kỳ chưa khai ngày thì gợi ý tất cả dòng chưa gắn. */
  const pheLieuChoHut = useMemo(
    () =>
      tatCaPL.filter(
        (r) =>
          r.source === "Nhập hàng" &&
          !r.periodId &&
          (!ky.startDate ||
            !ky.endDate ||
            !r.date ||
            (r.date >= ky.startDate && r.date <= ky.endDate))
      ),
    [tatCaPL, ky.startDate, ky.endDate]
  );

  const ganPheLieuVaoKy = (ids: string[]) => {
    const bo = new Set(ids);
    ghiPL(tatCaPL.map((r) => (bo.has(r.id) ? { ...r, periodId: ky.id } : r)));
    notify.daLuu(`Đã đưa ${ids.length} dòng phế liệu vào kỳ này`);
  };

  /** Gỡ khỏi kỳ, KHÔNG xóa — bản gốc vẫn nằm ở sổ nhập hàng. */
  const boPheLieuKhoiKy = (id: string) => {
    ghiPL(tatCaPL.map((r) => (r.id === id ? { ...r, periodId: "" } : r)));
    notify.daXoa("Đã bỏ dòng phế liệu khỏi kỳ (số gốc vẫn ở sổ nhập hàng)");
  };

  const kq = useMemo(
    () => calculateBalancing(ky, nlVao, pheLieu, tp),
    [ky, nlVao, pheLieu, tp]
  );
  /** Chưa có thành phẩm ra → định mức + lãi/lỗ chưa có nghĩa. */
  const chuaCoTP = kq.totalOutputKg <= 0;
  const tenMatHang = (id: string) =>
    matHang.find((m) => m.id === id)?.name || "—";
  const tenKhach = (id: string) => khach.find((k) => k.id === id)?.name || "—";

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack}>
        <ChevronLeft />
        Danh sách kỳ
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">{ky.materialTypeName}</h1>
          <p className="mt-2 text-base text-muted-foreground">
            Ngày tiếp nhận: {ky.dateRangeDescription || "chưa ghi"}
          </p>
        </div>
        <Button variant="outline" size="lg" onClick={() => setShowBang(true)}>
          <FileText />
          Xem / in bảng
        </Button>
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

      <KhoiNLVao
        rows={nlVao}
        onChange={persistNL}
        periodId={ky.id}
        goiYTen={loaiNLDanhMuc.map((l) => ({ value: l.name, label: l.name }))}
        onThemLoai={(ten) => {
          setLoaiNLDanhMuc([
            ...loaiNLDanhMuc,
            { id: uid(), name: ten, category: "", note: "" },
          ]);
          notify.daLuu(`Đã thêm loại nguyên liệu "${ten}" vào danh mục`);
          return ten;
        }}
      />

      <KhoiPheLieu
        rows={pheLieu}
        onChange={persistPL}
        periodId={ky.id}
        choHut={pheLieuChoHut}
        onGanVaoKy={ganPheLieuVaoKy}
        onBoKhoiKy={boPheLieuKhoiKy}
      />

      <KhoiTP
        rows={tp}
        onChange={persistTP}
        periodId={ky.id}
        matHang={matHang}
        khach={khach}
        choHutBan={banChoHut}
        onHutBan={hutBanVaoKy}
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
        tenMatHang={tenMatHang}
        tenKhach={tenKhach}
      />

      <Card className="p-5">
        <h2 className="mb-4 text-xl font-semibold">Kết quả cân đối</h2>
        <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          <KV k="Tổng nguyên liệu vào" v={`${num(kq.totalInputKg)} kg`} />
          <KV k="Tổng bán thành phẩm" v={`${num(kq.totalOutputKg)} kg`} />
          <KV
            k="Định mức chế biến"
            v={chuaCoTP ? "—" : num(kq.norm)}
            strong
          />
          <KV
            k="Tỉ lệ thu hồi"
            v={kq.yieldRate == null ? "—" : num(kq.yieldRate)}
          />
          <KV k="Giá trị nguyên liệu" v={`${num(kq.materialValue)} đ`} />
          <KV k="Giá thành" v={`${num(kq.costOfGoods)} đ`} />
          <KV k="Giá trị xuất" v={`${num(kq.exportValue)} đ`} />
          <KV k="Bình quân / kg NL" v={`${num(kq.avgCostPerKgMaterial)} đ`} />
          <KV k="Giá trị phế liệu" v={`${num(kq.scrapValue)} đ`} />
        </div>
        {/* Chưa nhập thành phẩm ra thì KHÔNG kết luận lãi/lỗ — nếu không màn sẽ báo
            "Lỗ = toàn bộ tiền nguyên liệu" (đỏ, hù người dùng) dù kỳ mới nhập một nửa. */}
        {chuaCoTP ? (
          <div className="mt-5 rounded-lg bg-muted px-5 py-4 text-base font-medium text-muted-foreground">
            Chưa có bán thành phẩm sản xuất — nhập khối 3 để tính được lãi/lỗ.
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

      {showBang && (
        <BangCanDoi
          ky={ky}
          nlVao={nlVao}
          pheLieu={pheLieu}
          tp={tp}
          matHang={matHang}
          khach={khach}
          kq={kq}
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

/* ---------- Khối 1: Nguyên liệu vào ---------- */

function KhoiNLVao({
  rows,
  onChange,
  periodId,
  goiYTen,
  onThemLoai,
}: {
  rows: BalancingInputItem[];
  onChange: (n: BalancingInputItem[]) => void;
  periodId: string;
  goiYTen: { value: string; label: string }[];
  /** Gõ tên mới → lưu vào danh mục loại NL, trả về tên để dùng luôn. */
  onThemLoai: (ten: string) => string;
}) {
  const [dang, setDang] = useState<BalancingInputItem | null>(null);
  const [laThem, setLaThem] = useState(false);
  const [loi, setLoi] = useState<LoiNhap[]>([]);

  const luu = () => {
    if (!dang) return;
    const ls: LoiNhap[] = [];
    if (!dang.name.trim()) ls.push({ truong: "Tên", thongBao: "Chưa nhập tên" });
    // Cho phép ÂM (điều chỉnh giảm, VD "bán nội địa" trừ khỏi pool NL) — chỉ chặn 0.
    if (!dang.quantityKg)
      ls.push({
        truong: "Số lượng",
        thongBao: "Phải khác 0 kg (âm = điều chỉnh giảm, VD bán nội địa)",
      });
    setLoi(ls);
    if (ls.length > 0) return;
    onChange(
      laThem ? [...rows, dang] : rows.map((r) => (r.id === dang.id ? dang : r))
    );
    notify.daLuu(laThem ? "Đã thêm dòng nguyên liệu" : "Đã lưu thay đổi");
    setDang(null);
  };

  const cols: Cot<BalancingInputItem>[] = [
    { key: "ten", header: "Tên nguyên liệu", chinh: true, render: (r) => r.name },
    {
      key: "nhom",
      header: "Nhóm",
      render: (r) => (
        <span className="flex flex-wrap items-center gap-1">
          <Badge>{r.groupName}</Badge>
          {r.sourceWarehouse && <Badge variant="outline">{r.sourceWarehouse}</Badge>}
        </span>
      ),
    },
    {
      key: "sl",
      header: "Số lượng (kg)",
      so: true,
      render: (r) => num(r.quantityKg),
    },
    {
      key: "gia",
      header: "Đơn giá (đ)",
      so: true,
      render: (r) => num(r.unitPrice) || "—",
    },
    {
      key: "tien",
      header: "Thành tiền (đ)",
      so: true,
      render: (r) => num(r.quantityKg * (r.unitPrice ?? 0)),
    },
  ];

  const tong = rows.reduce((s, r) => s + r.quantityKg, 0);
  const tongTien = rows.reduce((s, r) => s + r.quantityKg * (r.unitPrice ?? 0), 0);

  return (
    <KhoiKhung
      soThuTu="1"
      tieuDe="Nguyên liệu vào"
      tenDong="dòng nguyên liệu"
      trong={rows.length === 0}
      onThem={() => {
        setDang({
          id: uid(),
          periodId,
          groupName: "Thủy sản",
          name: "",
          quantityKg: 0,
          unitPrice: null,
          ratioPercentage: null,
          sourceWarehouse: "",
        });
        setLaThem(true);
        setLoi([]);
      }}
      hopThoai={
        <HopThoaiDong
          mo={dang !== null}
          laThem={laThem}
          tieuDe="dòng nguyên liệu"
          onDong={() => setDang(null)}
          onLuu={luu}
        >
          {dang && (
            <>
              <ErrorSummary loi={loi} />
              <ChoiceGroup
                label="Nhóm"
                value={dang.groupName}
                onChange={(v) =>
                  setDang((d) => (d ? { ...d, groupName: v as InputGroup } : d))
                }
                options={INPUT_GROUPS.map((n) => ({ value: n, label: n }))}
                cot={3}
              />
              <Combobox
                label="Tên nguyên liệu"
                required
                hint="Chọn trong danh mục, hoặc gõ tên mới rồi bấm Thêm mới."
                value={dang.name}
                onChange={(v) => setDang((d) => (d ? { ...d, name: v } : d))}
                options={goiYTen}
                onCreate={onThemLoai}
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
                  label="Đơn giá"
                  unit="đ"
                  value={dang.unitPrice}
                  onChange={(v) => setDang((d) => (d ? { ...d, unitPrice: v } : d))}
                />
                <NumberField
                  label="Tỉ lệ (bột phụ gia)"
                  unit="%"
                  value={dang.ratioPercentage}
                  onChange={(v) => setDang((d) => (d ? { ...d, ratioPercentage: v } : d))}
                />
              </div>
              {/* Nguồn kho — chỉ cho hàng xả đông: phân biệt mua từ kho khác về
                 và xả đông kho mình. Seam cho quản lý tồn kho sau này. */}
              {dang.groupName === "Xả đông" && (
                <ChoiceGroup
                  label="Nguồn kho (hàng xả đông)"
                  value={dang.sourceWarehouse || ""}
                  onChange={(v) =>
                    setDang((d) => (d ? { ...d, sourceWarehouse: v } : d))
                  }
                  options={[
                    { value: "", label: "Chưa rõ" },
                    { value: "Mua về", label: "Mua về (kho khác)" },
                    { value: "Kho mình", label: "Kho mình" },
                  ]}
                  cot={3}
                />
              )}
            </>
          )}
        </HopThoaiDong>
      }
    >
      <RecordTable
        columns={cols}
        rows={rows}
        getKey={(r) => r.id}
        actions={(r) => (
          <DongThaoTac
            onSua={() => {
              setDang({ ...r });
              setLaThem(false);
              setLoi([]);
            }}
            moTaBanGhi={`${r.name} — ${num(r.quantityKg)} kg`}
            onXoa={() => {
              const truoc = rows;
              onChange(rows.filter((x) => x.id !== r.id));
              notify.daXoa(`Đã xóa "${r.name}"`, () => onChange(truoc));
            }}
          />
        )}
      />
      <TongKet
        muc={[
          { nhan: "Tổng khối lượng", giaTri: `${num(tong)} kg` },
          { nhan: "Tổng tiền", giaTri: `${num(tongTien)} đ` },
        ]}
      />
    </KhoiKhung>
  );
}

/* ---------- Khối 2: Phế liệu ---------- */

function KhoiPheLieu({
  rows,
  onChange,
  periodId,
  choHut,
  onGanVaoKy,
  onBoKhoiKy,
}: {
  rows: ScrapItem[];
  onChange: (n: ScrapItem[]) => void;
  periodId: string;
  /** Phế liệu đã cân ở màn Nhập hàng, chưa gắn kỳ nào, hợp khoảng ngày của kỳ. */
  choHut: ScrapItem[];
  onGanVaoKy: (ids: string[]) => void;
  onBoKhoiKy: (id: string) => void;
}) {
  const [dang, setDang] = useState<ScrapItem | null>(null);
  const [laThem, setLaThem] = useState(false);
  const [loi, setLoi] = useState<LoiNhap[]>([]);

  const luu = () => {
    if (!dang) return;
    const ls: LoiNhap[] = [];
    if (!dang.name.trim())
      ls.push({ truong: "Loại", thongBao: "Chưa nhập loại" });
    if (!(dang.quantityKg > 0))
      ls.push({ truong: "Số lượng", thongBao: "Phải lớn hơn 0 kg" });
    setLoi(ls);
    if (ls.length > 0) return;
    onChange(
      laThem ? [...rows, dang] : rows.map((r) => (r.id === dang.id ? dang : r))
    );
    notify.daLuu(laThem ? "Đã thêm dòng phế liệu" : "Đã lưu thay đổi");
    setDang(null);
  };

  const cols: Cot<ScrapItem>[] = [
    { key: "loai", header: "Loại phế liệu", chinh: true, render: (r) => r.name },
    {
      key: "sl",
      header: "Số lượng (kg)",
      so: true,
      render: (r) => num(r.quantityKg),
    },
    {
      key: "gia",
      header: "Đơn giá bán (đ)",
      so: true,
      render: (r) => num(r.sellingPrice) || "—",
    },
    {
      key: "tien",
      header: "Thành tiền (đ)",
      so: true,
      render: (r) => num(r.quantityKg * (r.sellingPrice ?? 0)),
    },
    {
      key: "nguon",
      header: "Nguồn",
      render: (r) =>
        r.source === "Nhập hàng"
          ? `Sổ nhập ${r.date ? viDate(r.date) : ""}`.trim()
          : "Nhập tại kỳ",
    },
  ];

  return (
    <KhoiKhung
      soThuTu="2"
      tieuDe="Phế liệu (bán giá riêng)"
      tenDong="dòng phế liệu"
      /* Còn dòng chờ hút thì KHÔNG coi là khối rỗng — nếu không, lời mời "đưa
         phế liệu từ sổ nhập vào kỳ" bị ẩn đúng lúc cần nó nhất. */
      trong={rows.length === 0 && choHut.length === 0}
      onThem={() => {
        setDang({
          id: uid(),
          periodId,
          name: "",
          quantityKg: 0,
          sellingPrice: null,
          date: "",
          workshop: "",
          source: "Cân đối",
        });
        setLaThem(true);
        setLoi([]);
      }}
      hopThoai={
        <HopThoaiDong
          mo={dang !== null}
          laThem={laThem}
          tieuDe="dòng phế liệu"
          onDong={() => setDang(null)}
          onLuu={luu}
        >
          {dang && (
            <>
              <ErrorSummary loi={loi} />
              <Field label="Loại phế liệu" required>
                <Input
                  value={dang.name}
                  onChange={(e) =>
                    setDang((d) => (d ? { ...d, name: e.target.value } : d))
                  }
                  placeholder="VD: nội tạng, dạt"
                />
              </Field>
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
                />
              </div>
            </>
          )}
        </HopThoaiDong>
      }
    >
      {/* Phế liệu đã cân ở màn Nhập hàng — HÚT về kỳ, không nhập lại lần hai */}
      {choHut.length > 0 && (
        <div className="space-y-4 rounded-xl border-2 border-primary/40 bg-accent/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div>
              <p className="text-base font-semibold text-foreground">
                Có {choHut.length} dòng phế liệu đã cân ở sổ nhập hàng, chưa vào
                kỳ nào
              </p>
              <p className="text-base text-muted-foreground">
                Tổng{" "}
                <span className="tnum">
                  {num(choHut.reduce((s, r) => s + (r.quantityKg || 0), 0))} kg
                </span>{" "}
                — đưa vào kỳ này thay vì nhập tay lại.
              </p>
            </div>
            <Button
              size="lg"
              onClick={() => onGanVaoKy(choHut.map((r) => r.id))}
            >
              <Plus />
              Đưa cả {choHut.length} dòng vào kỳ
            </Button>
          </div>
          <ul className="divide-y divide-border">
            {choHut.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2"
              >
                <span className="text-base">
                  {r.date ? `${viDate(r.date)} · ` : ""}
                  {r.workshop ? `xưởng ${r.workshop} · ` : ""}
                  {r.name} —{" "}
                  <span className="tnum font-semibold">{num(r.quantityKg)}</span>{" "}
                  kg
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onGanVaoKy([r.id])}
                >
                  <Plus />
                  Đưa vào kỳ
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <RecordTable
        columns={cols}
        rows={rows}
        getKey={(r) => r.id}
        actions={(r) =>
          r.source === "Nhập hàng" ? (
            /* Số này thuộc sổ nhập hàng — chỉ gỡ khỏi kỳ, KHÔNG xóa bản gốc. */
            <Button
              variant="outline"
              size="sm"
              onClick={() => onBoKhoiKy(r.id)}
            >
              <X />
              Bỏ khỏi kỳ
            </Button>
          ) : (
            <DongThaoTac
              onSua={() => {
                setDang({ ...r });
                setLaThem(false);
                setLoi([]);
              }}
              moTaBanGhi={`${r.name} — ${num(r.quantityKg)} kg`}
              onXoa={() => {
                const truoc = rows;
                onChange(rows.filter((x) => x.id !== r.id));
                notify.daXoa(`Đã xóa "${r.name}"`, () => onChange(truoc));
              }}
            />
          )
        }
      />
    </KhoiKhung>
  );
}

/* ---------- Khối 3: Bán thành phẩm sản xuất ---------- */

function KhoiTP({
  rows,
  onChange,
  periodId,
  matHang,
  khach,
  choHutBan,
  onHutBan,
  onThemMatHang,
  onThemKhach,
  tenMatHang,
  tenKhach,
}: {
  rows: BalancingOutputItem[];
  onChange: (n: BalancingOutputItem[]) => void;
  periodId: string;
  matHang: Product[];
  khach: Customer[];
  /** Dòng bán ở sổ bán, hợp khoảng ngày của kỳ, chưa hút vào kỳ nào. */
  choHutBan: { ban: SalesItem; phieu: SalesInvoice }[];
  onHutBan: (items: { ban: SalesItem; phieu: SalesInvoice }[]) => void;
  onThemMatHang: (ten: string) => string;
  onThemKhach: (ten: string) => string;
  tenMatHang: (id: string) => string;
  tenKhach: (id: string) => string;
}) {
  const [dang, setDang] = useState<BalancingOutputItem | null>(null);
  const [laThem, setLaThem] = useState(false);
  const [loi, setLoi] = useState<LoiNhap[]>([]);

  const luu = () => {
    if (!dang) return;
    const ls: LoiNhap[] = [];
    if (!dang.productId)
      ls.push({ truong: "Mặt hàng", thongBao: "Chưa chọn mặt hàng" });
    if (!(dang.quantityKg > 0))
      ls.push({ truong: "Lượng", thongBao: "Phải lớn hơn 0 kg" });
    setLoi(ls);
    if (ls.length > 0) return;
    onChange(
      laThem ? [...rows, dang] : rows.map((r) => (r.id === dang.id ? dang : r))
    );
    notify.daLuu(laThem ? "Đã thêm dòng bán thành phẩm" : "Đã lưu thay đổi");
    setDang(null);
  };

  const cols: Cot<BalancingOutputItem>[] = [
    {
      key: "mh",
      header: "Mặt hàng",
      chinh: true,
      render: (r) => (
        <span className="flex flex-wrap items-center gap-2">
          {tenMatHang(r.productId)}
          {r.salesItemId && (
            <Badge variant="outline" className="shrink-0">
              Từ sổ bán
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: "qc",
      header: "Quy cách",
      render: (r) =>
        r.spec || <span className="text-muted-foreground">—</span>,
    },
    { key: "kh", header: "Khách", render: (r) => tenKhach(r.customerId) },
    {
      key: "kenh",
      header: "Kênh",
      render: (r) => <Badge>{r.channel}</Badge>,
    },
    {
      key: "sl",
      header: "Lượng (kg)",
      so: true,
      render: (r) => num(r.quantityKg),
    },
    {
      key: "gia",
      header: "Đơn giá",
      so: true,
      render: (r) =>
        r.unitPrice == null
          ? "—"
          : `${num(r.unitPrice)} ${r.channel === "Xuất khẩu" ? "USD" : "đ"}`,
    },
  ];

  const tong = rows.reduce((s, r) => s + r.quantityKg, 0);

  const tongHut = choHutBan.reduce((s, x) => s + (x.ban.quantityKg || 0), 0);

  return (
    <KhoiKhung
      soThuTu="3"
      tieuDe="Bán thành phẩm sản xuất"
      tenDong="dòng bán thành phẩm"
      /* Còn dòng bán chờ hút thì KHÔNG coi là khối rỗng — nếu không, lời mời
         "hút bán vào kỳ" bị ẩn đúng lúc cần nó nhất. */
      trong={rows.length === 0 && choHutBan.length === 0}
      onThem={() => {
        setDang({
          id: uid(),
          periodId,
          productId: "",
          customerId: "",
          channel: "Xuất khẩu",
          quantityKg: 0,
          unitPrice: null,
        });
        setLaThem(true);
        setLoi([]);
      }}
      hopThoai={
        <HopThoaiDong
          mo={dang !== null}
          laThem={laThem}
          tieuDe="dòng bán thành phẩm"
          onDong={() => setDang(null)}
          onLuu={luu}
        >
          {dang && (
            <>
              <ErrorSummary loi={loi} />
              <Combobox
                label="Mặt hàng"
                required
                hint="Chưa có trong danh mục thì gõ tên rồi bấm Thêm mới."
                value={dang.productId}
                onChange={(v) =>
                  setDang((d) => (d ? { ...d, productId: v } : d))
                }
                options={matHang.map((m) => ({
                  value: m.id,
                  label: m.name,
                  phu: m.code || undefined,
                }))}
                onCreate={onThemMatHang}
                emptyText="Chưa có mặt hàng nào trong danh mục."
              />
              <Combobox
                label="Khách hàng"
                hint="Bỏ trống nếu chưa xác định khách."
                value={dang.customerId}
                onChange={(v) => setDang((d) => (d ? { ...d, customerId: v } : d))}
                options={khach.map((k) => ({
                  value: k.id,
                  label: k.name,
                  phu: k.market || undefined,
                }))}
                onCreate={onThemKhach}
              />
              <ChoiceGroup
                label="Kênh bán"
                value={dang.channel}
                onChange={(v) =>
                  setDang((d) => (d ? { ...d, channel: v as SalesChannel } : d))
                }
                options={SALES_CHANNELS.map((k) => ({ value: k, label: k }))}
              />
              <div className="grid gap-6 sm:grid-cols-2">
                <NumberField
                  label="Lượng"
                  required
                  unit="kg"
                  value={dang.quantityKg || null}
                  onChange={(v) =>
                    setDang((d) => (d ? { ...d, quantityKg: v ?? 0 } : d))
                  }
                />
                <NumberField
                  label="Đơn giá"
                  unit={dang.channel === "Xuất khẩu" ? "USD" : "đ"}
                  value={dang.unitPrice}
                  onChange={(v) => setDang((d) => (d ? { ...d, unitPrice: v } : d))}
                />
              </div>
            </>
          )}
        </HopThoaiDong>
      }
    >
      {/* Dòng bán ở sổ bán, hợp khoảng ngày của kỳ — HÚT về kỳ, không nhập lại */}
      {choHutBan.length > 0 && (
        <div className="space-y-4 rounded-xl border-2 border-primary/40 bg-accent/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div>
              <p className="text-base font-semibold text-foreground">
                Có {choHutBan.length} dòng bán trong khoảng ngày của kỳ, chưa
                vào kỳ nào
              </p>
              <p className="text-base text-muted-foreground">
                Tổng <span className="tnum">{num(tongHut)} kg</span> — hút vào kỳ
                này thay vì nhập tay lại.
              </p>
            </div>
            <Button size="lg" onClick={() => onHutBan(choHutBan)}>
              <Plus />
              Hút cả {choHutBan.length} dòng vào kỳ
            </Button>
          </div>
          <ul className="divide-y divide-border">
            {choHutBan.map(({ ban, phieu }) => (
              <li
                key={ban.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2"
              >
                <span className="text-base">
                  {viDate(phieu.deliveryDate)} · {phieu.channel} ·{" "}
                  {tenMatHang(ban.productId)}
                  {ban.spec ? ` (${ban.spec})` : ""} —{" "}
                  <span className="tnum font-semibold">{num(ban.quantityKg)}</span>{" "}
                  kg
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onHutBan([{ ban, phieu }])}
                >
                  <Plus />
                  Hút vào kỳ
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <RecordTable
        columns={cols}
        rows={rows}
        getKey={(r) => r.id}
        actions={(r) =>
          r.salesItemId ? (
            /* Dòng hút từ sổ bán — bỏ khỏi kỳ là XÓA bản sao; số gốc ở sổ bán. */
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const truoc = rows;
                onChange(rows.filter((x) => x.id !== r.id));
                notify.daXoa(
                  "Đã bỏ dòng bán khỏi kỳ (số gốc vẫn ở sổ bán)",
                  () => onChange(truoc)
                );
              }}
            >
              <X />
              Bỏ khỏi kỳ
            </Button>
          ) : (
            <DongThaoTac
              onSua={() => {
                setDang({ ...r });
                setLaThem(false);
                setLoi([]);
              }}
              moTaBanGhi={`${tenMatHang(r.productId)} — ${num(r.quantityKg)} kg`}
              onXoa={() => {
                const truoc = rows;
                onChange(rows.filter((x) => x.id !== r.id));
                notify.daXoa("Đã xóa dòng bán thành phẩm", () => onChange(truoc));
              }}
            />
          )
        }
      />
      <TongKet muc={[{ nhan: "Tổng bán thành phẩm", giaTri: `${num(tong)} kg` }]} />
    </KhoiKhung>
  );
}

/* ---------- Mảnh dùng chung cho 3 khối ---------- */

function DongThaoTac({
  onSua,
  onXoa,
  moTaBanGhi,
}: {
  onSua: () => void;
  onXoa: () => void;
  moTaBanGhi: string;
}) {
  return (
    <>
      <Button variant="outline" size="sm" onClick={onSua}>
        <Pencil />
        Sửa
      </Button>
      <ConfirmDelete moTaBanGhi={moTaBanGhi} onConfirm={onXoa} />
    </>
  );
}

function KhoiKhung({
  soThuTu,
  tieuDe,
  tenDong,
  trong,
  onThem,
  hopThoai,
  children,
}: {
  soThuTu: string;
  tieuDe: string;
  tenDong: string;
  trong: boolean;
  onThem: () => void;
  /** Hộp thoại thêm/sửa — luôn gắn vào cây, kể cả khi khối chưa có dòng nào. */
  hopThoai: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-3 text-xl font-semibold">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary text-base text-primary-foreground">
            {soThuTu}
          </span>
          {tieuDe}
        </h2>
        <Button onClick={onThem}>
          <Plus />
          Thêm {tenDong}
        </Button>
      </div>
      {trong ? (
        <p className="rounded-xl border-2 border-dashed border-border px-5 py-8 text-center text-base text-muted-foreground">
          Chưa có {tenDong} nào.
        </p>
      ) : (
        <div className="space-y-4">{children}</div>
      )}
      {hopThoai}
    </Card>
  );
}

function TongKet({ muc }: { muc: { nhan: string; giaTri: string }[] }) {
  return (
    <div className="flex flex-wrap justify-end gap-x-10 gap-y-2 rounded-lg bg-muted px-4 py-3">
      {muc.map((m) => (
        <div key={m.nhan} className="flex items-baseline gap-3">
          <span className="text-base text-muted-foreground">{m.nhan}</span>
          <span className="tnum text-lg font-semibold">{m.giaTri}</span>
        </div>
      ))}
    </div>
  );
}

function HopThoaiDong({
  mo,
  laThem,
  tieuDe,
  onDong,
  onLuu,
  children,
}: {
  mo: boolean;
  laThem: boolean;
  tieuDe: string;
  onDong: () => void;
  onLuu: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog
      open={mo}
      onOpenChange={(o) => {
        if (!o) onDong();
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto w-full sm:max-w-3xl lg:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {laThem ? `Thêm ${tieuDe}` : `Sửa ${tieuDe}`}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-2">{children}</div>
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={onDong}>
            Hủy
          </Button>
          <Button size="lg" onClick={onLuu}>
            {laThem ? "Thêm" : "Lưu thay đổi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
