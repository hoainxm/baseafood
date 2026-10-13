// ============================================================
// Tên file cũ: src/features/warehouse/KhoDuTru.tsx
// Tên tiếng Việt: Màn hình Kho cấp đông dự trữ BSF1
// Description: Cold Storage Reserve Warehouse Management Screen
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { WipProductionItem } from "@/types";
import { useExportItems, useLotDispatches, useLotInputs, usePackagings, useProducts, useSalesItems, useWipProductions } from "@/lib/catalogRepo";
import { computeWipStockDetail, collectWipDeductions, type LotStock } from "@/lib/inventory";
import { bucketStockByAge } from "@/lib/dataFlow";
import {
  RequiredLegend,
  Button,
  Combobox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  TableSkeleton,
  ErrorSummary,
  Field,
  Input,
  Tag,
  NumberField,
  RecordTable,
  toneByName,
  toneForWorkshop,
  StatCardGrid,
  notify,
  type RecordTableColumn,
  type FieldError,
  type ComboboxOption,
  ProportionBar,
  todayIso,
} from "@/design-system";
import { kg, num, formatDateVN } from "@/lib/format";
import { AlertTriangle, CalendarRange, Camera, CameraOff, ClipboardList, PackageCheck, Scale, Search, Snowflake, Warehouse } from "lucide-react";
import { QrScanner } from "@/features/shared";
import { parseQrCode, formatWipLotLabel, findLots } from "@/lib/lotTraceability";

import { BSF1_WAREHOUSES } from "@/types";
import { computeWarehouseOccupancy } from "@/lib/inventory";
import { readParam } from "@/lib/legacyUrls";

const BSF1_WAREHOUSE_NAMES = BSF1_WAREHOUSES.map((w) => w.name);

interface ApprovalForm {
  wipId: string;
  warehouse: string;
  actualKg: number;
  actualBlocks: number;
  note: string;
}

export default function ReserveWarehouseScreen() {
  const [wips, persistWips, { trangThai: status }] = useWipProductions();
  const isLoading = status === "dang-tai" && wips.length === 0;
  const [exportItems] = useExportItems();
  const [products] = useProducts();
  const [salesItems] = useSalesItems();
  const [packagings] = usePackagings();
  const [lotInputs] = useLotInputs();
  const [lotDispatches] = useLotDispatches();
  // Trừ đúng lô đã gắn (truy xuất QR), phần còn lại FIFO — cùng con số với hộ chiếu lô.
  const retailSales = useMemo(
    () => collectWipDeductions(salesItems, packagings, lotInputs, lotDispatches),
    [salesItems, packagings, lotInputs, lotDispatches]
  );

  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [approval, setApproval] = useState<ApprovalForm | null>(null);
  const [loi, setLoi] = useState<FieldError[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [typedCode, setTypedCode] = useState("");

  const productNameOf = (id: string) => products.find((m) => m.id === id)?.name || "—";

  const pendingIntake = useMemo(
    () => wips.filter((s) => s.status === "cho-nhap"),
    [wips]
  );
  // Bán lẻ / đóng gói vượt số đang trữ: lô không xuống âm nên phần vượt không nằm
  // trong "Tổng tồn" — phải gọi tên ra, không được nuốt (lỗi ghi chép cần dò).
  const { los: lotStock, banVuot: oversales, tongBanVuot: totalOversold } = useMemo(
    () => computeWipStockDetail(wips, exportItems, retailSales),
    [wips, exportItems, retailSales]
  );
  const warehouseCapacity = useMemo(() => computeWarehouseOccupancy(lotStock), [lotStock]);

  const warehouseList = useMemo(() => {
    const set = new Set<string>(BSF1_WAREHOUSE_NAMES);
    for (const s of wips) if (s.warehouse) set.add(s.warehouse);
    return [...set];
  }, [wips]);
  const warehouseOptions: ComboboxOption[] = warehouseList.map((k) => {
    const wh = BSF1_WAREHOUSES.find((w) => w.name === k);
    return {
      value: k,
      label: wh ? `${wh.name} (${num(wh.capacityKg / 1000)} tấn)` : k,
    };
  });

  const filteredStock = useMemo(
    () => lotStock.filter((t) => (!warehouseFilter || t.warehouse === warehouseFilter) && t.conLai > 0),
    [lotStock, warehouseFilter]
  );
  const totalStock = filteredStock.reduce((s, t) => s + t.conLai, 0);
  const nhomTuoi = useMemo(() => bucketStockByAge(filteredStock, todayIso()), [filteredStock]);

  const openApprove = (s: WipProductionItem) => {
    setApproval({
      wipId: s.id,
      warehouse: s.warehouse || BSF1_WAREHOUSE_NAMES[0],
      actualKg: s.quantityKg,
      actualBlocks: s.blocksCount,
      note: "",
    });
    setLoi([]);
  };

  /**
   * Quét / gõ tem lô BTP ⇒ mở thẳng hộp duyệt của đúng mẻ đó (đợt 2 truy xuất QR).
   * Thủ kho cầm block nào quét block đó — khỏi dò danh sách, khỏi duyệt nhầm mẻ.
   */
  const approveByLabel = (text: string) => {
    const ma = parseQrCode(text);
    if (!ma) return;
    const items = findLots(ma, {
      shipments: [], imports: [], wips, packagings: [], lotInputs: [],
      exportItems: [], exportOrders: [], salesOrders: [], products, customers: [],
    }).filter((n) => n.kind === "W");
    if (items.length === 0) {
      notify.warning(`"${text.trim()}" không phải tem lô bán thành phẩm nào.`);
      return;
    }
    if (items.length > 1) {
      notify.warning(`Mã "${text.trim()}" trùng ${items.length} lô — quét QR trên tem thay vì gõ mã.`);
      return;
    }
    const wip = wips.find((x) => x.id === items[0]!.id);
    if (!wip) return;
    setTypedCode("");
    if (wip.status !== "cho-nhap") {
      notify.warning(`Lô ${items[0]!.nhan} đã nhập kho${wip.warehouse ? ` ${wip.warehouse}` : ""} rồi.`);
      return;
    }
    setIsScanning(false);
    openApprove(wip);
  };

  // Link từ /qr "Theo giai đoạn" (`?approve=W:<id>`; link cũ `?duyet=`) ⇒ mở thẳng hộp duyệt của đúng mẻ,
  // như quét tem. Xử lý một lần khi dữ liệu đã nạp rồi gỡ tham số khỏi link.
  const [searchParams, setSearchParams] = useSearchParams();
  const approveParam = readParam(searchParams, "approve");
  useEffect(() => {
    if (!approveParam || wips.length === 0) return;
    approveByLabel(approveParam);
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi link mang mã và sổ SX đã nạp
  }, [approveParam, wips.length]);

  const saveApproval = () => {
    if (!approval) return;
    const ls: FieldError[] = [];
    if (!approval.warehouse.trim()) ls.push({ field: "Kho", message: "Chưa chọn kho" });
    if (!(approval.actualKg > 0))
      ls.push({ field: "Lượng thực", message: "Phải lớn hơn 0 kg" });
    setLoi(ls);
    if (ls.length > 0) return;
    const original = wips.find((s) => s.id === approval.wipId);
    const diff = original ? approval.actualKg - original.quantityKg : 0;
    persistWips(
      wips.map((s) =>
        s.id === approval.wipId
          ? {
              ...s,
              warehouse: approval.warehouse,
              quantityKg: approval.actualKg,
              blocksCount: approval.actualBlocks,
              status: "da-nhap",
              note: approval.note || s.note,
            }
          : s
      )
    );
    notify.saved(
      `Đã nhập kho ${approval.warehouse} — ${kg(approval.actualKg)}` +
        (diff ? ` (lệch ${diff > 0 ? "+" : ""}${num(diff)} kg)` : "")
    );
    setApproval(null);
  };

  const stockColumns: RecordTableColumn<LotStock>[] = [
    {
      key: "mh",
      header: "Mặt hàng",
      primary: true,
      render: (r) => productNameOf(r.productId),
      getSortValue: (r) => productNameOf(r.productId),
    },
    { key: "kho", header: "Kho", render: (r) => <Tag variant="phan-loai" tone={toneByName(r.warehouse)}>{r.warehouse || "—"}</Tag>, getSortValue: (r) => r.warehouse },
    {
      key: "lo",
      header: "Lô (ngày SX)",
      render: (r) => formatDateVN(r.ngaySX),
      getSortValue: (r) => r.ngaySX,
    },
    { key: "con", header: "Còn (kg)", numeric: true, render: (r) => num(r.conLai), getSortValue: (r) => r.conLai },
    { key: "blk", header: "Block", numeric: true, render: (r) => num(r.blockConLai) },
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

      <StatCardGrid
        className="grid-cols-2 lg:grid-cols-4"
        cards={[
          { label: "Đang xem", value: "Tồn hiện tại", icon: CalendarRange, color: "trung-tinh" },
          { label: "Chờ nhập", value: pendingIntake.length, numeric: true, icon: Warehouse, color: "trung-tinh" },
          { label: "Số lô hàng", value: filteredStock.length, numeric: true, icon: ClipboardList, color: "brand" },
          { label: "Tổng tồn", value: kg(totalStock), numeric: true, icon: Scale, color: "success" },
        ]}
      />

      {totalOversold > 0 && (
        <div role="status" className="flex items-start gap-3 rounded-lg bg-warning-surface px-4 py-3 text-base text-warning">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <span>
            Bán vượt <span className="tnum font-semibold">{kg(totalOversold)}</span> so với tồn —{" "}
            {oversales
              .map((v) => `${productNameOf(v.productId)}${v.spec ? ` (${v.spec})` : ""} ${kg(v.kg)}`)
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
          <ProportionBar
            description="Tồn kho chia theo số ngày nằm kho"
            segments={nhomTuoi.map((g) => ({
              id: g.khoa,
              label: g.nhan,
              description: `${num(g.soLo)} lô`,
              value: g.kg,
              tone: ({ "duoi-30": "la", "30-60": "cat", "60-90": "cam", "tren-90": "hong" } as const)[g.khoa],
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
                    <Tag variant="phan-loai" tone={toneByName("Kho lớn")}>Kho lớn</Tag>
                  ) : (
                    <Tag variant="phan-loai" tone={toneForWorkshop(item.warehouse.workshop)}>
                      {`Xưởng ${item.warehouse.workshop}`}
                    </Tag>
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
          {isScanning && <QrScanner onScan={approveByLabel} />}
          <ul className="divide-y divide-border">
            {pendingIntake.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2"
              >
                <span className="min-w-0 flex-1 text-base">
                  <span className="tnum mr-2 font-semibold">{formatWipLotLabel(s)}</span>
                  {productNameOf(s.productId)}
                  {s.spec ? ` · ${s.spec}` : ""} —{" "}
                  <span className="tnum font-semibold">{num(s.quantityKg)}</span> kg
                  <span className="text-muted-foreground">
                    {" "}
                    · SX {formatDateVN(s.productionDate)} · xưởng {s.workshop}
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
          hideRequiredMark
          value={warehouseFilter}
          onChange={setWarehouseFilter}
          options={warehouseOptions}
          placeholder="Tất cả kho"
          className="min-w-[220px]"
        />
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : filteredStock.length === 0 ? (
        <EmptyState
          icon={Snowflake}
          title="Chưa có tồn trong kho"
          description={
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
            rowMarkKey="kho-du-tru"
            getSearchText={(r) => `${productNameOf(r.productId)} ${r.spec} ${r.warehouse}`}
            searchLabel="Tìm theo mặt hàng / quy cách / kho…"
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
                ? `${productNameOf(approvalSource.productId)}${approvalSource.spec ? ` · ${approvalSource.spec}` : ""} — SX ${formatDateVN(approvalSource.productionDate)}. Đối chiếu kg/block thực, chọn kho.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {approval && (
            <div className="space-y-6 py-2">
              <ErrorSummary errors={loi} />
              <RequiredLegend />
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
                  value={approval.actualKg || null}
                  onChange={(v) =>
                    setApproval((d) => (d ? { ...d, actualKg: v ?? 0 } : d))
                  }
                />
                <NumberField
                  label="Block thực"
                  unit="block"
                  value={approval.actualBlocks || null}
                  onChange={(v) =>
                    setApproval((d) => (d ? { ...d, actualBlocks: v ?? 0 } : d))
                  }
                />
              </div>
              {approvalSource && approval.actualKg !== approvalSource.quantityKg && (
                <p className="rounded-lg bg-accent px-4 py-3 text-base text-accent-foreground">
                  Lệch so ghi sản lượng:{" "}
                  <span className="tnum font-semibold">
                    {approval.actualKg - approvalSource.quantityKg > 0 ? "+" : ""}
                    {num(approval.actualKg - approvalSource.quantityKg)} kg
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
