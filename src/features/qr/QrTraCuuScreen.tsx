// ============================================================
// Màn Quét / tra lô theo QR (yêu cầu 2026-09-05, NR-6).
// Quét QR (camera) HOẶC gõ tay mã lô → tra ra chuyến nhập của lô đó + các dòng
// nguyên liệu (truy xuất nội bộ). In lại tem QR của lô ngay tại đây.
// Camera cần HTTPS + quyền camera; máy không có camera thì gõ tay mã lô vẫn tra được.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { useImportShipments, useMaterialImports } from "@/lib/catalogRepo";
import { kg, num, viDate } from "@/lib/format";
import { QrTemLoIn } from "@/features/shared";
import {
  Field,
  Input,
  Button,
  Badge,
  EmptyState,
  RecordTable,
  type Cot,
  notify,
} from "@/design-system";
import { Camera, CameraOff, Printer } from "lucide-react";
import type { MaterialImportItem } from "@/types";

export default function QrTraCuuScreen() {
  const [shipments] = useImportShipments();
  const [imports] = useMaterialImports();
  const [maLo, setMaLo] = useState("");
  const [dangQuet, setDangQuet] = useState(false);
  const [inTem, setInTem] = useState(false);

  // Bật/tắt scanner camera. html5-qrcode tự dựng UI trong #qr-reader.
  useEffect(() => {
    if (!dangQuet) return;
    const scanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: 250 }, false);
    scanner.render(
      (decoded: string) => {
        setMaLo(decoded.trim());
        setDangQuet(false);
        notify.daLuu(`Đã quét: ${decoded.trim()}`);
      },
      () => {
        /* lỗi từng khung hình — bỏ qua, không spam */
      }
    );
    return () => {
      scanner.clear().catch(() => {});
    };
  }, [dangQuet]);

  const chuyen = useMemo(
    () => (maLo.trim() ? shipments.find((s) => (s.lotCode || "") === maLo.trim()) : undefined),
    [shipments, maLo]
  );
  const dong = useMemo(
    () => (chuyen ? imports.filter((m) => m.shipmentId === chuyen.id) : []),
    [imports, chuyen]
  );
  const tongKg = dong.reduce((t, m) => t + (m.quantityKg || 0), 0);

  const cols: Cot<MaterialImportItem>[] = [
    { key: "loai", header: "Loại nguyên liệu", chinh: true, render: (r) => r.materialTypeName || "—", sapXep: (r) => r.materialTypeName },
    { key: "sl", header: "Số lượng (kg)", so: true, render: (r) => <span className="tnum">{kg(r.quantityKg)}</span>, sapXep: (r) => r.quantityKg },
    {
      key: "gia",
      header: "Đơn giá",
      so: true,
      anTrenDienThoai: true,
      render: (r) => (r.unitPrice == null ? <span className="text-muted-foreground">— chờ giá</span> : <span className="tnum">{num(r.unitPrice)}</span>),
      sapXep: (r) => r.unitPrice ?? 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Quét / tra lô</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quét QR trên tem lô, hoặc gõ tay mã lô, để xem chuyến nhập + nguyên liệu của lô đó.
        </p>
      </div>

      {/* Quét camera + gõ tay */}
      <div className="space-y-4 rounded-xl border-2 border-border p-4">
        <div className="flex flex-wrap items-center gap-3">
          {dangQuet ? (
            <Button variant="outline" size="lg" onClick={() => setDangQuet(false)}>
              <CameraOff aria-hidden /> Tắt camera
            </Button>
          ) : (
            <Button variant="outline" size="lg" onClick={() => setDangQuet(true)}>
              <Camera aria-hidden /> Quét bằng camera
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            Không có camera? Gõ tay mã lô bên dưới.
          </span>
        </div>
        {dangQuet && <div id="qr-reader" className="mx-auto max-w-sm" />}
        <Field label="Mã lô" hint="VD: Đ-260905-01 — gõ tay nếu không quét được.">
          <Input
            value={maLo}
            onChange={(e) => setMaLo(e.target.value)}
            placeholder="Nhập mã lô để tra"
          />
        </Field>
      </div>

      {/* Kết quả */}
      {!maLo.trim() ? (
        <EmptyState tieuDe="Chưa có mã lô" moTa="Quét QR hoặc gõ mã lô để tra chuyến nhập." />
      ) : !chuyen ? (
        <EmptyState
          tieuDe={`Không tìm thấy lô "${maLo.trim()}"`}
          moTa="Kiểm tra lại mã, hoặc lô này chưa được ghi trong sổ nhập."
        />
      ) : (
        <div className="space-y-4">
          <div className="space-y-3 rounded-xl border-2 border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="tnum">
                  Lô {chuyen.lotCode}
                </Badge>
                {chuyen.ssccCode ? (
                  <Badge variant="outline" className="tnum">
                    SSCC {chuyen.ssccCode}
                  </Badge>
                ) : (
                  <Badge variant="outline">Chưa có SSCC</Badge>
                )}
              </div>
              <Button variant="outline" size="lg" onClick={() => setInTem(true)}>
                <Printer aria-hidden /> In tem QR
              </Button>
            </div>
            <div className="space-y-1 text-base">
              <p className="font-semibold">
                {chuyen.supplierName || "—"} · xưởng {chuyen.workshop}
              </p>
              <p className="text-muted-foreground">
                Ngày về: {viDate(chuyen.deliveryDate)} · {dong.length} loại · tổng {kg(tongKg)}
              </p>
            </div>
          </div>

          {dong.length > 0 ? (
            <RecordTable columns={cols} rows={dong} getKey={(r) => r.id} />
          ) : (
            <EmptyState tieuDe="Lô chưa có dòng nguyên liệu" moTa="Chuyến này chưa ghi loại hàng nào." />
          )}
        </div>
      )}

      {inTem && chuyen && <QrTemLoIn chuyen={chuyen} onClose={() => setInTem(false)} />}
    </div>
  );
}
