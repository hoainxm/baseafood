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
import { useQcChecklists, useQcLocks } from "@/lib/catalogRepo";
import { luiNgay, qcTheoNgay } from "@/lib/dongChay";
import { taiAnhLen, urlAnh, xoaAnh, coLuuAnh } from "@/lib/storage";
import { todayISO, viDate } from "@/lib/format";
import {
  Field,
  ChoiceGroup,
  NumberField,
  DateField,
  Input,
  Button,
  Nhan,
  EmptyState,
  notify,
  type LuaChon,
  BieuDoTheoNgay,
} from "@/design-system";
import { Camera, Lock, Plus, X } from "lucide-react";

const WORKSHOP_OPTIONS: LuaChon[] = [
  { value: "Đông", label: "Đông" },
  { value: "Cá", label: "Cá" },
  { value: "Khô", label: "Khô" },
];

const KET_QUA_OPT: LuaChon[] = [
  { value: "dat", label: "Đạt" },
  { value: "tam", label: "Cần khắc phục" },
  { value: "khong-dat", label: "Không đạt" },
];

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

/** Một dòng chấm điểm trên màn (chưa lưu). */
interface Dong {
  criterion: string;
  result: QcResult | "";
  score: number | null;
  note: string;
  photoPaths: string[]; // đường dẫn ảnh đã tải (Supabase Storage bucket "qc")
}

export default function QcChecklistScreen() {
  const [rows, persist] = useQcChecklists();
  const [locks, persistLocks, { trangThai: ttKhoa }] = useQcLocks();

  const [date, setDate] = useState(todayISO());
  const [workshop, setWorkshop] = useState<Workshop>("Đông");
  const [dongs, setDongs] = useState<Dong[]>([]);
  const [backdateReason, setBackdateReason] = useState("");
  const [newName, setNewName] = useState("");

  const saved = useMemo(
    () => rows.filter((r) => r.date === date && r.workshop === workshop),
    [rows, date, workshop]
  );
  const khoa = useMemo(
    () => locks.find((l) => l.lockDate === date && l.workshop === workshop && l.isLocked),
    [locks, date, workshop]
  );
  const isLocked = Boolean(khoa);
  const isBackdate = isLocked || isBackdatedQc(date, todayISO());

  // Đổi (ngày × xưởng) hoặc dữ liệu tải xong → nạp lại bảng chấm điểm từ sổ.
  useEffect(() => {
    const dayRows = rows.filter((r) => r.date === date && r.workshop === workshop);
    const theoTen = new Map(dayRows.map((r) => [r.criterion, r]));
    const tenList = [
      ...DEFAULT_CRITERIA,
      ...dayRows.map((r) => r.criterion).filter((t) => !DEFAULT_CRITERIA.includes(t)),
    ];
    setDongs(
      tenList.map((ten) => {
        const prev = theoTen.get(ten);
        return {
          criterion: ten,
          result: (prev?.result ?? "") as QcResult | "",
          score: prev?.score ?? null,
          note: prev?.note ?? "",
          photoPaths: prev?.photoPaths ?? [],
        };
      })
    );
    setBackdateReason(dayRows.find((r) => r.backdateReason)?.backdateReason ?? "");
  }, [date, workshop, rows]);

  const updateRow = (i: number, patch: Partial<Dong>) =>
    setDongs((ds) => ds.map((d, k) => (k === i ? { ...d, ...patch } : d)));

  const addCriterion = () => {
    const ten = newName.trim();
    if (!ten) return;
    if (dongs.some((d) => d.criterion === ten)) {
      notify.canhBao("Chỉ tiêu này đã có trong danh sách");
      return;
    }
    setDongs((ds) => [
      ...ds,
      { criterion: ten, result: "", score: null, note: "", photoPaths: [] },
    ]);
    setNewName("");
  };

  // 30 ngày tới ngày đang xem — xu hướng chất lượng của xưởng.
  const qc30 = useMemo(() => qcTheoNgay(rows, workshop, luiNgay(date, 29), date), [rows, workshop, date]);
  const coQc30 = qc30.some((x) => x.dat + x.tam + x.khongDat > 0);

  const daCham = dongs.filter((d) => d.result);
  const passCount = daCham.filter((d) => d.result === "dat").length;
  const failCount = daCham.filter((d) => d.result === "khong-dat").length;

  const save = () => {
    const cham = dongs.filter((d) => d.result);
    if (cham.length === 0) {
      notify.canhBao("Chưa chấm chỉ tiêu nào — chọn ít nhất một kết quả");
      return;
    }
    if (isBackdate && !backdateReason.trim()) {
      notify.canhBao(
        isLocked
          ? "Ngày đã chốt — nhập lý do ghi bù để sửa"
          : "Ghi cho ngày cũ — nhập lý do ghi bù"
      );
      return;
    }
    const idTheoTen = new Map(saved.map((r) => [r.criterion, r.id]));
    const newRows: QcChecklistItem[] = cham.map((d) => ({
      id: idTheoTen.get(d.criterion) ?? newId(),
      date: date,
      workshop: workshop,
      criterion: d.criterion,
      result: d.result as QcResult,
      score: d.score,
      note: d.note,
      backdateReason: isBackdate ? backdateReason.trim() : "",
      photoPaths: d.photoPaths,
    }));
    const giuLai = rows.filter((r) => !(r.date === date && r.workshop === workshop));
    persist([...giuLai, ...newRows]);
    notify.daLuu(`Đã lưu QC ${viDate(date)} · xưởng ${workshop} — ${cham.length} chỉ tiêu`);
  };

  const lockDay = () => {
    if (saved.length === 0) {
      notify.canhBao("Chưa có chỉ tiêu nào đã lưu để chốt");
      return;
    }
    // Chưa nạp xong sổ chốt ⇒ chưa biết máy chủ đã có bản ghi (ngày, xưởng) chưa.
    if (ttKhoa === "dang-tai") {
      notify.loi("Đang tải sổ chốt QC từ máy chủ — đợi vài giây rồi bấm chốt lại");
      return;
    }
    const prev = locks.find((l) => l.lockDate === date && l.workshop === workshop);
    const record = {
      // Id cố định theo (ngày|xưởng): hai máy cùng chốt ghi CÙNG một dòng, không sinh bản trùng.
      id: prev?.id ?? `${date}|${workshop}`,
      lockDate: date,
      workshop: workshop,
      isLocked: true,
      lockedAt: todayISO(),
      totalKgAtLock: saved.length,
      reopenReason: "",
      note: "",
    };
    persistLocks([...locks.filter((l) => l.id !== record.id), record]);
    notify.daLuu(`Đã chốt QC ${viDate(date)} · xưởng ${workshop}`);
  };

  const reopen = () => {
    if (!khoa) return;
    persistLocks(locks.map((l) => (l.id === khoa.id ? { ...l, isLocked: false } : l)));
    notify.canhBao(`Đã mở lại QC ${viDate(date)} · xưởng ${workshop}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Kiểm tra QC</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cuối ngày chấm nhanh các chỉ tiêu vệ sinh / dụng cụ / thiết bị theo phân
          xưởng, rồi chốt ngày. (Ảnh kèm sẽ bổ sung sau.)
        </p>
      </div>

      {/* Bộ lọc: ngày + xưởng */}
      <div className="grid gap-5 rounded-xl border-2 border-border p-4 sm:grid-cols-2">
        <DateField label="Ngày kiểm" value={date} onChange={setDate} anNhanBatBuoc />
        <ChoiceGroup
          label="Phân xưởng"
          value={workshop}
          onChange={(v) => setWorkshop(v as Workshop)}
          options={WORKSHOP_OPTIONS}
          cot={3}
          anNhanBatBuoc
        />
      </div>

      {/* Trạng thái + chốt ngày */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold">
            {viDate(date)} · xưởng {workshop}
          </span>
          {isLocked ? (
            <Nhan loai="xong" icon={Lock}>
              Đã chốt
            </Nhan>
          ) : (
            <Nhan loai="cho">Chưa chốt</Nhan>
          )}
          {daCham.length > 0 && (
            <span className="text-base text-muted-foreground">
              Đã chấm {daCham.length}/{dongs.length} · Đạt {passCount}
              {failCount > 0 && ` · Không đạt ${failCount}`}
            </span>
          )}
        </div>
        {isLocked ? (
          <Button
            title="Mở khóa lại ngày QC đã chốt để sửa hoặc chấm bù." variant="outline" size="lg" onClick={reopen}>
            Mở lại ngày
          </Button>
        ) : (
          <Button
            title="Khóa sổ QC ngày này. Sau khi chốt muốn sửa phải mở lại ngày." variant="outline" size="lg" onClick={lockDay}>
            <Lock aria-hidden />
            Chốt ngày
          </Button>
        )}
      </div>

      {/* Xu hướng 30 ngày — số chỉ tiêu đạt / tạm / không đạt mỗi ngày */}
      {coQc30 && (
        <section className="space-y-3 rounded-xl border-2 border-border p-4">
          <h2 className="text-lg font-semibold text-foreground">30 ngày gần đây · xưởng {workshop}</h2>
          <BieuDoTheoNgay
            nhan={qc30.map((x) => `${x.ngay.slice(8, 10)}/${x.ngay.slice(5, 7)}`)}
            donVi="chỉ tiêu"
            cao={220}
            moTa={`Số chỉ tiêu QC đạt, tạm, không đạt mỗi ngày — xưởng ${workshop}`}
            chuoi={[
              { khoa: "dat", ten: "Đạt", mau: "la", dang: "cot", giaTri: qc30.map((x) => x.dat) },
              { khoa: "tam", ten: "Tạm (cần khắc phục)", mau: "cat", dang: "cot", giaTri: qc30.map((x) => x.tam) },
              { khoa: "kd", ten: "Không đạt", mau: "hong", dang: "cot", giaTri: qc30.map((x) => x.khongDat) },
            ]}
          />
        </section>
      )}

      {/* Ghi bù: ngày cũ hoặc ngày đã chốt → bắt lý do */}
      {isBackdate && (
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

      {/* Bảng chấm điểm từng chỉ tiêu */}
      {dongs.length === 0 ? (
        <EmptyState tieuDe="Chưa có chỉ tiêu" moTa="Thêm chỉ tiêu để bắt đầu chấm." />
      ) : (
        <div className="space-y-4">
          {dongs.map((d, i) => (
            <div key={d.criterion} className="space-y-3 rounded-xl border-2 border-border p-4">
              <p className="text-base font-semibold">{d.criterion}</p>
              <ChoiceGroup
                label="Kết quả"
                value={d.result}
                onChange={(v) => updateRow(i, { result: v as QcResult })}
                options={KET_QUA_OPT}
                cot={3}
                anNhanBatBuoc
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField
                  label="Điểm (tùy chọn)"
                  unit="điểm"
                  value={d.score}
                  onChange={(v) => updateRow(i, { score: v })}
                  anNhanBatBuoc
                />
                <Field label="Ghi chú">
                  <Input
                    value={d.note}
                    onChange={(e) => updateRow(i, { note: e.target.value })}
                    placeholder="Mô tả khi cần khắc phục / không đạt…"
                  />
                </Field>
              </div>
              {coLuuAnh && (
                <CriterionPhoto
                  paths={d.photoPaths}
                  onChange={(p) => updateRow(i, { photoPaths: p })}
                  khoa={isLocked}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Thêm chỉ tiêu tại chỗ */}
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

      {/* Lưu — không bao giờ disabled (thiếu thì báo qua toast) */}
      <div className="flex justify-end">
        <Button
          title="Ghi điểm của toàn bộ chỉ tiêu vào sổ QC ngày đang chọn." size="lg" onClick={save}>
          Lưu chấm điểm
        </Button>
      </div>
    </div>
  );
}

/* ---------- Ảnh của một chỉ tiêu QC (chụp/chọn → tải Storage → xem signed URL) ---------- */

/** Ô ảnh: tự lấy signed URL (có hạn) từ path rồi hiện; bấm mở ảnh lớn. */
function AnhThumb({ path, onXoa }: { path: string; onXoa?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let con = true;
    urlAnh(path).then((u) => con && setUrl(u));
    return () => {
      con = false;
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
      {onXoa && (
        <button
          type="button"
          onClick={onXoa}
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
  khoa,
}: {
  paths: string[];
  onChange: (paths: string[]) => void;
  khoa: boolean;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsLoading(true);
    const toAdd: string[] = [];
    for (const f of Array.from(files)) {
      const p = await taiAnhLen(f);
      if (p) toAdd.push(p);
    }
    setIsLoading(false);
    if (inputRef.current) inputRef.current.value = "";
    if (toAdd.length) {
      onChange([...paths, ...toAdd]);
      notify.daLuu(`Đã tải ${toAdd.length} ảnh`);
    } else {
      notify.canhBao("Không tải được ảnh — thử lại");
    }
  };

  return (
    <div className="space-y-2">
      {(paths.length > 0 || !khoa) && (
        <p className="text-sm text-muted-foreground">Ảnh minh chứng (nếu có)</p>
      )}
      {paths.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {paths.map((p) => (
            <AnhThumb
              key={p}
              path={p}
              onXoa={
                khoa
                  ? undefined
                  : () => {
                      void xoaAnh(p); // xóa file khỏi Storage; bỏ path khỏi dòng ngay
                      onChange(paths.filter((x) => x !== p));
                    }
              }
            />
          ))}
        </div>
      )}
      {!khoa && (
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
