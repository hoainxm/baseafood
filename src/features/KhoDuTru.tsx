import { useMemo, useState } from "react";
import type { DongSanXuat } from "@/types";
import { useDongLenh, useMatHang, useSanXuat } from "@/lib/danhMuc";
import { tinhTon, type LoTon } from "@/lib/kho";
import {
  Badge,
  Button,
  Combobox,
  ContextBar,
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
  notify,
  type Cot,
  type LoiNhap,
  type MucChon,
} from "@/design-system";
import { kg, num, viDate } from "@/lib/format";
import { PackageCheck, Snowflake } from "lucide-react";

const KHO_GOI_Y = ["Kho đông 1", "Kho đông 2", "Kho đông 3"];

interface DuyetForm {
  sanXuatId: string;
  kho: string;
  luongThuc: number;
  blockThuc: number;
  ghiChu: string;
}

export default function KhoDuTruScreen() {
  const [sanXuat, persistSX] = useSanXuat();
  const [dongLenh] = useDongLenh();
  const [matHang] = useMatHang();

  const [locKho, setLocKho] = useState("");
  const [duyet, setDuyet] = useState<DuyetForm | null>(null);
  const [loi, setLoi] = useState<LoiNhap[]>([]);

  const tenMH = (id: string) => matHang.find((m) => m.id === id)?.ten || "—";

  const choNhap = useMemo(
    () => sanXuat.filter((s) => s.trangThai === "cho-nhap"),
    [sanXuat]
  );
  const ton = useMemo(() => tinhTon(sanXuat, dongLenh), [sanXuat, dongLenh]);

  const dsKho = useMemo(() => {
    const set = new Set<string>(KHO_GOI_Y);
    for (const s of sanXuat) if (s.kho) set.add(s.kho);
    return [...set];
  }, [sanXuat]);
  const optKho: MucChon[] = dsKho.map((k) => ({ value: k, label: k }));

  const tonLoc = useMemo(
    () => ton.filter((t) => (!locKho || t.kho === locKho) && t.conLai > 0),
    [ton, locKho]
  );
  const tongTon = tonLoc.reduce((s, t) => s + t.conLai, 0);

  const moDuyet = (s: DongSanXuat) => {
    setDuyet({
      sanXuatId: s.id,
      kho: s.kho || KHO_GOI_Y[0],
      luongThuc: s.luongKg,
      blockThuc: s.soBlock,
      ghiChu: "",
    });
    setLoi([]);
  };

  const luuDuyet = () => {
    if (!duyet) return;
    const ls: LoiNhap[] = [];
    if (!duyet.kho.trim()) ls.push({ truong: "Kho", thongBao: "Chưa chọn kho" });
    if (!(duyet.luongThuc > 0))
      ls.push({ truong: "Lượng thực", thongBao: "Phải lớn hơn 0 kg" });
    setLoi(ls);
    if (ls.length > 0) return;
    const goc = sanXuat.find((s) => s.id === duyet.sanXuatId);
    const lech = goc ? duyet.luongThuc - goc.luongKg : 0;
    persistSX(
      sanXuat.map((s) =>
        s.id === duyet.sanXuatId
          ? {
              ...s,
              kho: duyet.kho,
              luongKg: duyet.luongThuc,
              soBlock: duyet.blockThuc,
              trangThai: "da-nhap",
              ghiChu: duyet.ghiChu || s.ghiChu,
            }
          : s
      )
    );
    notify.daLuu(
      `Đã nhập kho ${duyet.kho} — ${kg(duyet.luongThuc)}` +
        (lech ? ` (lệch ${lech > 0 ? "+" : ""}${num(lech)} kg)` : "")
    );
    setDuyet(null);
  };

  const colsTon: Cot<LoTon>[] = [
    {
      key: "mh",
      header: "Mặt hàng",
      chinh: true,
      render: (r) => tenMH(r.matHangId),
      sapXep: (r) => tenMH(r.matHangId),
    },
    { key: "qc", header: "Quy cách", render: (r) => r.quyCach || "—" },
    { key: "kho", header: "Kho", render: (r) => <Badge>{r.kho || "—"}</Badge>, sapXep: (r) => r.kho },
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
    ? sanXuat.find((s) => s.id === duyet.sanXuatId)
    : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">Kho dự trữ đông</h1>
        <p className="mt-2 max-w-2xl text-base text-muted-foreground">
          Duyệt bán thành phẩm sản xuất vào kho (cấp đông), theo dõi tồn từng lô.
          Tồn = đã nhập − đã xuất; chỉ lô đã duyệt mới tính tồn.
        </p>
      </div>

      <ContextBar
        items={[
          { nhan: "Chờ nhập", giaTri: choNhap.length, so: true },
          { nhan: "Lô còn hàng", giaTri: tonLoc.length, so: true },
          { nhan: "Tổng tồn", giaTri: kg(tongTon), so: true },
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
                  {tenMH(s.matHangId)}
                  {s.quyCach ? ` · ${s.quyCach}` : ""} —{" "}
                  <span className="tnum font-semibold">{num(s.luongKg)}</span> kg
                  <span className="text-muted-foreground">
                    {" "}
                    · SX {viDate(s.ngay)} · xưởng {s.phanXuong}
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
            getKey={(r) => r.sanXuatId}
            timKiem={(r) => `${tenMH(r.matHangId)} ${r.quyCach} ${r.kho}`}
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
                ? `${tenMH(duyetGoc.matHangId)}${duyetGoc.quyCach ? ` · ${duyetGoc.quyCach}` : ""} — SX ${viDate(duyetGoc.ngay)}. Đối chiếu kg/block thực, chọn kho.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {duyet && (
            <div className="space-y-6 py-2">
              <ErrorSummary loi={loi} />
              <Combobox
                label="Kho (phòng đông)"
                required
                value={duyet.kho}
                onChange={(v) => setDuyet((d) => (d ? { ...d, kho: v } : d))}
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
              {duyetGoc && duyet.luongThuc !== duyetGoc.luongKg && (
                <p className="rounded-lg bg-accent px-4 py-3 text-base text-accent-foreground">
                  Lệch so ghi sản lượng:{" "}
                  <span className="tnum font-semibold">
                    {duyet.luongThuc - duyetGoc.luongKg > 0 ? "+" : ""}
                    {num(duyet.luongThuc - duyetGoc.luongKg)} kg
                  </span>{" "}
                  — ghi rõ lý do ở ghi chú.
                </p>
              )}
              <Field label="Ghi chú (lý do lệch, nếu có)">
                <Input
                  value={duyet.ghiChu}
                  onChange={(e) =>
                    setDuyet((d) => (d ? { ...d, ghiChu: e.target.value } : d))
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
