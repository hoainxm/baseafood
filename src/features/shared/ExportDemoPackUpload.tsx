// ============================================================
// Tên file: src/features/shared/ExportDemoPackUpload.tsx
// Tên tiếng Việt: Nạp gói demo Xuất khẩu (số + file thật) vào kho file riêng
// Description: Admin picks the prepared folder (pack.json + PDFs / Excel / Word / photos); the
//              files are uploaded to the PRIVATE `export-files` bucket under a fixed demo-pack folder.
//              "Tạo bộ mới" of the demo mode then reads pack.json and links the real files.
// ============================================================
// Luật: ba-spec 41 v4 R14 — số / file thật của khách chỉ đi qua gói trong kho file riêng (cần đăng
// nhập + quyền Xuất khẩu), không nằm trong mã nguồn. Đây là thao tác tải file (không phải form ghi
// sổ) ⇒ không nháp; ghi đè gói cũ cùng tên.
import { useRef, useState } from "react";
import { Button, ErrorSummary, FormDialog, notify, type FieldError } from "@/design-system";
import { uploadExportDemoPackFile, DEMO_PACK_JSON } from "@/lib/exportFileStorage";
import { parseExportDemoPack } from "@/lib/exportPlanningDemo";
import { FolderUp, PackageOpen } from "lucide-react";

const baseName = (path: string) => path.split("/").pop() ?? path;

export function ExportDemoPackUpload() {
  const [isOpen, setIsOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [progress, setProgress] = useState<string>("");
  const [isBusy, setIsBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async () => {
    if (isBusy) return;
    const errs: FieldError[] = [];
    const packFile = files.find((f) => f.name === "pack.json");
    if (!packFile) errs.push({ field: "Gói", message: "Chưa chọn file pack.json (chọn cả thư mục gói, gồm pack.json)" });
    const pack = packFile ? parseExportDemoPack(JSON.parse(await packFile.text().catch(() => "null"))) : null;
    if (packFile && !pack) errs.push({ field: "pack.json", message: "pack.json không đúng khuôn gói demo Xuất khẩu" });
    const byName = new Map(files.map((f) => [f.name, f]));
    const missing = pack ? [...new Set(pack.files.map((f) => baseName(f.path)))].filter((n) => !byName.has(n)) : [];
    if (missing.length) errs.push({ field: "Thiếu file", message: `${missing.length} file trong pack.json chưa chọn: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}` });
    setErrors(errs);
    if (errs.length || !pack || !packFile) return;

    setIsBusy(true);
    const paths = [...new Map(pack.files.map((f) => [f.path, f])).keys()];
    let doneCount = 0;
    for (const path of paths) {
      setProgress(`Đang tải ${doneCount + 1} / ${paths.length + 1}: ${baseName(path)}`);
      const err = await uploadExportDemoPackFile(path, byName.get(baseName(path)) as File);
      if (err) {
        setErrors([{ field: baseName(path), message: err }]);
        setIsBusy(false);
        setProgress("");
        return;
      }
      doneCount++;
    }
    // pack.json lên SAU CÙNG — bộ sinh chỉ thấy gói khi mọi file đã có mặt.
    const err = await uploadExportDemoPackFile(DEMO_PACK_JSON, packFile, "application/json");
    setIsBusy(false);
    setProgress("");
    if (err) {
      setErrors([{ field: "pack.json", message: err }]);
      return;
    }
    notify.saved(`Đã nạp gói demo Xuất khẩu: ${paths.length} file + ${pack.plan.length} dòng sổ kế hoạch. Bấm Tạo bộ mới để dùng.`);
    setFiles([]);
    setIsOpen(false);
  };

  return (
    <>
      <Button variant="ghost" size="sm" className="justify-start" onClick={() => setIsOpen(true)} title="Tải gói demo Xuất khẩu (số + file thật đã chuẩn bị) vào kho file riêng — Tạo bộ mới sẽ dùng gói này.">
        <PackageOpen />
        Nạp gói demo Xuất khẩu…
      </Button>
      <FormDialog
        open={isOpen}
        onOpenChange={(o) => {
          if (isBusy) return;
          setIsOpen(o);
        }}
        title="Nạp gói demo Xuất khẩu"
        description="Chọn TẤT CẢ file trong thư mục gói (pack.json + hợp đồng, chứng từ, thiết kế thùng, container plan, lệnh SX / xuất, ảnh đóng cont). File lưu ở kho file riêng — chỉ người đăng nhập có quyền Xuất khẩu xem được; ai xem demo cũng thấy file thật (cả khi ẩn tên)."
        icon={PackageOpen}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => !isBusy && setIsOpen(false)}>
              Hủy
            </Button>
            <Button onClick={() => void upload()} title="Tải mọi file đã chọn lên kho file riêng, pack.json lên sau cùng.">
              <FolderUp className="mr-2 h-4 w-4" aria-hidden />
              {isBusy ? "Đang tải…" : `Tải gói lên (${files.length} file)`}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 py-2">
          <ErrorSummary errors={errors} />
          <input
            ref={inputRef}
            type="file"
            hidden
            multiple
            onChange={(e) => {
              setFiles([...(e.target.files ?? [])]);
              setErrors([]);
              e.target.value = "";
            }}
          />
          <div>
            <Button variant="outline" onClick={() => inputRef.current?.click()} title="Chọn các file của gói demo (chọn hết trong thư mục).">
              <FolderUp className="mr-2 h-4 w-4" aria-hidden />
              Chọn file của gói
            </Button>
          </div>
          {files.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Đã chọn {files.length} file{files.some((f) => f.name === "pack.json") ? " (có pack.json)" : " — chưa có pack.json"}.
            </p>
          )}
          {progress && <p role="status" className="text-sm">{progress}</p>}
        </div>
      </FormDialog>
    </>
  );
}
