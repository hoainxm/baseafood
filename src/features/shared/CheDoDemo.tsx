// ============================================================
// Tên file: src/features/shared/CheDoDemo.tsx
// Tên tiếng Việt: Chế độ demo — dải cảnh báo, nạp bộ demo, nút bật/tắt (admin)
// Description: Demo-mode UI (spec docs/spec/che-do-demo.md §4)
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { FlaskConical, LogOut, RefreshCw } from "lucide-react";
import { Button, ChoiceGroup, DangXuLy, XacNhan, homNay, notify } from "@/design-system";
import {
  datTamTatNhatKy,
  useBalancingInputs,
  useBalancingOutputs,
  useBalancingPeriods,
  useBatterTypes,
  useCustomers,
  useDailyLocks,
  useDomesticSales,
  useExportItems,
  useExportOrders,
  useFinishedGoodsOpeningStock,
  useImportShipments,
  useLabelPrints,
  useLotDispatches,
  useLotInputs,
  useLotWaivers,
  useMaterialImports,
  useMaterialOpeningStock,
  useMaterialTypes,
  useMonthlyStock,
  useNxtSnapshots,
  useOrderItems,
  usePackagings,
  useProductionLocks,
  useProducts,
  useQcChecklists,
  useQcLocks,
  useSalesInvoices,
  useSalesItems,
  useSalesOrders,
  useScraps,
  useStorageLocations,
  useSuppliers,
  useWipProductions,
} from "@/lib/catalogRepo";
import { LA_DEMO, datCheDo, datViecDemo, docGoiDemo, docViecDemo, luuGoiDemo, xoaGoiDemo } from "@/lib/cheDo";
import { quetThamSo, sinhGoiDemo, type GoiDemo, type NguonDemo } from "@/lib/sinhDemo";
import { num } from "@/lib/format";


/**
 * Dải "ĐANG XEM DỮ LIỆU DEMO" — dính đầu vùng nội dung, luôn hiện khi chế độ demo bật
 * (quy tắc 15: không bao giờ để người xem nhầm số demo là số thật). Tiêu đề tab có
 * tiền tố "[DEMO]".
 */
export function DaiDemo() {
  useEffect(() => {
    if (!LA_DEMO) return;
    const goc = document.title;
    if (!goc.startsWith("[DEMO]")) document.title = `[DEMO] ${goc}`;
    return () => {
      document.title = goc;
    };
  }, []);
  if (!LA_DEMO) return null;
  return (
    <div
      role="status"
      // Dính ngay dưới header trang (cùng token với BangTong xoRa) — cuộn đâu cũng thấy.
      className="sticky top-header z-20 mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border-2 border-warning bg-warning px-4 py-2 text-warning-foreground"
    >
      <FlaskConical className="size-5 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 text-sm font-semibold">
        ĐANG XEM DỮ LIỆU DEMO — số trình diễn, không phải sổ thật của xưởng. Ghi gì ở đây cũng chỉ vào bộ demo.
      </p>
      <Button
        title="Thoát chế độ demo, quay về số thật của xưởng."
        size="sm"
        variant="outline"
        className="bg-card text-foreground"
        onClick={() => datCheDo(false)}
      >
        <LogOut />
        Thoát demo
      </Button>
    </div>
  );
}

/**
 * Nạp gói demo vừa sinh (để ở localStorage lúc còn chế độ thật) vào các bảng của
 * `site-demo` — qua đúng hook ghi thường (repo tự diff: xóa số demo cũ, thêm mới, khóa
 * có tiền tố `demo:`). Chỉ gắn khi đang demo VÀ có gói chờ. Chờ mọi bảng nạp xong rồi
 * mới ghi, kẻo diff với bản rỗng làm sót dòng cũ.
 */
export function NapGoiDemo() {
  const [goi] = useState(() => docGoiDemo<GoiDemo>());
  if (!LA_DEMO || !goi) return null;
  return <NapGoiDemoThat goi={goi} />;
}

function NapGoiDemoThat({ goi }: { goi: GoiDemo }) {
  const bang = {
    products: useProducts(),
    materialTypes: useMaterialTypes(),
    suppliers: useSuppliers(),
    customers: useCustomers(),
    batterTypes: useBatterTypes(),
    storageLocations: useStorageLocations(),
    shipments: useImportShipments(),
    imports: useMaterialImports(),
    dailyLocks: useDailyLocks(),
    scraps: useScraps(),
    wips: useWipProductions(),
    productionLocks: useProductionLocks(),
    packagings: usePackagings(),
    salesOrders: useSalesOrders(),
    orderItems: useOrderItems(),
    exportOrders: useExportOrders(),
    exportItems: useExportItems(),
    salesInvoices: useSalesInvoices(),
    salesItems: useSalesItems(),
    domesticSales: useDomesticSales(),
    lotInputs: useLotInputs(),
    lotDispatches: useLotDispatches(),
    lotWaivers: useLotWaivers(),
    labelPrints: useLabelPrints(),
    qcChecklists: useQcChecklists(),
    qcLocks: useQcLocks(),
    periods: useBalancingPeriods(),
    balancingInputs: useBalancingInputs(),
    balancingOutputs: useBalancingOutputs(),
    materialOpening: useMaterialOpeningStock(),
    finishedOpening: useFinishedGoodsOpeningStock(),
    nxtSnapshots: useNxtSnapshots(),
    monthlyStock: useMonthlyStock(),
  } satisfies Record<keyof GoiDemo, unknown>;
  const daNap = useRef(false);
  const [daGhi, setDaGhi] = useState(false);
  const xong = (Object.values(bang) as { 2: { trangThai: string } }[]).every((b) => b[2].trangThai !== "dang-tai");

  useEffect(() => {
    if (!xong || daNap.current) return;
    daNap.current = true;
    datTamTatNhatKy(true);
    try {
      for (const k of Object.keys(bang) as (keyof GoiDemo)[]) {
        const ghi = bang[k][1] as (rows: unknown[]) => void;
        ghi(goi[k] ?? []);
      }
    } finally {
      datTamTatNhatKy(false);
    }
    xoaGoiDemo();
    const tong = Object.values(goi).reduce((s, ds) => s + (ds as unknown[]).length, 0);
    notify.daLuu(`Đã nạp bộ demo: ${num(tong)} dòng số trình diễn.`);
    setDaGhi(true);
    // Chạy MỘT lần khi mọi bảng nạp xong (daNap chặn lần hai); `bang` đổi mỗi lần vẽ.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xong]);

  if (daGhi) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80" role="status">
      <DangXuLy chu="Đang nạp bộ số demo…" />
    </div>
  );
}

/**
 * Khối "Chế độ demo" cho admin (đặt ở Tổng quan). Chế độ thật: tạo bộ demo mới từ số
 * thật rồi vào demo, hoặc vào demo giữ bộ đang có. Chế độ demo: làm mới bộ demo (tải
 * lại về chế độ thật để quét, rồi tự vào lại) hoặc thoát.
 */
export function KhoiCheDoDemo() {
  return LA_DEMO ? <KhoiDangDemo /> : <KhoiSinhDemo />;
}

function KhoiDangDemo() {
  const lamMoi = () => {
    datViecDemo("tao");
    datCheDo(false);
  };
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-warning/50 bg-warning-surface p-4">
      <FlaskConical className="size-6 shrink-0 text-warning" aria-hidden />
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold text-foreground">Đang ở chế độ demo</h2>
        <p className="text-sm text-muted-foreground">Số trên mọi màn là bộ trình diễn. Bấm thử thoải mái — làm mới là về nguyên trạng.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <XacNhan
          tieuDe="Làm mới bộ demo?"
          moTa="App quay về chế độ thật một lát để quét số mới nhất, sinh lại bộ demo rồi tự vào lại. Mọi thứ đã ghi trong bộ demo hiện tại bị thay. Số thật không bị đụng."
          nhanNut="Làm mới bộ demo"
          icon={RefreshCw}
          onConfirm={lamMoi}
          trigger={
            <Button title="Sinh lại bộ demo từ số thật mới nhất, thay bộ đang có." variant="outline">
              <RefreshCw />
              Làm mới bộ demo
            </Button>
          }
        />
        <Button title="Thoát chế độ demo, quay về số thật của xưởng." onClick={() => datCheDo(false)}>
          <LogOut />
          Thoát demo
        </Button>
      </div>
    </section>
  );
}

function KhoiSinhDemo() {
  const [products, , a1] = useProducts();
  const [materialTypes, , a2] = useMaterialTypes();
  const [suppliers, , a3] = useSuppliers();
  const [customers, , a4] = useCustomers();
  const [batterTypes, , a5] = useBatterTypes();
  const [storageLocations, , a6] = useStorageLocations();
  const [imports, , a7] = useMaterialImports();
  const [wips, , a8] = useWipProductions();
  const [periods, , a9] = useBalancingPeriods();
  const [balancingInputs, , a10] = useBalancingInputs();
  const [balancingOutputs, , a11] = useBalancingOutputs();
  const [nxtSnapshots, , a12] = useNxtSnapshots();
  const [monthlyStock, , a13] = useMonthlyStock();
  const daNap = [a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13].every((x) => x.trangThai !== "dang-tai");
  const [anDanh, setAnDanh] = useState("an");
  const [dangTao, setDangTao] = useState(false);

  const nguon: NguonDemo = useMemo(
    () => ({ products, materialTypes, suppliers, customers, batterTypes, storageLocations, imports, wips, periods, balancingInputs, balancingOutputs, nxtSnapshots, monthlyStock }),
    [products, materialTypes, suppliers, customers, batterTypes, storageLocations, imports, wips, periods, balancingInputs, balancingOutputs, nxtSnapshots, monthlyStock],
  );
  const thamSo = useMemo(() => quetThamSo(nguon), [nguon]);

  const taoVaVao = () => {
    setDangTao(true);
    const goi = sinhGoiDemo(nguon, { homNay: homNay(), anDanh: anDanh === "an", hat: Date.now() % 100_000 });
    datViecDemo(null);
    if (!luuGoiDemo(goi)) {
      setDangTao(false);
      notify.loi("Không tạo được bộ demo (bộ nhớ trình duyệt đầy?). Thử xóa bớt dữ liệu trình duyệt rồi làm lại.");
      return;
    }
    datCheDo(true);
  };

  // Việc chờ từ chế độ demo ("Làm mới bộ demo"): nạp xong số thật thì tự sinh và vào lại.
  const [viecTao] = useState(() => docViecDemo() === "tao");
  useEffect(() => {
    if (viecTao && daNap) taoVaVao();
    // taoVaVao tải lại trang ⇒ chỉ chạy một lần.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viecTao, daNap]);

  if (viecTao) {
    return (
      <section className="rounded-xl border-2 border-border p-4" role="status">
        <DangXuLy chu="Đang quét số thật để làm mới bộ demo…" />
      </section>
    );
  }

  return (
    <section className="grid gap-3 rounded-xl border-2 border-dashed border-border p-4">
      <div className="flex flex-wrap items-start gap-3">
        <FlaskConical className="mt-0.5 size-6 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-foreground">Chế độ demo (chỉ quản trị thấy)</h2>
          <p className="text-sm text-muted-foreground">
            Trình bày bằng bộ số đầy đủ chuỗi (nhập → sản xuất → kho → đóng gói → bán → lô QR), sinh từ số thật đã
            nhập: {num(thamSo.soDongNhapThat)} dòng nhập, {thamSo.daiLy.length} đại lý, {thamSo.xuong.length} xưởng, tỉ lệ
            ra thành phẩm {num(thamSo.tiLeTP * 100)}%. Bộ demo nằm riêng — số thật không bị đụng.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <ChoiceGroup
          label="Tên đối tác trong bộ demo"
          value={anDanh}
          onChange={setAnDanh}
          options={[
            { value: "an", label: "Ẩn tên + đổi giá", moTa: "Trình bày cho người ngoài" },
            { value: "giu", label: "Giữ tên thật", moTa: "Trình bày nội bộ" },
          ]}
          className="min-w-[min(20rem,100%)] flex-1"
        />
        <div className="flex flex-wrap gap-2">
          <XacNhan
            tieuDe="Tạo bộ demo mới và vào chế độ demo?"
            moTa="Quét số thật, sinh bộ demo 60 ngày rồi chuyển cả app sang chế độ demo. Bộ demo cũ (nếu có) bị thay. Số thật của xưởng không bị đụng."
            nhanNut="Tạo và vào demo"
            icon={FlaskConical}
            onConfirm={taoVaVao}
            trigger={
              <Button title="Sinh bộ số demo từ số thật đã nhập rồi chuyển sang chế độ demo." disabled={!daNap || dangTao}>
                <FlaskConical />
                {daNap ? "Tạo bộ demo mới" : "Đang nạp số thật…"}
              </Button>
            }
          />
          <Button
            title="Vào chế độ demo, giữ nguyên bộ demo đã tạo lần trước."
            variant="outline"
            onClick={() => datCheDo(true)}
          >
            Vào demo (giữ bộ cũ)
          </Button>
        </div>
      </div>
    </section>
  );
}
