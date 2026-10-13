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
import { recognizeImportSlip, type OcrCatalog, type KetQuaOcr } from "@/lib/ocr";
import { hasImageStorage, uploadImage } from "@/lib/storage";
import { kg as fmtKg, formatDateVN } from "@/lib/format";

interface Props {
  /** Danh mục để dò khớp tên trên phiếu (đại lý, loại NL). */
  catalog: OcrCatalog;
  /** Đã tải ảnh lên Storage → đường dẫn lưu kèm chuyến. */
  onImageSaved: (path: string) => void;
  onApplySupplier: (name: string) => void;
  onApplyDate: (iso: string) => void;
  onAddRow: (materialType: string, kg: number) => void;
  onClose: () => void;
}

type Phase = "chon" | "dang-nhan" | "xong" | "loi";

export function ImportSlipOcr({
  catalog,
  onImageSaved: onSavePhoto,
  onApplySupplier,
  onApplyDate,
  onAddRow,
  onClose,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Phase>("chon");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [percent, setPercent] = useState(0);
  const [result, setResult] = useState<KetQuaOcr | null>(null);
  const [isSupplierApplied, setIsSupplierApplied] = useState(false);
  const [isDateApplied, setIsDateApplied] = useState(false);
  const [appliedRows, setAppliedRows] = useState<Set<number>>(new Set());

  const pickImage = async (file: File) => {
    setPhotoUrl(URL.createObjectURL(file));
    setStage("dang-nhan");
    setPercent(0);
    setResult(null);
    setIsSupplierApplied(false);
    setIsDateApplied(false);
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

  const addAll = () => {
    result?.dong.forEach((d, i) => {
      if (!appliedRows.has(i)) onAddRow(d.loaiNL, d.kg);
    });
    setAppliedRows(new Set(result?.dong.map((_, i) => i)));
    notify.saved("Đã thêm các dòng nhận được — soát lại số trước khi lưu");
  };

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
                Đang đọc chữ trên phiếu… {percent}%
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
              {/* Đầu chuyến: đại lý + ngày */}
              {(result.daiLy || result.ngay) && (
                <div className="flex flex-wrap gap-2">
                  {result.daiLy && (
                    <Button
                      title="Điền tên đại lý máy đọc được vào form nhập hàng."
                      variant={isSupplierApplied ? "outline" : "default"}
                      onClick={() => {
                        onApplySupplier(result.daiLy!);
                        setIsSupplierApplied(true);
                      }}
                    >
                      {isSupplierApplied ? <Check /> : <Plus />}
                      Đại lý: {result.daiLy}
                    </Button>
                  )}
                  {result.ngay && (
                    <Button
                      title="Điền ngày máy đọc được vào form nhập hàng."
                      variant={isDateApplied ? "outline" : "default"}
                      onClick={() => {
                        onApplyDate(result.ngay!);
                        setIsDateApplied(true);
                      }}
                    >
                      {isDateApplied ? <Check /> : <Plus />}
                      Ngày: {formatDateVN(result.ngay)}
                    </Button>
                  )}
                </div>
              )}

              {/* Dòng loại NL + kg đoán được */}
              {result.dong.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">
                      Dòng nhận được ({result.dong.length})
                    </span>
                    <Button
                      title="Điền hết các dòng loại nguyên liệu + kg máy đọc được vào form. Vẫn soát lại từng dòng trước khi lưu." variant="outline" size="sm" onClick={addAll}>
                      <Plus />
                      Thêm tất cả
                    </Button>
                  </div>
                  <ul className="space-y-1.5">
                    {result.dong.map((d, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2"
                      >
                        <span className="text-base">
                          {d.loaiNL} · <span className="tnum font-semibold">{fmtKg(d.kg)}</span>
                        </span>
                        <Button
                          title="Điền riêng dòng này vào form nhập hàng."
                          variant={appliedRows.has(i) ? "outline" : "default"}
                          size="sm"
                          onClick={() => {
                            onAddRow(d.loaiNL, d.kg);
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
              {(result.soKg.length > 0 || result.loaiNL.length > 0) && (
                <div className="space-y-2 border-t border-border pt-3">
                  {result.loaiNL.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm text-muted-foreground">Loại NL:</span>
                      {result.loaiNL.map((l) => (
                        <Tag key={l} variant="phan-loai" tone={toneByName(l)}>
                          {l}
                        </Tag>
                      ))}
                    </div>
                  )}
                  {result.soKg.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm text-muted-foreground">Số nhận được:</span>
                      {result.soKg.map((n, i) => (
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
