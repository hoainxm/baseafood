// ============================================================
// Tên file: src/features/imports/OcrPhieuNhap.tsx
// Tên tiếng Việt: Nhận diện phiếu nhập (OCR) → gợi ý điền form
// Description: Chụp/chọn ảnh phiếu tay → OCR → tap-áp vào form Ghi nhập
// ============================================================
import { useRef, useState } from "react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  notify,
} from "@/design-system";
import { Camera, Check, Loader2, Plus, RefreshCw } from "lucide-react";
import { nhanDienPhieu, type DanhMucOcr, type KetQuaOcr } from "@/lib/ocr";
import { coLuuAnh, taiAnhLen } from "@/lib/storage";
import { kg as fmtKg, viDate } from "@/lib/format";

interface Props {
  /** Danh mục để dò khớp tên trên phiếu (đại lý, loại NL). */
  danhMuc: DanhMucOcr;
  /** Đã tải ảnh lên Storage → đường dẫn lưu kèm chuyến. */
  onLuuAnh: (path: string) => void;
  onApDaiLy: (name: string) => void;
  onApNgay: (iso: string) => void;
  onThemDong: (loaiNL: string, kg: number) => void;
  onClose: () => void;
}

type GiaiDoan = "chon" | "dang-nhan" | "xong" | "loi";

export function OcrPhieuNhap({
  danhMuc,
  onLuuAnh,
  onApDaiLy,
  onApNgay,
  onThemDong,
  onClose,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [giaiDoan, setGiaiDoan] = useState<GiaiDoan>("chon");
  const [anhURL, setAnhURL] = useState<string | null>(null);
  const [phanTram, setPhanTram] = useState(0);
  const [kq, setKq] = useState<KetQuaOcr | null>(null);
  const [daDaiLy, setDaDaiLy] = useState(false);
  const [daNgay, setDaNgay] = useState(false);
  const [daDong, setDaDong] = useState<Set<number>>(new Set());

  const chonAnh = async (file: File) => {
    setAnhURL(URL.createObjectURL(file));
    setGiaiDoan("dang-nhan");
    setPhanTram(0);
    setKq(null);
    setDaDaiLy(false);
    setDaNgay(false);
    setDaDong(new Set());

    // Tải ảnh lên Storage song song (ảnh là bằng chứng phiếu, lưu kèm chuyến).
    if (coLuuAnh)
      taiAnhLen(file).then((path) => {
        if (path) {
          onLuuAnh(path);
          notify.daLuu("Đã lưu ảnh phiếu kèm chuyến");
        }
      });

    try {
      const r = await nhanDienPhieu(file, danhMuc, setPhanTram);
      setKq(r);
      setGiaiDoan("xong");
    } catch {
      setGiaiDoan("loi");
    }
  };

  const themTatCa = () => {
    kq?.dong.forEach((d, i) => {
      if (!daDong.has(i)) onThemDong(d.loaiNL, d.kg);
    });
    setDaDong(new Set(kq?.dong.map((_, i) => i)));
    notify.daLuu("Đã thêm các dòng nhận được — soát lại số trước khi lưu");
  };

  const doiAnh = () => {
    setGiaiDoan("chon");
    setAnhURL(null);
    setKq(null);
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
              if (f) chonAnh(f);
              e.target.value = ""; // cho chọn lại cùng ảnh
            }}
          />

          {/* Ảnh xem trước */}
          {anhURL && (
            <img
              src={anhURL}
              alt="Ảnh phiếu"
              className="max-h-48 w-auto rounded-lg border border-border"
            />
          )}

          {giaiDoan === "chon" && (
            <Button size="lg" className="w-full" onClick={() => inputRef.current?.click()}>
              <Camera />
              Chụp / chọn ảnh phiếu
            </Button>
          )}

          {giaiDoan === "dang-nhan" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-base text-muted-foreground">
                <Loader2 className="animate-spin" />
                Đang đọc chữ trên phiếu… {phanTram}%
              </div>
              <div className="h-2 w-full overflow-hidden rounded bg-muted">
                <div
                  className="h-full rounded bg-primary transition-all"
                  style={{ width: `${Math.max(4, phanTram)}%` }}
                />
              </div>
            </div>
          )}

          {giaiDoan === "loi" && (
            <div className="space-y-3">
              <p className="text-base text-muted-foreground">
                Không đọc được ảnh (có thể mất mạng khi tải bộ nhận diện, hoặc ảnh
                quá mờ). Ảnh phiếu vẫn được lưu kèm chuyến để đối chiếu tay.
              </p>
              <Button variant="outline" size="lg" onClick={doiAnh}>
                <RefreshCw />
                Thử ảnh khác
              </Button>
            </div>
          )}

          {giaiDoan === "xong" && kq && (
            <div className="space-y-4">
              {/* Đầu chuyến: đại lý + ngày */}
              {(kq.daiLy || kq.ngay) && (
                <div className="flex flex-wrap gap-2">
                  {kq.daiLy && (
                    <Button
                      variant={daDaiLy ? "outline" : "default"}
                      onClick={() => {
                        onApDaiLy(kq.daiLy!);
                        setDaDaiLy(true);
                      }}
                    >
                      {daDaiLy ? <Check /> : <Plus />}
                      Đại lý: {kq.daiLy}
                    </Button>
                  )}
                  {kq.ngay && (
                    <Button
                      variant={daNgay ? "outline" : "default"}
                      onClick={() => {
                        onApNgay(kq.ngay!);
                        setDaNgay(true);
                      }}
                    >
                      {daNgay ? <Check /> : <Plus />}
                      Ngày: {viDate(kq.ngay)}
                    </Button>
                  )}
                </div>
              )}

              {/* Dòng loại NL + kg đoán được */}
              {kq.dong.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">
                      Dòng nhận được ({kq.dong.length})
                    </span>
                    <Button variant="outline" size="sm" onClick={themTatCa}>
                      <Plus />
                      Thêm tất cả
                    </Button>
                  </div>
                  <ul className="space-y-1.5">
                    {kq.dong.map((d, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2"
                      >
                        <span className="text-base">
                          {d.loaiNL} · <span className="tnum font-semibold">{fmtKg(d.kg)}</span>
                        </span>
                        <Button
                          variant={daDong.has(i) ? "outline" : "default"}
                          size="sm"
                          onClick={() => {
                            onThemDong(d.loaiNL, d.kg);
                            setDaDong((s) => new Set(s).add(i));
                          }}
                        >
                          {daDong.has(i) ? <Check /> : <Plus />}
                          {daDong.has(i) ? "Đã thêm" : "Thêm dòng"}
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
              {(kq.soKg.length > 0 || kq.loaiNL.length > 0) && (
                <div className="space-y-2 border-t border-border pt-3">
                  {kq.loaiNL.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm text-muted-foreground">Loại NL:</span>
                      {kq.loaiNL.map((l) => (
                        <Badge key={l} variant="secondary">
                          {l}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {kq.soKg.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm text-muted-foreground">Số nhận được:</span>
                      {kq.soKg.map((n, i) => (
                        <Badge key={i} variant="secondary" className="tnum">
                          {fmtKg(n)}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Toàn văn để đối chiếu */}
              {kq.text.trim() && (
                <details className="text-sm text-muted-foreground">
                  <summary className="cursor-pointer select-none">
                    Xem toàn văn nhận diện
                  </summary>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs">
                    {kq.text}
                  </pre>
                </details>
              )}

              <Button variant="outline" size="sm" onClick={doiAnh}>
                <RefreshCw />
                Chụp ảnh khác
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button size="lg" onClick={onClose}>
            Xong
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
