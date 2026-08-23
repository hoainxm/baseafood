// ============================================================
// Tên file cũ: src/features/orders/DonDat.tsx
// Tên tiếng Việt: Màn hình Quản lý Đơn đặt hàng & Gom hàng
// Description: Sales Order Management & Consolidation Screen
// ============================================================
import { useMemo, useState } from "react";
import type {
  OrderItem,
  ExportItem,
  SalesOrder,
  ExportOrder,
  SalesInvoice,
  SalesItem,
} from "@/types";
import { newId } from "@/lib/store";
import {
  useSalesItems,
  useSalesOrders,
  useOrderItems,
  useExportItems,
  useCustomers,
  useExportOrders,
  useProducts,
  useSalesInvoices,
  useWipProductions,
} from "@/lib/catalogRepo";
import { loConHang, tinhTon, locBanLe } from "@/lib/inventory";
import {
  Badge,
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
  NumberField,
  RecordTable,
  ThongKe,
  XacNhan,
  notify,
  type Cot,
  type LoiNhap,
  type MucChon,
} from "@/design-system";
import { kg, num, todayISO, viDate } from "@/lib/format";
import { CheckCircle, ClipboardList, Package, PackageCheck, Plus, Truck } from "lucide-react";

interface DongCanMoi {
  productId: string;
  spec: string;
  requiredQuantityKg: number;
  requiredBlocksCount: number;
}
interface DonMoi {
  customerId: string;
  orderDate: string;
  note: string;
  dong: DongCanMoi[];
}

const NHAN_TT: Record<SalesOrder["status"], string> = {
  "dang-gom": "Đang gom",
  du: "Đủ",
  dong: "Đã xuất",
};

export default function DonDatScreen() {
  const [don, persistDon, { trangThai }] = useSalesOrders();
  const dangTai = trangThai === "dang-tai" && don.length === 0;
  const [dongDon, persistDongDon] = useOrderItems();
  const [lenh, persistLenh] = useExportOrders();
  const [dongLenh, persistDongLenh] = useExportItems();
  const [sanXuat] = useWipProductions();
  const [matHang, setMatHang] = useProducts();
  const [khach] = useCustomers();
  const [phieuBan, persistPhieu] = useSalesInvoices();
  const [banHang, persistBan] = useSalesItems();

  const [chon, setChon] = useState<string | null>(null);
  const [tao, setTao] = useState<DonMoi | null>(null);
  const [loi, setLoi] = useState<LoiNhap[]>([]);

  const tenMH = (id: string) => matHang.find((m) => m.id === id)?.name || "—";
  const tenKH = (id: string) => khach.find((k) => k.id === id)?.name || "—";

  const banLe = useMemo(() => locBanLe(banHang), [banHang]);
  const ton = useMemo(() => tinhTon(sanXuat, dongLenh, banLe), [sanXuat, dongLenh, banLe]);

  const optMatHang: MucChon[] = matHang.map((m) => ({
    value: m.id,
    label: m.name,
    phu: m.code || undefined,
  }));
  const optKhach: MucChon[] = khach.map((k) => ({
    value: k.id,
    label: k.name,
    phu: k.market || undefined,
  }));
  /** kg đã xuất cho (đơn × mặt hàng × quy cách) — gom dòng lệnh của lệnh thuộc đơn. */
  const daXuat = (orderId: string, mh: string, qc: string) => {
    const lenhCuaDon = new Set(
      lenh.filter((l) => l.orderId === orderId).map((l) => l.id)
    );
    return dongLenh
      .filter(
        (d) =>
          lenhCuaDon.has(d.exportId) && d.productId === mh && d.spec === qc
      )
      .reduce((s, d) => s + (d.quantityKg || 0), 0);
  };

  const donCuaChon = chon ? don.find((d) => d.id === chon) : undefined;
  const dongCuaChon = useMemo(
    () => (chon ? dongDon.filter((d) => d.orderId === chon) : []),
    [dongDon, chon]
  );

  /* ---- Tạo đơn ---- */
  const moTao = () => {
    setTao({
      customerId: "",
      orderDate: todayISO(),
      note: "",
      dong: [{ productId: "", spec: "", requiredQuantityKg: 0, requiredBlocksCount: 0 }],
    });
    setLoi([]);
  };
  const themMatHang = (ten: string) => {
    const m = { id: newId(), code: "", name: ten, finishedGoodCode: "" };
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
    if (!tao.customerId) ls.push({ truong: "Khách", thongBao: "Chưa chọn khách" });
    const dongHopLe = tao.dong.filter((d) => d.productId && d.requiredQuantityKg > 0);
    if (dongHopLe.length === 0)
      ls.push({ truong: "Dòng cần", thongBao: "Thêm ít nhất 1 mặt hàng cần" });
    setLoi(ls);
    if (ls.length > 0) return;
    const donId = newId();
    const donMoi: SalesOrder = {
      id: donId,
      customerId: tao.customerId,
      orderDate: tao.orderDate,
      status: "dang-gom",
      note: tao.note,
    };
    const dongMoi: OrderItem[] = dongHopLe.map((d) => ({
      id: newId(),
      orderId: donId,
      productId: d.productId,
      spec: d.spec,
      requiredQuantityKg: d.requiredQuantityKg,
      requiredBlocksCount: d.requiredBlocksCount,
    }));
    persistDon([...don, donMoi]);
    persistDongDon([...dongDon, ...dongMoi]);
    notify.daLuu(`Đã tạo đơn cho ${tenKH(tao.customerId)}`);
    setTao(null);
    setChon(donId);
  };

  /* ---- Tạo lệnh xuất (FIFO, cho xuất một phần) + handoff sổ Bán hàng ---- */
  const taoLenhXuat = (d: SalesOrder) => {
    const dsDong = dongDon.filter((x) => x.orderId === d.id);
    const tonHienTai = tinhTon(sanXuat, dongLenh, banLe);
    const lenhId = newId();
    const dlMoi: ExportItem[] = [];
    for (const dc of dsDong) {
      let conCan = dc.requiredQuantityKg - daXuat(d.id, dc.productId, dc.spec);
      if (conCan <= 0) continue;
      const los = loConHang(tonHienTai, dc.productId, dc.spec);
      for (const lo of los) {
        if (conCan <= 0) break;
        const lay = Math.min(conCan, lo.conLai);
        if (lay <= 0) continue;
        const tyLe = lo.conLai > 0 ? lay / lo.conLai : 0;
        dlMoi.push({
          id: newId(),
          exportId: lenhId,
          wipId: lo.wipId,
          productId: dc.productId,
          spec: dc.spec,
          quantityKg: lay,
          blocksCount: Math.round(lo.blockConLai * tyLe),
        });
        lo.conLai -= lay; // trừ tồn trong bộ nhớ để lô sau tính đúng
        conCan -= lay;
      }
    }
    if (dlMoi.length === 0) {
      notify.canhBao("Chưa có tồn khả dụng để xuất cho đơn này");
      return;
    }
    const lenhMoi: ExportOrder = {
      id: lenhId,
      orderId: d.id,
      exportDate: todayISO(),
      status: "dong",
      note: "",
    };
    // Handoff sổ Bán hàng: 1 phiếu bán (kênh Xuất khẩu), mỗi dòng lệnh = 1 dòng bán.
    const phieuId = newId();
    const phieu: SalesInvoice = {
      id: phieuId,
      deliveryDate: todayISO(),
      postingDate: todayISO(),
      backdateReason: "",
      workshop: "Đông",
      customerId: d.customerId,
      channel: "Xuất khẩu",
      note: `Xuất container từ đơn ${tenKH(d.customerId)}`,
    };
    const dongBanMoi: SalesItem[] = dlMoi.map((dl) => ({
      id: newId(),
      invoiceId: phieuId,
      deliveryDate: todayISO(),
      productId: dl.productId,
      spec: dl.spec,
      quantityKg: dl.quantityKg,
      unitPrice: null,
      sourceWarehouse: "Lưu trữ",
    }));

    persistDongLenh([...dongLenh, ...dlMoi]);
    persistLenh([...lenh, lenhMoi]);
    persistPhieu([...phieuBan, phieu]);
    persistBan([...banHang, ...dongBanMoi]);

    // Cập nhật trạng thái đơn: đủ hết → "dong", còn thiếu → "dang-gom".
    const conThieu = dsDong.some(
      (dc) =>
        dc.requiredQuantityKg -
          (daXuat(d.id, dc.productId, dc.spec) +
            dlMoi
              .filter(
                (dl) => dl.productId === dc.productId && dl.spec === dc.spec
              )
              .reduce((s, dl) => s + dl.quantityKg, 0)) >
        0.001
    );
    persistDon(
      don.map((x) =>
        x.id === d.id ? { ...x, status: conThieu ? "dang-gom" : "dong" } : x
      )
    );
    const tongXuat = dlMoi.reduce((s, dl) => s + dl.quantityKg, 0);
    notify.daLuu(
      `Đã xuất ${kg(tongXuat)} → sổ Bán hàng (phiếu ${tenKH(d.customerId)})` +
        (conThieu ? " · đơn còn thiếu, vẫn mở" : " · đơn đóng")
    );
  };

  const xacNhanDu = (d: SalesOrder) => {
    persistDon(don.map((x) => (x.id === d.id ? { ...x, status: "du" } : x)));
    notify.daLuu("Đã đánh dấu đơn đủ — bấm Lệnh xuất để xuất container");
  };

  const xoaDon = (d: SalesOrder) => {
    const truocDon = don;
    const truocDong = dongDon;
    persistDon(don.filter((x) => x.id !== d.id));
    persistDongDon(dongDon.filter((x) => x.orderId !== d.id));
    if (chon === d.id) setChon(null);
    notify.daXoa(`Đã xóa đơn ${tenKH(d.customerId)}`, () => {
      persistDon(truocDon);
      persistDongDon(truocDong);
    });
  };

  const colsDon: Cot<SalesOrder>[] = [
    { key: "kh", header: "Khách", chinh: true, render: (r) => tenKH(r.customerId), sapXep: (r) => tenKH(r.customerId) },
    { key: "ngay", header: "Ngày đặt", render: (r) => viDate(r.orderDate), sapXep: (r) => r.orderDate },
    {
      key: "sd",
      header: "Số dòng",
      so: true,
      render: (r) => num(dongDon.filter((d) => d.orderId === r.id).length),
    },
    {
      key: "tt",
      header: "Trạng thái",
      render: (r) => (
        <Badge variant={r.status === "dong" ? "secondary" : r.status === "du" ? "default" : "outline"}>
          {NHAN_TT[r.status]}
        </Badge>
      ),
      sapXep: (r) => r.status,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Đơn đặt &amp; lệnh xuất
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="lg" onClick={moTao}>
            <Plus />
            Tạo đơn
          </Button>
        </div>
      </div>

      <ThongKe
        className="grid-cols-1 sm:grid-cols-3"
        the={[
          { nhan: "Tổng số đơn", giaTri: don.length, so: true, icon: ClipboardList, mau: "trung-tinh" },
          { nhan: "Đang gom hàng", giaTri: don.filter((d) => d.status === "dang-gom").length, so: true, icon: Package, mau: "brand" },
          { nhan: "Đã xuất xong", giaTri: don.filter((d) => d.status === "dong").length, so: true, icon: CheckCircle, mau: "success" },
        ]}
      />

      {dangTai ? (
        <SkeletonBang />
      ) : don.length === 0 ? (
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
          timKiem={(r) => tenKH(r.customerId)}
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
                {tenKH(donCuaChon.customerId)}
              </p>
              <p className="text-base text-muted-foreground">
                Đặt {viDate(donCuaChon.orderDate)} · {NHAN_TT[donCuaChon.status]}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {donCuaChon.status !== "dong" && (
                <>
                  <Button variant="outline" onClick={() => xacNhanDu(donCuaChon)}>
                    <PackageCheck />
                    Xác nhận đủ
                  </Button>
                  {/* Lệnh xuất TRỪ TỒN KHO + đẻ phiếu ở sổ Bán hàng — chạm hai
                      sổ cùng lúc, không có nút hoàn tác. Phải hỏi lại. */}
                  <XacNhan
                    tieuDe="Xuất hàng cho đơn này?"
                    moTa="Sẽ trừ tồn kho dự trữ theo FIFO và tạo một phiếu bán (kênh Xuất khẩu) ở sổ Bán hàng. Không hoàn tác được — sai thì phải sửa tay ở cả hai sổ."
                    chiTiet={`${tenKH(donCuaChon.customerId)} · đặt ${viDate(donCuaChon.orderDate)} · ${dongCuaChon.length} dòng hàng`}
                    nhanNut="Xuất hàng"
                    icon={Truck}
                    onConfirm={() => taoLenhXuat(donCuaChon)}
                    trigger={
                      <Button>
                        <Truck />
                        Lệnh xuất (một phần được)
                      </Button>
                    }
                  />
                </>
              )}
              <Button variant="outline" onClick={() => setChon(null)}>
                Đóng
              </Button>
            </div>
          </div>

          <ul className="divide-y divide-border">
            {dongCuaChon.map((dc) => {
              const xuat = daXuat(donCuaChon.id, dc.productId, dc.spec);
              const kd = ton
                .filter(
                  (t) => t.productId === dc.productId && t.spec === dc.spec
                )
                .reduce((s, t) => s + Math.max(0, t.conLai), 0);
              const con = dc.requiredQuantityKg - xuat;
              const du = con <= 0.001;
              return (
                <li
                  key={dc.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <span className="min-w-0 flex-1 text-base">
                    {tenMH(dc.productId)}
                    {dc.spec ? ` · ${dc.spec}` : ""}
                  </span>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-base">
                    <span className="text-muted-foreground">
                      Cần <span className="tnum font-semibold text-foreground">{num(dc.requiredQuantityKg)}</span> kg
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
              <ChuThichBatBuoc />
              <Combobox
                label="Khách hàng"
                required
                value={tao.customerId}
                onChange={(v) => setTao((t) => (t ? { ...t, customerId: v } : t))}
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
                      value={dc.productId}
                      onChange={(v) => datDong(i, { productId: v })}
                      options={optMatHang}
                      onCreate={themMatHang}
                    />
                    <div className="grid gap-6 sm:grid-cols-2">
                      <NumberField
                        label="Khối lượng cần"
                        required
                        unit="kg"
                        value={dc.requiredQuantityKg || null}
                        onChange={(v) => datDong(i, { requiredQuantityKg: v ?? 0 })}
                      />
                      <NumberField
                        label="Block cần"
                        unit="block"
                        value={dc.requiredBlocksCount || null}
                        onChange={(v) => datDong(i, { requiredBlocksCount: v ?? 0 })}
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
                              { productId: "", spec: "", requiredQuantityKg: 0, requiredBlocksCount: 0 },
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
                  value={tao.note}
                  onChange={(e) =>
                    setTao((t) => (t ? { ...t, note: e.target.value } : t))
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
