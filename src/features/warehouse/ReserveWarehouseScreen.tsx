// ============================================================
// Tên file cũ: src/features/warehouse/KhoDuTru.tsx
// Tên tiếng Việt: Màn hình Kho cấp đông dự trữ BSF1
// Description: Cold Storage Reserve Warehouse Management Screen
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { WipProductionItem } from "@/types";
import { useExportItems, useLotDispatches, useLotInputs, usePackagings, useProducts, useSalesItems, useWipProductions } from "@/lib/catalogRepo";
import { tinhTonChiTiet, truTonBTP, type LoTon } from "@/lib/inventory";
import { tuoiTon } from "@/lib/dongChay";
import {
  ChuThichBatBuoc,
  Button,
  Combobox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  SkeletonBang,
  ErrorSummary,
  Field,
  Input,
  Nhan,
  NumberField,
  RecordTable,
  sacTheoTen,
  sacXuong,
  ThongKe,
  notify,
  type Cot,
  type LoiNhap,
  type MucChon,
  ThanhChiaPhan,
  homNay,
} from "@/design-system";
import { kg, num, viDate } from "@/lib/format";
import { AlertTriangle, CalendarRange, Camera, CameraOff, ClipboardList, PackageCheck, Scale, Search, Snowflake, Warehouse } from "lucide-react";
import { KhungQuetQr } from "@/features/shared";
import { docMaQr, nhanLoBtp, timLo } from "@/lib/truyXuatLo";

import { BSF1_WAREHOUSES } from "@/types";
import { tinhDungTichKho } from "@/lib/inventory";

const BSF1_WAREHOUSE_NAMES = BSF1_WAREHOUSES.map((w) => w.name);

interface ApprovalForm {
  wipId: string;
  warehouse: string;
  luongThuc: number;
  blockThuc: number;
  note: string;
}

export default function KhoDuTruScreen() {
  const [wips, persistWips, { trangThai }] = useWipProductions();
  const isLoading = trangThai === "dang-tai" && wips.length === 0;
  const [exportItems] = useExportItems();
  const [products] = useProducts();
  const [salesItems] = useSalesItems();
  const [packagings] = usePackagings();
  const [lotInputs] = useLotInputs();
  const [lotDispatches] = useLotDispatches();
  // Trừ đúng lô đã gắn (truy xuất QR), phần còn lại FIFO — cùng con số với hộ chiếu lô.
  const retailSales = useMemo(
    () => truTonBTP(salesItems, packagings, lotInputs, lotDispatches),
    [salesItems, packagings, lotInputs, lotDispatches]
  );

  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [approval, setApproval] = useState<ApprovalForm | null>(null);
  const [loi, setLoi] = useState<LoiNhap[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [typedCode, setTypedCode] = useState("");

  const tenMH = (id: string) => products.find((m) => m.id === id)?.name || "—";

  const pendingIntake = useMemo(
    () => wips.filter((s) => s.status === "cho-nhap"),
    [wips]
  );
  // Bán lẻ / đóng gói vượt số đang trữ: lô không xuống âm nên phần vượt không nằm
  // trong "Tổng tồn" — phải gọi tên ra, không được nuốt (lỗi ghi chép cần dò).
  const { los: ton, banVuot, tongBanVuot } = useMemo(
    () => tinhTonChiTiet(wips, exportItems, retailSales),
    [wips, exportItems, retailSales]
  );
  const warehouseCapacity = useMemo(() => tinhDungTichKho(ton), [ton]);

  const warehouseList = useMemo(() => {
    const set = new Set<string>(BSF1_WAREHOUSE_NAMES);
    for (const s of wips) if (s.warehouse) set.add(s.warehouse);
    return [...set];
  }, [wips]);
  const warehouseOptions: MucChon[] = warehouseList.map((k) => {
    const wh = BSF1_WAREHOUSES.find((w) => w.name === k);
    return {
      value: k,
      label: wh ? `${wh.name} (${num(wh.capacityKg / 1000)} tấn)` : k,
    };
  });

  const filteredStock = useMemo(
    () => ton.filter((t) => (!warehouseFilter || t.warehouse === warehouseFilter) && t.conLai > 0),
    [ton, warehouseFilter]
  );
  const totalStock = filteredStock.reduce((s, t) => s + t.conLai, 0);
  const nhomTuoi = useMemo(() => tuoiTon(filteredStock, homNay()), [filteredStock]);

  const openApprove = (s: WipProductionItem) => {
    setApproval({
      wipId: s.id,
      warehouse: s.warehouse || BSF1_WAREHOUSE_NAMES[0],
      luongThuc: s.quantityKg,
      blockThuc: s.blocksCount,
      note: "",
    });
    setLoi([]);
  };

  /**
   * Quét / gõ tem lô BTP ⇒ mở thẳng hộp duyệt của đúng mẻ đó (đợt 2 truy xuất QR).
   * Thủ kho cầm block nào quét block đó — khỏi dò danh sách, khỏi duyệt nhầm mẻ.
   */
  const approveByLabel = (text: string) => {
    const ma = docMaQr(text);
    if (!ma) return;
    const ds = timLo(ma, {
      shipments: [], imports: [], wips: wips, packagings: [], lotInputs: [],
      exportItems: [], exportOrders: [], salesOrders: [], products: products, customers: [],
    }).filter((n) => n.kind === "W");
    if (ds.length === 0) {
      notify.canhBao(`"${text.trim()}" không phải tem lô bán thành phẩm nào.`);
      return;
    }
    if (ds.length > 1) {
      notify.canhBao(`Mã "${text.trim()}" trùng ${ds.length} lô — quét QR trên tem thay vì gõ mã.`);
      return;
    }
    const wip = wips.find((x) => x.id === ds[0]!.id);
    if (!wip) return;
    setTypedCode("");
    if (wip.status !== "cho-nhap") {
      notify.canhBao(`Lô ${ds[0]!.nhan} đã nhập kho${wip.warehouse ? ` ${wip.warehouse}` : ""} rồi.`);
      return;
    }
    setIsScanning(false);
    openApprove(wip);
  };

  // Link từ /qr "Theo giai đoạn" (`?duyet=W:<id>`) ⇒ mở thẳng hộp duyệt của đúng mẻ,
  // như quét tem. Xử lý một lần khi dữ liệu đã nạp rồi gỡ tham số khỏi link.
  const [searchParams, setSearchParams] = useSearchParams();
  const approveParam = searchParams.get("duyet");
  useEffect(() => {
    if (!approveParam || wips.length === 0) return;
    approveByLabel(approveParam);
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi link mang mã và sổ SX đã nạp
  }, [approveParam, wips.length]);

  const saveApproval = () => {
    if (!approval) return;
    const ls: LoiNhap[] = [];
    if (!approval.warehouse.trim()) ls.push({ truong: "Kho", thongBao: "Chưa chọn kho" });
    if (!(approval.luongThuc > 0))
      ls.push({ truong: "Lượng thực", thongBao: "Phải lớn hơn 0 kg" });
    setLoi(ls);
    if (ls.length > 0) return;
    const goc = wips.find((s) => s.id === approval.wipId);
    const lech = goc ? approval.luongThuc - goc.quantityKg : 0;
    persistWips(
      wips.map((s) =>
        s.id === approval.wipId
          ? {
              ...s,
              warehouse: approval.warehouse,
              quantityKg: approval.luongThuc,
              blocksCount: approval.blockThuc,
              status: "da-nhap",
              note: approval.note || s.note,
            }
          : s
      )
    );
    notify.daLuu(
      `Đã nhập kho ${approval.warehouse} — ${kg(approval.luongThuc)}` +
        (lech ? ` (lệch ${lech > 0 ? "+" : ""}${num(lech)} kg)` : "")
    );
    setApproval(null);
  };

  const stockColumns: Cot<LoTon>[] = [
    {
      key: "mh",
      header: "Mặt hàng",
      chinh: true,
      render: (r) => tenMH(r.productId),
      sapXep: (r) => tenMH(r.productId),
    },
    { key: "kho", header: "Kho", render: (r) => <Nhan loai="phan-loai" sac={sacTheoTen(r.warehouse)}>{r.warehouse || "—"}</Nhan>, sapXep: (r) => r.warehouse },
    {
      key: "lo",
      header: "Lô (ngày SX)",
      render: (r) => viDate(r.ngaySX),
      sapXep: (r) => r.ngaySX,
    },
    { key: "con", header: "Còn (kg)", so: true, render: (r) => num(r.conLai), sapXep: (r) => r.conLai },
    { key: "blk", header: "Block", so: true, render: (r) => num(r.blockConLai) },
    {
      key: "nx",
      header: "Nhập / xuất",
      render: (r) => (
        <span className="tnum text-muted-foreground">
          {num(r.luongNhap)} / {num(r.luongXuat)}
        </span>
      ),
    },
  ];

  const approvalSource = approval
    ? wips.find((s) => s.id === approval.wipId)
    : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Kho dự trữ đông</h1>
      </div>

      <ThongKe
        className="grid-cols-2 lg:grid-cols-4"
        the={[
          { nhan: "Đang xem", giaTri: "Tồn hiện tại", icon: CalendarRange, mau: "trung-tinh" },
          { nhan: "Chờ nhập", giaTri: pendingIntake.length, so: true, icon: Warehouse, mau: "trung-tinh" },
          { nhan: "Số lô hàng", giaTri: filteredStock.length, so: true, icon: ClipboardList, mau: "brand" },
          { nhan: "Tổng tồn", giaTri: kg(totalStock), so: true, icon: Scale, mau: "success" },
        ]}
      />

      {tongBanVuot > 0 && (
        <div role="status" className="flex items-start gap-3 rounded-lg bg-warning-surface px-4 py-3 text-base text-warning">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <span>
            Bán vượt <span className="tnum font-semibold">{kg(tongBanVuot)}</span> so với tồn —{" "}
            {banVuot
              .map((v) => `${tenMH(v.productId)}${v.spec ? ` (${v.spec})` : ""} ${kg(v.kg)}`)
              .join(" · ")}
            . Kiểm lại phiếu bán / đóng gói, hoặc duyệt nhập kho mẻ còn chờ.
          </span>
        </div>
      )}

      {/* Hàng nằm kho bao lâu — đẩy lô cũ trước (FIFO). */}
      {totalStock > 0 && (
        <section className="space-y-3 rounded-xl border-2 border-border bg-card p-4">
          <h2 className="text-lg font-semibold text-foreground">Hàng nằm kho bao lâu</h2>
          <p className="text-sm text-muted-foreground">
            Tồn {warehouseFilter ? `kho ${warehouseFilter}` : "mọi kho"} chia theo số ngày từ ngày sản xuất tới hôm nay. Phần nằm lâu nên xuất trước.
          </p>
          <ThanhChiaPhan
            moTa="Tồn kho chia theo số ngày nằm kho"
            phan={nhomTuoi.map((g) => ({
              khoa: g.khoa,
              nhan: g.nhan,
              moTa: `${num(g.soLo)} lô`,
              giaTri: g.kg,
              sac: ({ "duoi-30": "la", "30-60": "cat", "60-90": "cam", "tren-90": "hong" } as const)[g.khoa],
            }))}
          />
        </section>
      )}

      {/* Dung tích & Tải trọng 5 Kho BSF1 */}
      <div className="rounded-xl border-2 border-border p-4 bg-card space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground">
          <Warehouse className="w-5 h-5 text-primary" />
          Dung tích & Tải trọng Kho BSF1
        </h2>
        {/* auto-fill theo CHỖ TRỐNG thật (không theo bề rộng màn): trừ thanh bên, lg:grid-cols-5
            từng ép 5 thẻ ~114px ⇒ nhãn xưởng bị cắt chữ. Mỗi thẻ tối thiểu 11rem. */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(11rem,100%),1fr))] gap-4">
          {warehouseCapacity.map((item) => (
            <div
              key={item.warehouse.id}
              className={`rounded-lg border p-3 flex flex-col justify-between transition-colors ${
                item.isOverCapacity
                  ? "border-destructive bg-destructive/10"
                  : warehouseFilter === item.warehouse.name
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background"
              }`}
            >
              <div>
                {/* flex-wrap: thẻ hẹp thì nhãn xưởng xuống dòng thay vì bị ép cắt chữ. */}
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="min-w-0 font-semibold text-sm text-foreground">{item.warehouse.name}</span>
                  {item.warehouse.type === "xi-nghiep" ? (
                    <Nhan loai="phan-loai" sac={sacTheoTen("Kho lớn")}>Kho lớn</Nhan>
                  ) : (
                    <Nhan loai="phan-loai" sac={sacXuong(item.warehouse.workshop)}>
                      {`Xưởng ${item.warehouse.workshop}`}
                    </Nhan>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Sức chứa: <span className="font-medium tnum">{num(item.warehouse.capacityKg / 1000)}</span> tấn
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-xs font-semibold tnum">
                  <span>{num(item.currentKg)} kg</span>
                  <span className={item.isOverCapacity ? "text-destructive font-bold" : "text-muted-foreground"}>
                    {item.percentage}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      item.isOverCapacity
                        ? "bg-destructive"
                        : item.percentage > 85
                        ? "bg-warning"
                        : "bg-primary"
                    }`}
                    style={{ width: `${Math.min(100, item.percentage)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Khối chờ nhập — lời mời duyệt (không coi rỗng khi còn lô chờ) */}
      {pendingIntake.length > 0 && (
        <div className="space-y-4 rounded-xl border-2 border-primary/40 bg-accent/40 p-4">
          <p className="text-base font-semibold text-foreground">
            Có {pendingIntake.length} lô sản xuất chờ nhập kho — duyệt để tính vào tồn
          </p>
          {/* Quét tem lô BTP trên block ⇒ mở đúng hộp duyệt. Gõ mã khi tem bong / không có camera. */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Button
              title={isScanning ? "Tắt camera." : "Bật camera quét tem QR trên block để mở đúng lô cần duyệt nhập kho."}
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setIsScanning((v) => !v)}
            >
              {isScanning ? <CameraOff /> : <Camera />}
              {isScanning ? "Tắt camera" : "Quét tem để duyệt"}
            </Button>
            <Field label="Hoặc gõ mã lô trên tem" className="min-w-0 flex-1">
              <Input
                value={typedCode}
                onChange={(e) => setTypedCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && approveByLabel(typedCode)}
              />
            </Field>
            <Button title="Tìm lô theo mã vừa gõ rồi mở hộp duyệt nhập kho." variant="outline" className="w-full sm:w-auto" onClick={() => approveByLabel(typedCode)}>
              <Search />
              Tìm lô
            </Button>
          </div>
          {isScanning && <KhungQuetQr onQuet={approveByLabel} />}
          <ul className="divide-y divide-border">
            {pendingIntake.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2"
              >
                <span className="min-w-0 flex-1 text-base">
                  <span className="tnum mr-2 font-semibold">{nhanLoBtp(s)}</span>
                  {tenMH(s.productId)}
                  {s.spec ? ` · ${s.spec}` : ""} —{" "}
                  <span className="tnum font-semibold">{num(s.quantityKg)}</span> kg
                  <span className="text-muted-foreground">
                    {" "}
                    · SX {viDate(s.productionDate)} · xưởng {s.workshop}
                  </span>
                </span>
                <Button
                  title="Duyệt lô bán thành phẩm này từ trạng thái chờ sang đã nhập kho, để tính vào tồn dự trữ." size="sm" onClick={() => openApprove(s)}>
                  <PackageCheck />
                  Duyệt nhập kho
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-4 rounded-xl border-2 border-border p-4">
        <Combobox
          label="Lọc theo kho"
          anNhanBatBuoc
          value={warehouseFilter}
          onChange={setWarehouseFilter}
          options={warehouseOptions}
          placeholder="Tất cả kho"
          className="min-w-[220px]"
        />
      </div>

      {isLoading ? (
        <SkeletonBang />
      ) : filteredStock.length === 0 ? (
        <EmptyState
          icon={Snowflake}
          tieuDe="Chưa có tồn trong kho"
          moTa={
            pendingIntake.length > 0
              ? "Duyệt các lô chờ nhập ở trên để tồn hiện ra."
              : "Ghi sản lượng ở màn Sản xuất BTP rồi duyệt vào kho."
          }
        />
      ) : (
        <>
          <RecordTable
            columns={stockColumns}
            rows={filteredStock}
            getKey={(r) => r.wipId}
            toMau="kho-du-tru"
            timKiem={(r) => `${tenMH(r.productId)} ${r.spec} ${r.warehouse}`}
            nhanTimKiem="Tìm theo mặt hàng / quy cách / kho…"
          />
          <div className="flex justify-end rounded-xl bg-muted px-5 py-4">
            <div className="flex items-baseline gap-3">
              <span className="text-base text-muted-foreground">Tổng tồn</span>
              <span className="tnum text-xl font-semibold">{kg(totalStock)}</span>
            </div>
          </div>
        </>
      )}

      {/* Dialog duyệt nhập kho */}
      <Dialog open={approval !== null} onOpenChange={(o) => !o && setApproval(null)}>
        <DialogContent className="w-full sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Duyệt nhập kho</DialogTitle>
            <DialogDescription className="text-base">
              {approvalSource
                ? `${tenMH(approvalSource.productId)}${approvalSource.spec ? ` · ${approvalSource.spec}` : ""} — SX ${viDate(approvalSource.productionDate)}. Đối chiếu kg/block thực, chọn kho.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {approval && (
            <div className="space-y-6 py-2">
              <ErrorSummary loi={loi} />
              <ChuThichBatBuoc />
              <Combobox
                label="Kho (phòng đông)"
                required
                value={approval.warehouse}
                onChange={(v) => setApproval((d) => (d ? { ...d, warehouse: v } : d))}
                options={warehouseOptions}
                onCreate={(t) => t}
                hint="Chọn phòng đông. Gõ tên mới rồi Thêm nếu chưa có."
              />
              <div className="grid gap-6 sm:grid-cols-2">
                <NumberField
                  label="Khối lượng thực"
                  required
                  unit="kg"
                  value={approval.luongThuc || null}
                  onChange={(v) =>
                    setApproval((d) => (d ? { ...d, luongThuc: v ?? 0 } : d))
                  }
                />
                <NumberField
                  label="Block thực"
                  unit="block"
                  value={approval.blockThuc || null}
                  onChange={(v) =>
                    setApproval((d) => (d ? { ...d, blockThuc: v ?? 0 } : d))
                  }
                />
              </div>
              {approvalSource && approval.luongThuc !== approvalSource.quantityKg && (
                <p className="rounded-lg bg-accent px-4 py-3 text-base text-accent-foreground">
                  Lệch so ghi sản lượng:{" "}
                  <span className="tnum font-semibold">
                    {approval.luongThuc - approvalSource.quantityKg > 0 ? "+" : ""}
                    {num(approval.luongThuc - approvalSource.quantityKg)} kg
                  </span>{" "}
                  — ghi rõ lý do ở ghi chú.
                </p>
              )}
              <Field label="Ghi chú (lý do lệch, nếu có)">
                <Input
                  value={approval.note}
                  onChange={(e) =>
                    setApproval((d) => (d ? { ...d, note: e.target.value } : d))
                  }
                  placeholder="VD: hao khi cấp đông"
                />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setApproval(null)}>
              Hủy
            </Button>
            <Button
              title="Xác nhận cho lô này vào kho dự trữ — từ đây mới xuất bán hoặc đóng gói được." size="lg" onClick={saveApproval}>
              <PackageCheck />
              Xác nhận nhập kho
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
