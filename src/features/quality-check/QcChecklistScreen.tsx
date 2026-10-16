// ============================================================
// Màn Kiểm tra QC — checklist chấm điểm cuối ngày (họp 2026-09-02, QĐ-8).
// Cuối ngày QC/kỹ thuật kiểm bộ chỉ tiêu (vệ sinh, dụng cụ, thiết bị…), mỗi
// chỉ tiêu chấm nhanh: Đạt / Cần khắc phục / Không đạt (+ điểm tùy chọn) + ghi
// chú, rồi CHỐT NGÀY. Sửa sau khi chốt hoặc ghi cho ngày cũ = ghi bù (bắt lý do).
// Ảnh kèm: để sau (chưa có hạ tầng lưu ảnh).
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import type { QcChecklistItem, QcResult, Workshop } from "@/types";
import { isBackdatedQc } from "@/types";
import { newId } from "@/lib/store";
import { isServerConnected, useQcChecklists, useQcLocks } from "@/lib/catalogRepo";
import { useFormDraft } from "@/lib/formDraft";
import { useAuth } from "@/lib/auth";
import { DraftRestoredNotice } from "@/features/shared/DraftRestoredNotice";
import { subtractDays, countQcByDay } from "@/lib/dataFlow";
import { uploadImage, getPhotoUrl, deleteImage, hasImageStorage } from "@/lib/storage";
import { todayISO, formatDateVN } from "@/lib/format";
import {
  Field,
  ChoiceGroup,
  NumberField,
  DateField,
  Input,
  Button,
  Tag,
  EmptyState,
  ReadOnlyBadge,
  notify,
  type ChoiceOption,
  TimeSeriesChart,
} from "@/design-system";
import { useCan, useCanOnRow } from "@/features/shared/PermissionProvider";
import { Camera, Lock, Plus, X } from "lucide-react";

const WORKSHOP_OPTIONS: ChoiceOption[] = [
  { value: "Đông", label: "Đông" },
  { value: "Cá", label: "Cá" },
  { value: "Khô", label: "Khô" },
];

const RESULT_OPTIONS: ChoiceOption[] = [
  { value: "pass", label: "Đạt" },
  { value: "conditional", label: "Cần khắc phục" },
  { value: "fail", label: "Không đạt" },
];

/** Nhãn kết quả cho chế độ chỉ xem. */
const RESULT_TAGS: Record<QcResult, { label: string; variant: "done" | "warning" | "error" }> = {
  pass: { label: "Đạt", variant: "done" },
  conditional: { label: "Cần khắc phục", variant: "warning" },
  fail: { label: "Không đạt", variant: "error" },
};

/** Bộ chỉ tiêu mặc định — chấm nhanh, vẫn thêm chỉ tiêu mới tại chỗ. */
const DEFAULT_CRITERIA = [
  "Vệ sinh nhà xưởng",
  "Vệ sinh dụng cụ sản xuất",
  "Thiết bị / máy móc",
  "Bảo hộ lao động (BHLĐ)",
  "Nhiệt độ kho lạnh",
  "Nước đá / nước sản xuất",
  "Hóa chất / khử trùng",
  "Kiểm soát côn trùng",
  "Rác thải / nước thải",
  "Hồ sơ ghi chép",
];

/** Bảng chấm điểm của (ngày × xưởng) dựng từ sổ: tiêu chí mặc định + tiêu chí đã ghi. */
function buildQcRows(rows: QcChecklistItem[], date: string, workshop: Workshop): { dongs: Row[]; backdateReason: string } {
  const dayRows = rows.filter((r) => r.date === date && r.workshop === workshop);
  const byCriterion = new Map(dayRows.map((r) => [r.criterion, r]));
  const names = [...DEFAULT_CRITERIA, ...dayRows.map((r) => r.criterion).filter((t) => !DEFAULT_CRITERIA.includes(t))];
  return {
    dongs: names.map((name) => {
      const prev = byCriterion.get(name);
      return {
        criterion: name,
        result: (prev?.result ?? "") as QcResult | "",
        score: prev?.score ?? null,
        note: prev?.note ?? "",
        photoPaths: prev?.photoPaths ?? [],
      };
    }),
    backdateReason: dayRows.find((r) => r.backdateReason)?.backdateReason ?? "",
  };
}

/** Một dòng chấm điểm trên màn (chưa lưu). */
interface Row {
  criterion: string;
  result: QcResult | "";
  score: number | null;
  note: string;
  photoPaths: string[]; // đường dẫn ảnh đã tải (Supabase Storage bucket "qc")
}

export default function QcChecklistScreen() {
  const [rows, persist, { status: qcStatus }] = useQcChecklists();
  const [locks, persistLocks, { status: lockStatus }] = useQcLocks();
  /** Phân quyền lớp 2 (spec role-permissions §5): không thêm lẫn sửa ⇒ chỉ xem kết quả. */
  const allowed = useCan("qc");
  const canWrite = allowed.create || allowed.update;
  /** Phạm vi Đợt 5 (spec §3c): quản đốc chấm / chốt / mở lại QC xưởng mình, xem mọi xưởng. */
  const canRow = useCanOnRow("qc");

  const [date, setDate] = useState(todayISO());
  const [workshop, setWorkshop] = useState<Workshop>("Đông");
  const [dongs, setDongs] = useState<Row[]>([]);
  const [backdateReason, setBackdateReason] = useState("");
  const [newName, setNewName] = useState("");

  const saved = useMemo(
    () => rows.filter((r) => r.date === date && r.workshop === workshop),
    [rows, date, workshop]
  );
  const lock = useMemo(
    () => locks.find((l) => l.lockDate === date && l.workshop === workshop && l.isLocked),
    [locks, date, workshop]
  );
  const isLocked = Boolean(lock);
  const scopeRow = { workshop };
  /** Ghi được (ngày × xưởng) đang chọn — phạm vi "all" ⇒ trùng `canWrite`. */
  const canWriteDay = canRow("create", scopeRow, "create") || canRow("update", scopeRow);
  const writableWorkshops = WORKSHOP_OPTIONS.map((o) => o.value).filter(
    (w) => canRow("create", { workshop: w }, "create") || canRow("update", { workshop: w })
  );
  const isBackdate = isLocked || isBackdatedQc(date, todayISO());

  /* Tự lưu NHÁP phiếu chấm đang gõ (quy tắc 17, lib/formDraft.ts). Phiếu QC nạp lại từ sổ
     mỗi khi đổi ngày/xưởng ⇒ nháp mở lại được đổ vào SAU bước nạp (pendingDraft). "Trống" =
     phiếu y hệt số đã lưu. */
  const { profile } = useAuth();
  const pendingDraft = useRef<{ date: string; workshop: Workshop; dongs: Row[]; backdateReason: string } | null>(null);
  const qcDraft = useFormDraft({
    form: "qc",
    account: profile?.username ?? "",
    accountReady: profile !== null || !isServerConnected,
    value: { date, workshop, dongs, backdateReason },
    isEmpty: (d) => {
      const savedForm = buildQcRows(rows, d.date, d.workshop);
      return JSON.stringify(savedForm.dongs) === JSON.stringify(d.dongs) && savedForm.backdateReason === d.backdateReason;
    },
    onRestore: (d) => {
      // Effect nạp-từ-sổ sẽ còn chạy (đổi ngày/xưởng hoặc sổ chưa tải xong) ⇒ nhờ nó giữ nháp.
      const willReload = qcStatus === "loading" || d.date !== date || d.workshop !== workshop;
      pendingDraft.current = willReload ? d : null;
      setDate(d.date);
      setWorkshop(d.workshop);
      setDongs(d.dongs);
      setBackdateReason(d.backdateReason);
    },
  });

  // Đổi (ngày × xưởng) hoặc dữ liệu tải xong → nạp lại bảng chấm điểm từ sổ.
  useEffect(() => {
    const p = pendingDraft.current;
    if (p && p.date === date && p.workshop === workshop) {
      // Vừa mở lại nháp đúng ngày × xưởng này ⇒ giữ số đang gõ dở, đừng nạp đè từ sổ.
      pendingDraft.current = null;
      setDongs(p.dongs);
      setBackdateReason(p.backdateReason);
      return;
    }
    const built = buildQcRows(rows, date, workshop);
    setDongs(built.dongs);
    setBackdateReason(built.backdateReason);
  }, [date, workshop, rows]);

  const updateRow = (i: number, patch: Partial<Row>) =>
    setDongs((items) => items.map((d, k) => (k === i ? { ...d, ...patch } : d)));

  const addCriterion = () => {
    const name = newName.trim();
    if (!name) return;
    if (dongs.some((d) => d.criterion === name)) {
      notify.warning("Chỉ tiêu này đã có trong danh sách");
      return;
    }
    setDongs((items) => [
      ...items,
      { criterion: name, result: "", score: null, note: "", photoPaths: [] },
    ]);
    setNewName("");
  };

  // 30 ngày tới ngày đang xem — xu hướng chất lượng của xưởng.
  const qc30 = useMemo(() => countQcByDay(rows, workshop, subtractDays(date, 29), date), [rows, workshop, date]);
  const hasQc30 = qc30.some((x) => x.pass + x.conditional + x.fail > 0);

  const scoredRows = dongs.filter((d) => d.result);
  const passCount = scoredRows.filter((d) => d.result === "pass").length;
  const failCount = scoredRows.filter((d) => d.result === "fail").length;

  const save = () => {
    const scored = dongs.filter((d) => d.result);
    if (scored.length === 0) {
      notify.warning("Chưa chấm chỉ tiêu nào — chọn ít nhất một kết quả");
      return;
    }
    if (isBackdate && !backdateReason.trim()) {
      notify.warning(
        isLocked
          ? "Ngày đã chốt — nhập lý do ghi bù để sửa"
          : "Ghi cho ngày cũ — nhập lý do ghi bù"
      );
      return;
    }
    const idTheoTen = new Map(saved.map((r) => [r.criterion, r.id]));
    const newRows: QcChecklistItem[] = scored.map((d) => ({
      id: idTheoTen.get(d.criterion) ?? newId(),
      date,
      workshop,
      criterion: d.criterion,
      result: d.result as QcResult,
      score: d.score,
      note: d.note,
      backdateReason: isBackdate ? backdateReason.trim() : "",
      photoPaths: d.photoPaths,
    }));
    const kept = rows.filter((r) => !(r.date === date && r.workshop === workshop));
    persist([...kept, ...newRows]);
    notify.saved(`Đã lưu QC ${formatDateVN(date)} · xưởng ${workshop} — ${scored.length} chỉ tiêu`);
  };

  const lockDay = () => {
    if (saved.length === 0) {
      notify.warning("Chưa có chỉ tiêu nào đã lưu để chốt");
      return;
    }
    // Chưa nạp xong sổ chốt ⇒ chưa biết máy chủ đã có bản ghi (ngày, xưởng) chưa.
    if (lockStatus === "loading") {
      notify.error("Đang tải sổ chốt QC từ máy chủ — đợi vài giây rồi bấm chốt lại");
      return;
    }
    const prev = locks.find((l) => l.lockDate === date && l.workshop === workshop);
    const record = {
      // Id cố định theo (ngày|xưởng): hai máy cùng chốt ghi CÙNG một dòng, không sinh bản trùng.
      id: prev?.id ?? `${date}|${workshop}`,
      lockDate: date,
      workshop,
      isLocked: true,
      lockedAt: todayISO(),
      totalKgAtLock: saved.length,
      reopenReason: "",
      note: "",
    };
    persistLocks([...locks.filter((l) => l.id !== record.id), record]);
    notify.saved(`Đã chốt QC ${formatDateVN(date)} · xưởng ${workshop}`);
  };

  const reopen = () => {
    if (!lock) return;
    persistLocks(locks.map((l) => (l.id === lock.id ? { ...l, isLocked: false } : l)));
    notify.warning(`Đã mở lại QC ${formatDateVN(date)} · xưởng ${workshop}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold text-foreground">
          Kiểm tra QC
          {!canWrite && <ReadOnlyBadge />}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cuối ngày chấm nhanh các chỉ tiêu vệ sinh / dụng cụ / thiết bị theo phân
          xưởng, rồi chốt ngày. (Ảnh kèm sẽ bổ sung sau.)
        </p>
      </div>

      <DraftRestoredNotice
        savedAt={qcDraft.restoredAt}
        onDiscard={() => {
          qcDraft.discard();
          const built = buildQcRows(rows, date, workshop);
          setDongs(built.dongs);
          setBackdateReason(built.backdateReason);
        }}
      />

      {/* Bộ lọc: ngày + xưởng */}
      <div className="grid gap-5 rounded-xl border-2 border-border p-4 sm:grid-cols-2">
        <DateField label="Ngày kiểm" value={date} onChange={setDate} hideRequiredMark />
        <ChoiceGroup
          label="Phân xưởng"
          value={workshop}
          onChange={(v) => setWorkshop(v as Workshop)}
          options={WORKSHOP_OPTIONS}
          columns={3}
          hideRequiredMark
        />
      </div>

      {/* Trạng thái + chốt ngày */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold">
            {formatDateVN(date)} · xưởng {workshop}
          </span>
          {isLocked ? (
            <Tag variant="done" icon={Lock}>
              Đã chốt
            </Tag>
          ) : (
            <Tag variant="pending">Chưa chốt</Tag>
          )}
          {scoredRows.length > 0 && (
            <span className="text-base text-muted-foreground">
              Đã chấm {scoredRows.length}/{dongs.length} · Đạt {passCount}
              {failCount > 0 && ` · Không đạt ${failCount}`}
            </span>
          )}
        </div>
        {isLocked ? (
          canRow("unlock", scopeRow) && (
          <Button
            title="Mở khóa lại ngày QC đã chốt để sửa hoặc chấm bù." variant="edit" size="lg" onClick={reopen}>
            Mở lại ngày
          </Button>
          )
        ) : (
          canRow("lock", scopeRow) && (
          <Button
            title="Khóa sổ QC ngày này. Sau khi chốt muốn sửa phải mở lại ngày." variant="lock" size="lg" onClick={lockDay}>
            <Lock aria-hidden />
            Chốt ngày
          </Button>
          )
        )}
      </div>

      {/* Xu hướng 30 ngày — số chỉ tiêu đạt / tạm / không đạt mỗi ngày */}
      {hasQc30 && (
        <section className="space-y-3 rounded-xl border-2 border-border p-4">
          <h2 className="text-lg font-semibold text-foreground">30 ngày gần đây · xưởng {workshop}</h2>
          <TimeSeriesChart
            labels={qc30.map((x) => `${x.date.slice(8, 10)}/${x.date.slice(5, 7)}`)}
            unit="chỉ tiêu"
            height={220}
            description={`Số chỉ tiêu QC đạt, tạm, không đạt mỗi ngày — xưởng ${workshop}`}
            series={[
              { id: "dat", name: "Đạt", color: "green", kind: "bar", values: qc30.map((x) => x.pass) },
              { id: "tam", name: "Tạm (cần khắc phục)", color: "sand", kind: "bar", values: qc30.map((x) => x.conditional) },
              { id: "kd", name: "Không đạt", color: "pink", kind: "bar", values: qc30.map((x) => x.fail) },
            ]}
          />
        </section>
      )}

      {/* Ghi bù: ngày cũ hoặc ngày đã chốt → bắt lý do */}
      {canWrite && !canWriteDay && writableWorkshops.length > 0 && (
        <p className="text-base text-muted-foreground">
          Bạn chỉ ghi được xưởng {writableWorkshops.join(", ")} — xưởng {workshop} chỉ xem.
        </p>
      )}

      {canWriteDay && isBackdate && (
        <Field
          label="Lý do ghi bù"
          required
          hint={
            isLocked
              ? "Ngày này đã chốt — sửa phải ghi rõ lý do."
              : "Đang ghi cho ngày trước hôm nay — ghi rõ lý do."
          }
        >
          <Input
            value={backdateReason}
            onChange={(e) => setBackdateReason(e.target.value)}
            placeholder="VD: bổ sung chỉ tiêu sót, sửa kết quả sau khi kiểm lại…"
          />
        </Field>
      )}

      {/* Chỉ xem: liệt kê kết quả đã chấm, không có ô nhập */}
      {!canWriteDay ? (
        scoredRows.length === 0 ? (
          <EmptyState title="Chưa chấm QC ngày này" description={`${formatDateVN(date)} · xưởng ${workshop}`} />
        ) : (
          <div className="space-y-4">
            {scoredRows.map((d) => (
              <div key={d.criterion} className="space-y-2 rounded-xl border-2 border-border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold">{d.criterion}</p>
                  {d.result && (
                    <Tag variant={RESULT_TAGS[d.result].variant}>{RESULT_TAGS[d.result].label}</Tag>
                  )}
                  {d.score != null && <span className="tnum text-base text-muted-foreground">{d.score} điểm</span>}
                </div>
                {d.note && <p className="text-base text-muted-foreground">{d.note}</p>}
                {hasImageStorage && d.photoPaths.length > 0 && (
                  <CriterionPhoto paths={d.photoPaths} onChange={() => {}} isLocked />
                )}
              </div>
            ))}
          </div>
        )
      ) : dongs.length === 0 ? (
        <EmptyState title="Chưa có chỉ tiêu" description="Thêm chỉ tiêu để bắt đầu chấm." />
      ) : (
        <div className="space-y-4">
          {dongs.map((d, i) => (
            <div key={d.criterion} className="space-y-3 rounded-xl border-2 border-border p-4">
              <p className="text-base font-semibold">{d.criterion}</p>
              <ChoiceGroup
                label="Kết quả"
                value={d.result}
                onChange={(v) => updateRow(i, { result: v as QcResult })}
                options={RESULT_OPTIONS}
                columns={3}
                hideRequiredMark
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField
                  label="Điểm (tùy chọn)"
                  unit="điểm"
                  value={d.score}
                  onChange={(v) => updateRow(i, { score: v })}
                  hideRequiredMark
                />
                <Field label="Ghi chú">
                  <Input
                    value={d.note}
                    onChange={(e) => updateRow(i, { note: e.target.value })}
                    placeholder="Mô tả khi cần khắc phục / không đạt…"
                  />
                </Field>
              </div>
              {hasImageStorage && (
                <CriterionPhoto
                  paths={d.photoPaths}
                  onChange={(p) => updateRow(i, { photoPaths: p })}
                  isLocked={isLocked}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Thêm chỉ tiêu tại chỗ */}
      {canWriteDay && (
      <div className="flex flex-wrap items-end gap-3 rounded-xl border-2 border-dashed border-border p-4">
        <Field label="Thêm chỉ tiêu khác" className="min-w-[min(15rem,100%)] flex-1">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCriterion();
              }
            }}
            placeholder="VD: Kiểm tra kim loại"
          />
        </Field>
        <Button
          title="Thêm một chỉ tiêu chấm điểm nữa vào bảng kiểm của ngày." variant="outline" size="lg" onClick={addCriterion}>
          <Plus aria-hidden />
          Thêm chỉ tiêu
        </Button>
      </div>
      )}

      {/* Lưu — không bao giờ disabled (thiếu thì báo qua toast); không quyền thì không có nút */}
      {canWriteDay && (
      <div className="flex justify-end">
        <Button variant="save"
          title="Ghi điểm của toàn bộ chỉ tiêu vào sổ QC ngày đang chọn." size="lg" onClick={save}>
          Lưu chấm điểm
        </Button>
      </div>
      )}
    </div>
  );
}

/* ---------- Ảnh của một chỉ tiêu QC (chụp/chọn → tải Storage → xem signed URL) ---------- */

/** Ô ảnh: tự lấy signed URL (có hạn) từ path rồi hiện; bấm mở ảnh lớn. */
function PhotoThumb({ path, onDelete }: { path: string; onDelete?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let keepGoing = true;
    getPhotoUrl(path).then((u) => keepGoing && setUrl(u));
    return () => {
      keepGoing = false;
    };
  }, [path]);
  return (
    <div className="relative">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img
            src={url}
            alt="Ảnh QC"
            className="size-20 rounded-md border-2 border-border object-cover"
          />
        </a>
      ) : (
        <div className="flex size-20 items-center justify-center rounded-md border-2 border-dashed border-border bg-muted text-sm text-muted-foreground">
          …
        </div>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label="Bỏ ảnh"
          className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

/** Khối ảnh của một chỉ tiêu: các thumbnail + nút "Chụp / chọn ảnh" (ẩn khi đã chốt). */
function CriterionPhoto({
  paths,
  onChange,
  isLocked: lock,
}: {
  paths: string[];
  onChange: (paths: string[]) => void;
  isLocked: boolean;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsLoading(true);
    const toAdd: string[] = [];
    for (const f of Array.from(files)) {
      const p = await uploadImage(f);
      if (p) toAdd.push(p);
    }
    setIsLoading(false);
    if (inputRef.current) inputRef.current.value = "";
    if (toAdd.length) {
      onChange([...paths, ...toAdd]);
      notify.saved(`Đã tải ${toAdd.length} ảnh`);
    } else {
      notify.warning("Không tải được ảnh — thử lại");
    }
  };

  return (
    <div className="space-y-2">
      {(paths.length > 0 || !lock) && (
        <p className="text-sm text-muted-foreground">Ảnh minh chứng (nếu có)</p>
      )}
      {paths.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {paths.map((p) => (
            <PhotoThumb
              key={p}
              path={p}
              onDelete={
                lock
                  ? undefined
                  : () => {
                      void deleteImage(p); // xóa file khỏi Storage; bỏ path khỏi dòng ngay
                      onChange(paths.filter((x) => x !== p));
                    }
              }
            />
          ))}
        </div>
      )}
      {!lock && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            hidden
            onChange={(e) => pickFiles(e.target.files)}
          />
          <Button
            title="Chọn ảnh minh chứng cho chỉ tiêu này (ảnh lưu trên máy chủ, xem lại được sau)."
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={isLoading}
          >
            <Camera aria-hidden />
            {isLoading ? "Đang tải ảnh…" : "Chụp / chọn ảnh"}
          </Button>
        </>
      )}
    </div>
  );
}
