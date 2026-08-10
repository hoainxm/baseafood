import { useMemo, useState } from "react";
import type { WipProductionItem } from "@/types";
import { useExportItems, useProducts, useWipProductions } from "@/lib/danhMuc";
import { tinhTon, type LoTon } from "@/lib/kho";
import {
  Badge,
  Button,
  Combobox,
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
  ThongKe,
  notify,
  type Cot,
  type LoiNhap,
  type MucChon,
} from "@/design-system";
import { kg, num, viDate } from "@/lib/format";
import { CalendarRange, ClipboardList, PackageCheck, Scale, Snowflake, Warehouse } from "lucide-react";

const KHO_GOI_Y = ["Kho đông 1", "Kho đông 2", "Kho đông 3"];

interface DuyetForm {
  wipId: string;
  warehouse: string;
  luongThuc: number;
  blockThuc: number;
  note: string;
}

export default function KhoDuTruScreen() {
  const [sanXuat, persistSX] = useWipProductions();
  const [dongLenh] = useExportItems();
  const [matHang] = useProducts();

  const [locKho, setLocKho] = useState("");
  const [duyet, setDuyet] = useState<DuyetForm | null>(null);
  const [loi, setLoi] = useState<LoiNhap[]>([]);

  const tenMH = (id: string) => matHang.find((m) => m.id === id)?.name || "—";

  const choNhap = useMemo(
    () => sanXuat.filter((s) => s.status === "cho-nhap"),
    [sanXuat]
  );
  const ton = useMemo(() => tinhTon(sanXuat, dongLenh), [sanXuat, dongLenh]);

  const dsKho = useMemo(() => {
    const set = new Set<string>(KHO_GOI_Y);
    for (const s of sanXuat) if (s.warehouse) set.add(s.warehouse);
    return [...set];
  }, [sanXuat]);
  const optKho: MucChon[] = dsKho.map((k) => ({ value: k, label: k }));

  const tonLoc = useMemo(
    () => ton.filter((t) => (!locKho || t.warehouse === locKho) && t.conLai > 0),
    [ton, locKho]
  );
  const tongTon = tonLoc.reduce((s, t) => s + t.conLai, 0);

  const moDuyet = (s: WipProductionItem) => {
    setDuyet({
      wipId: s.id,
      warehouse: s.warehouse || KHO_GOI_Y[0],
      luongThuc: s.quantityKg,
      blockThuc: s.blocksCount,
      note: "",
    });
    setLoi([]);
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
    { key: "kho", header: "Kho", render: (r) => <Badge>{r.warehouse || "—"}</Badge>, sapXep: (r) => r.warehouse },
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
        <h1 className="text-3xl font-semibold text-foreground">Kho dự trữ đông</h1>
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

      {/* Khối chờ nhập — lời mời duyệt (không coi rỗng khi còn lô chờ) */}
      {choNhap.length > 0 && (
        <div className="space-y-4 rounded-xl border-2 border-primary/40 bg-accent/40 p-4">
          <p className="text-base font-semibold text-foreground">
            Có {choNhap.length} lô sản xuất chờ nhập kho — duyệt để tính vào tồn
          </p>
          <ul className="divide-y divide-border">
            {choNhap.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2"
              >
                <span className="min-w-0 flex-1 text-base">
                  {tenMH(s.productId)}
                  {s.spec ? ` · ${s.spec}` : ""} —{" "}
                  <span className="tnum font-semibold">{num(s.quantityKg)}</span> kg
                  <span className="text-muted-foreground">
                    {" "}
                    · SX {viDate(s.productionDate)} · xưởng {s.workshop}
                  </span>
                </span>
                <Button size="sm" onClick={() => moDuyet(s)}>
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

      {tonLoc.length === 0 ? (
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
            <Button size="lg" onClick={luuDuyet}>
              <PackageCheck />
              Xác nhận nhập kho
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
