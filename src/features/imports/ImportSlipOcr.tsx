// ============================================================
// Tên file: src/features/imports/ImportSlipOcr.tsx
// Tên tiếng Việt: Nhận diện phiếu nhập (OCR) → gợi ý điền form
// Description: Chụp/chọn ảnh phiếu tay → OCR → tap-áp vào form Ghi nhập
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
  toneByName,
} from "@/design-system";
import { Camera, Check, Loader2, Plus, RefreshCw } from "lucide-react";
import { recognizeImportSlip, type OcrCatalog, type KetQuaOcr, type DongOcr } from "@/lib/ocr";
import { hasImageStorage, uploadImage } from "@/lib/storage";
import { kg as fmtKg, formatDateVN, num } from "@/lib/format";

interface Props {
  /** Danh mục để dò khớp tên trên phiếu (đại lý, loại NL). */
  catalog: OcrCatalog;
  /** Đã tải ảnh lên Storage → đường dẫn lưu kèm chuyến. */
  onImageSaved: (path: string) => void;
  onApplySupplier: (name: string) => void;
  onApplyDate: (iso: string) => void;
  onApplyWorkshop: (workshop: string) => void;
  /** Điền biển số và/hoặc tài xế (trường nào máy không đọc được thì để nguyên). */
  onApplyVehicle: (vehicle: { licensePlate?: string; driverName?: string }) => void;
  onAddRow: (line: DongOcr) => void;
  /** Điền một lượt mọi thứ đọc được (đầu chuyến + mọi dòng) theo đúng luồng chọn tay. */
  onApplyAll: (result: KetQuaOcr) => void;
  onClose: () => void;
}

/** Ô đầu chuyến máy đọc được — mỗi ô một nút "điền". */
type HeaderField = "supplier" | "date" | "workshop" | "vehicle";

type Phase = "chon" | "dang-nhan" | "xong" | "loi";

export function ImportSlipOcr({
  catalog,
  onImageSaved: onSavePhoto,
  onApplySupplier,
  onApplyDate,
  onApplyWorkshop,
  onApplyVehicle,
  onAddRow,
  onApplyAll,
  onClose,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Phase>("chon");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [percent, setPercent] = useState(0);
  const [result, setResult] = useState<KetQuaOcr | null>(null);
  const [appliedFields, setAppliedFields] = useState<Set<HeaderField>>(new Set());
  const [appliedRows, setAppliedRows] = useState<Set<number>>(new Set());

  const pickImage = async (file: File) => {
    setPhotoUrl(URL.createObjectURL(file));
    setStage("dang-nhan");
    setPercent(0);
    setResult(null);
    setAppliedFields(new Set());
    setAppliedRows(new Set());

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
      setStage("xong");
    } catch {
      setStage("loi");
    }
  };

  const markField = (f: HeaderField) => setAppliedFields((s) => new Set(s).add(f));

  const addAll = () => {
    result?.lines.forEach((d, i) => {
      if (!appliedRows.has(i)) onAddRow(d);
    });
    setAppliedRows(new Set(result?.lines.map((_, i) => i)));
    notify.saved("Đã thêm các dòng nhận được — soát lại số trước khi lưu");
  };

  /** Một lượt điền hết rồi đóng hộp — người dùng soát ngay trên phiếu. */
  const applyEverything = () => {
    if (!result) return;
    onApplyAll(result);
    notify.saved("Đã điền phiếu từ ảnh — soát lại từng ô trước khi lưu");
    onClose();
  };

  /** Có ô đầu chuyến nào máy đọc được không (để hiện khối nút). */
  const hasHeader =
    !!result && !!(result.supplier || result.date || result.workshop || result.licensePlate || result.driverName);
  const hasAnything = hasHeader || (result?.lines.length ?? 0) > 0;
  /** Nút một ô đầu chuyến: chưa điền = nút chính, đã điền = viền + dấu tích. */
  const fieldButton = (f: HeaderField, label: string, title: string, apply: () => void) => (
    <Button
      key={f}
      title={title}
      variant={appliedFields.has(f) ? "outline" : "default"}
      onClick={() => {
        apply();
        markField(f);
      }}
    >
      {appliedFields.has(f) ? <Check /> : <Plus />}
      {label}
    </Button>
  );

  const changePhoto = () => {
    setStage("chon");
    setPhotoUrl(null);
    setResult(null);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-full sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Nhận diện phiếu nhập (nháp)</DialogTitle>
          <DialogDescription className="text-base">
            Chụp hoặc chọn ảnh phiếu tay, máy đọc chữ rồi gợi ý điền. Chữ viết tay
            nhận chưa chắc đúng — <b>soát lại số trước khi lưu</b>.
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

          {/* Ảnh xem trước */}
          {photoUrl && (
            <img
              src={photoUrl}
              alt="Ảnh phiếu"
              className="max-h-48 w-auto rounded-lg border border-border"
            />
          )}

          {stage === "chon" && (
            <Button
              title="Mở máy ảnh hoặc chọn ảnh phiếu nhập viết tay có sẵn trong máy." size="lg" className="w-full" onClick={() => inputRef.current?.click()}>
              <Camera />
              Chụp / chọn ảnh phiếu
            </Button>
          )}

          {stage === "dang-nhan" && (
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

          {stage === "loi" && (
            <div className="space-y-3">
              <p className="text-base text-muted-foreground">
                Không đọc được ảnh (có thể mất mạng khi tải bộ nhận diện, hoặc ảnh
                quá mờ). Ảnh phiếu vẫn được lưu kèm chuyến để đối chiếu tay.
              </p>
              <Button
                title="Bỏ ảnh này, chụp hoặc chọn ảnh khác rõ hơn." variant="outline" size="lg" onClick={changePhoto}>
                <RefreshCw />
                Thử ảnh khác
              </Button>
            </div>
          )}

          {stage === "xong" && result && (
            <div className="space-y-4">
              {/* Máy nào đã đọc — OpenAI hỏng thì nói rõ đang dùng máy dự phòng (đọc chữ tay kém hơn). */}
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Tag variant="phu">{result.engine === "openai" ? "Đọc bằng OpenAI" : "Đọc bằng máy trong trình duyệt"}</Tag>
                {result.cloudError && <span>OpenAI chưa dùng được lúc này, đang dùng máy dự phòng.</span>}
              </div>
              {hasAnything && (
                <Button
                  title="Điền một lượt mọi thứ máy đọc được (đại lý, ngày, xưởng, xe, tài xế, các dòng loại NL + kg + giá) vào phiếu rồi đóng hộp này. Vẫn soát lại từng ô trước khi lưu."
                  size="lg"
                  className="w-full sm:w-auto"
                  onClick={applyEverything}
                >
                  <Check />
                  Điền tất cả vào phiếu
                </Button>
              )}

              {/* Đầu chuyến: đại lý · ngày · xưởng · xe/tài xế — điền từng ô */}
              {hasHeader && (
                <div className="flex flex-wrap gap-2">
                  {result.supplier &&
                    fieldButton("supplier", `Đại lý: ${result.supplier}`, "Điền tên đại lý máy đọc được vào phiếu (bảng loại hàng dựng lại theo lượt giao gần nhất của đại lý).", () =>
                      onApplySupplier(result.supplier!),
                    )}
                  {result.date &&
                    fieldButton("date", `Ngày: ${formatDateVN(result.date)}`, "Điền ngày hàng về máy đọc được vào phiếu (đổi cả ngày ghi sổ, không bật ghi bù).", () =>
                      onApplyDate(result.date!),
                    )}
                  {result.workshop &&
                    fieldButton("workshop", `Xưởng: ${result.workshop}`, "Chọn xưởng máy đọc được trên phiếu.", () => onApplyWorkshop(result.workshop!))}
                  {(result.licensePlate || result.driverName) &&
                    fieldButton(
                      "vehicle",
                      [result.licensePlate && `Xe: ${result.licensePlate}`, result.driverName && `Tài xế: ${result.driverName}`]
                        .filter(Boolean)
                        .join(" · "),
                      "Điền biển số xe và tài xế máy đọc được vào phiếu.",
                      () => onApplyVehicle({ licensePlate: result.licensePlate, driverName: result.driverName }),
                    )}
                </div>
              )}

              {/* Dòng loại NL + kg đoán được */}
              {result.lines.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">
                      Dòng nhận được ({result.lines.length})
                    </span>
                    <Button
                      title="Điền hết các dòng loại nguyên liệu + kg (+ giá nếu có) máy đọc được vào phiếu. Vẫn soát lại từng dòng trước khi lưu." variant="outline" size="sm" onClick={addAll}>
                      <Plus />
                      Thêm tất cả
                    </Button>
                  </div>
                  <ul className="space-y-1.5">
                    {result.lines.map((d, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2"
                      >
                        <span className="text-base">
                          {d.materialType} · <span className="tnum font-semibold">{fmtKg(d.kg)}</span>
                          {d.unitPrice != null && (
                            <span className="tnum text-muted-foreground"> · {num(d.unitPrice)} đ/kg</span>
                          )}
                        </span>
                        <Button
                          title="Điền riêng dòng này vào form nhập hàng."
                          variant={appliedRows.has(i) ? "outline" : "default"}
                          size="sm"
                          onClick={() => {
                            onAddRow(d);
                            setAppliedRows((s) => new Set(s).add(i));
                          }}
                        >
                          {appliedRows.has(i) ? <Check /> : <Plus />}
                          {appliedRows.has(i) ? "Đã thêm" : "Thêm dòng"}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-base text-muted-foreground">
                  Chưa ghép được dòng nào (loại + số cùng hàng). Xem số &amp; loại nhận
                  được bên dưới để điền tay.
                </p>
              )}

              {/* Tham khảo: số kg lẻ + loại NL lẻ */}
              {(result.kgValues.length > 0 || result.materialTypes.length > 0) && (
                <div className="space-y-2 border-t border-border pt-3">
                  {result.materialTypes.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm text-muted-foreground">Loại NL:</span>
                      {result.materialTypes.map((l) => (
                        <Tag key={l} variant="phan-loai" tone={toneByName(l)}>
                          {l}
                        </Tag>
                      ))}
                    </div>
                  )}
                  {result.kgValues.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm text-muted-foreground">Số nhận được:</span>
                      {result.kgValues.map((n, i) => (
                        <Tag key={i} variant="phu" className="tnum">
                          {fmtKg(n)}
                        </Tag>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Toàn văn để đối chiếu */}
              {result.text.trim() && (
                <details className="text-sm text-muted-foreground">
                  <summary className="cursor-pointer select-none">
                    Xem toàn văn nhận diện
                  </summary>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs">
                    {result.text}
                  </pre>
                </details>
              )}

              <Button
                title="Chụp ảnh phiếu khác để đọc tiếp." variant="outline" size="sm" onClick={changePhoto}>
                <RefreshCw />
                Chụp ảnh khác
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            title="Đóng cửa sổ nhận diện, quay về form nhập hàng." size="lg" onClick={onClose}>
            Xong
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
