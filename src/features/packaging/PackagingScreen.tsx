// ============================================================
// Tên file: src/features/packaging/PackagingScreen.tsx
// Tên tiếng Việt: Màn hình Đóng gói Bán thành phẩm → Thành phẩm
// Description: Packaging Screen — BTP consumed → packaged finished goods (G3)
// ============================================================
import { useMemo, useState } from "react";
import type { Packaging, Product, Workshop } from "@/types";
import { haoHutDongGoi, BSF1_WAREHOUSES } from "@/types";
import { newId } from "@/lib/store";
import { uid } from "@/lib/db";
import {
  usePackagings,
  useWipProductions,
  useExportItems,
  useSalesItems,
  useProducts,
} from "@/lib/catalogRepo";
import {
  tinhTon,
  khaDung,
  locBanLe,
  dongGoiTruTon,
  tinhTonTP,
  KHO_TP,
} from "@/lib/inventory";
import {
  Badge,
  Button,
  ChuThichBatBuoc,
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
  SkeletonBang,
  ThongKe,
  notify,
  type Cot,
  type LoiNhap,
  type MucChon,
} from "@/design-system";
import { kg, num, todayISO, viDate } from "@/lib/format";
import { KY_OPT, phamViKy, type KyXem } from "@/lib/periodUtils";
import { Boxes, CalendarRange, Package, PackageCheck, Plus, Scale } from "lucide-react";

const PHAN_XUONG: Workshop[] = ["Đông", "Cá", "Khô"];
const KHO_TP_NAMES = BSF1_WAREHOUSES.map((w) => w.name);

interface FormDG {
  date: string;
  workshop: Workshop;
  fromProductId: string;
  fromSpec: string;
  inputKg: number;
  inputBlocks: number;
  toProductId: string;
  toSpec: string;
  outputKg: number;
  outputUnits: number;
  warehouse: string;
  note: string;
}

export default function DongGoiScreen() {
  const [rows, persist, { trangThai }] = usePackagings();
  const dangTai = trangThai === "dang-tai" && rows.length === 0;
  const [sanXuat] = useWipProductions();
  const [dongLenh] = useExportItems();
  const [banHang] = useSalesItems();
  const [matHang, setMatHang] = useProducts();

  const [ky, setKy] = useState<KyXem>("ngay");
  const [ngay, setNgay] = useState(todayISO());
  const [tuNgay, setTuNgay] = useState(todayISO());
  const [denNgay, setDenNgay] = useState(todayISO());
  const [phanXuong, setPhanXuong] = useState<Workshop | "Tất cả">("Đông");

  const [form, setForm] = useState<FormDG | null>(null);
  const [loi, setLoi] = useState<LoiNhap[]>([]);

  const [tuHieuLuc, denHieuLuc] = phamViKy(ky, ngay, tuNgay, denNgay);
  const laMotNgay = tuHieuLuc === denHieuLuc;
  const moTaPhamVi = laMotNgay
    ? viDate(tuHieuLuc)
    : `${viDate(tuHieuLuc)} – ${viDate(denHieuLuc)}`;

  const tenMH = (id: string) => matHang.find((m) => m.id === id)?.name || "—";
  const optMatHang: MucChon[] = matHang.map((m) => ({
    value: m.id,
    label: m.code ? `${m.code} · ${m.name}` : m.name,
    phu: m.code || undefined,
  }));

  /* Tồn BTP khả dụng: sản xuất − xuất − bán lẻ block thô − ĐÃ đóng gói. */
  const truBTP = useMemo(
    () => [...locBanLe(banHang), ...dongGoiTruTon(rows)],
    [banHang, rows]
  );
  const tonBTP = useMemo(
    () => tinhTon(sanXuat, dongLenh, truBTP),
    [sanXuat, dongLenh, truBTP]
  );
  /* Tồn TP đóng gói (chưa trừ bán TP ở đây — chỉ để xem đã đóng gói bao nhiêu còn kho). */
  const tonTP = useMemo(() => tinhTonTP(rows, locBanLe(banHang, KHO_TP)), [rows, banHang]);

  const view = useMemo(
    () =>
      rows
        .filter(
          (r) =>
            r.date >= tuHieuLuc &&
            r.date <= denHieuLuc &&
            (phanXuong === "Tất cả" || r.workshop === phanXuong)
        )
        .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
    [rows, tuHieuLuc, denHieuLuc, phanXuong]
  );

  const tongVao = view.reduce((s, r) => s + (r.inputKg || 0), 0);
  const tongRa = view.reduce((s, r) => s + (r.outputKg || 0), 0);
  const tongHao = tongVao - tongRa;
  const tongTonTP = tonTP.reduce((s, t) => s + Math.max(0, t.conLai), 0);

  const ngayGhi = laMotNgay ? tuHieuLuc : denHieuLuc;
  const xuongGhi: Workshop = phanXuong === "Tất cả" ? "Đông" : phanXuong;

  const themMatHang = (ten: string): string => {
    const m: Product = { id: uid(), code: "", name: ten, finishedGoodCode: "", category: "", materialTypeId: "" };
    setMatHang([...matHang, m]);
    notify.daLuu(`Đã thêm mặt hàng "${ten}"`);
    return m.id;
  };

  const moThem = () => {
    setForm({
      date: ngayGhi,
      workshop: xuongGhi,
      fromProductId: "",
      fromSpec: "",
      inputKg: 0,
      inputBlocks: 0,
      toProductId: "",
      toSpec: "",
      outputKg: 0,
      outputUnits: 0,
      warehouse: KHO_TP_NAMES[0] ?? "",
      note: "",
    });
    setLoi([]);
  };
  const dat = <K extends keyof FormDG>(k: K, v: FormDG[K]) =>
    setForm((p) => (p ? { ...p, [k]: v } : p));

  const btpKhaDung = form?.fromProductId
    ? khaDung(tonBTP, form.fromProductId, form.fromSpec.trim())
    : null;
  const vuotTonBTP = btpKhaDung != null && form != null && form.inputKg > btpKhaDung;
  const haoAm = form != null && form.outputKg > form.inputKg;

  const ghi = () => {
    if (!form) return;
    const ls: LoiNhap[] = [];
    if (!form.fromProductId) ls.push({ truong: "BTP tiêu hao", thongBao: "Chưa chọn mặt hàng BTP" });
    if (!(form.inputKg > 0)) ls.push({ truong: "BTP vào (kg)", thongBao: "Phải lớn hơn 0" });
    if (!form.toProductId) ls.push({ truong: "Thành phẩm ra", thongBao: "Chưa chọn mặt hàng TP" });
    if (!(form.outputKg > 0)) ls.push({ truong: "TP ra (kg)", thongBao: "Phải lớn hơn 0" });
    setLoi(ls);
    if (ls.length > 0) return;

    const p: Packaging = {
      id: newId(),
      date: form.date,
      workshop: form.workshop,
      fromProductId: form.fromProductId,
      fromSpec: form.fromSpec.trim(),
      inputKg: form.inputKg,
      inputBlocks: form.inputBlocks,
      toProductId: form.toProductId,
      toSpec: form.toSpec.trim(),
      outputKg: form.outputKg,
      outputUnits: form.outputUnits,
      warehouse: form.warehouse,
      note: form.note,
    };
    persist([...rows, p]);
    notify.daLuu(
      `Đã đóng gói: ${tenMH(p.fromProductId)} ${kg(p.inputKg)} → ${tenMH(p.toProductId)} ${kg(p.outputKg)}`
    );
    setForm(null);
  };

  const xoa = (r: Packaging) => {
    const truoc = rows;
    persist(rows.filter((x) => x.id !== r.id));
    notify.daXoa(`Đã xóa phiếu đóng gói ${tenMH(r.toProductId)}`, () => persist(truoc));
  };

  const cot: Cot<Packaging>[] = [
    { key: "date", header: "Ngày", chinh: true, render: (r) => viDate(r.date), sapXep: (r) => r.date },
    { key: "workshop", header: "Xưởng", render: (r) => r.workshop },
    {
      key: "from",
      header: "BTP tiêu hao",
      render: (r) => (
        <span>
          {tenMH(r.fromProductId)}
          {r.fromSpec ? <span className="text-muted-foreground"> · {r.fromSpec}</span> : null}
          <span className="tnum"> — {num(r.inputKg)} kg</span>
          {r.inputBlocks ? <span className="text-muted-foreground"> · {num(r.inputBlocks)} block</span> : null}
        </span>
      ),
    },
    {
      key: "to",
      header: "Thành phẩm ra",
      render: (r) => (
        <span>
          {tenMH(r.toProductId)}
          {r.toSpec ? <span className="text-muted-foreground"> · {r.toSpec}</span> : null}
          <span className="tnum"> — {num(r.outputKg)} kg</span>
          {r.outputUnits ? <span className="text-muted-foreground"> · {num(r.outputUnits)} thùng</span> : null}
        </span>
      ),
    },
    {
      key: "hao",
      header: "Hao hụt (kg)",
      so: true,
      render: (r) => {
        const h = haoHutDongGoi(r);
        return <span className={h < 0 ? "tnum text-warning" : "tnum"}>{num(h)}</span>;
      },
      sapXep: (r) => haoHutDongGoi(r),
    },
    { key: "kho", header: "Kho TP", render: (r) => r.warehouse || "—" },
    {
      key: "xoa",
      header: "",
      render: (r) => (
        <Button variant="outline" size="sm" onClick={() => xoa(r)}>
          Xóa
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Đóng gói thành phẩm</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bán thành phẩm (còn khuôn đá) → đóng gói thành thành phẩm sẵn bán. Đóng gói trừ tồn dự trữ, cộng tồn thành phẩm.
          </p>
        </div>
        <Button size="lg" onClick={moThem}>
          <Plus />
          Ghi phiếu đóng gói
        </Button>
      </div>

      <ThongKe
        className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        the={[
          { nhan: "Đang xem", giaTri: moTaPhamVi, icon: CalendarRange, mau: "trung-tinh" },
          { nhan: "Số phiếu", giaTri: view.length, so: true, icon: Package, mau: "brand" },
          { nhan: "BTP vào", giaTri: kg(tongVao), so: true, icon: Scale, mau: "trung-tinh" },
          { nhan: "TP ra", giaTri: kg(tongRa), so: true, icon: PackageCheck, mau: "success" },
          { nhan: "Hao hụt", giaTri: kg(tongHao), so: true, icon: Scale, mau: tongHao < 0 ? "warning" : "trung-tinh" },
        ]}
      />

      <div className="flex flex-wrap items-end gap-4 rounded-xl border-2 border-border p-4">
        <Combobox
          label="Kỳ xem"
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
              label="Khoảng ngày"
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
            <DateField label="Ngày" anNhanBatBuoc value={ngay} onChange={setNgay} />
          )}
        </div>
        <Combobox
          label="Phân xưởng"
          choPhepXoa={false}
          value={phanXuong}
          onChange={(v) => setPhanXuong(v as Workshop | "Tất cả")}
          options={[{ value: "Tất cả", label: "Tất cả" }, ...PHAN_XUONG.map((p) => ({ value: p, label: p }))]}
          className="min-w-[12rem]"
        />
      </div>

      {/* Tồn thành phẩm đóng gói còn kho */}
      {tonTP.some((t) => t.conLai > 0) && (
        <section className="grid gap-3 rounded-xl border-2 border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-foreground">Tồn thành phẩm đóng gói</h2>
            <Badge variant="outline">
              <Boxes className="size-4" aria-hidden /> {kg(tongTonTP)}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {tonTP
              .filter((t) => t.conLai > 0)
              .map((t) => (
                <span
                  key={`${t.productId}|${t.spec}`}
                  className="rounded-lg border-2 border-border px-3 py-1.5 text-sm"
                >
                  {tenMH(t.productId)}
                  {t.spec ? <span className="text-muted-foreground"> · {t.spec}</span> : null}:{" "}
                  <span className="tnum font-semibold text-foreground">{kg(t.conLai)}</span>
                </span>
              ))}
          </div>
        </section>
      )}

      {dangTai ? (
        <SkeletonBang />
      ) : view.length === 0 ? (
        <EmptyState
          icon={Package}
          tieuDe="Chưa có phiếu đóng gói"
          moTa="Bấm “Ghi phiếu đóng gói” để chuyển bán thành phẩm thành thành phẩm đóng gói."
        />
      ) : (
        <RecordTable columns={cot} rows={view} getKey={(r) => r.id} />
      )}

      {/* Dialog ghi phiếu */}
      <Dialog open={form !== null} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[92vh] w-full overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Ghi phiếu đóng gói</DialogTitle>
            <DialogDescription className="text-base">
              BTP tiêu hao (trừ tồn dự trữ) → thành phẩm đóng gói ra (cộng tồn thành phẩm). Chênh lệch là hao hụt.
            </DialogDescription>
          </DialogHeader>

          {form && (
            <div className="space-y-6 py-2">
              <ErrorSummary loi={loi} />
              <ChuThichBatBuoc />

              <div className="grid gap-6 sm:grid-cols-2">
                <DateField label="Ngày đóng gói" required value={form.date} onChange={(v) => dat("date", v)} />
                <Combobox
                  label="Phân xưởng"
                  required
                  choPhepXoa={false}
                  value={form.workshop}
                  onChange={(v) => dat("workshop", v as Workshop)}
                  options={PHAN_XUONG.map((p) => ({ value: p, label: p }))}
                />
              </div>

              <div className="space-y-5 rounded-xl border-2 border-border p-4">
                <p className="text-base font-semibold">Bán thành phẩm tiêu hao</p>
                <Combobox
                  label="Mặt hàng BTP"
                  required
                  value={form.fromProductId}
                  onChange={(v) => dat("fromProductId", v)}
                  options={optMatHang}
                  onCreate={themMatHang}
                  emptyText="Chưa có mặt hàng — gõ tên rồi Thêm mới."
                />
                <Field label="Quy cách BTP" hint="Size/grade của lô BTP. VD: 230-250.">
                  <Input value={form.fromSpec} onChange={(e) => dat("fromSpec", e.target.value)} placeholder="VD: 230-250" />
                </Field>
                <div className="grid gap-6 sm:grid-cols-2">
                  <NumberField label="BTP vào" required unit="kg" value={form.inputKg || null} onChange={(v) => dat("inputKg", v ?? 0)} />
                  <NumberField label="Số block" unit="block" value={form.inputBlocks || null} onChange={(v) => dat("inputBlocks", v ?? 0)} />
                </div>
                {btpKhaDung != null ? (
                  <div
                    className={
                      vuotTonBTP
                        ? "rounded-lg bg-warning-surface px-4 py-3 text-base text-warning"
                        : "rounded-lg bg-muted px-4 py-3 text-base text-muted-foreground"
                    }
                  >
                    Tồn BTP khả dụng: <span className="tnum font-semibold">{kg(btpKhaDung)}</span>
                    {vuotTonBTP ? " — đóng gói vượt tồn, kiểm lại (vẫn ghi được, tồn báo âm)." : ""}
                  </div>
                ) : null}
              </div>

              <div className="space-y-5 rounded-xl border-2 border-primary/40 bg-accent/40 p-4">
                <p className="text-base font-semibold">Thành phẩm đóng gói ra</p>
                <Combobox
                  label="Mặt hàng TP"
                  required
                  hint="Thành phẩm đã đóng gói (có thể khác mã BTP)."
                  value={form.toProductId}
                  onChange={(v) => dat("toProductId", v)}
                  options={optMatHang}
                  onCreate={themMatHang}
                  emptyText="Chưa có mặt hàng — gõ tên rồi Thêm mới."
                />
                <Field label="Quy cách đóng gói" hint="VD: thùng 10 kg, hộp 1 kg.">
                  <Input value={form.toSpec} onChange={(e) => dat("toSpec", e.target.value)} placeholder="VD: hộp 1 kg" />
                </Field>
                <div className="grid gap-6 sm:grid-cols-2">
                  <NumberField label="TP ra" required unit="kg" value={form.outputKg || null} onChange={(v) => dat("outputKg", v ?? 0)} />
                  <NumberField label="Số thùng" unit="thùng" value={form.outputUnits || null} onChange={(v) => dat("outputUnits", v ?? 0)} />
                </div>
                <Combobox
                  label="Kho chứa TP"
                  choPhepXoa={false}
                  value={form.warehouse}
                  onChange={(v) => dat("warehouse", v)}
                  options={KHO_TP_NAMES.map((k) => ({ value: k, label: k }))}
                />
                {haoAm ? (
                  <div className="rounded-lg bg-warning-surface px-4 py-3 text-base text-warning">
                    TP ra ({kg(form.outputKg)}) lớn hơn BTP vào ({kg(form.inputKg)}) — hao hụt âm, kiểm lại số.
                  </div>
                ) : form.inputKg > 0 && form.outputKg > 0 ? (
                  <div className="rounded-lg bg-muted px-4 py-3 text-base text-muted-foreground">
                    Hao hụt: <span className="tnum font-semibold">{kg(form.inputKg - form.outputKg)}</span>
                  </div>
                ) : null}
              </div>

              <Field label="Ghi chú">
                <Input value={form.note} onChange={(e) => dat("note", e.target.value)} placeholder="Ghi chú (nếu có)" />
              </Field>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setForm(null)}>
              Hủy
            </Button>
            <Button size="lg" onClick={ghi}>
              <PackageCheck />
              Ghi đóng gói
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
