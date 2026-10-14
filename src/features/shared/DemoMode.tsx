// ============================================================
// Tên file: src/features/shared/DemoMode.tsx
// Tên tiếng Việt: Chế độ demo — dải cảnh báo, nạp bộ demo, nút bật/tắt (admin)
// Description: Demo-mode UI (spec docs/spec/che-do-demo.md §4)
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { FlaskConical, LogOut, RefreshCw } from "lucide-react";
import { Button, ChoiceGroup, ProcessingState, ConfirmAction, todayIso, notify } from "@/design-system";
import {
  setAuditPaused,
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
import { IS_DEMO, setDemoMode, setPendingDemoTask, readDemoBundle, readDemoJob, saveDemoBundle, clearDemoBundle } from "@/lib/demoMode";
import { scanDemoParams, generateDemoBundle, type DemoBundle, type DemoSource } from "@/lib/demoGenerator";
import { num } from "@/lib/format";


/**
 * Dải "ĐANG XEM DỮ LIỆU DEMO" — dính đầu vùng nội dung, luôn hiện khi chế độ demo bật
 * (quy tắc 15: không bao giờ để người xem nhầm số demo là số thật). Tiêu đề tab có
 * tiền tố "[DEMO]".
 */
export function DemoModeBanner() {
  useEffect(() => {
    if (!IS_DEMO) return;
    const originalTitle = document.title;
    if (!originalTitle.startsWith("[DEMO]")) document.title = `[DEMO] ${originalTitle}`;
    return () => {
      document.title = originalTitle;
    };
  }, []);
  if (!IS_DEMO) return null;
  return (
    <div
      role="status"
      // Dính ngay dưới header trang (cùng token với SummaryTable fullHeight) — cuộn đâu cũng thấy.
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
        onClick={() => setDemoMode(false)}
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
export function DemoPackLoader() {
  const [bundle] = useState(() => readDemoBundle<DemoBundle>());
  if (!IS_DEMO || !bundle) return null;
  return <DemoBundleLoader bundle={bundle} />;
}

function DemoBundleLoader({ bundle }: { bundle: DemoBundle }) {
  const tables = {
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
  } satisfies Record<keyof DemoBundle, unknown>;
  const loaded = useRef(false);
  const [isWritten, setIsWritten] = useState(false);
  const done = (Object.values(tables) as { 2: { status: string } }[]).every((b) => b[2].status !== "loading");

  useEffect(() => {
    if (!done || loaded.current) return;
    loaded.current = true;
    setAuditPaused(true);
    try {
      for (const k of Object.keys(tables) as (keyof DemoBundle)[]) {
        const writer = tables[k][1] as (rows: unknown[]) => void;
        writer(bundle[k] ?? []);
      }
    } finally {
      setAuditPaused(false);
    }
    clearDemoBundle();
    const total = Object.values(bundle).reduce((s, items) => s + (items as unknown[]).length, 0);
    notify.saved(`Đã nạp bộ demo: ${num(total)} dòng số trình diễn.`);
    setIsWritten(true);
    // Chạy MỘT lần khi mọi bảng nạp xong (daNap chặn lần hai); `bang` đổi mỗi lần vẽ.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  if (isWritten) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80" role="status">
      <ProcessingState text="Đang nạp bộ số demo…" />
    </div>
  );
}

/**
 * Khối "Chế độ demo" cho admin (đặt ở Tổng quan). Chế độ thật: tạo bộ demo mới từ số
 * thật rồi vào demo, hoặc vào demo giữ bộ đang có. Chế độ demo: làm mới bộ demo (tải
 * lại về chế độ thật để quét, rồi tự vào lại) hoặc thoát.
 */
export function DemoModeSection() {
  return IS_DEMO ? <DemoActiveSection /> : <DemoGeneratorSection />;
}

function DemoActiveSection() {
  const refresh = () => {
    setPendingDemoTask("tao");
    setDemoMode(false);
  };
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-warning/50 bg-warning-surface p-4">
      <FlaskConical className="size-6 shrink-0 text-warning" aria-hidden />
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold text-foreground">Đang ở chế độ demo</h2>
        <p className="text-sm text-muted-foreground">Số trên mọi màn là bộ trình diễn. Bấm thử thoải mái — làm mới là về nguyên trạng.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <ConfirmAction
          title="Làm mới bộ demo?"
          description="App quay về chế độ thật một lát để quét số mới nhất, sinh lại bộ demo rồi tự vào lại. Mọi thứ đã ghi trong bộ demo hiện tại bị thay. Số thật không bị đụng."
          confirmLabel="Làm mới bộ demo"
          icon={RefreshCw}
          onConfirm={refresh}
          trigger={
            <Button title="Sinh lại bộ demo từ số thật mới nhất, thay bộ đang có." variant="outline">
              <RefreshCw />
              Làm mới bộ demo
            </Button>
          }
        />
        <Button title="Thoát chế độ demo, quay về số thật của xưởng." onClick={() => setDemoMode(false)}>
          <LogOut />
          Thoát demo
        </Button>
      </div>
    </section>
  );
}

function DemoGeneratorSection() {
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
  const loaded = [a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13].every((x) => x.status !== "loading");
  const [anonymize, setAnonymize] = useState("an");
  const [isCreating, setIsCreating] = useState(false);

  const source: DemoSource = useMemo(
    () => ({ products, materialTypes, suppliers, customers, batterTypes, storageLocations, imports, wips, periods, balancingInputs, balancingOutputs, nxtSnapshots, monthlyStock }),
    [products, materialTypes, suppliers, customers, batterTypes, storageLocations, imports, wips, periods, balancingInputs, balancingOutputs, nxtSnapshots, monthlyStock],
  );
  const demoParams = useMemo(() => scanDemoParams(source), [source]);

  const createAndEnter = () => {
    setIsCreating(true);
    const bundle = generateDemoBundle(source, { today: todayIso(), anonymize: anonymize === "an", hat: Date.now() % 100_000 });
    setPendingDemoTask(null);
    if (!saveDemoBundle(bundle)) {
      setIsCreating(false);
      notify.error("Không tạo được bộ demo (bộ nhớ trình duyệt đầy?). Thử xóa bớt dữ liệu trình duyệt rồi làm lại.");
      return;
    }
    setDemoMode(true);
  };

  // Việc chờ từ chế độ demo ("Làm mới bộ demo"): nạp xong số thật thì tự sinh và vào lại.
  const [pendingCreate] = useState(() => readDemoJob() === "tao");
  useEffect(() => {
    if (pendingCreate && loaded) createAndEnter();
    // taoVaVao tải lại trang ⇒ chỉ chạy một lần.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCreate, loaded]);

  if (pendingCreate) {
    return (
      <section className="rounded-xl border-2 border-border p-4" role="status">
        <ProcessingState text="Đang quét số thật để làm mới bộ demo…" />
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
            nhập: {num(demoParams.realImportRowCount)} dòng nhập, {demoParams.suppliers.length} đại lý, {demoParams.workshops.length} xưởng, tỉ lệ
            ra thành phẩm {num(demoParams.finishedRate * 100)}%. Bộ demo nằm riêng — số thật không bị đụng.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <ChoiceGroup
          label="Tên đối tác trong bộ demo"
          value={anonymize}
          onChange={setAnonymize}
          options={[
            { value: "an", label: "Ẩn tên + đổi giá", description: "Trình bày cho người ngoài" },
            { value: "giu", label: "Giữ tên thật", description: "Trình bày nội bộ" },
          ]}
          className="min-w-[min(20rem,100%)] flex-1"
        />
        <div className="flex flex-wrap gap-2">
          <ConfirmAction
            title="Tạo bộ demo mới và vào chế độ demo?"
            description="Quét số thật, sinh bộ demo 60 ngày rồi chuyển cả app sang chế độ demo. Bộ demo cũ (nếu có) bị thay. Số thật của xưởng không bị đụng."
            confirmLabel="Tạo và vào demo"
            icon={FlaskConical}
            onConfirm={createAndEnter}
            trigger={
              <Button title="Sinh bộ số demo từ số thật đã nhập rồi chuyển sang chế độ demo." disabled={!loaded || isCreating}>
                <FlaskConical />
                {loaded ? "Tạo bộ demo mới" : "Đang nạp số thật…"}
              </Button>
            }
          />
          <Button
            title="Vào chế độ demo, giữ nguyên bộ demo đã tạo lần trước."
            variant="outline"
            onClick={() => setDemoMode(true)}
          >
            Vào demo (giữ bộ cũ)
          </Button>
        </div>
      </div>
    </section>
  );
}
