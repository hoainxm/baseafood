// ============================================================
// IN TEM HÀNG LOẠT — tab của màn /qr.
// Một chỗ duy nhất để in tem cho mọi lô (NL · BTP · TP) theo ngày / xưởng / loại,
// in nhiều tem một lượt thay vì đi từng màn bấm từng nút "Tem".
// Danh sách lô lấy qua listLotsToPrint (lib/lotTraceability, hàm thuần có test).
// Thiết kế: docs/spec/qr-truy-xuat-lo.md §8
// ============================================================
import { useMemo, useState } from "react";
import type { LotKind, Workshop } from "@/types";
import { LotQrLabels, useTraceData } from "@/features/shared";
import { kg, formatDateVN } from "@/lib/format";
import { TRACE_KIND_LABELS, listLotsToPrint, lotKey, summarizeLabelPrints, type LotNode } from "@/lib/lotTraceability";
import { useLabelPrints } from "@/lib/catalogRepo";
import { Button, ChoiceGroup, DateRangeField, EmptyState, Tag, addDays, todayIso, notify, toneByName } from "@/design-system";
import { Printer } from "lucide-react";

const LOT_KINDS: { kind: LotKind; description: string }[] = [
  { kind: "S", description: "chuyến nhập" },
  { kind: "W", description: "mẻ sản xuất" },
  { kind: "P", description: "phiếu đóng gói" },
];
const nodeKey = (n: LotNode) => `${n.kind}:${n.id}`;

export function BulkLabelPrint() {
  const { dl } = useTraceData();
  const [tu, setTu] = useState(() => addDays(todayIso(), -6));
  const [den, setDen] = useState(todayIso);
  const [workshop, setWorkshop] = useState<Workshop | "">("");
  const [lotKinds, setLotKinds] = useState<LotKind[]>(["S", "W", "P"]);
  // Lưu những lô người dùng BỎ chọn (mặc định chọn hết) — đổi bộ lọc thì lô mới vào vẫn được chọn.
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const [printing, setPrinting] = useState<LotNode[] | null>(null);
  const [onlyUnprinted, setOnlyUnprinted] = useState(false);
  const [soIn] = useLabelPrints();
  const daIn = useMemo(() => summarizeLabelPrints(soIn), [soIn]);

  const allLots = useMemo(() => listLotsToPrint(dl, { tu, den, xuong: workshop, loai: lotKinds }), [dl, tu, den, workshop, lotKinds]);
  const unprintedCount = allLots.filter((n) => !daIn.has(lotKey(n.kind as LotKind, n.id))).length;
  const items = onlyUnprinted ? allLots.filter((n) => !daIn.has(lotKey(n.kind as LotKind, n.id))) : allLots;
  const selected = items.filter((n) => !deselected.has(nodeKey(n)));

  const toggleKind = (k: LotKind) =>
    setLotKinds((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  const toggleSelect = (n: LotNode) =>
    setDeselected((prev) => {
      const nextSet = new Set(prev);
      const k = nodeKey(n);
      if (nextSet.has(k)) nextSet.delete(k);
      else nextSet.add(k);
      return nextSet;
    });
  const selectAll = (isSelected: boolean) =>
    setDeselected(isSelected ? new Set() : new Set(items.map(nodeKey)));

  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-xl border-2 border-border p-4">
        <div className="grid gap-4">
          <DateRangeField
            label="Ngày của lô"
            hint="Ngày hàng về (nguyên liệu) · ngày sản xuất (bán thành phẩm) · ngày đóng gói (thành phẩm)."
            startDate={tu}
            endDate={den}
            onChange={(a, b) => {
              setTu(a);
              setDen(b);
            }}
            hideRequiredMark
          />
          <ChoiceGroup
            label="Phân xưởng"
            value={workshop}
            onChange={(v) => setWorkshop(v as Workshop | "")}
            options={[{ value: "", label: "Tất cả" }, ...(["Đông", "Cá", "Khô"] as const).map((x) => ({ value: x, label: x }))]}
            columns={4}
            hideRequiredMark
          />
        </div>
        <div className="space-y-2">
          <p className="font-medium">Loại lô</p>
          <div className="flex flex-wrap gap-2">
            {LOT_KINDS.map(({ kind, description }) => (
              <Button
                key={kind}
                type="button"
                variant={lotKinds.includes(kind) ? "default" : "outline"}
                title={`${lotKinds.includes(kind) ? "Bỏ" : "Thêm"} tem ${TRACE_KIND_LABELS[kind].toLowerCase()} (${description}) khỏi danh sách in.`}
                aria-pressed={lotKinds.includes(kind)}
                onClick={() => toggleKind(kind)}
              >
                {TRACE_KIND_LABELS[kind]}
              </Button>
            ))}
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            className="size-5 shrink-0"
            checked={onlyUnprinted}
            onChange={(e) => setOnlyUnprinted(e.target.checked)}
          />
          <span>
            Chỉ lô <b>chưa in tem</b>{" "}
            <span className="tnum text-muted-foreground">({unprintedCount} / {allLots.length} lô)</span>
          </span>
        </label>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title={onlyUnprinted && allLots.length ? "Lô trong khoảng này đều đã in tem" : "Không có lô nào trong khoảng này"}
          description={
            onlyUnprinted && allLots.length
              ? "Bỏ tick \"Chỉ lô chưa in tem\" nếu cần in lại."
              : "Nới khoảng ngày, chọn thêm loại lô hoặc đổi phân xưởng."
          }
        />
      ) : (
        <div className="space-y-3 rounded-xl border-2 border-border p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground">
              Đã chọn <span className="tnum font-semibold text-foreground">{selected.length}</span> / {items.length} lô
            </p>
            <div className="flex flex-wrap gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
              <Button
                type="button"
                variant="outline"
                title={selected.length === items.length ? "Bỏ chọn mọi lô trong danh sách." : "Chọn mọi lô trong danh sách để in."}
                onClick={() => selectAll(selected.length !== items.length)}
              >
                {selected.length === items.length ? "Bỏ chọn hết" : "Chọn hết"}
              </Button>
              <Button
                type="button"
                title="Mở bản in cho các lô đang chọn, mỗi tem một nhãn đúng khổ tem."
                onClick={() => (selected.length ? setPrinting(selected) : notify.warning("Chưa chọn lô nào để in."))}
              >
                <Printer aria-hidden /> In {selected.length} tem
              </Button>
            </div>
          </div>

          <ul className="max-h-[60dvh] divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {items.map((n) => {
              const k = nodeKey(n);
              const isSelected = !deselected.has(k);
              const supplier = n.chiTiet.find((c) => c.nhan === "Đại lý")?.giaTri;
              return (
                <li key={k}>
                  <label className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-muted">
                    <input
                      type="checkbox"
                      className="mt-1 size-5 shrink-0"
                      checked={isSelected}
                      onChange={() => toggleSelect(n)}
                      aria-label={`In tem lô ${n.nhan} · ${n.moTa}`}
                    />
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <Tag variant="phan-loai" tone={toneByName(TRACE_KIND_LABELS[n.kind])}>{TRACE_KIND_LABELS[n.kind]}</Tag>
                        <span className="tnum font-semibold">{n.nhan}</span>
                        {(() => {
                          const t = daIn.get(lotKey(n.kind as LotKind, n.id));
                          return t ? (
                            <Tag variant="xong">Đã in {t.tem} tem · {formatDateVN(t.cuoi.printedAt.slice(0, 10))}</Tag>
                          ) : (
                            <Tag variant="cho">Chưa in tem</Tag>
                          );
                        })()}
                      </span>
                      <span className="block text-muted-foreground">
                        {[n.moTa, formatDateVN(n.ngay), n.xuong && `xưởng ${n.xuong}`, supplier, n.kg ? kg(n.kg) : ""]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {printing && <LotQrLabels nuts={printing} onClose={() => setPrinting(null)} />}
    </div>
  );
}
