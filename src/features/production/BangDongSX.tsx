// ============================================================
// Tên file: src/features/production/BangDongSX.tsx
// Tên tiếng Việt: Bảng dòng thành phẩm theo nhóm (kiểu chế biến × khách) của phiên ghi SX
// Tách khỏi WipProductionScreen.tsx ngày 2026-09-21 — KHÔNG đổi logic.
// ============================================================
import { Fragment } from "react";
import type { Product } from "@/types";
import { laCoTach, quyCachBlock } from "@/types";
import { Button, Combobox, NumberField, type MucChon } from "@/design-system";
import { num } from "@/lib/format";
import { ChevronDown, Plus, X } from "lucide-react";
import { dongTrong, laTach, tongDong, type DongSX } from "./wipHelpers";

/**
 * BẢNG nhập NHÓM THEO LOÀI: mỗi loài một cụm (Bạch tuộc, Mực, Cá…), dưới là bảng
 * thành phẩm của loài đó (cột ngang kiểu bảng tính, nhãn đi bằng tiêu đề cột).
 * Gom theo LOÀI vì loài có sẵn trên mọi mặt hàng (141 mã seed) và gộp lớn/nhỏ tự
 * nhiên — "Bạch tuộc 2 da lớn/nhỏ" đều là loài Bạch tuộc. Mã có cờ "tách râu/bao
 * tử" (Danh mục) mới hiện mũi tên đầu dòng để mở ô râu + bao tử. Mã có "quy cách
 * block" thì nhập số block tự tính kg gợi ý. Thêm nhóm bằng ô "Thêm loài" ở cuối.
 */
export function BangDongSX({
  dong,
  matHang,
  onSua,
  onBo,
  onThemDong,
  onThemNhom,
  onDoiNhom,
  onTaoMatHang,
  optKhach,
  onTaoKhach,
}: {
  dong: DongSX[];
  matHang: Product[];
  onSua: (key: string, patch: Partial<DongSX>) => void;
  onBo: (key: string) => void;
  onThemDong: (
    groupId: string,
    processingType: string,
    customerName: string
  ) => void;
  onThemNhom: (processingType?: string, customerName?: string) => void;
  onDoiNhom: (
    groupId: string,
    patch: Partial<Pick<DongSX, "processingType" | "customerName">>
  ) => void;
  onTaoMatHang: (ten: string, processingType: string) => string;
  optKhach: MucChon[];
  onTaoKhach: (ten: string) => string;
}) {
  const th =
    "border-b-2 border-border bg-card px-2 py-2 text-left text-sm font-semibold whitespace-nowrap";
  const td = "border-b border-border px-2 py-2 align-middle";

  // Nhóm theo groupId ỔN ĐỊNH (giữ thứ tự xuất hiện) — sửa nhãn không remount.
  const nhomKeys: string[] = [];
  const nhomRows = new Map<string, DongSX[]>();
  for (const d of dong) {
    if (!nhomRows.has(d.groupId)) {
      nhomRows.set(d.groupId, []);
      nhomKeys.push(d.groupId);
    }
    nhomRows.get(d.groupId)!.push(d);
  }

  // Gợi ý kiểu chế biến = các giá trị đã có trên mặt hàng (thêm mới tại chỗ được).
  const optCheBien: MucChon[] = [
    ...new Set(
      matHang.map((m) => (m.processingType || "").trim()).filter(Boolean)
    ),
  ]
    .sort((a, b) => a.localeCompare(b, "vi"))
    .map((v) => ({ value: v, label: v }));

  // Mọi mặt hàng (gõ tên để tìm) — không giới hạn theo loài.
  const optMatHangTatCa: MucChon[] = matHang.map((m) => ({
    value: m.id,
    label: m.code ? `${m.code} · ${m.name}` : m.name,
    phu: [m.code, m.processingType, m.category].filter(Boolean).join(" · ") || undefined,
  }));

  return (
    // data-luoi-phim: khung điều hướng ↑/↓/Enter theo cột cho các ô số (navCol).
    <div className="space-y-4" data-luoi-phim>
      {nhomKeys.map((gid) => {
        const rows = nhomRows.get(gid)!;
        const info = { pt: rows[0].processingType, cust: rows[0].customerName };
        const soThat = rows.filter((d) => !dongTrong(d)).length;
        return (
          <div
            key={gid}
            className="overflow-hidden rounded-lg border-2 border-border"
          >
            {/* Đầu nhóm SỬA ĐƯỢC tại chỗ: kiểu chế biến × khách — cập nhật mọi dòng
                cùng groupId (nhãn vẫn lưu theo từng dòng khi Lưu vào sổ). */}
            <div className="flex flex-wrap items-end gap-3 bg-muted px-3 py-2.5">
              <div className="min-w-[10rem] flex-1">
                <Combobox
                  label="Kiểu chế biến"
                  value={info.pt}
                  onChange={(v) => onDoiNhom(gid, { processingType: v })}
                  options={optCheBien}
                  onCreate={(ten) => ten}
                  placeholder="VD: 2 da chần, luộc…"
                  emptyText="Chưa có — gõ tên rồi Thêm mới."
                />
              </div>
              <div className="min-w-[10rem] flex-1">
                <Combobox
                  label="Khách hàng"
                  value={info.cust}
                  onChange={(v) => onDoiNhom(gid, { customerName: v })}
                  options={optKhach}
                  onCreate={(ten) => onTaoKhach(ten)}
                  placeholder="VD: Peacock…"
                  emptyText="Chưa có — gõ tên rồi Thêm mới."
                />
              </div>
              <span className="pb-2.5 text-sm text-muted-foreground">
                {soThat} thành phẩm
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[840px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className={`${th} w-10`} aria-label="Mở tách" />
                    <th className={`${th} min-w-[13rem]`}>
                      Thành phẩm <span className="text-destructive">*</span>
                    </th>
                    <th className={`${th} min-w-[8.5rem]`}>
                      Số lượng (kg) <span className="text-destructive">*</span>
                    </th>
                    <th className={`${th} min-w-[13rem]`}>
                      Số block × quy cách
                    </th>
                    <th className={`${th} w-12`} aria-label="Bỏ dòng" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((d) => {
                    // Mũi tên tách hiện ở MỌI dòng; tách "tính" khi đã nhập
                    // râu/bao tử. Mã đánh dấu "Có tách" chỉ để tự mở sẵn.
                    const tach = laTach(d);
                    return (
                      <Fragment key={d.key}>
                        <tr>
                          <td className={`${td} text-center`}>
                            <button
                              type="button"
                              onClick={() => onSua(d.key, { moRong: !d.moRong })}
                              aria-expanded={d.moRong}
                              aria-label="Mở/đóng ô râu + bao tử"
                              title="Tách râu + bao tử (cùng giá)"
                              className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                            >
                              <ChevronDown
                                className={`size-5 transition-transform ${d.moRong ? "" : "-rotate-90"}`}
                                aria-hidden
                              />
                            </button>
                          </td>
                          <td className={td}>
                            <Combobox
                              anNhan
                              label="Thành phẩm"
                              required
                              value={d.productId}
                              onChange={(v) => {
                                const p = matHang.find((m) => m.id === v);
                                onSua(d.key, {
                                  productId: v,
                                  // Mã đánh dấu "Có tách" → tự mở ô tách.
                                  moRong: laCoTach(p) ? true : d.moRong,
                                  // Có quy cách đã gắn ở mặt hàng → tự điền kg/khối.
                                  blockSpecKg: quyCachBlock(p) ?? d.blockSpecKg,
                                });
                              }}
                              options={optMatHangTatCa}
                              onCreate={(ten) => onTaoMatHang(ten, info.pt)}
                              emptyText="Chưa có mặt hàng — gõ tên rồi Thêm mới."
                            />
                          </td>
                          <td className={td}>
                            {tach ? (
                              <div
                                className="tnum flex h-10 items-center rounded-md bg-muted px-3 font-semibold"
                                title="Tổng = râu + bao tử"
                              >
                                {num(tongDong(d))}
                              </div>
                            ) : (
                              <NumberField
                                anNhan
                                navCol="sl"
                                label="Số lượng"
                                required
                                unit="kg"
                                value={d.quantityKg || null}
                                onChange={(v) =>
                                  onSua(d.key, { quantityKg: v ?? 0 })
                                }
                              />
                            )}
                          </td>
                          <td className={td}>
                            <div className="flex items-center gap-1.5">
                              <NumberField
                                anNhan
                                anNhanBatBuoc
                                navCol="block"
                                label="Số block"
                                unit="block"
                                className="min-w-[5.5rem] flex-1"
                                value={d.blocksCount || null}
                                onChange={(v) => {
                                  const b = v ?? 0;
                                  const s = d.blockSpecKg || 0;
                                  // Có quy cách & chưa tách → tự tính kg = block × quy cách.
                                  onSua(
                                    d.key,
                                    s > 0 && !tach
                                      ? { blocksCount: b, quantityKg: b * s }
                                      : { blocksCount: b }
                                  );
                                }}
                              />
                              <span className="text-sm text-muted-foreground">
                                ×
                              </span>
                              <NumberField
                                anNhan
                                anNhanBatBuoc
                                navCol="quycach"
                                label="Quy cách kg/khối"
                                unit="kg/khối"
                                className="min-w-[6rem] flex-1"
                                value={d.blockSpecKg || null}
                                onChange={(v) => {
                                  const s = v ?? 0;
                                  const b = d.blocksCount || 0;
                                  onSua(
                                    d.key,
                                    b > 0 && s > 0 && !tach
                                      ? { blockSpecKg: s, quantityKg: b * s }
                                      : { blockSpecKg: s }
                                  );
                                }}
                              />
                            </div>
                          </td>
                          <td className={`${td} text-center`}>
                            <Button
                              title="Bỏ dòng thành phẩm này khỏi phiên đang gõ (chưa lưu nên không đụng sổ)."
                              variant="outline"
                              size="icon"
                              aria-label="Bỏ dòng"
                              onClick={() => onBo(d.key)}
                            >
                              <X />
                            </Button>
                          </td>
                        </tr>

                        {d.moRong && (
                          <tr className="bg-accent/30">
                            <td className="border-b border-border" />
                            <td
                              className="border-b border-border px-2 pb-3"
                              colSpan={4}
                            >
                              <p className="mb-2 text-sm text-muted-foreground">
                                Tách râu + bao tử (cùng giá) — Số lượng = tổng
                                hai ô.
                              </p>
                              <div className="flex flex-wrap items-end gap-4">
                                <NumberField
                                  label="Râu"
                                  unit="kg"
                                  navCol="rau"
                                  className="min-w-[8rem] flex-1"
                                  value={d.rauKg || null}
                                  onChange={(v) =>
                                    onSua(d.key, { rauKg: v ?? 0 })
                                  }
                                />
                                <NumberField
                                  label="Bao tử"
                                  unit="kg"
                                  navCol="baotu"
                                  className="min-w-[8rem] flex-1"
                                  value={d.baoTuKg || null}
                                  onChange={(v) =>
                                    onSua(d.key, { baoTuKg: v ?? 0 })
                                  }
                                />
                                <div className="pb-2 text-base text-muted-foreground">
                                  Tổng ={" "}
                                  <span className="tnum font-semibold text-foreground">
                                    {num(tongDong(d))}
                                  </span>{" "}
                                  kg
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-2">
              <Button
                title="Thêm một dòng thành phẩm nữa vào nhóm này (cùng kiểu chế biến và khách hàng)."
                type="button"
                variant="outline"
                className="border-dashed"
                onClick={() => onThemDong(gid, info.pt, info.cust)}
              >
                <Plus />
                Thêm thành phẩm
              </Button>
            </div>
          </div>
        );
      })}

      {/* Thêm NHÓM mới — nhãn kiểu chế biến × khách đặt ngay ở đầu nhóm sau khi thêm */}
      <Button
        title="Mở một nhóm mới cho kiểu chế biến / khách hàng khác — mỗi nhóm gõ sản lượng riêng."
        type="button"
        variant="outline"
        className="w-full border-dashed sm:w-auto"
        onClick={() => onThemNhom()}
      >
        <Plus />
        Thêm nhóm (kiểu chế biến × khách)
      </Button>
    </div>
  );
}
