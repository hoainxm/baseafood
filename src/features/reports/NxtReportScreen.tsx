// ============================================================
// Tên file cũ: src/features/reports/BaoCaoNhapXuatTon.tsx
// Tên tiếng Việt: Màn hình Báo cáo Nhập Xuất Tồn 10 cột Excel
// Description: Import-Export-Inventory 10-Column Report Screen
// ============================================================
import { useMemo, useState, useRef } from "react";
import {
  BSF1_WAREHOUSES,
  NXT_GOODS_CATEGORIES,
  type NxtGoodsCategory,
} from "@/types";
import { useWipProductions, useExportItems, useProducts } from "@/lib/catalogRepo";
import { tinhTon } from "@/lib/inventory";
import {
  parseNxtExcelFile,
  exportNxtToExcel,
  type NxtExcelRow,
  type NxtExcelReportData,
} from "@/lib/nxtExcel";
import {
  Badge,
  Button,
  Combobox,
  DateField,
  EmptyState,
  RecordTable,
  ThongKe,
  notify,
  type Cot,
  type MucChon,
} from "@/design-system";
import { kg, num } from "@/lib/format";
import {
  FileSpreadsheet,
  Upload,
  Download,
  RefreshCw,
  Package,
  Layers,
  Scale,
} from "lucide-react";

export default function BaoCaoNhapXuatTonScreen() {
  const [sanXuat] = useWipProductions();
  const [dongLenh] = useExportItems();
  const [matHang] = useProducts();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Filters
  const [locKho, setLocKho] = useState<string>("");
  const [locLoaiHang, setLocLoaiHang] = useState<string>("");
  const [tuNgay, setTuNgay] = useState<string>("2026-07-01");
  const [denNgay, setDenNgay] = useState<string>("2026-07-31");

  // State dữ liệu từ Excel mẫu (nếu được import)
  const [importedExcelData, setImportedExcelData] = useState<NxtExcelReportData | null>(null);

  // Computed data từ hệ thống MES (nếu không import file ngoài)
  const tonSystem = useMemo(() => tinhTon(sanXuat, dongLenh), [sanXuat, dongLenh]);

  // Phân loại danh sách mặt hàng hệ thống
  const systemRows = useMemo<NxtExcelRow[]>(() => {
    // Gom nhóm theo mặt hàng & kho
    const map = new Map<string, NxtExcelRow>();

    for (const t of tonSystem) {
      if (locKho && t.warehouse !== locKho) continue;

      const mh = matHang.find((m) => m.id === t.productId);
      const code = mh?.code || t.productId;
      const name = mh?.name || `Mặt hàng ${t.productId}`;

      const key = `${t.productId}_${t.warehouse}`;

      let cat: NxtGoodsCategory = "Hàng trong nước";
      if (code.includes("NK") || name.toUpperCase().includes("NK")) {
        cat = "Hàng nhập khẩu";
      }

      const cur = map.get(key) || {
        code,
        name: `${name} ${t.spec ? `(${t.spec})` : ""}`,
        category: cat,
        tonDauKg: 0,
        giaTriDau: 0,
        nhapKg: 0,
        giaTriNhap: 0,
        xuatKg: 0,
        giaTriXuat: 0,
        tonCuoiKg: 0,
        giaTriCuoi: 0,
      };

      cur.nhapKg += t.luongNhap;
      cur.xuatKg += t.luongXuat;
      cur.tonCuoiKg += t.conLai;

      map.set(key, cur);
    }

    return Array.from(map.values());
  }, [tonSystem, matHang, locKho]);

  // Danh sách dòng hiển thị cuối cùng
  const finalRows = useMemo(() => {
    const rawList = importedExcelData ? importedExcelData.items : systemRows;
    return rawList.filter((r) => {
      if (locLoaiHang && r.category !== locLoaiHang) return false;
      return true;
    });
  }, [importedExcelData, systemRows, locLoaiHang]);

  // Thống kê tổng
  const tongTonDau = useMemo(() => finalRows.reduce((s, r) => s + r.tonDauKg, 0), [finalRows]);
  const tongNhap = useMemo(() => finalRows.reduce((s, r) => s + r.nhapKg, 0), [finalRows]);
  const tongXuat = useMemo(() => finalRows.reduce((s, r) => s + r.xuatKg, 0), [finalRows]);
  const tongTonCuoi = useMemo(() => finalRows.reduce((s, r) => s + r.tonCuoiKg, 0), [finalRows]);

  // Xử lý upload file Excel
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await parseNxtExcelFile(file);
      setImportedExcelData(data);
      notify.daLuu(`Đã import thành công mẫu Excel (${data.items.length} mặt hàng)`);
    } catch (err: any) {
      notify.loi(`Không thể đọc file Excel: ${err.message || err}`);
    }
  };

  // Xử lý xuất Excel
  const handleExportExcel = () => {
    const reportData: NxtExcelReportData = {
      createdDateText: `Ngày lập: ${new Date().toLocaleString("vi-VN")}`,
      title: "Báo cáo xuất nhập tồn",
      dateRangeText: `Từ ngày ${tuNgay} đến ngày ${denNgay}`,
      warehouseText: locKho ? `Chi nhánh: ${locKho}` : "Chi nhánh: Tất cả kho BSF1",
      items: finalRows,
      totalItemCount: finalRows.length,
      totalTonDauKg: tongTonDau,
      totalGiaTriDau: 0,
      totalNhapKg: tongNhap,
      totalGiaTriNhap: 0,
      totalXuatKg: tongXuat,
      totalGiaTriXuat: 0,
      totalTonCuoiKg: tongTonCuoi,
      totalGiaTriCuoi: 0,
    };

    exportNxtToExcel(reportData, `Bao-Cao-NXT-BSF1-${tuNgay}-${denNgay}.xlsx`);
    notify.daLuu("Đã xuất file Excel thành công!");
  };

  // Các tùy chọn Combobox
  const optKho: MucChon[] = [
    { value: "", label: "Tất cả kho BSF1" },
    ...BSF1_WAREHOUSES.map((w) => ({
      value: w.name,
      label: `${w.name} (${num(w.capacityKg / 1000)} tấn)`,
    })),
  ];

  const optLoaiHang: MucChon[] = [
    { value: "", label: "Tất cả 3 loại hàng" },
    ...NXT_GOODS_CATEGORIES.map((c) => ({ value: c, label: c })),
  ];

  const columns: Cot<NxtExcelRow>[] = [
    {
      key: "code",
      header: "Mã hàng",
      chinh: true,
      render: (r) => <span className="font-mono font-semibold">{r.code}</span>,
      sapXep: (r) => r.code,
    },
    {
      key: "name",
      header: "Tên hàng",
      render: (r) => (
        <div className="whitespace-pre-line text-sm leading-snug">
          {r.name}
        </div>
      ),
      sapXep: (r) => r.name,
    },
    {
      key: "category",
      header: "Phân loại",
      render: (r) => (
        <Badge
          variant={
            r.category === "Hàng nhập khẩu"
              ? "default"
              : r.category === "Hàng tạm"
              ? "secondary"
              : "outline"
          }
        >
          {r.category}
        </Badge>
      ),
      sapXep: (r) => r.category,
    },
    {
      key: "tonDau",
      header: "Tồn đầu kỳ (kg)",
      so: true,
      render: (r) => num(r.tonDauKg),
      sapXep: (r) => r.tonDauKg,
    },
    {
      key: "nhap",
      header: "SL Nhập (kg)",
      so: true,
      render: (r) => (
        <span className={r.nhapKg > 0 ? "font-semibold text-emerald-600 dark:text-emerald-400" : ""}>
          {num(r.nhapKg)}
        </span>
      ),
      sapXep: (r) => r.nhapKg,
    },
    {
      key: "xuat",
      header: "SL Xuất (kg)",
      so: true,
      render: (r) => (
        <span className={r.xuatKg > 0 ? "font-semibold text-amber-600 dark:text-amber-400" : ""}>
          {num(r.xuatKg)}
        </span>
      ),
      sapXep: (r) => r.xuatKg,
    },
    {
      key: "tonCuoi",
      header: "Tồn cuối kỳ (kg)",
      so: true,
      render: (r) => (
        <span className="tnum font-bold text-foreground">
          {num(r.tonCuoiKg)}
        </span>
      ),
      sapXep: (r) => r.tonCuoiKg,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Input ẩn để upload file excel */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".xlsx, .xls"
        className="hidden"
      />

      {/* Header chính */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground flex items-center gap-2">
            <FileSpreadsheet className="w-8 h-8 text-primary" />
            Báo cáo Nhập - Xuất - Tồn (NXT)
          </h1>
          <p className="text-muted-foreground mt-1">
            Xí nghiệp Baseafood BSF1 — Theo dõi tồn kho 5 kho và 3 nhóm mặt hàng (Nhập khẩu, Trong nước, Hàng tạm)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4 mr-2" />
            Import Excel mẫu
          </Button>

          <Button variant="default" onClick={handleExportExcel}>
            <Download className="w-4 h-4 mr-2" />
            Xuất file Excel mẫu
          </Button>
        </div>
      </div>

      {/* Badge báo trạng thái dữ liệu (đang dùng dữ liệu Import hay Hệ thống) */}
      {importedExcelData && (
        <div className="flex items-center justify-between rounded-lg border-2 border-emerald-500/40 bg-emerald-500/10 p-3">
          <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            Đang xem dữ liệu từ file Excel import: {importedExcelData.items.length} mặt hàng ({importedExcelData.warehouseText || "Chi nhánh KHO 1000"})
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setImportedExcelData(null);
              notify.daLuu("Đã chuyển về dữ liệu MES hệ thống");
            }}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Dùng dữ liệu MES
          </Button>
        </div>
      )}

      {/* Thẻ Thống kê tổng hợp */}
      <ThongKe
        className="grid-cols-2 lg:grid-cols-4"
        the={[
          {
            nhan: "SL Mặt hàng",
            giaTri: finalRows.length,
            so: true,
            icon: Package,
            mau: "trung-tinh",
          },
          {
            nhan: "Tồn đầu kỳ",
            giaTri: kg(tongTonDau),
            so: true,
            icon: Scale,
            mau: "trung-tinh",
          },
          {
            nhan: "Tổng Nhập / Xuất",
            giaTri: `${num(tongNhap)} / ${num(tongXuat)} kg`,
            icon: Layers,
            mau: "brand",
          },
          {
            nhan: "Tổng Tồn cuối kỳ",
            giaTri: kg(tongTonCuoi),
            so: true,
            icon: Scale,
            mau: "success",
          },
        ]}
      />

      {/* Thanh điều khiển Bộ lọc */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 rounded-xl border-2 border-border bg-card p-4">
        <Combobox
          label="Lọc theo Kho"
          value={locKho}
          onChange={setLocKho}
          options={optKho}
          placeholder="Tất cả 5 kho BSF1"
        />

        <Combobox
          label="Phân loại Mặt hàng"
          value={locLoaiHang}
          onChange={setLocLoaiHang}
          options={optLoaiHang}
          placeholder="Tất cả 3 loại hàng"
        />

        <DateField
          label="Từ ngày"
          value={tuNgay}
          onChange={setTuNgay}
        />

        <DateField
          label="Đến ngày"
          value={denNgay}
          onChange={setDenNgay}
        />
      </div>

      {/* Bảng Báo cáo Nhập Xuất Tồn */}
      {finalRows.length === 0 ? (
        <EmptyState
          icon={FileSpreadsheet}
          tieuDe="Chưa có dữ liệu Báo cáo Nhập Xuất Tồn"
          moTa="Hãy chọn lại bộ lọc hoặc bấm 'Import Excel mẫu' để tải file dữ liệu lên."
        />
      ) : (
        <div className="space-y-4">
          <RecordTable
            columns={columns}
            rows={finalRows}
            getKey={(r) => `${r.code}_${r.name}`}
            timKiem={(r) => `${r.code} ${r.name} ${r.category}`}
            nhanTimKiem="Tìm kiếm theo mã hàng / tên hàng / phân loại…"
          />

          {/* Hàng tổng cộng hợp nhất ở chân bảng */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border-2 border-primary/30 bg-accent/40 p-4">
            <span className="font-semibold text-base text-foreground">
              Tổng cộng ({finalRows.length} mặt hàng):
            </span>
            <div className="flex flex-wrap items-center gap-6 tnum font-bold text-base">
              <span>Tồn đầu: <span className="text-primary">{num(tongTonDau)} kg</span></span>
              <span>Nhập: <span className="text-emerald-600 dark:text-emerald-400">+{num(tongNhap)} kg</span></span>
              <span>Xuất: <span className="text-amber-600 dark:text-amber-400">-{num(tongXuat)} kg</span></span>
              <span className="text-lg">Tồn cuối: <span className="text-primary">{kg(tongTonCuoi)}</span></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
