// ============================================================
// Tên file cũ: src/features/sales/BaoCaoBan.tsx
// Tên tiếng Việt: Báo cáo doanh số và sản lượng Bán hàng
// Description: Sales Volume & Revenue Report
// ============================================================
import { useMemo, useState } from "react";
import {
  BangTong,
  BieuDoCot,
  Combobox,
  DateField,
  DateRangeField,
  ThongKe,
  homNay,
  type CotBieuDo,
  type CotTong,
  type TheThongTin,
} from "@/design-system";
import { useSalesItems, useSalesInvoices, useCustomers } from "@/lib/catalogRepo";
import { KY_OPT, phamViKy, type KyXem } from "@/lib/periodUtils";
import { num, viDate } from "@/lib/format";
import { calculateSalesAmount, type SalesChannel } from "@/types";
import { CalendarRange, Scale, Users } from "lucide-react";

interface DongTong {
  customerName: string;
  channel: SalesChannel;
  quantityKg: number;
  amount: number;
}

/** Đơn vị tiền theo kênh: Xuất khẩu bằng USD, Nội địa bằng VND. */
function donVi(channel: SalesChannel): string {
  return channel === "Xuất khẩu" ? "$" : "đ";
}

/**
 * Báo cáo Bán hàng — tổng bán theo kỳ, gom theo KHÁCH × KÊNH (Xuất khẩu / Nội
 * địa). Giá trị để theo từng kênh vì hai kênh khác đơn vị tiền (USD ≠ VND) —
 * KHÔNG cộng thẳng. Chỉ đọc sổ bán.
 */
export default function BaoCaoBan() {
  const [items] = useSalesItems();
  const [invoices] = useSalesInvoices();
  const [customers] = useCustomers();

  const [ky, setKy] = useState<KyXem>("thang");
  const [moc, setMoc] = useState(homNay());
  const [tuTC, setTuTC] = useState(homNay());
  const [denTC, setDenTC] = useState(homNay());
  const [tu, den] = phamViKy(ky, moc, tuTC, denTC);

  const { dong, chart, soKhach, tongKg } = useMemo(() => {
    const invById = new Map(invoices.map((i) => [i.id, i]));
    const tenKH = new Map(customers.map((c) => [c.id, c.name]));

    const map = new Map<string, DongTong>();
    const theoKH = new Map<string, number>();
    for (const it of items) {
      if (it.deliveryDate < tu || it.deliveryDate > den) continue;
      const inv = invById.get(it.invoiceId);
      if (!inv) continue;
      const kh = tenKH.get(inv.customerId) || "(chưa có khách)";
      const k = `${inv.customerId}|||${inv.channel}`;
      let d = map.get(k);
      if (!d) {
        d = { customerName: kh, channel: inv.channel, quantityKg: 0, amount: 0 };
        map.set(k, d);
      }
      d.quantityKg += it.quantityKg || 0;
      d.amount += calculateSalesAmount(it);
      theoKH.set(inv.customerId, (theoKH.get(inv.customerId) ?? 0) + (it.quantityKg || 0));
    }
    const dong = [...map.values()].sort(
      (a, b) =>
        a.customerName.localeCompare(b.customerName, "vi") ||
        a.channel.localeCompare(b.channel, "vi")
    );
    const chart: CotBieuDo[] = [...theoKH.entries()].map(([id, giaTri]) => ({
      nhan: tenKH.get(id) || "(chưa có khách)",
      giaTri,
    }));
    return {
      dong,
      chart,
      soKhach: theoKH.size,
      tongKg: dong.reduce((s, d) => s + d.quantityKg, 0),
    };
  }, [items, invoices, customers, tu, den]);

  const the: TheThongTin[] = [
    { nhan: "Kỳ báo cáo", giaTri: `${viDate(tu)} – ${viDate(den)}`, icon: CalendarRange, mau: "trung-tinh" },
    { nhan: "Tổng bán", giaTri: `${num(tongKg)} kg`, so: true, icon: Scale, mau: "brand" },
    { nhan: "Số khách", giaTri: num(soKhach), so: true, icon: Users, mau: "trung-tinh" },
  ];

  const cot: CotTong<DongTong>[] = [
    { key: "kh", header: "Khách hàng", render: (r) => r.customerName },
    { key: "kenh", header: "Kênh", render: (r) => r.channel },
    {
      key: "kg",
      header: "Số cân (kg)",
      so: true,
      render: (r) => num(r.quantityKg),
      tong: () => num(tongKg),
    },
    {
      key: "tien",
      header: "Giá trị",
      so: true,
      render: (r) => `${num(r.amount)} ${donVi(r.channel)}`,
    },
  ];

  return (
    <div className="space-y-6">
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

      {chart.length > 0 && (
        <section className="space-y-3 rounded-xl border-2 border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground">
            Sản lượng bán theo khách
          </h3>
          <BieuDoCot data={chart} donVi="kg" />
        </section>
      )}

      <BangTong
        rows={dong}
        cot={cot}
        getKey={(r) => `${r.customerName}|||${r.channel}`}
        emptyText="Không có phiếu bán trong kỳ này."
      />
    </div>
  );
}
