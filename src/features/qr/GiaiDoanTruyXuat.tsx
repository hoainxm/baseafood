// ============================================================
// THEO GIAI ĐOẠN — tab của màn /qr (truy xuất QR đợt 2b).
// Kiểm QR từng khâu ở MỘT chỗ: nhập NL → sản xuất → nhập kho → đóng gói → xuất/bán.
// Mỗi khâu liệt kê lô / dòng hàng ra trong khoảng ngày × xưởng, kèm trạng thái (tem,
// lô đã gắn, kho, quét kiểm) và nút làm NGAY tại đây: In tem · Gắn lô · Hộ chiếu ·
// Duyệt nhập kho / Kiểm lô (mở thẳng hộp ở màn Kho dự trữ / Đơn đặt).
// Thay cho tab "Độ phủ" (mỗi khâu đã có số đếm đã gắn / còn thiếu).
// Số lấy từ theoGiaiDoan (lib/truyXuatLo, hàm thuần có test).
// Thiết kế: docs/spec/qr-truy-xuat-lo.md §6d
// ============================================================
import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { DomesticSaleItem, Packaging, SalesItem, WipProductionItem, Workshop } from "@/types";
import { GanLoDauVao, GanLoXuat, TemLoQr, useDuLieuTruyXuat } from "@/features/shared";
import { kg, viDate } from "@/lib/format";
import { TEN_LOAI, laHangRa, nhanLoBtp, nhanLoTp, theoGiaiDoan, type GiaiDoan, type KhoaGiaiDoan, type MucGiaiDoan, type NutLo } from "@/lib/truyXuatLo";
import { Button, ChoiceGroup, DateRangeField, EmptyState, Nhan, congNgay, homNay, sacTheoTen } from "@/design-system";
import { ClipboardCheck, Link2, Printer, ScanLine, Search } from "lucide-react";

/** Màn gốc của từng khâu + đơn vị đếm. */
const KHAU: Record<KhoaGiaiDoan, { donVi: string; man: { duong: string; nhan: string }[] }> = {
  nhap: { donVi: "lô", man: [{ duong: "/imports", nhan: "Nhập hàng" }] },
  "san-xuat": { donVi: "mẻ", man: [{ duong: "/wip", nhan: "Sản xuất thành phẩm" }] },
  kho: { donVi: "mẻ", man: [{ duong: "/warehouse", nhan: "Kho dự trữ" }] },
  "dong-goi": { donVi: "phiếu", man: [{ duong: "/packaging", nhan: "Đóng gói" }] },
  "xuat-ban": { donVi: "dòng", man: [{ duong: "/orders", nhan: "Đơn đặt" }, { duong: "/sales", nhan: "Bán hàng" }] },
};

const describeNode = (n: NutLo) =>
  [
    n.moTa,
    n.ngay && viDate(n.ngay),
    n.chiTiet.find((c) => c.nhan === "Đại lý" || c.nhan === "Khách")?.giaTri,
    n.kg ? kg(n.kg) : "",
  ]
    .filter((x) => x && x !== "—")
    .join(" · ");

/** Một dòng: nhãn lô (bấm mở hộ chiếu) + mô tả, nhãn trạng thái, nút thao tác. */
function StageRow({ m, trangThai, nut }: { m: MucGiaiDoan; trangThai: ReactNode; nut: ReactNode }) {
  const n = m.nut;
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-border py-2 last:border-b-0">
      <div className="min-w-0 flex-1 basis-64 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Nhan loai="phan-loai" sac={sacTheoTen(TEN_LOAI[n.kind])}>{TEN_LOAI[n.kind]}</Nhan>
          {laHangRa(n.kind) || n.mat ? (
            <span className="tnum font-medium">{n.nhan}</span>
          ) : (
            <Link
              className="tnum font-medium text-primary underline-offset-4 hover:underline"
              title={`Mở hộ chiếu của lô ${n.nhan}: làm từ đâu, đã đi đâu, cân bằng kg.`}
              to={`/qr?lo=${n.kind}:${encodeURIComponent(n.id)}`}
            >
              {n.nhan}
            </Link>
          )}
        </div>
        <p className="text-muted-foreground">{describeNode(n)}</p>
        <div className="flex flex-wrap gap-1.5">{trangThai}</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">{nut}</div>
    </li>
  );
}

const labelBadge = (m: MucGiaiDoan) =>
  m.daIn === undefined ? null : m.daIn > 0 ? <Nhan loai="xong">Đã in {m.daIn} tem</Nhan> : <Nhan loai="cho">Chưa in tem</Nhan>;

const lotBadge = (m: MucGiaiDoan, ten: string) =>
  (m.soLo ?? 0) > 0 ? (
    <Nhan loai="xong">
      {ten} ({m.soLo})
    </Nhan>
  ) : m.lyDo ? (
    <Nhan loai="luu-y" title={`Lý do chưa gắn lô: ${m.lyDo}`}>
      Chưa gắn lô · có lý do
    </Nhan>
  ) : (
    <Nhan loai="loi">Chưa gắn lô</Nhan>
  );

export function GiaiDoanTruyXuat() {
  const { dl } = useDuLieuTruyXuat();
  const navigate = useNavigate();
  const [tu, setTu] = useState(() => congNgay(homNay(), -6));
  const [den, setDen] = useState(homNay);
  const [workshop, setWorkshop] = useState<Workshop | "">("");
  const [onlyMissing, setOnlyMissing] = useState(false);

  const [lotLabel, setLotLabel] = useState<NutLo | null>(null);
  const [lotForBatch, setLotForBatch] = useState<WipProductionItem | null>(null);
  const [lotForPackaging, setLotForPackaging] = useState<Packaging | null>(null);
  const [lotForSalesItem, setLotForSalesItem] = useState<{ dong: SalesItem; loaiLo: "W" | "P" } | null>(null);
  const [lotForDomesticSale, setLotForDomesticSale] = useState<DomesticSaleItem | null>(null);

  const ds = useMemo(() => theoGiaiDoan(dl, { tu, den, xuong: workshop }), [dl, tu, den, workshop]);
  const tenMH = (id: string) => dl.products.find((p) => p.id === id)?.name || "—";

  /** Nút: việc còn thiếu thì nổi (default), còn lại viền (outline). */
  const taskButton = (thieu: boolean, title: string, onClick: () => void, icon: ReactNode, label: string) => (
    <Button size="sm" variant={thieu ? "default" : "outline"} title={title} onClick={onClick}>
      {icon}
      {label}
    </Button>
  );
  const labelButton = (m: MucGiaiDoan) =>
    taskButton(m.thieu.includes("tem"), `In tem QR cho lô ${m.nut.nhan} (mặc định mỗi block / thùng một tem).`, () => setLotLabel(m.nut), <Printer aria-hidden />, "In tem");

  const dongCua = (g: GiaiDoan, m: MucGiaiDoan): ReactNode => {
    const n = m.nut;
    if (g.khoa === "nhap")
      return (
        <StageRow
          key={n.id}
          m={m}
          trangThai={
            <>
              {labelBadge(m)}
              {(m.daDung ?? 0) > 0 ? <Nhan loai="nguon">Đã dùng cho {m.daDung} mẻ / dòng bán</Nhan> : <Nhan loai="phu">Chưa dùng</Nhan>}
            </>
          }
          nut={labelButton(m)}
        />
      );
    if (g.khoa === "san-xuat") {
      const w = dl.wips.find((x) => x.id === n.id);
      return (
        <StageRow
          key={n.id}
          m={m}
          trangThai={
            <>
              {lotBadge(m, "Lô NL")}
              {labelBadge(m)}
            </>
          }
          nut={
            <>
              {w &&
                taskButton(m.thieu.includes("lo"), `Ghi mẻ ${n.nhan} đã dùng lô nguyên liệu nào (quét tem, gõ mã hoặc chọn).`, () => setLotForBatch(w), <Link2 aria-hidden />, (m.soLo ?? 0) > 0 ? "Lô NL" : "Gắn lô NL")}
              {labelButton(m)}
            </>
          }
        />
      );
    }
    if (g.khoa === "kho")
      return (
        <StageRow
          key={n.id}
          m={m}
          trangThai={
            m.kho === "cho-nhap" ? (
              <Nhan loai="cho">Chờ nhập kho</Nhan>
            ) : (
              <Nhan loai="xong">Đã nhập kho{m.ton != null ? ` · tồn ${kg(m.ton)}` : ""}</Nhan>
            )
          }
          nut={
            m.kho === "cho-nhap"
              ? taskButton(true, `Mở màn Kho dự trữ với hộp duyệt nhập kho của mẻ ${n.nhan}.`, () => navigate(`/warehouse?duyet=W:${encodeURIComponent(n.id)}`), <ClipboardCheck aria-hidden />, "Duyệt nhập kho")
              : null
          }
        />
      );
    if (g.khoa === "dong-goi") {
      const p = dl.packagings.find((x) => x.id === n.id);
      return (
        <StageRow
          key={n.id}
          m={m}
          trangThai={
            <>
              {lotBadge(m, "Lô BTP")}
              {labelBadge(m)}
              {m.ton != null && <Nhan loai="vi-tri">Tồn {kg(m.ton)}</Nhan>}
            </>
          }
          nut={
            <>
              {p &&
                taskButton(m.thieu.includes("lo"), `Ghi phiếu ${n.nhan} đã dùng lô bán thành phẩm nào.`, () => setLotForPackaging(p), <Link2 aria-hidden />, (m.soLo ?? 0) > 0 ? "Lô BTP" : "Gắn lô BTP")}
              {labelButton(m)}
            </>
          }
        />
      );
    }
    // Xuất & bán
    if (n.kind === "X")
      return (
        <StageRow
          key={`X:${n.id}`}
          m={m}
          trangThai={m.daQuet ? <Nhan loai="xong">Đã quét kiểm</Nhan> : <Nhan loai="cho">Chưa quét kiểm</Nhan>}
          nut={
            m.donId && m.lenhId
              ? taskButton(!m.daQuet, "Mở màn Đơn đặt với hộp kiểm lô bằng quét của lệnh xuất này.", () => navigate(`/orders?don=${encodeURIComponent(m.donId!)}&kiem=${encodeURIComponent(m.lenhId!)}`), <ScanLine aria-hidden />, "Kiểm lô")
              : null
          }
        />
      );
    if (n.kind === "B") {
      const b = (dl.salesItems ?? []).find((x) => x.id === n.id);
      return (
        <StageRow
          key={`B:${n.id}`}
          m={m}
          trangThai={lotBadge(m, m.loaiLoBan === "P" ? "Lô TP" : "Lô BTP")}
          nut={
            b && m.loaiLoBan
              ? taskButton(m.thieu.includes("lo"), "Ghi dòng bán này lấy từ lô nào — để thu hồi tới được khách.", () => setLotForSalesItem({ dong: b, loaiLo: m.loaiLoBan! }), <Link2 aria-hidden />, (m.soLo ?? 0) > 0 ? "Lô" : "Gắn lô")
              : null
          }
        />
      );
    }
    const r = (dl.domesticSales ?? []).find((x) => x.id === n.id);
    return (
      <StageRow
        key={`N:${n.id}`}
        m={m}
        trangThai={lotBadge(m, "Lô NL")}
        nut={r ? taskButton(m.thieu.includes("lo"), "Ghi nguyên liệu bán này lấy từ lô NL nào.", () => setLotForDomesticSale(r), <Link2 aria-hidden />, (m.soLo ?? 0) > 0 ? "Lô NL" : "Gắn lô NL") : null}
      />
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 rounded-xl border-2 border-border p-4">
        <DateRangeField
          label="Khoảng ngày"
          hint="Ngày hàng về · ngày sản xuất · ngày đóng gói · ngày xuất / bán."
          startDate={tu}
          endDate={den}
          onChange={(a, b) => {
            setTu(a);
            setDen(b);
          }}
          anNhanBatBuoc
        />
        <ChoiceGroup
          label="Phân xưởng"
          value={workshop}
          onChange={(v) => setWorkshop(v as Workshop | "")}
          options={[{ value: "", label: "Tất cả" }, ...(["Đông", "Cá", "Khô"] as const).map((x) => ({ value: x, label: x }))]}
          cot={4}
          anNhanBatBuoc
        />
        <label className="flex cursor-pointer items-center gap-3">
          <input type="checkbox" className="size-5 shrink-0" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
          <span>
            Chỉ hiện mục <b>còn thiếu</b> (chưa in tem, chưa gắn lô, chờ duyệt, chưa quét kiểm)
          </span>
        </label>
      </div>

      <ol className="space-y-4">
        {ds.map((g, i) => {
          const soThieu = g.muc.filter((m) => m.thieu.length > 0).length;
          const isVisible = onlyMissing ? g.muc.filter((m) => m.thieu.length > 0) : g.muc;
          return (
            <li key={g.khoa} className="space-y-2 rounded-xl border-2 border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">
                  <span className="tnum">{i + 1}.</span> {g.ten}
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tnum text-muted-foreground">
                    {g.muc.length} {KHAU[g.khoa].donVi}
                  </span>
                  {g.muc.length > 0 &&
                    (soThieu > 0 ? <Nhan loai="loi">Còn thiếu {soThieu}</Nhan> : <Nhan loai="xong">Đủ</Nhan>)}
                </div>
              </div>
              <p className="text-muted-foreground">
                Làm ở{" "}
                {KHAU[g.khoa].man.map((x, k) => (
                  <span key={x.duong}>
                    {k > 0 && " · "}
                    <Link className="text-primary underline-offset-4 hover:underline" to={x.duong}>
                      {x.nhan}
                    </Link>
                  </span>
                ))}
                , hoặc bấm nút ngay ở từng dòng.
              </p>
              {isVisible.length > 0 ? (
                <ul>{isVisible.map((m) => dongCua(g, m))}</ul>
              ) : (
                <p className="text-muted-foreground">
                  {g.muc.length ? "Khâu này không còn mục thiếu." : `Không có ${KHAU[g.khoa].donVi} nào trong khoảng này.`}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      {ds.every((g) => g.muc.length === 0) && (
        <EmptyState tieuDe="Chưa có dữ liệu trong khoảng này" moTa="Nới khoảng ngày hoặc đổi phân xưởng." />
      )}
      <p className="flex items-center gap-2 text-muted-foreground">
        <Search aria-hidden className="size-4 shrink-0" /> Bấm vào mã lô để mở hộ chiếu: làm từ đâu, đã đi đâu, danh sách thu hồi.
      </p>

      {lotLabel && <TemLoQr nut={lotLabel} onClose={() => setLotLabel(null)} />}
      {lotForBatch && (
        <GanLoDauVao
          outputKind="W"
          outputId={lotForBatch.id}
          outputNhan={`mẻ ${nhanLoBtp(lotForBatch)} · ${tenMH(lotForBatch.productId)}`}
          xuong={lotForBatch.workshop}
          ngay={lotForBatch.productionDate}
          onClose={() => setLotForBatch(null)}
        />
      )}
      {lotForPackaging && (
        <GanLoDauVao
          outputKind="P"
          outputId={lotForPackaging.id}
          outputNhan={`phiếu ${nhanLoTp(lotForPackaging)} · ${tenMH(lotForPackaging.toProductId)}`}
          xuong={lotForPackaging.workshop}
          ngay={lotForPackaging.date}
          matHangId={lotForPackaging.fromProductId}
          onClose={() => setLotForPackaging(null)}
        />
      )}
      {lotForSalesItem && (
        <GanLoXuat
          docKind="sales_item"
          docId={lotForSalesItem.dong.id}
          docNhan={`${tenMH(lotForSalesItem.dong.productId)} · ${kg(lotForSalesItem.dong.quantityKg)} · ${viDate(lotForSalesItem.dong.deliveryDate)}`}
          loaiLo={lotForSalesItem.loaiLo}
          xuong={(dl.salesInvoices ?? []).find((v) => v.id === lotForSalesItem.dong.invoiceId)?.workshop ?? "Đông"}
          ngay={lotForSalesItem.dong.deliveryDate}
          matHangId={lotForSalesItem.dong.productId}
          onClose={() => setLotForSalesItem(null)}
        />
      )}
      {lotForDomesticSale && (
        <GanLoXuat
          docKind="domestic_sale"
          docId={lotForDomesticSale.id}
          docNhan={`bán nội địa ${lotForDomesticSale.materialTypeName} · ${kg(lotForDomesticSale.quantityKg)} · ${viDate(lotForDomesticSale.saleDate)}`}
          loaiLo="S"
          xuong={lotForDomesticSale.workshop}
          ngay={lotForDomesticSale.saleDate}
          onClose={() => setLotForDomesticSale(null)}
        />
      )}
    </div>
  );
}
