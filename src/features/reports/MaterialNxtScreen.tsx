// ============================================================
// Tên file: src/features/reports/MaterialNxtScreen.tsx
// Tên tiếng Việt: Báo cáo Nhập–Xuất–Tồn kho nguyên liệu
// Description: Raw-material inventory (Nhập–Xuất–Tồn) report screen
// ============================================================
import { useMemo, useState } from "react";
import {
  Badge,
  BangTong,
  Button,
  ChuThichBatBuoc,
  Combobox,
  ConfirmDelete,
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
  ThongKe,
  homNay,
  notify,
  type CotTong,
  type LoiNhap,
  type MucChon,
  type TheThongTin,
} from "@/design-system";
import {
  useBalancingInputs,
  useBalancingPeriods,
  useMaterialImports,
  useMaterialOpeningStock,
  useMaterialTypes,
  useProductionLocks,
} from "@/lib/catalogRepo";
import { KY_OPT, phamViKy, type KyXem } from "@/lib/periodUtils";
import {
  tinhTonNLTong,
  conDoChuaKhopKy,
  type TonNLTongHo,
  type TonNLTongNgay,
} from "@/lib/inventoryMaterial";
import { num, viDate } from "@/lib/format";
import { uid } from "@/lib/db";
import type { MaterialOpeningStock, Workshop } from "@/types";
import {
  AlertTriangle,
  ArrowDownToLine,
  CalendarDays,
  PackagePlus,
  Scale,
  Snowflake,
  Truck,
} from "lucide-react";

const XUONG_OPT: MucChon[] = [
  { value: "Tất cả", label: "Tất cả xưởng" },
  { value: "Đông", label: "Đông" },
  { value: "Cá", label: "Cá" },
  { value: "Khô", label: "Khô" },
];

interface OpeningForm {
  workshop: Workshop;
  materialTypeName: string;
  asOfDate: string;
  quantityKg: number | null;
  note: string;
}

/**
 * Báo cáo Nhập–Xuất–Tồn nguyên liệu. Tồn suy THẲNG từ sổ Nhập hàng (material_imports):
 *
 *   Tồn cuối = Tồn đầu + Nhập hàng − Xuất SX
 *
 * Xuất SX ("NL lấy ra sản xuất") CHƯA được ghi ở màn Sản xuất nên = 0 (cột chờ) —
 * tồn hiện là "chưa trừ xuất". Đông gửi / xả đông (vòng gối đầu ở Cân đối) chỉ hiện
 * làm CỘT THÔNG TIN, KHÔNG cộng vào tồn (tránh đếm đôi — PA-a, chốt 2026-09-11).
 * Ô nhập tay duy nhất là "Tồn đầu". Xem lib/inventoryMaterial.ts#tinhTonNLTong.
 */
export default function MaterialNxtScreen() {
  const [periods] = useBalancingPeriods();
  const [inputs] = useBalancingInputs();
  const [imports] = useMaterialImports();
  const [opening, ghiOpening] = useMaterialOpeningStock();
  const [materialTypes] = useMaterialTypes();
  const [locks] = useProductionLocks();

  const [ky, setKy] = useState<KyXem>("thang");
  const [moc, setMoc] = useState(homNay());
  const [tuTC, setTuTC] = useState(homNay());
  const [denTC, setDenTC] = useState(homNay());
  const [xuong, setXuong] = useState<string>("Tất cả");
  const [tu, den] = phamViKy(ky, moc, tuTC, denTC);

  // Dialog tồn đầu
  const [moTonDau, setMoTonDau] = useState(false);
  const [form, setForm] = useState<OpeningForm | null>(null);
  const [loi, setLoi] = useState<LoiNhap[]>([]);

  const workshop = xuong === "Tất cả" ? undefined : (xuong as Workshop);

  const data = useMemo(
    () =>
      tinhTonNLTong(periods, inputs, imports, opening, locks, {
        tuNgay: tu,
        denNgay: den,
        workshop,
      }),
    [periods, inputs, imports, opening, locks, tu, den, workshop],
  );

  const coDongXa = data.tongDongGui > 0 || data.tongXaDong > 0;
  // Còn dở SX ghi ở ngày KHÔNG có kỳ cân đối nào phủ → không lọt vào cột "Đông gửi"
  // (info) nào. Gọi tên thay vì để số biến mất (luật "màn tự giải thích").
  const conDoRot = useMemo(
    () => conDoChuaKhopKy(periods, locks, { tuNgay: tu, denNgay: den, workshop }),
    [periods, locks, tu, den, workshop],
  );

  const the: TheThongTin[] = [
    { nhan: "Tồn đầu kỳ", giaTri: `${num(data.tongTonDau)} kg`, so: true, icon: Snowflake, mau: "trung-tinh" },
    { nhan: "Nhập trong kỳ", giaTri: `${num(data.tongNhap)} kg`, so: true, icon: ArrowDownToLine, mau: "brand" },
    { nhan: "Xuất SX (chờ)", giaTri: "0 kg", so: true, icon: Truck, mau: "trung-tinh" },
    { nhan: "Tồn cuối (chưa trừ SX)", giaTri: `${num(data.tongTonCuoi)} kg`, so: true, icon: Scale, mau: "success" },
  ];

  // Bảng tồn theo NGÀY (mọi họ gộp) — trục "theo ngày" cho BGĐ.
  const cotNgay: CotTong<TonNLTongNgay>[] = [
    {
      key: "date",
      header: "Ngày",
      render: (r) => <span className="font-semibold text-foreground">{viDate(r.date)}</span>,
    },
    {
      key: "nhap",
      header: "Nhập (kg)",
      so: true,
      render: (r) => <span className="font-semibold text-primary">+{num(r.nhap)}</span>,
      tong: () => num(data.tongNhap),
    },
    {
      key: "xuatSX",
      header: "Xuất SX (kg)",
      so: true,
      render: () => <span className="text-muted-foreground">—</span>,
      tong: () => "—",
    },
    {
      key: "tonCuoi",
      header: "Tồn cuối ngày (kg)",
      so: true,
      render: (r) => <span className="tnum font-bold text-foreground">{num(r.tonCuoi)}</span>,
    },
  ];

  // Bảng tồn theo LOẠI (họ) NL.
  const cotHo: CotTong<TonNLTongHo>[] = [
    {
      key: "hoNL",
      header: "Loại nguyên liệu",
      render: (r) => (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-foreground">{r.hoNL}</span>
          {r.seedTonDau && <Badge variant="outline">Tồn đầu khai tay</Badge>}
          {r.canhBaoAm && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="size-icon-sm" aria-hidden />
              Tồn âm
            </Badge>
          )}
        </div>
      ),
    },
    { key: "tonDau", header: "Tồn đầu (kg)", so: true, render: (r) => num(r.tonDau), tong: () => num(data.tongTonDau) },
    {
      key: "nhapKy",
      header: "Nhập (kg)",
      so: true,
      render: (r) => <span className="font-semibold text-primary">+{num(r.nhapKy)}</span>,
      tong: () => num(data.tongNhap),
    },
    {
      key: "xuatSX",
      header: "Xuất SX (kg)",
      so: true,
      render: () => <span className="text-muted-foreground">—</span>,
      tong: () => "—",
    },
    {
      key: "tonCuoi",
      header: "Tồn cuối (kg)",
      so: true,
      render: (r) => (
        <span className={`tnum font-bold ${r.canhBaoAm ? "text-destructive" : "text-foreground"}`}>
          {num(r.tonCuoi)}
        </span>
      ),
      tong: () => num(data.tongTonCuoi),
    },
    // Cột THÔNG TIN (kho đông dự trữ) — không vào tồn.
    {
      key: "dongGui",
      header: "Đông gửi (kho đông)",
      so: true,
      render: (r) => <span className="text-muted-foreground">{r.dongGui > 0 ? num(r.dongGui) : "—"}</span>,
      tong: () => (data.tongDongGui > 0 ? num(data.tongDongGui) : "—"),
    },
    {
      key: "xaDong",
      header: "Xả đông (kho đông)",
      so: true,
      render: (r) => <span className="text-muted-foreground">{r.xaDong > 0 ? num(r.xaDong) : "—"}</span>,
      tong: () => (data.tongXaDong > 0 ? num(data.tongXaDong) : "—"),
    },
  ];

  // ----- Tồn đầu: thêm / xóa -----
  const optLoaiNL: MucChon[] = materialTypes.map((m) => ({ value: m.name, label: m.name }));

  const moThemTonDau = () => {
    setForm({
      workshop: (workshop ?? "Đông") as Workshop,
      materialTypeName: "",
      asOfDate: homNay(),
      quantityKg: null,
      note: "",
    });
    setLoi([]);
  };

  const luuTonDau = () => {
    if (!form) return;
    const ls: LoiNhap[] = [];
    if (!form.materialTypeName.trim())
      ls.push({ truong: "Loại nguyên liệu", thongBao: "Chưa chọn loại nguyên liệu" });
    if (!form.asOfDate) ls.push({ truong: "Ngày mốc", thongBao: "Chưa chọn ngày tồn đầu" });
    if (!(Number(form.quantityKg) > 0))
      ls.push({ truong: "Khối lượng", thongBao: "Phải lớn hơn 0 kg" });
    setLoi(ls);
    if (ls.length > 0) return;
    const moi: MaterialOpeningStock = {
      id: uid(),
      workshop: form.workshop,
      materialTypeName: form.materialTypeName.trim(),
      asOfDate: form.asOfDate,
      quantityKg: Number(form.quantityKg),
      note: form.note.trim(),
    };
    ghiOpening([...opening, moi]);
    notify.daLuu(`Đã lưu tồn đầu ${num(moi.quantityKg)} kg — ${moi.materialTypeName}`);
    setForm(null);
  };

  const xoaTonDau = (id: string) => {
    ghiOpening(opening.filter((o) => o.id !== id));
    notify.daXoa("Đã xóa dòng tồn đầu");
  };

  const openingLoc = useMemo(
    () => (workshop ? opening.filter((o) => o.workshop === workshop) : opening),
    [opening, workshop],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Snowflake className="h-8 w-8 text-primary" />
            Tồn kho nguyên liệu (Nhập – Xuất – Tồn)
          </h1>
          <p className="mt-1 text-muted-foreground">
            Tồn suy thẳng từ sổ Nhập hàng: <b>Tồn cuối = Tồn đầu + Nhập − Xuất SX</b>. Cả 3 phân
            xưởng, xem theo ngày.
          </p>
        </div>
        <Button variant="outline" onClick={() => setMoTonDau(true)}>
          <PackagePlus className="mr-2 h-4 w-4" />
          Tồn đầu ({openingLoc.length})
        </Button>
      </div>

      {/* Bộ chọn kỳ + phân xưởng */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[12rem]">
          <Combobox
            label="Kỳ báo cáo"
            anNhanBatBuoc
            choPhepXoa={false}
            value={ky}
            onChange={(v) => setKy(v as KyXem)}
            options={KY_OPT}
          />
        </div>
        <div className="min-w-0 flex-1 sm:min-w-[16rem]">
          {ky === "tuy-chon" ? (
            <DateRangeField
              label="Khoảng ngày"
              anNhanBatBuoc
              presets={false}
              startDate={tuTC}
              endDate={denTC}
              onChange={(a, b) => {
                setTuTC(a);
                setDenTC(b);
              }}
            />
          ) : (
            <DateField
              label={ky === "ngay" ? "Ngày" : "Ngày bất kỳ trong kỳ"}
              anNhanBatBuoc
              hint={ky === "ngay" ? undefined : `Kỳ: ${viDate(tu)} – ${viDate(den)}`}
              value={moc}
              onChange={setMoc}
            />
          )}
        </div>
        <div className="min-w-[10rem]">
          <Combobox
            label="Phân xưởng"
            anNhanBatBuoc
            choPhepXoa={false}
            value={xuong}
            onChange={setXuong}
            options={XUONG_OPT}
          />
        </div>
      </div>

      <ThongKe the={the} />

      {/* Chú thích phạm vi — trung thực (nhất là với BGĐ) */}
      <div className="flex flex-wrap items-start gap-3 rounded-xl border-2 border-warning bg-warning/10 p-4">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
        <span className="text-base text-warning">
          <b>Xuất SX chưa được ghi</b> (màn Sản xuất chưa có ô "NL lấy ra sản xuất") nên tạm = 0 —
          tồn hiện là <b>tồn theo nhập, CHƯA trừ phần đưa vào chế biến</b>. Cột "Đông gửi / Xả đông"
          là thông tin kho đông dự trữ (vòng gối đầu ở Cân đối), <b>không cộng vào tồn</b>.
        </span>
      </div>

      {/* Còn dở SX ghi ở ngày không có kỳ cân đối phủ → không hiện ở cột đông gửi
          info nào. Gọi tên thay vì để số biến mất. */}
      {conDoRot > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-warning bg-warning/10 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning" aria-hidden />
          <span className="text-base font-semibold text-warning">
            {num(conDoRot)} kg còn dở SX chưa hiện ở đâu — ghi ở ngày CHƯA có kỳ cân đối nào (cùng
            họ NL) phủ. Tạo kỳ cân đối phủ ngày đó ở màn Cân đối để phần còn dở vào cột "Đông gửi".
          </span>
        </div>
      )}

      {/* Cảnh báo tồn âm — bộ dò lỗi ghi chép */}
      {data.soCanhBao > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-destructive bg-destructive/10 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" aria-hidden />
          <span className="text-base font-semibold text-destructive">
            {data.soCanhBao} loại có tồn cuối ÂM — kiểm lại tồn đầu / nhập hàng đã ghi đúng chưa.
          </span>
        </div>
      )}

      {data.soHo === 0 ? (
        <EmptyState
          icon={CalendarDays}
          tieuDe="Chưa có nhập hàng nào trong khoảng ngày này"
          moTa="Đổi lại Kỳ báo cáo / phân xưởng, hoặc ghi chuyến nhập ở màn Nhập hàng trước. Có thể khai Tồn đầu để cộng vào tồn."
        />
      ) : (
        <>
          {/* Tồn theo NGÀY */}
          {data.theoNgay.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">Tồn theo ngày</h3>
              <BangTong
                rows={data.theoNgay}
                cot={cotNgay}
                getKey={(r) => r.date}
                emptyText="Không có ngày nào có nhập."
              />
            </section>
          )}

          {/* Tồn theo loại NL */}
          <section className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">Tồn theo loại nguyên liệu</h3>
            <BangTong
              rows={data.theoHo}
              cot={cotHo}
              getKey={(r) => r.hoNL}
              emptyText="Chưa có loại nguyên liệu nào."
            />
          </section>
        </>
      )}

      {/* Dialog quản lý Tồn đầu */}
      <Dialog open={moTonDau} onOpenChange={setMoTonDau}>
        <DialogContent className="w-full sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Tồn đầu kho nguyên liệu</DialogTitle>
            <DialogDescription className="text-base">
              Số dư nguyên liệu có sẵn TRƯỚC khi dùng app (baseline một lần). Đặt "tính từ ngày" =
              ngày ĐẦU TIÊN app bắt đầu tính nhập (VD 01/07 cho tồn cuối 30/06) — chuyến nhập trước
              ngày đó coi như đã nằm trong số này, nhập từ ngày đó trở đi cộng thêm.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Danh sách đang có */}
            {openingLoc.length > 0 ? (
              <ul className="divide-y divide-border rounded-lg border-2 border-border">
                {openingLoc.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                    <span className="min-w-0 flex-1 text-base">
                      <span className="font-semibold">{o.materialTypeName}</span>
                      {" — "}
                      <span className="tnum font-semibold">{num(o.quantityKg)}</span> kg
                      <span className="text-muted-foreground">
                        {" "}
                        · từ {viDate(o.asOfDate)} · xưởng {o.workshop}
                        {o.note ? ` · ${o.note}` : ""}
                      </span>
                    </span>
                    <ConfirmDelete
                      moTaBanGhi={`${o.materialTypeName} — ${num(o.quantityKg)} kg (từ ${viDate(o.asOfDate)})`}
                      onConfirm={() => xoaTonDau(o.id)}
                      trigger={
                        <Button size="sm" variant="ghost">
                          Xóa
                        </Button>
                      }
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border-2 border-dashed border-border p-4 text-center text-base text-muted-foreground">
                Chưa khai tồn đầu nào cho xưởng này.
              </p>
            )}

            {/* Form thêm */}
            {form ? (
              <div className="space-y-4 rounded-xl border-2 border-primary/40 bg-accent/30 p-4">
                <ErrorSummary loi={loi} />
                <ChuThichBatBuoc />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Combobox
                    label="Phân xưởng"
                    required
                    choPhepXoa={false}
                    value={form.workshop}
                    onChange={(v) => setForm((f) => (f ? { ...f, workshop: v as Workshop } : f))}
                    options={XUONG_OPT.filter((o) => o.value !== "Tất cả")}
                  />
                  <Combobox
                    label="Loại nguyên liệu"
                    required
                    value={form.materialTypeName}
                    onChange={(v) => setForm((f) => (f ? { ...f, materialTypeName: v } : f))}
                    onCreate={(t) => t}
                    options={optLoaiNL}
                    hint="Chọn hoặc gõ tên loại; gõ đúng tên trong sổ Nhập hàng để khớp họ."
                  />
                  <DateField
                    label="Tồn đầu tính từ ngày"
                    required
                    value={form.asOfDate}
                    onChange={(v) => setForm((f) => (f ? { ...f, asOfDate: v } : f))}
                  />
                  <NumberField
                    label="Khối lượng tồn"
                    required
                    unit="kg"
                    value={form.quantityKg}
                    onChange={(v) => setForm((f) => (f ? { ...f, quantityKg: v } : f))}
                  />
                </div>
                <Field label="Ghi chú">
                  <Input
                    value={form.note}
                    onChange={(e) => setForm((f) => (f ? { ...f, note: e.target.value } : f))}
                    placeholder="VD: số kiểm kê đầu năm"
                  />
                </Field>
                <div className="flex flex-wrap justify-end gap-3">
                  <Button variant="outline" onClick={() => setForm(null)}>
                    Hủy
                  </Button>
                  <Button onClick={luuTonDau}>
                    <PackagePlus className="mr-1 h-4 w-4" />
                    Lưu tồn đầu
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" onClick={moThemTonDau}>
                <PackagePlus className="mr-2 h-4 w-4" />
                Thêm tồn đầu
              </Button>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setMoTonDau(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chú thích đơn vị + cách đọc */}
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Truck className="size-icon-sm" aria-hidden />
        "Nhập" lấy từ sổ Nhập hàng (mọi chuyến nhập trong kỳ).{" "}
        {coDongXa
          ? "Đông gửi / Xả đông là số kho đông dự trữ (Cân đối) — chỉ để tham khảo, không vào tồn."
          : "Chưa có đông gửi / xả đông nào trong kỳ."}
      </p>
    </div>
  );
}
