// ============================================================
// Tên file: src/features/reports/MaterialNxtScreen.tsx
// Tên tiếng Việt: Báo cáo Nhập–Xuất–Tồn kho nguyên liệu (kho đông dự trữ)
// Description: Raw-material inventory (frozen reserve) NXT report screen
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
} from "@/lib/catalogRepo";
import { KY_OPT, phamViKy, type KyXem } from "@/lib/periodUtils";
import { tinhSoTonNL, tongSoTonNL, type SoTonNLKy } from "@/lib/inventoryMaterial";
import { num, viDate } from "@/lib/format";
import { uid } from "@/lib/db";
import type { MaterialOpeningStock, Workshop } from "@/types";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarRange,
  PackagePlus,
  Scale,
  Snowflake,
  Truck,
} from "lucide-react";

const XUONG_OPT: MucChon[] = [
  { value: "Đông", label: "Đông" },
  { value: "Cá", label: "Cá" },
  { value: "Khô", label: "Khô" },
  { value: "Tất cả", label: "Tất cả xưởng" },
];

interface OpeningForm {
  workshop: Workshop;
  materialTypeName: string;
  asOfDate: string;
  quantityKg: number | null;
  note: string;
}

/**
 * Báo cáo NXT nguyên liệu — tồn kho nguyên liệu chính là KHO ĐÔNG DỰ TRỮ của
 * vòng gối đầu. Số suy thẳng từ cột "Chuyển kỳ" của Cân đối (đông gửi = nhập kho
 * tồn, xả đông = xuất kho tồn) nên không lệch sổ gốc. Xem lib/inventoryMaterial.ts.
 * Chỉ đọc; ô nhập tay duy nhất là "Tồn đầu" (số dư trước khi số hoá).
 */
export default function MaterialNxtScreen() {
  const [periods] = useBalancingPeriods();
  const [inputs] = useBalancingInputs();
  const [imports] = useMaterialImports();
  const [opening, ghiOpening] = useMaterialOpeningStock();
  const [materialTypes] = useMaterialTypes();

  const [ky, setKy] = useState<KyXem>("nam");
  const [moc, setMoc] = useState(homNay());
  const [tuTC, setTuTC] = useState(homNay());
  const [denTC, setDenTC] = useState(homNay());
  const [xuong, setXuong] = useState<string>("Đông");
  const [tu, den] = phamViKy(ky, moc, tuTC, denTC);

  // Dialog tồn đầu
  const [moTonDau, setMoTonDau] = useState(false);
  const [form, setForm] = useState<OpeningForm | null>(null);
  const [loi, setLoi] = useState<LoiNhap[]>([]);

  const workshop = xuong === "Tất cả" ? undefined : (xuong as Workshop);

  const rows = useMemo(
    () => tinhSoTonNL(periods, inputs, imports, opening, { tuNgay: tu, denNgay: den, workshop }),
    [periods, inputs, imports, opening, tu, den, workshop],
  );
  const tong = useMemo(() => tongSoTonNL(rows), [rows]);

  const the: TheThongTin[] = [
    { nhan: "Tồn đầu kho", giaTri: `${num(tong.tonDau)} kg`, so: true, icon: Snowflake, mau: "trung-tinh" },
    { nhan: "Đông gửi (+kho)", giaTri: `${num(tong.dongGui)} kg`, so: true, icon: ArrowDownToLine, mau: "brand" },
    { nhan: "Xả đông (−kho)", giaTri: `${num(tong.xaDong)} kg`, so: true, icon: ArrowUpFromLine, mau: "trung-tinh" },
    { nhan: "Tồn cuối kho", giaTri: `${num(tong.tonCuoi)} kg`, so: true, icon: Scale, mau: "success" },
  ];

  const cot: CotTong<SoTonNLKy>[] = [
    {
      key: "ky",
      header: "Kỳ / họ nguyên liệu",
      render: (r) => (
        <div className="min-w-0">
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
          <div className="text-sm text-muted-foreground">
            {r.startDate ? `${viDate(r.startDate)} – ${viDate(r.endDate)}` : "Chưa khai ngày"}
          </div>
        </div>
      ),
    },
    {
      key: "tonDau",
      header: "Tồn đầu (kg)",
      so: true,
      render: (r) => num(r.tonDau),
      tong: () => num(tong.tonDau),
    },
    {
      key: "nhapTuoi",
      header: "Nhập tươi (kg)",
      so: true,
      render: (r) => <span className="text-muted-foreground">{num(r.nhapTuoi)}</span>,
      tong: () => num(tong.nhapTuoi),
    },
    {
      key: "dongGui",
      header: "Đông gửi +",
      so: true,
      render: (r) => (
        <span className={r.dongGui > 0 ? "font-semibold text-success" : ""}>
          {r.dongGui > 0 ? `+${num(r.dongGui)}` : "—"}
        </span>
      ),
      tong: () => num(tong.dongGui),
    },
    {
      key: "xaDong",
      header: "Xả đông −",
      so: true,
      render: (r) => (
        <span className={r.xaDong > 0 ? "font-semibold text-warning" : ""}>
          {r.xaDong > 0 ? `−${num(r.xaDong)}` : "—"}
        </span>
      ),
      tong: () => num(tong.xaDong),
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
      tong: () => num(tong.tonCuoi),
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
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Snowflake className="w-8 h-8 text-primary" />
            Tồn kho nguyên liệu (Nhập – Xuất – Tồn)
          </h1>
          <p className="text-muted-foreground mt-1">
            Kho đông dự trữ của vòng gối đầu — đông gửi vào kho, xả đông ra dùng kỳ sau. Số suy từ sổ
            Cân đối, không nhập tay lần hai.
          </p>
        </div>
        <Button variant="outline" onClick={() => setMoTonDau(true)}>
          <PackagePlus className="w-4 h-4 mr-2" />
          Tồn đầu ({openingLoc.length})
        </Button>
      </div>

      {/* Bộ chọn kỳ + phân xưởng (mẫu giống Báo cáo nhập hàng) */}
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
        <div className="min-w-[16rem] flex-1">
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

      {/* Cảnh báo tồn âm — bộ dò lỗi ghi chép, không giấu */}
      {tong.soCanhBao > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-destructive bg-destructive/10 p-4">
          <AlertTriangle className="w-5 h-5 shrink-0 text-destructive" aria-hidden />
          <span className="text-base font-semibold text-destructive">
            {tong.soCanhBao} kỳ có tồn cuối ÂM — xả đông nhiều hơn số đang trữ. Kiểm lại đông gửi /
            xả đông của kỳ đó ở màn Cân đối (số ghi tay có thể sai).
          </span>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          tieuDe="Chưa có kỳ cân đối nào trong khoảng ngày này"
          moTa={
            periods.length === 0
              ? "Tồn kho nguyên liệu suy từ vòng chuyển kỳ của Cân đối. Hãy tạo kỳ cân đối và khai đông gửi / xả đông ở màn Cân đối trước."
              : "Đổi lại Kỳ báo cáo / phân xưởng, hoặc kiểm ngày bắt đầu của kỳ. Sổ lọc theo ngày kỳ giao nhau với khoảng đang xem."
          }
        />
      ) : (
        <BangTong
          rows={rows}
          cot={cot}
          getKey={(r) => r.periodId}
          emptyText="Không có kỳ nào trong khoảng ngày này."
        />
      )}

      {/* Dialog quản lý Tồn đầu */}
      <Dialog open={moTonDau} onOpenChange={setMoTonDau}>
        <DialogContent className="w-full sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Tồn đầu kho nguyên liệu</DialogTitle>
            <DialogDescription className="text-base">
              Số dư cấp đông dự trữ có sẵn TRƯỚC khi dùng app. Chỉ cần khai cho kỳ đầu tiên của mỗi
              loại — các kỳ sau tự kế thừa tồn cuối kỳ trước.
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
                    hint="Chọn hoặc gõ tên loại; gõ đúng tên trong sổ Cân đối để khớp họ."
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
        "Nhập tươi" là nguyên liệu về xưởng trong kỳ (bối cảnh, phần lớn chế biến ngay). Kho tồn chỉ
        cộng/trừ khi <b>đông gửi</b> / <b>xả đông</b>.
      </p>
    </div>
  );
}
