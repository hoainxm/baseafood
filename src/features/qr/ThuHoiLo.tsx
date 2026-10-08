// ============================================================
// THU HỒI THEO LÔ — mục cuối của hộ chiếu lô (/qr, đợt 2b).
// Lô nghi có vấn đề ⇒ trả lời ngay: những ai đã nhận hàng (khách · ngày · chứng
// từ · kg) và lô BTP/TP nào còn trong xưởng cần khoanh lại. In A4 + tải Excel để
// gửi đoàn kiểm tra (FSMA 204 đòi hồ sơ trong 24 giờ).
// Số lấy từ danhSachThuHoi (lib/truyXuatLo, hàm thuần có test).
// ============================================================
import { useMemo, useState } from "react";
import { kg, viDate } from "@/lib/format";
import { TEN_LOAI, danhSachThuHoi, danhSachThuHoiNhieu, tonKhoCuaLo, type DuLieuTruyXuat, type NutLo } from "@/lib/truyXuatLo";
import { Button, InfoTip, KhungCuonNgang, PhieuIn, TdIn, ThIn } from "@/design-system";
import { FileSpreadsheet, Printer, ShieldAlert } from "lucide-react";

const kgHoacTrong = (v: number | null) => (v == null ? "chưa ghi kg" : kg(v));

export function ThuHoiLo({ nut, dl, cungChuyen = [] }: { nut: NutLo; dl: DuLieuTruyXuat; cungChuyen?: NutLo[] }) {
  const [dangIn, setDangIn] = useState(false);
  /** Lô NL có nhiều loại cùng chuyến ⇒ cho thu hồi GỘP cả chuyến (nghi cả xe hàng của đại lý). */
  const [caChuyen, setCaChuyen] = useState(false);
  const gopChuyen = caChuyen && cungChuyen.length > 1;
  const { hangRa, loTrongXuong } = useMemo(
    () => (gopChuyen ? danhSachThuHoiNhieu(cungChuyen, dl) : danhSachThuHoi(nut.kind, nut.id, dl)),
    [gopChuyen, cungChuyen, nut, dl]
  );
  const phamVi = gopChuyen ? `chuyến ${nut.nhan} (${cungChuyen.length} loại NL)` : `lô ${nut.nhan}${nut.kind === "S" ? ` · ${nut.moTa}` : ""}`;
  const tonTrong = useMemo(
    () => loTrongXuong.map((n) => ({ n, ton: tonKhoCuaLo(n.kind, n.id, dl) })),
    [loTrongXuong, dl]
  );
  const soKhach = new Set(hangRa.map((r) => r.khach || "khách ?")).size;
  const tongKg = hangRa.reduce((s, r) => s + (r.kg ?? 0), 0);

  const taiExcel = async () => {
    const { exportAoaToXlsx } = await import("@/lib/reportXlsx"); // nạp động — xlsx không vào chunk chính
    exportAoaToXlsx({
      sheetName: "Thu hồi",
      fileName: `thu-hoi-${nut.nhan}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "")}.xlsx`,
      colWidths: [14, 28, 12, 26, 32, 12, 22],
      aoa: [
        [`Danh sách thu hồi — ${phamVi} (${TEN_LOAI[nut.kind]})`],
        [],
        ["Ngả ra", "Khách", "Ngày", "Chứng từ", "Mặt hàng", "Kg", "Từ lô"],
        ...hangRa.map((r) => [TEN_LOAI[r.loai], r.khach, r.ngay, r.chungTu, r.matHang, r.kg, r.tuLo]),
        [],
        ["Lô còn trong xưởng", "Mặt hàng", "Ngày", "Tồn trong kho (kg)"],
        ...tonTrong.map(({ n, ton }) => [`${TEN_LOAI[n.kind]} ${n.nhan}`, n.moTa, n.ngay, ton]),
      ],
    });
  };

  return (
    <section className="space-y-3 rounded-xl border-2 border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <ShieldAlert aria-hidden /> Thu hồi — ai đã nhận hàng từ lô này
          <InfoTip label="thu hồi">
            Đi hết cây truy xuôi: mọi lệnh xuất, dòng bán lẻ, bán nội địa có dùng lô này, kể cả qua mẻ sản xuất / đóng gói trung gian. Chỉ tính các mối nối ĐÃ GẮN LÔ — hàng bán mà chưa gắn lô thì không hiện ở đây (xem tab Theo giai đoạn).
          </InfoTip>
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" title="Mở bản in A4 danh sách thu hồi để in hoặc lưu PDF." onClick={() => setDangIn(true)}>
            <Printer aria-hidden /> In danh sách
          </Button>
          <Button variant="outline" title="Tải danh sách thu hồi ra file Excel." onClick={taiExcel}>
            <FileSpreadsheet aria-hidden /> Tải Excel
          </Button>
        </div>
      </div>

      {cungChuyen.length > 1 && (
        <label className="flex cursor-pointer items-center gap-3">
          <input type="checkbox" className="size-5 shrink-0" checked={caChuyen} onChange={(e) => setCaChuyen(e.target.checked)} />
          <span>
            Thu hồi <b>cả chuyến</b> ({cungChuyen.length} loại nguyên liệu cùng xe, cùng đại lý)
          </span>
        </label>
      )}

      <p className="tnum">
        {hangRa.length
          ? `${hangRa.length} ngả ra · ${soKhach} khách · ${kg(tongKg)} đã ghi kg`
          : "Chưa ghi nhận hàng nào từ lô này ra khỏi xưởng."}
        {loTrongXuong.length > 0 && ` · ${loTrongXuong.length} lô còn trong xưởng cần khoanh lại`}
      </p>

      {hangRa.length > 0 && (
        <KhungCuonNgang>
          <table className="w-full min-w-[40rem] border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-1 pr-3 font-medium">Khách</th>
                <th className="py-1 pr-3 font-medium">Ngày</th>
                <th className="py-1 pr-3 font-medium">Chứng từ</th>
                <th className="py-1 pr-3 font-medium">Mặt hàng</th>
                <th className="py-1 pr-3 text-right font-medium">Kg</th>
                <th className="py-1 font-medium">Từ lô</th>
              </tr>
            </thead>
            <tbody>
              {hangRa.map((r, i) => (
                <tr key={i} className="border-b border-border">
                  <td className="py-1 pr-3 font-medium">{r.khach || "khách ?"}</td>
                  <td className="tnum py-1 pr-3">{r.ngay ? viDate(r.ngay) : "—"}</td>
                  <td className="py-1 pr-3">{r.chungTu}</td>
                  <td className="py-1 pr-3">{r.matHang}</td>
                  <td className="tnum py-1 pr-3 text-right">{kgHoacTrong(r.kg)}</td>
                  <td className="tnum py-1">{r.tuLo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </KhungCuonNgang>
      )}

      {tonTrong.length > 0 && (
        <div className="space-y-1">
          <p className="font-medium">Lô còn trong xưởng</p>
          <ul className="space-y-1">
            {tonTrong.map(({ n, ton }) => (
              <li key={`${n.kind}:${n.id}`} className="tnum text-muted-foreground">
                {TEN_LOAI[n.kind]} <span className="font-medium text-foreground">{n.nhan}</span> · {n.moTa}
                {ton != null ? ` · tồn trong kho ${kg(ton)}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {dangIn && (
        <PhieuIn
          tieuDe="Danh sách thu hồi theo lô"
          phuDe={`${gopChuyen ? `Chuyến ${nut.nhan} · ${cungChuyen.length} loại NL` : `Lô ${nut.nhan} · ${TEN_LOAI[nut.kind]} · ${nut.moTa}`}${nut.ngay ? ` · ${viDate(nut.ngay)}` : ""}`}
          onClose={() => setDangIn(false)}
        >
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <ThIn>Ngả ra</ThIn>
                <ThIn>Khách</ThIn>
                <ThIn>Ngày</ThIn>
                <ThIn>Chứng từ</ThIn>
                <ThIn>Mặt hàng</ThIn>
                <ThIn right>Kg</ThIn>
                <ThIn>Từ lô</ThIn>
              </tr>
            </thead>
            <tbody>
              {hangRa.length ? (
                hangRa.map((r, i) => (
                  <tr key={i}>
                    <TdIn>{TEN_LOAI[r.loai]}</TdIn>
                    <TdIn>{r.khach || "khách ?"}</TdIn>
                    <TdIn>{r.ngay ? viDate(r.ngay) : "—"}</TdIn>
                    <TdIn>{r.chungTu}</TdIn>
                    <TdIn>{r.matHang}</TdIn>
                    <TdIn right>{kgHoacTrong(r.kg)}</TdIn>
                    <TdIn>{r.tuLo}</TdIn>
                  </tr>
                ))
              ) : (
                <tr>
                  <TdIn colSpan={7}>Chưa ghi nhận hàng nào từ lô này ra khỏi xưởng.</TdIn>
                </tr>
              )}
            </tbody>
          </table>
          {tonTrong.length > 0 && (
            <table className="mt-4 w-full border-collapse">
              <thead>
                <tr>
                  <ThIn>Lô còn trong xưởng</ThIn>
                  <ThIn>Mặt hàng</ThIn>
                  <ThIn>Ngày</ThIn>
                  <ThIn right>Tồn trong kho</ThIn>
                </tr>
              </thead>
              <tbody>
                {tonTrong.map(({ n, ton }) => (
                  <tr key={`${n.kind}:${n.id}`}>
                    <TdIn>{`${TEN_LOAI[n.kind]} ${n.nhan}`}</TdIn>
                    <TdIn>{n.moTa}</TdIn>
                    <TdIn>{n.ngay ? viDate(n.ngay) : "—"}</TdIn>
                    <TdIn right>{ton != null ? kg(ton) : "—"}</TdIn>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </PhieuIn>
      )}
    </section>
  );
}
