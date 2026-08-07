import { useMemo, useState } from "react";
import type {
  DongDon,
  DongLenh,
  DonDat,
  LenhXuat,
  PhieuBan,
  DongBan,
} from "@/types";
import { newId } from "@/lib/store";
import {
  useBanHang,
  useDonDat,
  useDongDon,
  useDongLenh,
  useKhachHang,
  useLenhXuat,
  useMatHang,
  usePhieuBan,
  useSanXuat,
} from "@/lib/danhMuc";
import { loConHang, tinhTon } from "@/lib/kho";
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
import { kg, num, todayISO, viDate } from "@/lib/format";
import { ClipboardList, PackageCheck, Plus, Truck } from "lucide-react";

interface DongCanMoi {
  matHangId: string;
  quyCach: string;
  luongKgCan: number;
  soBlockCan: number;
}
interface DonMoi {
  khachId: string;
  ngayDat: string;
  ghiChu: string;
  dong: DongCanMoi[];
}

const NHAN_TT: Record<DonDat["trangThai"], string> = {
  "dang-gom": "Đang gom",
  du: "Đủ",
  dong: "Đã xuất",
};

export default function DonDatScreen() {
  const [don, persistDon] = useDonDat();
  const [dongDon, persistDongDon] = useDongDon();
  const [lenh, persistLenh] = useLenhXuat();
  const [dongLenh, persistDongLenh] = useDongLenh();
  const [sanXuat] = useSanXuat();
  const [matHang, setMatHang] = useMatHang();
  const [khach] = useKhachHang();
  const [phieuBan, persistPhieu] = usePhieuBan();
  const [banHang, persistBan] = useBanHang();

  const [chon, setChon] = useState<string | null>(null);
  const [tao, setTao] = useState<DonMoi | null>(null);
  const [loi, setLoi] = useState<LoiNhap[]>([]);

  const tenMH = (id: string) => matHang.find((m) => m.id === id)?.ten || "—";
  const tenKH = (id: string) => khach.find((k) => k.id === id)?.ten || "—";

  const ton = useMemo(() => tinhTon(sanXuat, dongLenh), [sanXuat, dongLenh]);

  const optMatHang: MucChon[] = matHang.map((m) => ({
    value: m.id,
    label: m.ten,
    phu: m.ma || undefined,
  }));
  const optKhach: MucChon[] = khach.map((k) => ({
    value: k.id,
    label: k.ten,
    phu: k.thiTruong || undefined,
  }));
  /** kg đã xuất cho (đơn × mặt hàng × quy cách) — gom dòng lệnh của lệnh thuộc đơn. */
  const daXuat = (donId: string, mh: string, qc: string) => {
    const lenhCuaDon = new Set(
      lenh.filter((l) => l.donId === donId).map((l) => l.id)
    );
    return dongLenh
      .filter(
        (d) =>
          lenhCuaDon.has(d.lenhId) && d.matHangId === mh && d.quyCach === qc
      )
      .reduce((s, d) => s + (d.luongKg || 0), 0);
  };

  const donCuaChon = chon ? don.find((d) => d.id === chon) : undefined;
  const dongCuaChon = useMemo(
    () => (chon ? dongDon.filter((d) => d.donId === chon) : []),
    [dongDon, chon]
  );

  /* ---- Tạo đơn ---- */
  const moTao = () => {
    setTao({
      khachId: "",
      ngayDat: todayISO(),
      ghiChu: "",
      dong: [{ matHangId: "", quyCach: "", luongKgCan: 0, soBlockCan: 0 }],
    });
    setLoi([]);
  };
  const themMatHang = (ten: string) => {
    const m = { id: newId(), ma: "", ten, maTP: "" };
    setMatHang([...matHang, m]);
    notify.daLuu(`Đã thêm mặt hàng "${ten}"`);
    return m.id;
  };
  const datDong = (i: number, patch: Partial<DongCanMoi>) =>
    setTao((t) =>
      t
        ? { ...t, dong: t.dong.map((d, j) => (j === i ? { ...d, ...patch } : d)) }
        : t
    );

  const luuTao = () => {
    if (!tao) return;
    const ls: LoiNhap[] = [];
    if (!tao.khachId) ls.push({ truong: "Khách", thongBao: "Chưa chọn khách" });
    const dongHopLe = tao.dong.filter((d) => d.matHangId && d.luongKgCan > 0);
    if (dongHopLe.length === 0)
      ls.push({ truong: "Dòng cần", thongBao: "Thêm ít nhất 1 mặt hàng cần" });
    setLoi(ls);
    if (ls.length > 0) return;
    const donId = newId();
    const donMoi: DonDat = {
      id: donId,
      khachId: tao.khachId,
      ngayDat: tao.ngayDat,
      trangThai: "dang-gom",
      ghiChu: tao.ghiChu,
    };
    const dongMoi: DongDon[] = dongHopLe.map((d) => ({
      id: newId(),
      donId,
      matHangId: d.matHangId,
      quyCach: d.quyCach,
      luongKgCan: d.luongKgCan,
      soBlockCan: d.soBlockCan,
    }));
    persistDon([...don, donMoi]);
    persistDongDon([...dongDon, ...dongMoi]);
    notify.daLuu(`Đã tạo đơn cho ${tenKH(tao.khachId)}`);
    setTao(null);
    setChon(donId);
  };

  /* ---- Tạo lệnh xuất (FIFO, cho xuất một phần) + handoff sổ Bán hàng ---- */
  const taoLenhXuat = (d: DonDat) => {
    const dsDong = dongDon.filter((x) => x.donId === d.id);
    const tonHienTai = tinhTon(sanXuat, dongLenh);
    const lenhId = newId();
    const dlMoi: DongLenh[] = [];
    for (const dc of dsDong) {
      let conCan = dc.luongKgCan - daXuat(d.id, dc.matHangId, dc.quyCach);
      if (conCan <= 0) continue;
      const los = loConHang(tonHienTai, dc.matHangId, dc.quyCach);
      for (const lo of los) {
        if (conCan <= 0) break;
        const lay = Math.min(conCan, lo.conLai);
        if (lay <= 0) continue;
        const tyLe = lo.conLai > 0 ? lay / lo.conLai : 0;
        dlMoi.push({
          id: newId(),
          lenhId,
          sanXuatId: lo.sanXuatId,
          matHangId: dc.matHangId,
          quyCach: dc.quyCach,
          luongKg: lay,
          soBlock: Math.round(lo.blockConLai * tyLe),
        });
        lo.conLai -= lay; // trừ tồn trong bộ nhớ để lô sau tính đúng
        conCan -= lay;
      }
    }
    if (dlMoi.length === 0) {
      notify.canhBao("Chưa có tồn khả dụng để xuất cho đơn này");
      return;
    }
    const lenhMoi: LenhXuat = {
      id: lenhId,
      donId: d.id,
      ngay: todayISO(),
      trangThai: "dong",
      ghiChu: "",
    };
    // Handoff sổ Bán hàng: 1 phiếu bán (kênh Xuất khẩu), mỗi dòng lệnh = 1 dòng bán.
    const phieuId = newId();
    const phieu: PhieuBan = {
      id: phieuId,
      ngayGiao: todayISO(),
      ngayGhiSo: todayISO(),
      lyDoGhiBu: "",
      phanXuong: "Đông",
      khachId: d.khachId,
      kenh: "Xuất khẩu",
      ghiChu: `Xuất container từ đơn ${tenKH(d.khachId)}`,
    };
    const dongBanMoi: DongBan[] = dlMoi.map((dl) => ({
      id: newId(),
      phieuId,
      ngay: todayISO(),
      matHangId: dl.matHangId,
      quyCach: dl.quyCach,
      luongKg: dl.luongKg,
      donGia: null,
      khoNguon: "Lưu trữ",
    }));

    persistDongLenh([...dongLenh, ...dlMoi]);
    persistLenh([...lenh, lenhMoi]);
    persistPhieu([...phieuBan, phieu]);
    persistBan([...banHang, ...dongBanMoi]);

    // Cập nhật trạng thái đơn: đủ hết → "dong", còn thiếu → "dang-gom".
    const conThieu = dsDong.some(
      (dc) =>
        dc.luongKgCan -
          (daXuat(d.id, dc.matHangId, dc.quyCach) +
            dlMoi
              .filter(
                (dl) => dl.matHangId === dc.matHangId && dl.quyCach === dc.quyCach
              )
              .reduce((s, dl) => s + dl.luongKg, 0)) >
        0.001
    );
    persistDon(
      don.map((x) =>
        x.id === d.id ? { ...x, trangThai: conThieu ? "dang-gom" : "dong" } : x
      )
    );
    const tongXuat = dlMoi.reduce((s, dl) => s + dl.luongKg, 0);
    notify.daLuu(
      `Đã xuất ${kg(tongXuat)} → sổ Bán hàng (phiếu ${tenKH(d.khachId)})` +
        (conThieu ? " · đơn còn thiếu, vẫn mở" : " · đơn đóng")
    );
  };

  const xacNhanDu = (d: DonDat) => {
    persistDon(don.map((x) => (x.id === d.id ? { ...x, trangThai: "du" } : x)));
    notify.daLuu("Đã đánh dấu đơn đủ — bấm Lệnh xuất để xuất container");
  };

  const xoaDon = (d: DonDat) => {
    const truocDon = don;
    const truocDong = dongDon;
    persistDon(don.filter((x) => x.id !== d.id));
    persistDongDon(dongDon.filter((x) => x.donId !== d.id));
    if (chon === d.id) setChon(null);
    notify.daXoa(`Đã xóa đơn ${tenKH(d.khachId)}`, () => {
      persistDon(truocDon);
      persistDongDon(truocDong);
    });
  };

  const colsDon: Cot<DonDat>[] = [
    { key: "kh", header: "Khách", chinh: true, render: (r) => tenKH(r.khachId), sapXep: (r) => tenKH(r.khachId) },
    { key: "ngay", header: "Ngày đặt", render: (r) => viDate(r.ngayDat), sapXep: (r) => r.ngayDat },
    {
      key: "sd",
      header: "Số dòng",
      so: true,
      render: (r) => num(dongDon.filter((d) => d.donId === r.id).length),
    },
    {
      key: "tt",
      header: "Trạng thái",
      render: (r) => (
        <Badge variant={r.trangThai === "dong" ? "secondary" : r.trangThai === "du" ? "default" : "outline"}>
          {NHAN_TT[r.trangThai]}
        </Badge>
      ),
      sapXep: (r) => r.trangThai,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">
          Đơn đặt &amp; lệnh xuất
        </h1>
        <p className="mt-2 max-w-2xl text-base text-muted-foreground">
          Khách đặt số lượng lớn — gom đủ qua nhiều ngày sản xuất rồi xuất
          container (được xuất một phần). Xuất xong đẩy sang sổ Bán hàng.
        </p>
      </div>

      <ContextBar
        items={[
          { nhan: "Số đơn", giaTri: don.length, so: true },
          { nhan: "Đang gom", giaTri: don.filter((d) => d.trangThai === "dang-gom").length, so: true },
          { nhan: "Đã xuất", giaTri: don.filter((d) => d.trangThai === "dong").length, so: true },
        ]}
        actions={
          <Button size="lg" onClick={moTao}>
            <Plus />
            Tạo đơn
          </Button>
        }
      />

      {don.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          tieuDe="Chưa có đơn đặt nào"
          moTa="Bấm Tạo đơn để khai đơn khách đặt (mặt hàng, quy cách, số lượng cần)."
          action={
            <Button size="lg" onClick={moTao}>
              <Plus />
              Tạo đơn
            </Button>
          }
        />
      ) : (
        <RecordTable
          columns={colsDon}
          rows={don}
          getKey={(r) => r.id}
          timKiem={(r) => tenKH(r.khachId)}
          nhanTimKiem="Tìm theo khách…"
          actions={(r) => (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setChon(r.id)}>
                Xem
              </Button>
              <Button variant="outline" size="sm" onClick={() => xoaDon(r)}>
                Bỏ
              </Button>
            </div>
          )}
        />
      )}

      {/* Chi tiết đơn được chọn */}
      {donCuaChon && (
        <div className="space-y-4 rounded-xl border-2 border-border p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xl font-semibold text-foreground">
                {tenKH(donCuaChon.khachId)}
              </p>
              <p className="text-base text-muted-foreground">
                Đặt {viDate(donCuaChon.ngayDat)} · {NHAN_TT[donCuaChon.trangThai]}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {donCuaChon.trangThai !== "dong" && (
                <>
                  <Button variant="outline" onClick={() => xacNhanDu(donCuaChon)}>
                    <PackageCheck />
                    Xác nhận đủ
                  </Button>
                  <Button onClick={() => taoLenhXuat(donCuaChon)}>
                    <Truck />
                    Lệnh xuất (một phần được)
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={() => setChon(null)}>
                Đóng
              </Button>
            </div>
          </div>

          <ul className="divide-y divide-border">
            {dongCuaChon.map((dc) => {
              const xuat = daXuat(donCuaChon.id, dc.matHangId, dc.quyCach);
              const kd = ton
                .filter(
                  (t) => t.matHangId === dc.matHangId && t.quyCach === dc.quyCach
                )
                .reduce((s, t) => s + Math.max(0, t.conLai), 0);
              const con = dc.luongKgCan - xuat;
              const du = con <= 0.001;
              return (
                <li
                  key={dc.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <span className="min-w-0 flex-1 text-base">
                    {tenMH(dc.matHangId)}
                    {dc.quyCach ? ` · ${dc.quyCach}` : ""}
                  </span>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-base">
                    <span className="text-muted-foreground">
                      Cần <span className="tnum font-semibold text-foreground">{num(dc.luongKgCan)}</span> kg
                    </span>
                    <span className="text-muted-foreground">
                      Đã xuất <span className="tnum">{num(xuat)}</span>
                    </span>
                    <span className="text-muted-foreground">
                      Khả dụng <span className="tnum">{num(kd)}</span>
                    </span>
                    {du ? (
                      <Badge variant="secondary">Đủ</Badge>
                    ) : (
                      <Badge variant="outline">Còn thiếu {num(con)} kg</Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Dialog tạo đơn */}
      <Dialog open={tao !== null} onOpenChange={(o) => !o && setTao(null)}>
        <DialogContent className="max-h-[92vh] w-full overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Tạo đơn đặt</DialogTitle>
            <DialogDescription className="text-base">
              Khách và các mặt hàng cần (mặt hàng · quy cách · kg · block).
            </DialogDescription>
          </DialogHeader>
          {tao && (
            <div className="space-y-6 py-2">
              <ErrorSummary loi={loi} />
              <Combobox
                label="Khách hàng"
                required
                value={tao.khachId}
                onChange={(v) => setTao((t) => (t ? { ...t, khachId: v } : t))}
                options={optKhach}
                emptyText="Chưa có khách nào — thêm ở Danh mục."
              />
              <div className="space-y-4">
                <p className="text-base font-semibold">Mặt hàng cần</p>
                {tao.dong.map((dc, i) => (
                  <div
                    key={i}
                    className="space-y-4 rounded-xl border-2 border-border p-4"
                  >
                    <Combobox
                      label="Thành phẩm"
                      required
                      value={dc.matHangId}
                      onChange={(v) => datDong(i, { matHangId: v })}
                      options={optMatHang}
                      onCreate={themMatHang}
                    />
                    <div className="grid gap-6 sm:grid-cols-2">
                      <NumberField
                        label="Khối lượng cần"
                        required
                        unit="kg"
                        value={dc.luongKgCan || null}
                        onChange={(v) => datDong(i, { luongKgCan: v ?? 0 })}
                      />
                      <NumberField
                        label="Block cần"
                        unit="block"
                        value={dc.soBlockCan || null}
                        onChange={(v) => datDong(i, { soBlockCan: v ?? 0 })}
                      />
                    </div>
                    {tao.dong.length > 1 && (
                      <Button
                        variant="outline"
                        onClick={() =>
                          setTao((t) =>
                            t ? { ...t, dong: t.dong.filter((_, j) => j !== i) } : t
                          )
                        }
                      >
                        Bỏ dòng này
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={() =>
                    setTao((t) =>
                      t
                        ? {
                            ...t,
                            dong: [
                              ...t.dong,
                              { matHangId: "", quyCach: "", luongKgCan: 0, soBlockCan: 0 },
                            ],
                          }
                        : t
                    )
                  }
                >
                  <Plus />
                  Thêm mặt hàng cần
                </Button>
              </div>
              <Field label="Ghi chú">
                <Input
                  value={tao.ghiChu}
                  onChange={(e) =>
                    setTao((t) => (t ? { ...t, ghiChu: e.target.value } : t))
                  }
                  placeholder="Ghi chú đơn (nếu có)"
                />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setTao(null)}>
              Hủy
            </Button>
            <Button size="lg" onClick={luuTao}>
              Tạo đơn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
