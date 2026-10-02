// ============================================================
// Tên file cũ: src/features/warehouse/KhoDuTru.tsx
// Tên tiếng Việt: Màn hình Kho cấp đông dự trữ BSF1
// Description: Cold Storage Reserve Warehouse Management Screen
// ============================================================
import { useMemo, useState } from "react";
import type { WipProductionItem } from "@/types";
import { useExportItems, usePackagings, useProducts, useSalesItems, useWipProductions } from "@/lib/catalogRepo";
import { tinhTon, locBanLe, dongGoiTruTon, type LoTon } from "@/lib/inventory";
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
} from "@/design-system";
import { kg, num, viDate } from "@/lib/format";
import { CalendarRange, Camera, CameraOff, ClipboardList, PackageCheck, Scale, Search, Snowflake, Warehouse } from "lucide-react";
import { KhungQuetQr } from "@/features/shared";
import { docMaQr, nhanLoBtp, timLo } from "@/lib/truyXuatLo";

import { BSF1_WAREHOUSES } from "@/types";
import { tinhDungTichKho } from "@/lib/inventory";

const KHO_BSF1_NAMES = BSF1_WAREHOUSES.map((w) => w.name);

interface DuyetForm {
  wipId: string;
  warehouse: string;
  luongThuc: number;
  blockThuc: number;
  note: string;
}

export default function KhoDuTruScreen() {
  const [sanXuat, persistSX, { trangThai }] = useWipProductions();
  const dangTai = trangThai === "dang-tai" && sanXuat.length === 0;
  const [dongLenh] = useExportItems();
  const [matHang] = useProducts();
  const [banHang] = useSalesItems();
  const [packagings] = usePackagings();
  const banLe = useMemo(
    () => [...locBanLe(banHang), ...dongGoiTruTon(packagings)],
    [banHang, packagings]
  );

  const [locKho, setLocKho] = useState("");
  const [duyet, setDuyet] = useState<DuyetForm | null>(null);
  const [loi, setLoi] = useState<LoiNhap[]>([]);
  const [dangQuet, setDangQuet] = useState(false);
  const [maGo, setMaGo] = useState("");

  const tenMH = (id: string) => matHang.find((m) => m.id === id)?.name || "—";

  const choNhap = useMemo(
    () => sanXuat.filter((s) => s.status === "cho-nhap"),
    [sanXuat]
  );
  const ton = useMemo(() => tinhTon(sanXuat, dongLenh, banLe), [sanXuat, dongLenh, banLe]);
  const dungTichKho = useMemo(() => tinhDungTichKho(ton), [ton]);

  const dsKho = useMemo(() => {
    const set = new Set<string>(KHO_BSF1_NAMES);
    for (const s of sanXuat) if (s.warehouse) set.add(s.warehouse);
    return [...set];
  }, [sanXuat]);
  const optKho: MucChon[] = dsKho.map((k) => {
    const wh = BSF1_WAREHOUSES.find((w) => w.name === k);
    return {
      value: k,
      label: wh ? `${wh.name} (${num(wh.capacityKg / 1000)} tấn)` : k,
    };
  });

  const tonLoc = useMemo(
    () => ton.filter((t) => (!locKho || t.warehouse === locKho) && t.conLai > 0),
    [ton, locKho]
  );
  const tongTon = tonLoc.reduce((s, t) => s + t.conLai, 0);

  const moDuyet = (s: WipProductionItem) => {
    setDuyet({
      wipId: s.id,
      warehouse: s.warehouse || KHO_BSF1_NAMES[0],
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
  const duyetTheoTem = (text: string) => {
    const ma = docMaQr(text);
    if (!ma) return;
    const ds = timLo(ma, {
      shipments: [], imports: [], wips: sanXuat, packagings: [], lotInputs: [],
      exportItems: [], exportOrders: [], salesOrders: [], products: matHang, customers: [],
    }).filter((n) => n.kind === "W");
    if (ds.length === 0) {
      notify.canhBao(`"${text.trim()}" không phải tem lô bán thành phẩm nào.`);
      return;
    }
    if (ds.length > 1) {
      notify.canhBao(`Mã "${text.trim()}" trùng ${ds.length} lô — quét QR trên tem thay vì gõ mã.`);
      return;
    }
    const wip = sanXuat.find((x) => x.id === ds[0]!.id);
    if (!wip) return;
    setMaGo("");
    if (wip.status !== "cho-nhap") {
      notify.canhBao(`Lô ${ds[0]!.nhan} đã nhập kho${wip.warehouse ? ` ${wip.warehouse}` : ""} rồi.`);
      return;
    }
    setDangQuet(false);
    moDuyet(wip);
  };

  const luuDuyet = () => {
    if (!duyet) return;
    const ls: LoiNhap[] = [];
    if (!duyet.warehouse.trim()) ls.push({ truong: "Kho", thongBao: "Chưa chọn kho" });
    if (!(duyet.luongThuc > 0))
      ls.push({ truong: "Lượng thực", thongBao: "Phải lớn hơn 0 kg" });
    setLoi(ls);
    if (ls.length > 0) return;
    const goc = sanXuat.find((s) => s.id === duyet.wipId);
    const lech = goc ? duyet.luongThuc - goc.quantityKg : 0;
    persistSX(
      sanXuat.map((s) =>
        s.id === duyet.wipId
          ? {
              ...s,
              warehouse: duyet.warehouse,
              quantityKg: duyet.luongThuc,
              blocksCount: duyet.blockThuc,
              status: "da-nhap",
              note: duyet.note || s.note,
            }
          : s
      )
    );
    notify.daLuu(
      `Đã nhập kho ${duyet.warehouse} — ${kg(duyet.luongThuc)}` +
        (lech ? ` (lệch ${lech > 0 ? "+" : ""}${num(lech)} kg)` : "")
    );
    setDuyet(null);
  };

  const colsTon: Cot<LoTon>[] = [
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

  const duyetGoc = duyet
    ? sanXuat.find((s) => s.id === duyet.wipId)
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
          { nhan: "Chờ nhập", giaTri: choNhap.length, so: true, icon: Warehouse, mau: "trung-tinh" },
          { nhan: "Số lô hàng", giaTri: tonLoc.length, so: true, icon: ClipboardList, mau: "brand" },
          { nhan: "Tổng tồn", giaTri: kg(tongTon), so: true, icon: Scale, mau: "success" },
        ]}
      />

      {/* Dung tích & Tải trọng 5 Kho BSF1 */}
      <div className="rounded-xl border-2 border-border p-4 bg-card space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground">
          <Warehouse className="w-5 h-5 text-primary" />
          Dung tích & Tải trọng Kho BSF1
        </h2>
        {/* auto-fill theo CHỖ TRỐNG thật (không theo bề rộng màn): trừ thanh bên, lg:grid-cols-5
            từng ép 5 thẻ ~114px ⇒ nhãn xưởng bị cắt chữ. Mỗi thẻ tối thiểu 11rem. */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(11rem,100%),1fr))] gap-4">
          {dungTichKho.map((item) => (
            <div
              key={item.warehouse.id}
              className={`rounded-lg border p-3 flex flex-col justify-between transition-colors ${
                item.isOverCapacity
                  ? "border-destructive bg-destructive/10"
                  : locKho === item.warehouse.name
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
      {choNhap.length > 0 && (
        <div className="space-y-4 rounded-xl border-2 border-primary/40 bg-accent/40 p-4">
          <p className="text-base font-semibold text-foreground">
            Có {choNhap.length} lô sản xuất chờ nhập kho — duyệt để tính vào tồn
          </p>
          {/* Quét tem lô BTP trên block ⇒ mở đúng hộp duyệt. Gõ mã khi tem bong / không có camera. */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Button
              title={dangQuet ? "Tắt camera." : "Bật camera quét tem QR trên block để mở đúng lô cần duyệt nhập kho."}
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setDangQuet((v) => !v)}
            >
              {dangQuet ? <CameraOff /> : <Camera />}
              {dangQuet ? "Tắt camera" : "Quét tem để duyệt"}
            </Button>
            <Field label="Hoặc gõ mã lô trên tem" className="min-w-0 flex-1">
              <Input
                value={maGo}
                onChange={(e) => setMaGo(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && duyetTheoTem(maGo)}
              />
            </Field>
            <Button title="Tìm lô theo mã vừa gõ rồi mở hộp duyệt nhập kho." variant="outline" className="w-full sm:w-auto" onClick={() => duyetTheoTem(maGo)}>
              <Search />
              Tìm lô
            </Button>
          </div>
          {dangQuet && <KhungQuetQr onQuet={duyetTheoTem} />}
          <ul className="divide-y divide-border">
            {choNhap.map((s) => (
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
                  title="Duyệt lô bán thành phẩm này từ trạng thái chờ sang đã nhập kho, để tính vào tồn dự trữ." size="sm" onClick={() => moDuyet(s)}>
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
          value={locKho}
          onChange={setLocKho}
          options={optKho}
          placeholder="Tất cả kho"
          className="min-w-[220px]"
        />
      </div>

      {dangTai ? (
        <SkeletonBang />
      ) : tonLoc.length === 0 ? (
        <EmptyState
          icon={Snowflake}
          tieuDe="Chưa có tồn trong kho"
          moTa={
            choNhap.length > 0
              ? "Duyệt các lô chờ nhập ở trên để tồn hiện ra."
              : "Ghi sản lượng ở màn Sản xuất BTP rồi duyệt vào kho."
          }
        />
      ) : (
        <>
          <RecordTable
            columns={colsTon}
            rows={tonLoc}
            getKey={(r) => r.wipId}
            timKiem={(r) => `${tenMH(r.productId)} ${r.spec} ${r.warehouse}`}
            nhanTimKiem="Tìm theo mặt hàng / quy cách / kho…"
          />
          <div className="flex justify-end rounded-xl bg-muted px-5 py-4">
            <div className="flex items-baseline gap-3">
              <span className="text-base text-muted-foreground">Tổng tồn</span>
              <span className="tnum text-xl font-semibold">{kg(tongTon)}</span>
            </div>
          </div>
        </>
      )}

      {/* Dialog duyệt nhập kho */}
      <Dialog open={duyet !== null} onOpenChange={(o) => !o && setDuyet(null)}>
        <DialogContent className="w-full sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Duyệt nhập kho</DialogTitle>
            <DialogDescription className="text-base">
              {duyetGoc
                ? `${tenMH(duyetGoc.productId)}${duyetGoc.spec ? ` · ${duyetGoc.spec}` : ""} — SX ${viDate(duyetGoc.productionDate)}. Đối chiếu kg/block thực, chọn kho.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {duyet && (
            <div className="space-y-6 py-2">
              <ErrorSummary loi={loi} />
              <ChuThichBatBuoc />
              <Combobox
                label="Kho (phòng đông)"
                required
                value={duyet.warehouse}
                onChange={(v) => setDuyet((d) => (d ? { ...d, warehouse: v } : d))}
                options={optKho}
                onCreate={(t) => t}
                hint="Chọn phòng đông. Gõ tên mới rồi Thêm nếu chưa có."
              />
              <div className="grid gap-6 sm:grid-cols-2">
                <NumberField
                  label="Khối lượng thực"
                  required
                  unit="kg"
                  value={duyet.luongThuc || null}
                  onChange={(v) =>
                    setDuyet((d) => (d ? { ...d, luongThuc: v ?? 0 } : d))
                  }
                />
                <NumberField
                  label="Block thực"
                  unit="block"
                  value={duyet.blockThuc || null}
                  onChange={(v) =>
                    setDuyet((d) => (d ? { ...d, blockThuc: v ?? 0 } : d))
                  }
                />
              </div>
              {duyetGoc && duyet.luongThuc !== duyetGoc.quantityKg && (
                <p className="rounded-lg bg-accent px-4 py-3 text-base text-accent-foreground">
                  Lệch so ghi sản lượng:{" "}
                  <span className="tnum font-semibold">
                    {duyet.luongThuc - duyetGoc.quantityKg > 0 ? "+" : ""}
                    {num(duyet.luongThuc - duyetGoc.quantityKg)} kg
                  </span>{" "}
                  — ghi rõ lý do ở ghi chú.
                </p>
              )}
              <Field label="Ghi chú (lý do lệch, nếu có)">
                <Input
                  value={duyet.note}
                  onChange={(e) =>
                    setDuyet((d) => (d ? { ...d, note: e.target.value } : d))
                  }
                  placeholder="VD: hao khi cấp đông"
                />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setDuyet(null)}>
              Hủy
            </Button>
            <Button
              title="Xác nhận cho lô này vào kho dự trữ — từ đây mới xuất bán hoặc đóng gói được." size="lg" onClick={luuDuyet}>
              <PackageCheck />
              Xác nhận nhập kho
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
