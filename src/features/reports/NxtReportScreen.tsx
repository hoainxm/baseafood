// ============================================================
// Tên file cũ: src/features/reports/BaoCaoNhapXuatTon.tsx
// Tên tiếng Việt: Màn hình Báo cáo Nhập Xuất Tồn thành phẩm
// Description: Finished-goods Import-Export-Inventory (NXT) report screen
// ============================================================
import { useMemo, useState } from "react";
import type { FinishedGoodsOpeningStock } from "@/types";
import {
  useWipProductions,
  useExportItems,
  useExportOrders,
  useSalesItems,
  useProducts,
  useFinishedGoodsOpeningStock,
} from "@/lib/catalogRepo";
import {
  tinhSoTonTP,
  tongSoTonTP,
  type SoTonTPRow,
} from "@/lib/inventoryFinished";
import { exportNxtToExcel, inferCategory, type NxtExcelRow } from "@/lib/nxtExcel";
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
import { KY_OPT, phamViKy, dauThang, type KyXem } from "@/lib/periodUtils";
import { num, viDate } from "@/lib/format";
import { uid } from "@/lib/db";
import {
  AlertTriangle,
  ArrowDownToLine,
  Download,
  PackagePlus,
  Scale,
  Ship,
  Snowflake,
  Store,
} from "lucide-react";

interface OpeningForm {
  productId: string;
  spec: string;
  asOfDate: string;
  quantityKg: number | null;
  blocksCount: number | null;
  warehouse: string;
  note: string;
}

/**
 * Báo cáo NXT thành phẩm — kho bán thành phẩm cấp đông dự trữ. Số suy thẳng từ
 * lịch sử: Nhập = BTP duyệt vào kho; Xuất = đơn đặt (dòng lệnh) + bán hàng ngày;
 * Tồn đầu = khai tay + lịch sử trước kỳ. Xem lib/inventoryFinished.ts.
 * Chỉ đọc; ô nhập tay duy nhất là "Tồn đầu" (số dư trước khi số hoá).
 */
export default function BaoCaoNhapXuatTonScreen() {
  const [sanXuat] = useWipProductions();
  const [exportItems] = useExportItems();
  const [exportOrders] = useExportOrders();
  const [salesItems] = useSalesItems();
  const [matHang] = useProducts();
  const [opening, ghiOpening] = useFinishedGoodsOpeningStock();

  const [ky, setKy] = useState<KyXem>("thang");
  const [moc, setMoc] = useState(homNay());
  const [tuTC, setTuTC] = useState(dauThang(homNay()));
  const [denTC, setDenTC] = useState(homNay());
  const [tu, den] = phamViKy(ky, moc, tuTC, denTC);

  // Dialog tồn đầu
  const [moTonDau, setMoTonDau] = useState(false);
  const [form, setForm] = useState<OpeningForm | null>(null);
  const [loi, setLoi] = useState<LoiNhap[]>([]);

  const tenMH = (id: string) => matHang.find((m) => m.id === id)?.name || "—";

  const rows = useMemo(
    () =>
      tinhSoTonTP({
        sanXuat,
        exportOrders,
        exportItems,
        salesItems,
        opening,
        products: matHang,
        tuNgay: tu,
        denNgay: den,
      }),
    [sanXuat, exportOrders, exportItems, salesItems, opening, matHang, tu, den]
  );
  const tong = useMemo(() => tongSoTonTP(rows), [rows]);

  const the: TheThongTin[] = [
    { nhan: "Tồn đầu kho", giaTri: `${num(tong.tonDau)} kg`, so: true, icon: Snowflake, mau: "trung-tinh" },
    { nhan: "Nhập kho", giaTri: `${num(tong.nhap)} kg`, so: true, icon: ArrowDownToLine, mau: "brand" },
    {
      nhan: "Xuất (đơn + bán)",
      giaTri: `${num(tong.xuatDon)} + ${num(tong.xuatBan)} kg`,
      icon: Ship,
      mau: "warning",
    },
    { nhan: "Tồn cuối kho", giaTri: `${num(tong.tonCuoi)} kg`, so: true, icon: Scale, mau: "success" },
  ];

  const cot: CotTong<SoTonTPRow>[] = [
    {
      key: "mh",
      header: "Mặt hàng · quy cách",
      render: (r) => (
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">{r.productName}</span>
            {r.spec && <Badge variant="outline">{r.spec}</Badge>}
            {r.seedTonDau && <Badge variant="outline">Tồn đầu khai tay</Badge>}
            {r.canhBaoAm && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="size-icon-sm" aria-hidden />
                Tồn âm
              </Badge>
            )}
          </div>
          {r.productCode && (
            <div className="font-mono text-sm text-muted-foreground">{r.productCode}</div>
          )}
        </div>
      ),
    },
    { key: "tonDau", header: "Tồn đầu (kg)", so: true, render: (r) => num(r.tonDau), tong: () => num(tong.tonDau) },
    {
      key: "nhap",
      header: "Nhập (kg)",
      so: true,
      render: (r) => (
        <span className={r.nhap > 0 ? "font-semibold text-success" : ""}>{r.nhap ? `+${num(r.nhap)}` : "—"}</span>
      ),
      tong: () => num(tong.nhap),
    },
    {
      key: "xuatDon",
      header: "Xuất đơn (kg)",
      so: true,
      render: (r) => (r.xuatDon ? `−${num(r.xuatDon)}` : "—"),
      tong: () => num(tong.xuatDon),
    },
    {
      key: "xuatBan",
      header: "Xuất bán (kg)",
      so: true,
      render: (r) => (r.xuatBan ? `−${num(r.xuatBan)}` : "—"),
      tong: () => num(tong.xuatBan),
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

  // ----- Xuất Excel (mẫu 10 cột) -----
  const xuatExcel = () => {
    if (!rows.length) {
      notify.canhBao("Không có số liệu để xuất");
      return;
    }
    const items: NxtExcelRow[] = rows.map((r) => ({
      code: r.productCode || r.productId,
      name: `${r.productName}${r.spec ? ` (${r.spec})` : ""}`,
      category: inferCategory(r.productCode, r.productName),
      tonDauKg: r.tonDau,
      giaTriDau: 0,
      nhapKg: r.nhap,
      giaTriNhap: 0,
      xuatKg: r.xuat,
      giaTriXuat: 0,
      tonCuoiKg: r.tonCuoi,
      giaTriCuoi: 0,
    }));
    exportNxtToExcel(
      {
        createdDateText: `Ngày lập: ${viDate(homNay())}`,
        title: "Báo cáo xuất nhập tồn thành phẩm",
        dateRangeText: `Từ ngày ${viDate(tu)} đến ngày ${viDate(den)}`,
        warehouseText: "Chi nhánh: Kho thành phẩm BSF1",
        items,
        totalItemCount: items.length,
        totalTonDauKg: tong.tonDau,
        totalGiaTriDau: 0,
        totalNhapKg: tong.nhap,
        totalGiaTriNhap: 0,
        totalXuatKg: tong.xuat,
        totalGiaTriXuat: 0,
        totalTonCuoiKg: tong.tonCuoi,
        totalGiaTriCuoi: 0,
      },
      `Bao-Cao-NXT-Thanh-Pham-${tu}-${den}.xlsx`
    );
    notify.daLuu("Đã xuất Excel báo cáo NXT thành phẩm");
  };

  // ----- Tồn đầu: thêm / xóa -----
  const optMatHang: MucChon[] = matHang.map((m) => ({ value: m.id, label: m.name, phu: m.code || undefined }));

  const moThemTonDau = () => {
    setForm({
      productId: "",
      spec: "",
      asOfDate: homNay(),
      quantityKg: null,
      blocksCount: null,
      warehouse: "",
      note: "",
    });
    setLoi([]);
  };

  const luuTonDau = () => {
    if (!form) return;
    const ls: LoiNhap[] = [];
    if (!form.productId) ls.push({ truong: "Mặt hàng", thongBao: "Chưa chọn mặt hàng" });
    if (!form.asOfDate) ls.push({ truong: "Ngày mốc", thongBao: "Chưa chọn ngày tồn đầu" });
    if (!(Number(form.quantityKg) > 0)) ls.push({ truong: "Khối lượng", thongBao: "Phải lớn hơn 0 kg" });
    setLoi(ls);
    if (ls.length > 0) return;
    const moi: FinishedGoodsOpeningStock = {
      id: uid(),
      productId: form.productId,
      spec: form.spec.trim(),
      asOfDate: form.asOfDate,
      quantityKg: Number(form.quantityKg),
      blocksCount: Number(form.blocksCount) || 0,
      warehouse: form.warehouse.trim(),
      note: form.note.trim(),
    };
    ghiOpening([...opening, moi]);
    notify.daLuu(`Đã lưu tồn đầu ${num(moi.quantityKg)} kg — ${tenMH(moi.productId)}`);
    setForm(null);
  };

  const xoaTonDau = (id: string) => {
    ghiOpening(opening.filter((o) => o.id !== id));
    notify.daXoa("Đã xóa dòng tồn đầu");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Snowflake className="h-8 w-8 text-primary" />
            Báo cáo Nhập – Xuất – Tồn thành phẩm
          </h1>
          <p className="mt-1 text-muted-foreground">
            Kho bán thành phẩm cấp đông dự trữ. Số suy từ sổ Sản xuất, Đơn đặt và Bán hàng — không nhập
            tay lần hai.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => setMoTonDau(true)}>
            <PackagePlus className="mr-2 h-4 w-4" />
            Tồn đầu ({opening.length})
          </Button>
          <Button onClick={xuatExcel} disabled={!rows.length}>
            <Download className="mr-2 h-4 w-4" />
            Xuất Excel
          </Button>
        </div>
      </div>

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
      </div>

      <ThongKe the={the} />

      {tong.soCanhBao > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-destructive bg-destructive/10 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" aria-hidden />
          <span className="text-base font-semibold text-destructive">
            {tong.soCanhBao} mặt hàng có tồn cuối ÂM — xuất nhiều hơn số đang trữ. Kiểm lại sản xuất /
            đơn đặt / bán hàng (số ghi tay có thể sai, hoặc thiếu khai tồn đầu).
          </span>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={Snowflake}
          tieuDe="Chưa có số liệu thành phẩm trong khoảng ngày này"
          moTa="Ghi sản lượng ở Sản xuất BTP, duyệt vào Kho dự trữ, rồi xuất theo Đơn đặt / Bán hàng — số sẽ tổng hợp về đây. Có số dư đông trước khi số hoá thì khai ở nút Tồn đầu."
        />
      ) : (
        <BangTong rows={rows} cot={cot} getKey={(r) => `${r.productId}|||${r.spec}`} />
      )}

      <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Store className="size-icon-sm" aria-hidden />
        "Xuất đơn" = lệnh xuất container theo Đơn đặt; "Xuất bán" = phiếu Bán hàng ngày (không tính
        hai lần phần đã xuất qua đơn). Tồn cuối khớp với Tổng tồn ở màn Kho dự trữ.
      </p>

      {/* Dialog quản lý Tồn đầu thành phẩm */}
      <Dialog open={moTonDau} onOpenChange={setMoTonDau}>
        <DialogContent className="w-full sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Tồn đầu kho thành phẩm</DialogTitle>
            <DialogDescription className="text-base">
              Số dư bán thành phẩm cấp đông có sẵn TRƯỚC khi dùng app, theo (mặt hàng × quy cách). Chỉ
              cần khai một lần — các kỳ sau tự kế thừa từ lịch sử nhập/xuất.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {opening.length > 0 ? (
              <ul className="divide-y divide-border rounded-lg border-2 border-border">
                {opening.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                    <span className="min-w-0 flex-1 text-base">
                      <span className="font-semibold">{tenMH(o.productId)}</span>
                      {o.spec ? <span className="text-muted-foreground"> · {o.spec}</span> : null}
                      {" — "}
                      <span className="tnum font-semibold">{num(o.quantityKg)}</span> kg
                      <span className="text-muted-foreground">
                        {" "}
                        · từ {viDate(o.asOfDate)}
                        {o.warehouse ? ` · ${o.warehouse}` : ""}
                        {o.note ? ` · ${o.note}` : ""}
                      </span>
                    </span>
                    <ConfirmDelete
                      moTaBanGhi={`${tenMH(o.productId)}${o.spec ? ` · ${o.spec}` : ""} — ${num(o.quantityKg)} kg`}
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
                Chưa khai tồn đầu thành phẩm nào.
              </p>
            )}

            {form ? (
              <div className="space-y-4 rounded-xl border-2 border-primary/40 bg-accent/30 p-4">
                <ErrorSummary loi={loi} />
                <ChuThichBatBuoc />
                <Combobox
                  label="Mặt hàng"
                  required
                  value={form.productId}
                  onChange={(v) => setForm((f) => (f ? { ...f, productId: v } : f))}
                  options={optMatHang}
                  emptyText="Chưa có mặt hàng — thêm ở Danh mục."
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Quy cách" hint="Khớp size hàng trong kho (để trống nếu không tách).">
                    <Input
                      value={form.spec}
                      onChange={(e) => setForm((f) => (f ? { ...f, spec: e.target.value } : f))}
                      placeholder="VD 18-20"
                    />
                  </Field>
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
                  <NumberField
                    label="Số block"
                    unit="block"
                    value={form.blocksCount}
                    onChange={(v) => setForm((f) => (f ? { ...f, blocksCount: v } : f))}
                  />
                </div>
                <Field label="Kho (tùy chọn)">
                  <Input
                    value={form.warehouse}
                    onChange={(e) => setForm((f) => (f ? { ...f, warehouse: e.target.value } : f))}
                    placeholder="VD: Kho 1000 tấn"
                  />
                </Field>
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
    </div>
  );
}
