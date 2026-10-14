// ============================================================
// Tên file: src/features/imports/ImportSlipOcr.tsx
// Tên tiếng Việt: Nhận diện phiếu nhập (OCR) → đối chiếu → điền form
// Description: Chụp/chọn ảnh phiếu tay → OCR → bảng đối chiếu cạnh ảnh → điền form Ghi nhập
// ============================================================
import { useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Tag,
  notify,
} from "@/design-system";
import { Camera, Check, Loader2, Plus, RefreshCw } from "lucide-react";
import {
  recognizeImportSlip,
  type OcrCatalog,
  type OcrResult,
} from "@/lib/ocr";
import { hasImageStorage, uploadImage } from "@/lib/storage";
import { kg as fmtKg, formatDateVN } from "@/lib/format";
import {
  applyOcrSelection,
  defaultOcrSelection,
  type OcrSelection,
} from "./importHelpers";
import { OcrReviewTable, SlipImageViewer } from "./OcrReviewPanel";

interface Props {
  /** Danh mục để dò khớp tên trên phiếu (đại lý, loại NL, xe, tài xế…). */
  catalog: OcrCatalog;
  /** Đã tải ảnh lên Storage → đường dẫn lưu kèm chuyến. */
  onImageSaved: (path: string) => void;
  /** Điền các ô ĐÃ TICK trong bảng đối chiếu theo đúng luồng chọn tay (nháp, chưa lưu). */
  onApplyAll: (result: OcrResult) => void;
  /** Ghi THẲNG phế liệu ngày đọc được vào sổ (không phải nháp). Trả số dòng đã ghi. */
  onAddScraps: (
    items: { name: string; kg: number }[],
    result: OcrResult,
  ) => number;
  /** Ngày + xưởng phế liệu sẽ ghi vào (ngày/xưởng trên phiếu, thiếu thì của phiếu đang mở). */
  scrapTarget: (result: OcrResult) => { date: string; workshop: string };
  onClose: () => void;
}

type Phase = "select" | "recognizing" | "done" | "error";

export function ImportSlipOcr({
  catalog,
  onImageSaved: onSavePhoto,
  onApplyAll,
  onAddScraps,
  scrapTarget,
  onClose,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Phase>("select");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [percent, setPercent] = useState(0);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [selection, setSelection] = useState<OcrSelection>({
    header: new Set(),
    lines: new Set(),
  });
  const [isScrapSaved, setIsScrapSaved] = useState(false);

  const pickImage = async (file: File) => {
    setPhotoUrl(URL.createObjectURL(file));
    setStage("recognizing");
    setPercent(0);
    setResult(null);
    setIsScrapSaved(false);

    // Tải ảnh lên Storage song song (ảnh là bằng chứng phiếu, lưu kèm chuyến).
    if (hasImageStorage)
      uploadImage(file).then((path) => {
        if (path) {
          onSavePhoto(path);
          notify.saved("Đã lưu ảnh phiếu kèm chuyến");
        }
      });

    try {
      const r = await recognizeImportSlip(file, catalog, setPercent);
      setResult(r);
      setSelection(defaultOcrSelection(r));
      setStage("done");
    } catch {
      setStage("error");
    }
  };

  const picked = result ? applyOcrSelection(result, selection) : null;
  const pickedCount = selection.header.size + selection.lines.size;
  /** Máy có hiểu được ô nào để điền không (không thì chỉ còn đối chiếu toàn văn). */
  const hasCandidates =
    !!result &&
    (result.lines.length > 0 || defaultOcrSelection(result).header.size > 0);

  /** Điền các ô đang tick rồi đóng hộp — người dùng soát tiếp ngay trên phiếu nhập. */
  const applyPicked = () => {
    if (!picked) return;
    if (!pickedCount) {
      notify.warning(
        "Chưa tick ô nào để điền — tick các ô đúng trong bảng đối chiếu.",
      );
      return;
    }
    onApplyAll(picked);
    notify.saved("Đã điền phiếu từ ảnh — soát lại từng ô trước khi lưu");
    onClose();
  };

  const changePhoto = () => {
    setStage("select");
    setPhotoUrl(null);
    setResult(null);
  };

  const isReviewing = stage === "done" && !!result && !!photoUrl;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={
          isReviewing
            ? "w-full sm:max-w-3xl lg:max-w-6xl"
            : "w-full sm:max-w-2xl"
        }
      >
        <DialogHeader>
          <DialogTitle className="text-2xl">
            Nhận diện phiếu nhập (nháp)
          </DialogTitle>
          <DialogDescription className="text-base">
            {isReviewing ? (
              <>
                Đặt ảnh phiếu cạnh bảng: cột <b>Trên phiếu</b> là chữ máy chép
                y, cột <b>Điền vào sổ</b> là giá trị sẽ điền. Bỏ tick ô sai —
                chỉ ô đang tick được điền.
              </>
            ) : (
              <>
                Chụp hoặc chọn ảnh phiếu tay, máy đọc chữ rồi gợi ý điền. Chữ
                viết tay nhận chưa chắc đúng — <b>soát lại số trước khi lưu</b>.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pickImage(f);
              e.target.value = ""; // cho chọn lại cùng ảnh
            }}
          />

          {/* Ảnh xem trước lúc đang đọc / lỗi (lúc đối chiếu ảnh nằm cạnh bảng) */}
          {photoUrl && !isReviewing && (
            <img
              src={photoUrl}
              alt="Ảnh phiếu"
              className="max-h-48 w-auto rounded-lg border border-border"
            />
          )}

          {stage === "select" && (
            <Button
              title="Mở máy ảnh hoặc chọn ảnh phiếu nhập viết tay có sẵn trong máy."
              size="lg"
              className="w-full"
              onClick={() => inputRef.current?.click()}
            >
              <Camera />
              Chụp / chọn ảnh phiếu
            </Button>
          )}

          {stage === "recognizing" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-base text-muted-foreground">
                <Loader2 className="animate-spin" />
                Đang đọc chữ trên phiếu… {percent > 0 ? `${percent}%` : ""}
              </div>
              <div className="h-2 w-full overflow-hidden rounded bg-muted">
                <div
                  className="h-full rounded bg-primary transition-all"
                  style={{ width: `${Math.max(4, percent)}%` }}
                />
              </div>
            </div>
          )}

          {stage === "error" && (
            <div className="space-y-3">
              <p className="text-base text-muted-foreground">
                Không đọc được ảnh (có thể mất mạng khi tải bộ nhận diện, hoặc
                ảnh quá mờ). Ảnh phiếu vẫn được lưu kèm chuyến để đối chiếu tay.
              </p>
              <Button
                title="Bỏ ảnh này, chụp hoặc chọn ảnh khác rõ hơn."
                variant="outline"
                size="lg"
                onClick={changePhoto}
              >
                <RefreshCw />
                Thử ảnh khác
              </Button>
            </div>
          )}

          {isReviewing && (
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Ảnh thật — dính trên cùng khi cuộn bảng (máy tính) */}
              <div className="lg:sticky lg:top-0 lg:self-start">
                <SlipImageViewer src={photoUrl} />
              </div>

              <div className="min-w-0 space-y-4">
                {/* Máy nào đã đọc — OpenAI hỏng thì nói rõ đang dùng máy dự phòng (đọc chữ tay kém hơn). */}
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Tag variant="muted">
                    {result.engine === "openai"
                      ? "Đọc bằng OpenAI"
                      : "Đọc bằng máy trong trình duyệt"}
                  </Tag>
                  {result.cloudError && (
                    <span>
                      OpenAI chưa dùng được lúc này, đang dùng máy dự phòng.
                    </span>
                  )}
                </div>
                {(result.warnings?.length ?? 0) > 0 && (
                  <ul className="space-y-1 rounded-lg border border-warning/30 bg-warning-surface px-3 py-2 text-sm text-warning">
                    {result.warnings!.map((w, i) => (
                      <li key={i}>⚠ {w}</li>
                    ))}
                  </ul>
                )}

                <OcrReviewTable
                  result={result}
                  catalog={catalog}
                  selection={selection}
                  onSelectionChange={setSelection}
                />

                {/* Phế liệu cân gộp — ghi thẳng vào sổ phế liệu ngày, KHÔNG phải dòng hàng */}
                {(result.scraps?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
                    <span className="text-base">
                      Phế liệu:{" "}
                      {result
                        .scraps!.map((x) => `${x.name} ${fmtKg(x.kg)}`)
                        .join(" · ")}
                      <span className="text-sm text-muted-foreground">
                        {" "}
                        (ngày {formatDateVN(scrapTarget(result).date)}, xưởng{" "}
                        {scrapTarget(result).workshop})
                      </span>
                    </span>
                    <Button
                      title="Ghi ngay phế liệu này vào sổ phế liệu cân trong ngày (theo ngày và xưởng ghi bên cạnh). Loại đã có trong sổ ngày đó thì bỏ qua."
                      variant={isScrapSaved ? "outline" : "default"}
                      size="sm"
                      onClick={() => {
                        if (onAddScraps(result.scraps!, result) > 0)
                          setIsScrapSaved(true);
                      }}
                    >
                      {isScrapSaved ? <Check /> : <Plus />}
                      {isScrapSaved ? "Đã ghi" : "Ghi phế liệu"}
                    </Button>
                  </div>
                )}

                {/* Toàn văn để đối chiếu */}
                {result.text.trim() && (
                  <details className="text-sm text-muted-foreground">
                    <summary className="cursor-pointer select-none">
                      Xem toàn văn máy chép từ phiếu
                    </summary>
                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">
                      {result.text}
                    </pre>
                  </details>
                )}

                <Button
                  title="Chụp ảnh phiếu khác để đọc tiếp."
                  variant="outline"
                  size="sm"
                  onClick={changePhoto}
                >
                  <RefreshCw />
                  Chụp ảnh khác
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Chân hộp dính đáy: nút chính luôn thấy dù bảng dài phải cuộn */}
        <DialogFooter className="flex-wrap gap-2">
          {isReviewing && hasCandidates && (
            <Button
              title="Điền các ô đang tick (đầu chuyến + dòng loại NL) vào phiếu nhập rồi đóng hộp này. Phế liệu ghi riêng bằng nút Ghi phế liệu. Vẫn soát lại trước khi lưu."
              size="lg"
              onClick={applyPicked}
            >
              <Check />
              Điền {pickedCount} ô đã chọn vào phiếu
            </Button>
          )}
          <Button
            title="Đóng cửa sổ nhận diện, quay về form nhập hàng (không điền gì thêm)."
            size="lg"
            variant={isReviewing && hasCandidates ? "outline" : "default"}
            onClick={onClose}
          >
            {isReviewing && hasCandidates ? "Đóng" : "Xong"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
