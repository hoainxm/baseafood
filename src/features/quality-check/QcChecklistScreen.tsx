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
import { taiAnhLen, urlAnh, xoaAnh, coLuuAnh } from "@/lib/storage";
import { todayISO, viDate } from "@/lib/format";
import {
  Field,
  ChoiceGroup,
  NumberField,
  DateField,
  Input,
  Button,
  Badge,
  EmptyState,
  notify,
  type LuaChon,
} from "@/design-system";
import { Camera, Lock, Plus, X } from "lucide-react";

const XUONG_OPT: LuaChon[] = [
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
const CHI_TIEU_MAC_DINH = [
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
  const [locks, persistLocks] = useQcLocks();

  const [ngay, setNgay] = useState(todayISO());
  const [xuong, setXuong] = useState<Workshop>("Đông");
  const [dongs, setDongs] = useState<Dong[]>([]);
  const [lyDoGhiBu, setLyDoGhiBu] = useState("");
  const [themTen, setThemTen] = useState("");

  const daLuu = useMemo(
    () => rows.filter((r) => r.date === ngay && r.workshop === xuong),
    [rows, ngay, xuong]
  );
  const khoa = useMemo(
    () => locks.find((l) => l.lockDate === ngay && l.workshop === xuong && l.isLocked),
    [locks, ngay, xuong]
  );
  const dangKhoa = Boolean(khoa);
  const ghiBu = dangKhoa || isBackdatedQc(ngay, todayISO());

  // Đổi (ngày × xưởng) hoặc dữ liệu tải xong → nạp lại bảng chấm điểm từ sổ.
  useEffect(() => {
    const luuNgay = rows.filter((r) => r.date === ngay && r.workshop === xuong);
    const theoTen = new Map(luuNgay.map((r) => [r.criterion, r]));
    const tenList = [
      ...CHI_TIEU_MAC_DINH,
      ...luuNgay.map((r) => r.criterion).filter((t) => !CHI_TIEU_MAC_DINH.includes(t)),
    ];
    setDongs(
      tenList.map((ten) => {
        const cu = theoTen.get(ten);
        return {
          criterion: ten,
          result: (cu?.result ?? "") as QcResult | "",
          score: cu?.score ?? null,
          note: cu?.note ?? "",
          photoPaths: cu?.photoPaths ?? [],
        };
      })
    );
    setLyDoGhiBu(luuNgay.find((r) => r.backdateReason)?.backdateReason ?? "");
  }, [ngay, xuong, rows]);

  const doiDong = (i: number, patch: Partial<Dong>) =>
    setDongs((ds) => ds.map((d, k) => (k === i ? { ...d, ...patch } : d)));

  const themChiTieu = () => {
    const ten = themTen.trim();
    if (!ten) return;
    if (dongs.some((d) => d.criterion === ten)) {
      notify.canhBao("Chỉ tiêu này đã có trong danh sách");
      return;
    }
    setDongs((ds) => [
      ...ds,
      { criterion: ten, result: "", score: null, note: "", photoPaths: [] },
    ]);
    setThemTen("");
  };

  const daCham = dongs.filter((d) => d.result);
  const soDat = daCham.filter((d) => d.result === "dat").length;
  const soKhongDat = daCham.filter((d) => d.result === "khong-dat").length;

  const luu = () => {
    const cham = dongs.filter((d) => d.result);
    if (cham.length === 0) {
      notify.canhBao("Chưa chấm chỉ tiêu nào — chọn ít nhất một kết quả");
      return;
    }
    if (ghiBu && !lyDoGhiBu.trim()) {
      notify.canhBao(
        dangKhoa
          ? "Ngày đã chốt — nhập lý do ghi bù để sửa"
          : "Ghi cho ngày cũ — nhập lý do ghi bù"
      );
      return;
    }
    const idTheoTen = new Map(daLuu.map((r) => [r.criterion, r.id]));
    const moi: QcChecklistItem[] = cham.map((d) => ({
      id: idTheoTen.get(d.criterion) ?? newId(),
      date: ngay,
      workshop: xuong,
      criterion: d.criterion,
      result: d.result as QcResult,
      score: d.score,
      note: d.note,
      backdateReason: ghiBu ? lyDoGhiBu.trim() : "",
      photoPaths: d.photoPaths,
    }));
    const giuLai = rows.filter((r) => !(r.date === ngay && r.workshop === xuong));
    persist([...giuLai, ...moi]);
    notify.daLuu(`Đã lưu QC ${viDate(ngay)} · xưởng ${xuong} — ${cham.length} chỉ tiêu`);
  };

  const chotNgay = () => {
    if (daLuu.length === 0) {
      notify.canhBao("Chưa có chỉ tiêu nào đã lưu để chốt");
      return;
    }
    const cu = locks.find((l) => l.lockDate === ngay && l.workshop === xuong);
    const banGhi = {
      id: cu?.id ?? newId(),
      lockDate: ngay,
      workshop: xuong,
      isLocked: true,
      lockedAt: todayISO(),
      totalKgAtLock: daLuu.length,
      reopenReason: "",
      note: "",
    };
    persistLocks([...locks.filter((l) => l.id !== banGhi.id), banGhi]);
    notify.daLuu(`Đã chốt QC ${viDate(ngay)} · xưởng ${xuong}`);
  };

  const moLai = () => {
    if (!khoa) return;
    persistLocks(locks.map((l) => (l.id === khoa.id ? { ...l, isLocked: false } : l)));
    notify.canhBao(`Đã mở lại QC ${viDate(ngay)} · xưởng ${xuong}`);
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
        <DateField label="Ngày kiểm" value={ngay} onChange={setNgay} anNhanBatBuoc />
        <ChoiceGroup
          label="Phân xưởng"
          value={xuong}
          onChange={(v) => setXuong(v as Workshop)}
          options={XUONG_OPT}
          cot={3}
          anNhanBatBuoc
        />
      </div>

      {/* Trạng thái + chốt ngày */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold">
            {viDate(ngay)} · xưởng {xuong}
          </span>
          {dangKhoa ? (
            <Badge variant="secondary">
              <Lock aria-hidden />
              Đã chốt
            </Badge>
          ) : (
            <Badge variant="outline">Chưa chốt</Badge>
          )}
          {daCham.length > 0 && (
            <span className="text-base text-muted-foreground">
              Đã chấm {daCham.length}/{dongs.length} · Đạt {soDat}
              {soKhongDat > 0 && ` · Không đạt ${soKhongDat}`}
            </span>
          )}
        </div>
        {dangKhoa ? (
          <Button variant="outline" size="lg" onClick={moLai}>
            Mở lại ngày
          </Button>
        ) : (
          <Button variant="outline" size="lg" onClick={chotNgay}>
            <Lock aria-hidden />
            Chốt ngày
          </Button>
        )}
      </div>

      {/* Ghi bù: ngày cũ hoặc ngày đã chốt → bắt lý do */}
      {ghiBu && (
        <Field
          label="Lý do ghi bù"
          required
          hint={
            dangKhoa
              ? "Ngày này đã chốt — sửa phải ghi rõ lý do."
              : "Đang ghi cho ngày trước hôm nay — ghi rõ lý do."
          }
        >
          <Input
            value={lyDoGhiBu}
            onChange={(e) => setLyDoGhiBu(e.target.value)}
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
                onChange={(v) => doiDong(i, { result: v as QcResult })}
                options={KET_QUA_OPT}
                cot={3}
                anNhanBatBuoc
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField
                  label="Điểm (tùy chọn)"
                  unit="điểm"
                  value={d.score}
                  onChange={(v) => doiDong(i, { score: v })}
                  anNhanBatBuoc
                />
                <Field label="Ghi chú">
                  <Input
                    value={d.note}
                    onChange={(e) => doiDong(i, { note: e.target.value })}
                    placeholder="Mô tả khi cần khắc phục / không đạt…"
                  />
                </Field>
              </div>
              {coLuuAnh && (
                <AnhChiTieu
                  paths={d.photoPaths}
                  onChange={(p) => doiDong(i, { photoPaths: p })}
                  khoa={dangKhoa}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Thêm chỉ tiêu tại chỗ */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border-2 border-dashed border-border p-4">
        <Field label="Thêm chỉ tiêu khác" className="min-w-60 flex-1">
          <Input
            value={themTen}
            onChange={(e) => setThemTen(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                themChiTieu();
              }
            }}
            placeholder="VD: Kiểm tra kim loại"
          />
        </Field>
        <Button variant="outline" size="lg" onClick={themChiTieu}>
          <Plus aria-hidden />
          Thêm chỉ tiêu
        </Button>
      </div>

      {/* Lưu — không bao giờ disabled (thiếu thì báo qua toast) */}
      <div className="flex justify-end">
        <Button size="lg" onClick={luu}>
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
function AnhChiTieu({
  paths,
  onChange,
  khoa,
}: {
  paths: string[];
  onChange: (paths: string[]) => void;
  khoa: boolean;
}) {
  const [dangTai, setDangTai] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const chon = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setDangTai(true);
    const them: string[] = [];
    for (const f of Array.from(files)) {
      const p = await taiAnhLen(f);
      if (p) them.push(p);
    }
    setDangTai(false);
    if (inputRef.current) inputRef.current.value = "";
    if (them.length) {
      onChange([...paths, ...them]);
      notify.daLuu(`Đã tải ${them.length} ảnh`);
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
            onChange={(e) => chon(e.target.files)}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={dangTai}
          >
            <Camera aria-hidden />
            {dangTai ? "Đang tải ảnh…" : "Chụp / chọn ảnh"}
          </Button>
        </>
      )}
    </div>
  );
}
