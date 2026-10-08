// ============================================================
// ĐỘ PHỦ TRUY XUẤT — tab của màn /qr (đợt 2b).
// Chuỗi truy xuất chỉ đáng tin khi mọi mắt xích được gắn lô. Tab này đo, theo
// khoảng ngày × xưởng: bao nhiêu mẻ đã có lô NL, phiếu đóng gói có lô BTP, lô đã
// in tem, dòng bán có lô, dòng lệnh xuất đã quét kiểm — và liệt kê chỗ còn thiếu.
// Số lấy từ doPhuTruyXuat (lib/truyXuatLo, hàm thuần có test).
// Thiết kế: docs/spec/qr-truy-xuat-lo.md §6d
// ============================================================
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Workshop } from "@/types";
import { useDuLieuTruyXuat } from "@/features/shared";
import { kg, viDate } from "@/lib/format";
import { TEN_LOAI, doPhuTruyXuat, laHangRa, type MucDoPhu } from "@/lib/truyXuatLo";
import { Button, ChoiceGroup, DateRangeField, EmptyState, Nhan, congNgay, homNay, sacTheoTen } from "@/design-system";
import { ChevronDown, ChevronRight } from "lucide-react";

/** Màn sửa chỗ thiếu của từng mục — để người xem biết đi đâu gắn. */
const CHO_SUA: Record<MucDoPhu["khoa"], { duong: string; nhan: string }> = {
  me: { duong: "/wip", nhan: "Sản xuất thành phẩm → \"Gắn lô NL\" ở dòng mẻ, hoặc hộp chốt ngày" },
  "dong-goi": { duong: "/packaging", nhan: "Đóng gói → \"Gắn lô BTP\" ở dòng phiếu" },
  tem: { duong: "/qr?tab=in", nhan: "tab In tem hàng loạt, tick \"Chỉ lô chưa in tem\"" },
  "ban-le": { duong: "/sales", nhan: "Bán hàng → \"Gắn lô\" ở dòng bán" },
  "ban-nd": { duong: "/wip", nhan: "Sản xuất thành phẩm → khối Bán nội địa, nút \"Gắn lô NL\"" },
  xuat: { duong: "/orders", nhan: "Đơn đặt → Lệnh xuất đã lập → \"Kiểm lô bằng quét\"" },
};

const phanTram = (m: MucDoPhu) => (m.tong ? Math.round(((m.co + m.coLyDo) / m.tong) * 100) : 100);

export function DoPhuTruyXuat() {
  const { dl } = useDuLieuTruyXuat();
  const [tu, setTu] = useState(() => congNgay(homNay(), -6));
  const [den, setDen] = useState(homNay);
  const [xuong, setXuong] = useState<Workshop | "">("");
  const [mo, setMo] = useState<MucDoPhu["khoa"] | null>(null);

  const ds = useMemo(() => doPhuTruyXuat(dl, { tu, den, xuong }), [dl, tu, den, xuong]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 rounded-xl border-2 border-border p-4">
        <DateRangeField
          label="Khoảng ngày"
          hint="Ngày hàng về · ngày sản xuất · ngày đóng gói · ngày bán · ngày xuất."
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
          value={xuong}
          onChange={(v) => setXuong(v as Workshop | "")}
          options={[{ value: "", label: "Tất cả" }, ...(["Đông", "Cá", "Khô"] as const).map((x) => ({ value: x, label: x }))]}
          cot={4}
          anNhanBatBuoc
        />
      </div>

      <ul className="space-y-3">
        {ds.map((m) => {
          const pt = phanTram(m);
          const dangMo = mo === m.khoa;
          return (
            <li key={m.khoa} className="space-y-3 rounded-xl border-2 border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold">{m.ten}</p>
                  <p className="tnum text-muted-foreground">
                    {m.tong === 0
                      ? "Không có trong khoảng này"
                      : `${m.co} / ${m.tong}${m.coLyDo ? ` · ${m.coLyDo} có lý do bỏ qua` : ""} · thiếu ${m.thieu.length}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Nhan loai={m.tong === 0 || pt === 100 ? "xong" : pt >= 80 ? "luu-y" : "loi"}>
                    <span className="tnum">{pt}%</span>
                  </Nhan>
                  {m.thieu.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      aria-expanded={dangMo}
                      title={dangMo ? "Thu gọn danh sách còn thiếu." : `Xem ${m.thieu.length} mục còn thiếu của "${m.ten}".`}
                      onClick={() => setMo(dangMo ? null : m.khoa)}
                    >
                      {dangMo ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />} Còn thiếu ({m.thieu.length})
                    </Button>
                  )}
                </div>
              </div>

              {dangMo && (
                <div className="space-y-2">
                  <p className="text-muted-foreground">
                    Sửa ở{" "}
                    <Link className="text-primary underline-offset-4 hover:underline" to={CHO_SUA[m.khoa].duong}>
                      {CHO_SUA[m.khoa].nhan}
                    </Link>
                    .
                  </p>
                  <ul className="max-h-96 space-y-1 overflow-y-auto">
                    {m.thieu.map((n) => (
                      <li key={`${n.kind}:${n.id}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border py-1">
                        <Nhan loai="phan-loai" sac={sacTheoTen(TEN_LOAI[n.kind])}>{TEN_LOAI[n.kind]}</Nhan>
                        {laHangRa(n.kind) ? (
                          <span className="font-medium">{n.nhan}</span>
                        ) : (
                          <Link
                            className="font-medium text-primary underline-offset-4 hover:underline"
                            title={`Mở hộ chiếu của lô ${n.nhan}.`}
                            to={`/qr?lo=${n.kind}:${encodeURIComponent(n.id)}`}
                          >
                            {n.nhan}
                          </Link>
                        )}
                        <span className="text-muted-foreground">
                          {[n.moTa, n.ngay && viDate(n.ngay), n.kg ? kg(n.kg) : ""].filter(Boolean).join(" · ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {ds.every((m) => m.tong === 0) && (
        <EmptyState tieuDe="Chưa có dữ liệu trong khoảng này" moTa="Nới khoảng ngày hoặc đổi phân xưởng." />
      )}
    </div>
  );
}
