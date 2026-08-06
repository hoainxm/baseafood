import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type {
  KyCanDoi,
  DongNLVao,
  DongPheLieu,
  DongTP,
  MatHang,
  KhachHang,
  NhomNL,
  Kenh,
} from "@/types";
import { NHOM_NL, KENH } from "@/types";
import { uid } from "@/lib/db";
import {
  useKhachHang,
  useKyCanDoi,
  useLoaiNL,
  useMatHang,
  useNLVao,
  usePheLieu,
  useTPRa,
} from "@/lib/danhMuc";
import { tinhCanDoi } from "@/lib/canDoi";
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
import BangCanDoi from "@/features/BangCanDoi";

/** Chuỗi ngày để in trên bảng, sinh từ khoảng ngày đã chọn. */
function moTaKhoang(tu?: string, den?: string): string {
  if (!tu) return "";
  if (!den || den === tu) return viDate(tu);
  return `${viDate(tu)} – ${viDate(den)}`;
}

export default function CanDoiScreen() {
  const [kyList, persistKy] = useKyCanDoi();
  const [selId, setSelId] = useState<string | null>(null);
  const [loaiNLDanhMuc, setLoaiNLDanhMuc] = useLoaiNL();

  /* Xóa kỳ phải xóa luôn dòng con của nó (NL vào / phế liệu / TP ra), nếu không
     các dòng này mồ côi trong kho — chiếm chỗ, sai tổng khi thống kê sau này. */
  const [tatCaNL, ghiNL] = useNLVao();
  const [tatCaPL, ghiPL] = usePheLieu();
  const [tatCaTP, ghiTP] = useTPRa();

  /** Gõ loại mới trong ô chọn → LƯU LUÔN vào danh mục (rule 7), không để mồ côi. */
  const themLoaiNL = (ten: string) => {
    setLoaiNLDanhMuc([...loaiNLDanhMuc, { id: uid(), ten, loai: "", ghiChu: "" }]);
    notify.daLuu(`Đã thêm loại nguyên liệu "${ten}" vào danh mục`);
    return ten;
  };

  const [dang, setDang] = useState<KyCanDoi | null>(null);
  const [laThem, setLaThem] = useState(false);
  const [loi, setLoi] = useState<LoiNhap[]>([]);

  const moThem = () => {
    const homNay = dateToIso(new Date());
    setDang({
      id: uid(),
      loaiNL: "",
      ngayList: "",
      tuNgay: homNay,
      denNgay: homNay,
      tongNLNhan: null,
      tiGia: 26000,
      chiPhiCB: null,
      createdAt: new Date().toISOString(),
    });
    setLaThem(true);
    setLoi([]);
  };

  const luuKy = () => {
    if (!dang) return;
    const ls: LoiNhap[] = [];
    if (!dang.loaiNL.trim())
      ls.push({ truong: "Loại nguyên liệu", thongBao: "Chưa chọn loại" });
    if (!dang.tuNgay)
      ls.push({ truong: "Ngày tiếp nhận", thongBao: "Chưa chọn ngày" });
    setLoi(ls);
    if (ls.length > 0) return;

    const ban: KyCanDoi = {
      ...dang,
      ngayList: moTaKhoang(dang.tuNgay, dang.denNgay),
    };
    if (laThem) {
      persistKy([ban, ...kyList]);
      notify.daLuu(`Đã tạo kỳ cân đối "${ban.loaiNL}"`);
      setSelId(ban.id);
    } else {
      persistKy(kyList.map((k) => (k.id === ban.id ? ban : k)));
      notify.daLuu("Đã lưu thay đổi");
    }
    setDang(null);
  };

  const xoaKy = (k: KyCanDoi) => {
    const truocKy = kyList;
    const truocNL = tatCaNL;
    const truocPL = tatCaPL;
    const truocTP = tatCaTP;
    persistKy(kyList.filter((x) => x.id !== k.id));
    ghiNL(tatCaNL.filter((r) => r.kyId !== k.id));
    /* Phế liệu cân ở màn Nhập hàng chỉ MƯỢN kỳ này — xóa kỳ thì gỡ liên kết,
       tuyệt đối không xóa theo, vì bản gốc là số cân của sổ nhập hàng. */
    ghiPL(
      tatCaPL
        .filter((r) => r.kyId !== k.id || r.nguon === "Nhập hàng")
        .map((r) =>
          r.kyId === k.id && r.nguon === "Nhập hàng" ? { ...r, kyId: "" } : r
        )
    );
    ghiTP(tatCaTP.filter((r) => r.kyId !== k.id));
    notify.daXoa(`Đã xóa kỳ "${k.loaiNL}" và toàn bộ dòng của kỳ`, () => {
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

  const cols: Cot<KyCanDoi>[] = [
    {
      key: "loaiNL",
      header: "Loại nguyên liệu",
      chinh: true,
      render: (r) => r.loaiNL,
      sapXep: (r) => r.loaiNL,
    },
    {
      key: "ngay",
      header: "Ngày tiếp nhận",
      render: (r) =>
        r.ngayList || <span className="text-muted-foreground">Chưa ghi</span>,
      sapXep: (r) => r.tuNgay ?? "",
    },
    {
      key: "tongNLNhan",
      header: "Tổng NL nhận (kg)",
      so: true,
      anTrenDienThoai: true,
      render: (r) =>
        r.tongNLNhan != null ? (
          num(r.tongNLNhan)
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      sapXep: (r) => r.tongNLNhan ?? 0,
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
            thành phẩm ra để ra định mức chế biến và lãi/lỗ.
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
          timKiem={(r) => `${r.loaiNL} ${r.ngayList}`}
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
                moTaBanGhi={`Kỳ "${r.loaiNL}" — ${r.ngayList || "chưa ghi ngày"}`}
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
                value={dang.loaiNL}
                onChange={(v) => setDang((d) => (d ? { ...d, loaiNL: v } : d))}
                options={loaiNLDanhMuc.map((l) => ({
                  value: l.ten,
                  label: l.ten,
                  phu: l.loai || undefined,
                }))}
                onCreate={themLoaiNL}
              />

              <DateRangeField
                label="Ngày tiếp nhận"
                required
                hint="Kỳ xưởng Đông thường 5 ngày — có nút chọn nhanh bên dưới."
                tuNgay={dang.tuNgay ?? ""}
                denNgay={dang.denNgay ?? ""}
                onChange={(tu, den) =>
                  setDang((d) => (d ? { ...d, tuNgay: tu, denNgay: den } : d))
                }
              />

              <div className="grid gap-6 sm:grid-cols-2">
                <NumberField
                  label="Tổng NL nhận cả kỳ"
                  unit="kg"
                  value={dang.tongNLNhan}
                  onChange={(v) =>
                    setDang((d) => (d ? { ...d, tongNLNhan: v } : d))
                  }
                  hint="Lấy từ bảng phụ — để tính tỉ lệ thu hồi."
                />
                <NumberField
                  label="Chi phí chế biến / kg TP"
                  unit="đ"
                  value={dang.chiPhiCB}
                  onChange={(v) =>
                    setDang((d) => (d ? { ...d, chiPhiCB: v } : d))
                  }
                />
                <NumberField
                  label="Tỉ giá"
                  unit="đ/USD"
                  value={dang.tiGia}
                  onChange={(v) => setDang((d) => (d ? { ...d, tiGia: v } : d))}
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
  ky: KyCanDoi;
  onBack: () => void;
  onChangeKy: (patch: Partial<KyCanDoi>) => void;
}) {
  /* Repo trả về TOÀN BỘ dòng của mọi kỳ; màn này chỉ làm việc với dòng của kỳ
     đang mở, khi ghi thì ghép lại với dòng của các kỳ khác. */
  const [tatCaNL, ghiNL] = useNLVao();
  const [tatCaPL, ghiPL] = usePheLieu();
  const [tatCaTP, ghiTP] = useTPRa();

  const nlVao = useMemo(
    () => tatCaNL.filter((r) => r.kyId === ky.id),
    [tatCaNL, ky.id]
  );
  const pheLieu = useMemo(
    () => tatCaPL.filter((r) => r.kyId === ky.id),
    [tatCaPL, ky.id]
  );
  const tp = useMemo(
    () => tatCaTP.filter((r) => r.kyId === ky.id),
    [tatCaTP, ky.id]
  );
  const [matHang, setMatHang] = useMatHang();
  const [khach, setKhach] = useKhachHang();
  const [loaiNLDanhMuc, setLoaiNLDanhMuc] = useLoaiNL();
  const [showBang, setShowBang] = useState(false);

  const ghepLai = <T extends { kyId: string }>(tatCa: T[], kyRows: T[]) => [
    ...tatCa.filter((r) => r.kyId !== ky.id),
    ...kyRows,
  ];
  const persistNL = (n: DongNLVao[]) => ghiNL(ghepLai(tatCaNL, n));
  const persistPL = (n: DongPheLieu[]) => ghiPL(ghepLai(tatCaPL, n));
  const persistTP = (n: DongTP[]) => ghiTP(ghepLai(tatCaTP, n));

  /* Phế liệu cân ở màn Nhập hàng, chưa gắn kỳ nào, rơi trong khoảng ngày của
     kỳ này → gợi ý hút về. Kỳ chưa khai ngày thì gợi ý tất cả dòng chưa gắn. */
  const pheLieuChoHut = useMemo(
    () =>
      tatCaPL.filter(
        (r) =>
          r.nguon === "Nhập hàng" &&
          !r.kyId &&
          (!ky.tuNgay ||
            !ky.denNgay ||
            !r.ngay ||
            (r.ngay >= ky.tuNgay && r.ngay <= ky.denNgay))
      ),
    [tatCaPL, ky.tuNgay, ky.denNgay]
  );

  const ganPheLieuVaoKy = (ids: string[]) => {
    const bo = new Set(ids);
    ghiPL(tatCaPL.map((r) => (bo.has(r.id) ? { ...r, kyId: ky.id } : r)));
    notify.daLuu(`Đã đưa ${ids.length} dòng phế liệu vào kỳ này`);
  };

  /** Gỡ khỏi kỳ, KHÔNG xóa — bản gốc vẫn nằm ở sổ nhập hàng. */
  const boPheLieuKhoiKy = (id: string) => {
    ghiPL(tatCaPL.map((r) => (r.id === id ? { ...r, kyId: "" } : r)));
    notify.daXoa("Đã bỏ dòng phế liệu khỏi kỳ (số gốc vẫn ở sổ nhập hàng)");
  };

  const kq = useMemo(
    () => tinhCanDoi(ky, nlVao, pheLieu, tp),
    [ky, nlVao, pheLieu, tp]
  );
  /** Chưa có thành phẩm ra → định mức + lãi/lỗ chưa có nghĩa. */
  const chuaCoTP = kq.tongTP <= 0;
  const tenMatHang = (id: string) =>
    matHang.find((m) => m.id === id)?.ten || "—";
  const tenKhach = (id: string) => khach.find((k) => k.id === id)?.ten || "—";

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack}>
        <ChevronLeft />
        Danh sách kỳ
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">{ky.loaiNL}</h1>
          <p className="mt-2 text-base text-muted-foreground">
            Ngày tiếp nhận: {ky.ngayList || "chưa ghi"}
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
            value={ky.tongNLNhan}
            onChange={(v) => onChangeKy({ tongNLNhan: v })}
          />
          <NumberField
            label="Chi phí chế biến / kg TP"
            unit="đ"
            anNhanBatBuoc
            value={ky.chiPhiCB}
            onChange={(v) => onChangeKy({ chiPhiCB: v })}
          />
          <NumberField
            label="Tỉ giá"
            unit="đ/USD"
            anNhanBatBuoc
            value={ky.tiGia}
            onChange={(v) => onChangeKy({ tiGia: v })}
          />
        </div>
      </Card>

      <KhoiNLVao
        rows={nlVao}
        onChange={persistNL}
        kyId={ky.id}
        goiYTen={loaiNLDanhMuc.map((l) => ({ value: l.ten, label: l.ten }))}
        onThemLoai={(ten) => {
          setLoaiNLDanhMuc([
            ...loaiNLDanhMuc,
            { id: uid(), ten, loai: "", ghiChu: "" },
          ]);
          notify.daLuu(`Đã thêm loại nguyên liệu "${ten}" vào danh mục`);
          return ten;
        }}
      />

      <KhoiPheLieu
        rows={pheLieu}
        onChange={persistPL}
        kyId={ky.id}
        choHut={pheLieuChoHut}
        onGanVaoKy={ganPheLieuVaoKy}
        onBoKhoiKy={boPheLieuKhoiKy}
      />

      <KhoiTP
        rows={tp}
        onChange={persistTP}
        kyId={ky.id}
        matHang={matHang}
        khach={khach}
        onThemMatHang={(ten) => {
          const m: MatHang = { id: uid(), ma: "", ten, maTP: "" };
          setMatHang([...matHang, m]);
          notify.daLuu(`Đã thêm mặt hàng "${ten}" vào danh mục`);
          return m.id;
        }}
        onThemKhach={(ten) => {
          const k: KhachHang = { id: uid(), ma: "", ten, thiTruong: "" };
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
          <KV k="Tổng nguyên liệu vào" v={`${num(kq.tongNLVao)} kg`} />
          <KV k="Tổng thành phẩm" v={`${num(kq.tongTP)} kg`} />
          <KV
            k="Định mức chế biến"
            v={chuaCoTP ? "—" : num(kq.dinhMuc)}
            strong
          />
          <KV
            k="Tỉ lệ thu hồi"
            v={kq.tyLeThuHoi == null ? "—" : num(kq.tyLeThuHoi)}
          />
          <KV k="Giá trị nguyên liệu" v={`${num(kq.giaTriNL)} đ`} />
          <KV k="Giá thành" v={`${num(kq.giaThanh)} đ`} />
          <KV k="Giá trị xuất" v={`${num(kq.giaTriXuat)} đ`} />
          <KV k="Bình quân / kg NL" v={`${num(kq.binhQuanKgNL)} đ`} />
          <KV k="Giá trị phế liệu" v={`${num(kq.giaTriPheLieu)} đ`} />
        </div>
        {/* Chưa nhập thành phẩm ra thì KHÔNG kết luận lãi/lỗ — nếu không màn sẽ báo
            "Lỗ = toàn bộ tiền nguyên liệu" (đỏ, hù người dùng) dù kỳ mới nhập một nửa. */}
        {chuaCoTP ? (
          <div className="mt-5 rounded-lg bg-muted px-5 py-4 text-base font-medium text-muted-foreground">
            Chưa có thành phẩm ra — nhập khối 3 để tính được lãi/lỗ.
          </div>
        ) : (
          <div
            className={`mt-5 rounded-lg px-5 py-4 text-xl font-semibold ${
              kq.laiLo >= 0
                ? "bg-success-surface text-success"
                : "bg-warning-surface text-destructive"
            }`}
          >
            {kq.laiLo >= 0 ? "▲ Lãi" : "▼ Lỗ"}:{" "}
            <span className="tnum">{num(Math.abs(kq.laiLo))}</span> đ
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
  kyId,
  goiYTen,
  onThemLoai,
}: {
  rows: DongNLVao[];
  onChange: (n: DongNLVao[]) => void;
  kyId: string;
  goiYTen: { value: string; label: string }[];
  /** Gõ tên mới → lưu vào danh mục loại NL, trả về tên để dùng luôn. */
  onThemLoai: (ten: string) => string;
}) {
  const [dang, setDang] = useState<DongNLVao | null>(null);
  const [laThem, setLaThem] = useState(false);
  const [loi, setLoi] = useState<LoiNhap[]>([]);

  const luu = () => {
    if (!dang) return;
    const ls: LoiNhap[] = [];
    if (!dang.ten.trim()) ls.push({ truong: "Tên", thongBao: "Chưa nhập tên" });
    if (!(dang.soLuongKg > 0))
      ls.push({ truong: "Số lượng", thongBao: "Phải lớn hơn 0 kg" });
    setLoi(ls);
    if (ls.length > 0) return;
    onChange(
      laThem ? [...rows, dang] : rows.map((r) => (r.id === dang.id ? dang : r))
    );
    notify.daLuu(laThem ? "Đã thêm dòng nguyên liệu" : "Đã lưu thay đổi");
    setDang(null);
  };

  const cols: Cot<DongNLVao>[] = [
    { key: "ten", header: "Tên nguyên liệu", chinh: true, render: (r) => r.ten },
    { key: "nhom", header: "Nhóm", render: (r) => <Badge>{r.nhom}</Badge> },
    {
      key: "sl",
      header: "Số lượng (kg)",
      so: true,
      render: (r) => num(r.soLuongKg),
    },
    {
      key: "gia",
      header: "Đơn giá (đ)",
      so: true,
      render: (r) => num(r.donGia) || "—",
    },
    {
      key: "tien",
      header: "Thành tiền (đ)",
      so: true,
      render: (r) => num(r.soLuongKg * (r.donGia ?? 0)),
    },
  ];

  const tong = rows.reduce((s, r) => s + r.soLuongKg, 0);
  const tongTien = rows.reduce((s, r) => s + r.soLuongKg * (r.donGia ?? 0), 0);

  return (
    <KhoiKhung
      soThuTu="1"
      tieuDe="Nguyên liệu vào"
      tenDong="dòng nguyên liệu"
      trong={rows.length === 0}
      onThem={() => {
        setDang({
          id: uid(),
          kyId,
          nhom: "Thủy sản",
          ten: "",
          soLuongKg: 0,
          donGia: null,
          tyLe: null,
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
                value={dang.nhom}
                onChange={(v) =>
                  setDang((d) => (d ? { ...d, nhom: v as NhomNL } : d))
                }
                options={NHOM_NL.map((n) => ({ value: n, label: n }))}
                cot={3}
              />
              <Combobox
                label="Tên nguyên liệu"
                required
                hint="Chọn trong danh mục, hoặc gõ tên mới rồi bấm Thêm mới."
                value={dang.ten}
                onChange={(v) => setDang((d) => (d ? { ...d, ten: v } : d))}
                options={goiYTen}
                onCreate={onThemLoai}
              />
              <div className="grid gap-6 sm:grid-cols-2">
                <NumberField
                  label="Số lượng"
                  required
                  unit="kg"
                  value={dang.soLuongKg || null}
                  onChange={(v) =>
                    setDang((d) => (d ? { ...d, soLuongKg: v ?? 0 } : d))
                  }
                />
                <NumberField
                  label="Đơn giá"
                  unit="đ"
                  value={dang.donGia}
                  onChange={(v) => setDang((d) => (d ? { ...d, donGia: v } : d))}
                />
                <NumberField
                  label="Tỉ lệ (bột phụ gia)"
                  unit="%"
                  value={dang.tyLe}
                  onChange={(v) => setDang((d) => (d ? { ...d, tyLe: v } : d))}
                />
              </div>
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
            moTaBanGhi={`${r.ten} — ${num(r.soLuongKg)} kg`}
            onXoa={() => {
              const truoc = rows;
              onChange(rows.filter((x) => x.id !== r.id));
              notify.daXoa(`Đã xóa "${r.ten}"`, () => onChange(truoc));
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
  kyId,
  choHut,
  onGanVaoKy,
  onBoKhoiKy,
}: {
  rows: DongPheLieu[];
  onChange: (n: DongPheLieu[]) => void;
  kyId: string;
  /** Phế liệu đã cân ở màn Nhập hàng, chưa gắn kỳ nào, hợp khoảng ngày của kỳ. */
  choHut: DongPheLieu[];
  onGanVaoKy: (ids: string[]) => void;
  onBoKhoiKy: (id: string) => void;
}) {
  const [dang, setDang] = useState<DongPheLieu | null>(null);
  const [laThem, setLaThem] = useState(false);
  const [loi, setLoi] = useState<LoiNhap[]>([]);

  const luu = () => {
    if (!dang) return;
    const ls: LoiNhap[] = [];
    if (!dang.loai.trim())
      ls.push({ truong: "Loại", thongBao: "Chưa nhập loại" });
    if (!(dang.soLuongKg > 0))
      ls.push({ truong: "Số lượng", thongBao: "Phải lớn hơn 0 kg" });
    setLoi(ls);
    if (ls.length > 0) return;
    onChange(
      laThem ? [...rows, dang] : rows.map((r) => (r.id === dang.id ? dang : r))
    );
    notify.daLuu(laThem ? "Đã thêm dòng phế liệu" : "Đã lưu thay đổi");
    setDang(null);
  };

  const cols: Cot<DongPheLieu>[] = [
    { key: "loai", header: "Loại phế liệu", chinh: true, render: (r) => r.loai },
    {
      key: "sl",
      header: "Số lượng (kg)",
      so: true,
      render: (r) => num(r.soLuongKg),
    },
    {
      key: "gia",
      header: "Đơn giá bán (đ)",
      so: true,
      render: (r) => num(r.donGiaBan) || "—",
    },
    {
      key: "tien",
      header: "Thành tiền (đ)",
      so: true,
      render: (r) => num(r.soLuongKg * (r.donGiaBan ?? 0)),
    },
    {
      key: "nguon",
      header: "Nguồn",
      render: (r) =>
        r.nguon === "Nhập hàng"
          ? `Sổ nhập ${r.ngay ? viDate(r.ngay) : ""}`.trim()
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
          kyId,
          loai: "",
          soLuongKg: 0,
          donGiaBan: null,
          ngay: "",
          phanXuong: "",
          nguon: "Cân đối",
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
                  value={dang.loai}
                  onChange={(e) =>
                    setDang((d) => (d ? { ...d, loai: e.target.value } : d))
                  }
                  placeholder="VD: nội tạng, dạt"
                />
              </Field>
              <div className="grid gap-6 sm:grid-cols-2">
                <NumberField
                  label="Số lượng"
                  required
                  unit="kg"
                  value={dang.soLuongKg || null}
                  onChange={(v) =>
                    setDang((d) => (d ? { ...d, soLuongKg: v ?? 0 } : d))
                  }
                />
                <NumberField
                  label="Đơn giá bán"
                  unit="đ"
                  value={dang.donGiaBan}
                  onChange={(v) =>
                    setDang((d) => (d ? { ...d, donGiaBan: v } : d))
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
                  {num(choHut.reduce((s, r) => s + (r.soLuongKg || 0), 0))} kg
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
                  {r.ngay ? `${viDate(r.ngay)} · ` : ""}
                  {r.phanXuong ? `xưởng ${r.phanXuong} · ` : ""}
                  {r.loai} —{" "}
                  <span className="tnum font-semibold">{num(r.soLuongKg)}</span>{" "}
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
          r.nguon === "Nhập hàng" ? (
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
              moTaBanGhi={`${r.loai} — ${num(r.soLuongKg)} kg`}
              onXoa={() => {
                const truoc = rows;
                onChange(rows.filter((x) => x.id !== r.id));
                notify.daXoa(`Đã xóa "${r.loai}"`, () => onChange(truoc));
              }}
            />
          )
        }
      />
    </KhoiKhung>
  );
}

/* ---------- Khối 3: Thành phẩm ra ---------- */

function KhoiTP({
  rows,
  onChange,
  kyId,
  matHang,
  khach,
  onThemMatHang,
  onThemKhach,
  tenMatHang,
  tenKhach,
}: {
  rows: DongTP[];
  onChange: (n: DongTP[]) => void;
  kyId: string;
  matHang: MatHang[];
  khach: KhachHang[];
  onThemMatHang: (ten: string) => string;
  onThemKhach: (ten: string) => string;
  tenMatHang: (id: string) => string;
  tenKhach: (id: string) => string;
}) {
  const [dang, setDang] = useState<DongTP | null>(null);
  const [laThem, setLaThem] = useState(false);
  const [loi, setLoi] = useState<LoiNhap[]>([]);

  const luu = () => {
    if (!dang) return;
    const ls: LoiNhap[] = [];
    if (!dang.matHangId)
      ls.push({ truong: "Mặt hàng", thongBao: "Chưa chọn mặt hàng" });
    if (!(dang.luongKg > 0))
      ls.push({ truong: "Lượng", thongBao: "Phải lớn hơn 0 kg" });
    setLoi(ls);
    if (ls.length > 0) return;
    onChange(
      laThem ? [...rows, dang] : rows.map((r) => (r.id === dang.id ? dang : r))
    );
    notify.daLuu(laThem ? "Đã thêm dòng thành phẩm" : "Đã lưu thay đổi");
    setDang(null);
  };

  const cols: Cot<DongTP>[] = [
    {
      key: "mh",
      header: "Mặt hàng",
      chinh: true,
      render: (r) => tenMatHang(r.matHangId),
    },
    { key: "kh", header: "Khách", render: (r) => tenKhach(r.khachId) },
    {
      key: "kenh",
      header: "Kênh",
      render: (r) => <Badge>{r.kenh}</Badge>,
    },
    {
      key: "sl",
      header: "Lượng (kg)",
      so: true,
      render: (r) => num(r.luongKg),
    },
    {
      key: "gia",
      header: "Đơn giá",
      so: true,
      render: (r) =>
        r.donGia == null
          ? "—"
          : `${num(r.donGia)} ${r.kenh === "Xuất khẩu" ? "USD" : "đ"}`,
    },
  ];

  const tong = rows.reduce((s, r) => s + r.luongKg, 0);

  return (
    <KhoiKhung
      soThuTu="3"
      tieuDe="Thành phẩm ra"
      tenDong="dòng thành phẩm"
      trong={rows.length === 0}
      onThem={() => {
        setDang({
          id: uid(),
          kyId,
          matHangId: "",
          khachId: "",
          kenh: "Xuất khẩu",
          luongKg: 0,
          donGia: null,
        });
        setLaThem(true);
        setLoi([]);
      }}
      hopThoai={
        <HopThoaiDong
          mo={dang !== null}
          laThem={laThem}
          tieuDe="dòng thành phẩm"
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
                value={dang.matHangId}
                onChange={(v) =>
                  setDang((d) => (d ? { ...d, matHangId: v } : d))
                }
                options={matHang.map((m) => ({
                  value: m.id,
                  label: m.ten,
                  phu: m.ma || undefined,
                }))}
                onCreate={onThemMatHang}
                emptyText="Chưa có mặt hàng nào trong danh mục."
              />
              <Combobox
                label="Khách hàng"
                hint="Bỏ trống nếu chưa xác định khách."
                value={dang.khachId}
                onChange={(v) => setDang((d) => (d ? { ...d, khachId: v } : d))}
                options={khach.map((k) => ({
                  value: k.id,
                  label: k.ten,
                  phu: k.thiTruong || undefined,
                }))}
                onCreate={onThemKhach}
              />
              <ChoiceGroup
                label="Kênh bán"
                value={dang.kenh}
                onChange={(v) =>
                  setDang((d) => (d ? { ...d, kenh: v as Kenh } : d))
                }
                options={KENH.map((k) => ({ value: k, label: k }))}
              />
              <div className="grid gap-6 sm:grid-cols-2">
                <NumberField
                  label="Lượng"
                  required
                  unit="kg"
                  value={dang.luongKg || null}
                  onChange={(v) =>
                    setDang((d) => (d ? { ...d, luongKg: v ?? 0 } : d))
                  }
                />
                <NumberField
                  label="Đơn giá"
                  unit={dang.kenh === "Xuất khẩu" ? "USD" : "đ"}
                  value={dang.donGia}
                  onChange={(v) => setDang((d) => (d ? { ...d, donGia: v } : d))}
                />
              </div>
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
            moTaBanGhi={`${tenMatHang(r.matHangId)} — ${num(r.luongKg)} kg`}
            onXoa={() => {
              const truoc = rows;
              onChange(rows.filter((x) => x.id !== r.id));
              notify.daXoa("Đã xóa dòng thành phẩm", () => onChange(truoc));
            }}
          />
        )}
      />
      <TongKet muc={[{ nhan: "Tổng thành phẩm", giaTri: `${num(tong)} kg` }]} />
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
