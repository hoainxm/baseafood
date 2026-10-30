// ============================================================
// Tên file: src/features/shared/DemoMode.tsx
// Tên tiếng Việt: Chế độ demo — dải cảnh báo, nạp bộ demo, nút Demo trên header (admin)
// Description: Demo-mode UI (spec docs/spec/che-do-demo.md §4)
// ============================================================
import { forwardRef, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { FlaskConical, LogOut, RefreshCw } from "lucide-react";
import {
  Button,
  ChoiceGroup,
  ConfirmAction,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ProcessingState,
  todayIso,
  notify,
} from "@/design-system";
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
  useTaskAssignments,
  useCompanyDocuments,
  useExportContracts,
  useExportContractRevisions,
  useExportContractApprovals,
  useExportDeadlineExtensions,
  useExportShipments,
  useExportStepItems,
  useExportFiles,
  useExportPayments,
  useExportActivities,
  useCustomerProductNames,
  useExportDocumentKinds,
  useGoodsTypes,
  useImportContracts,
  useImportSuppliers,
  useImportContractLines,
  useImportReceipts,
  useImportReceiptLines,
  useImportDocuments,
  useImportFiles,
  useImportSampleChecks,
  useDocumentVersions,
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
import { fetchExportDemoPack } from "@/lib/exportFileStorage";
import { ExportDemoPackUpload } from "./ExportDemoPackUpload";
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
      className="sticky top-header z-20 mb-4 flex items-center gap-2 rounded-md bg-warning px-3 py-1 text-warning-foreground"
    >
      <FlaskConical className="size-4 shrink-0" aria-hidden />
      {/* Gọn một dòng — nút Thoát / Làm mới ở nút DEMO trên header. */}
      <p className="min-w-0 flex-1 text-sm font-semibold">ĐANG XEM DỮ LIỆU DEMO — số trình diễn, không phải sổ thật của xưởng.</p>
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
    taskAssignments: useTaskAssignments(),
    companyDocuments: useCompanyDocuments(),
    documentVersions: useDocumentVersions(),
    exportContracts: useExportContracts(),
    exportContractRevisions: useExportContractRevisions(),
    exportContractApprovals: useExportContractApprovals(),
    exportDeadlineExtensions: useExportDeadlineExtensions(),
    exportShipments: useExportShipments(),
    exportStepItems: useExportStepItems(),
    exportFiles: useExportFiles(),
    exportPayments: useExportPayments(),
    exportActivities: useExportActivities(),
    customerProductNames: useCustomerProductNames(),
    exportDocumentKinds: useExportDocumentKinds(),
    goodsTypes: useGoodsTypes(),
    importSuppliers: useImportSuppliers(),
    importContracts: useImportContracts(),
    importContractLines: useImportContractLines(),
    importReceipts: useImportReceipts(),
    importReceiptLines: useImportReceiptLines(),
    importDocuments: useImportDocuments(),
    importFiles: useImportFiles(),
    importSampleChecks: useImportSampleChecks(),
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
 * Nút "Demo" trên header (admin; gom gọn 2026-10-16 — trước là khối to ở Tổng quan).
 * Chế độ thật: menu nhỏ chọn ẩn tên/giữ tên rồi tạo bộ mới hoặc vào demo giữ bộ cũ.
 * Chế độ demo: nút nổi màu cảnh báo, menu Làm mới / Thoát. Bộ số thật chỉ nạp khi mở
 * menu lần đầu (không tốn tải ở mọi màn); việc chờ "Làm mới" tự chạy ở bất kỳ màn nào.
 */
export function DemoModeHeaderButton() {
  const [pendingCreate] = useState(() => !IS_DEMO && readDemoJob() === "tao");
  const [isActivated, setIsActivated] = useState(pendingCreate);
  if (IS_DEMO) return <DemoActiveMenu />;
  if (!isActivated) return <DemoTriggerButton onClick={() => setIsActivated(true)} />;
  return <DemoGeneratorMenu autoCreate={pendingCreate} />;
}

const DemoTriggerButton = forwardRef<HTMLButtonElement, ComponentProps<typeof Button>>(function DemoTriggerButton(
  props,
  ref,
) {
  return (
    <Button
      ref={ref}
      data-tour="dashboard-demo-mode"
      title="Chế độ demo: trình bày bằng bộ số sinh từ số thật, số thật không bị đụng."
      variant="outline"
      className="text-muted-foreground"
      {...props}
    >
      <FlaskConical />
      <span className="hidden lg:inline">Demo</span>
    </Button>
  );
});

function DemoActiveMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const refresh = () => {
    setPendingDemoTask("tao");
    setDemoMode(false);
  };
  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          {/* Điện thoại: chỉ icon (dải "ĐANG XEM DỮ LIỆU DEMO" trên trang đã báo) — chữ DEMO
              chiếm ~110 px ở cỡ chữ 130 %, ép tiêu đề trang mất hẳn. */}
          <Button
            data-tour="dashboard-demo-mode"
            title="Đang ở chế độ demo — bấm để làm mới bộ demo hoặc thoát."
            aria-label="Đang ở chế độ demo — làm mới bộ demo hoặc thoát"
            className="border-warning bg-warning font-bold text-warning-foreground hover:bg-warning/90 max-sm:w-10 max-sm:px-0"
          >
            <FlaskConical />
            <span className="max-sm:sr-only">DEMO</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="grid w-80 max-w-[calc(100vw-2rem)] gap-3">
          <div>
            <p className="font-semibold text-foreground">Đang ở chế độ demo</p>
            <p className="text-sm text-muted-foreground">Số trên mọi màn là bộ trình diễn. Bấm thử thoải mái, làm mới là về nguyên trạng.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              title="Sinh lại bộ demo từ số thật mới nhất, thay bộ đang có."
              variant="outline"
              onClick={() => {
                setIsOpen(false);
                setIsConfirming(true);
              }}
            >
              <RefreshCw />
              Làm mới bộ demo
            </Button>
            <Button title="Thoát chế độ demo, quay về số thật của xưởng." onClick={() => setDemoMode(false)}>
              <LogOut />
              Thoát demo
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <ConfirmAction
        open={isConfirming}
        onOpenChange={setIsConfirming}
        title="Làm mới bộ demo?"
        description="App quay về chế độ thật một lát để quét số mới nhất, sinh lại bộ demo rồi tự vào lại. Mọi thứ đã ghi trong bộ demo hiện tại bị thay. Số thật không bị đụng."
        confirmLabel="Làm mới bộ demo"
        icon={RefreshCw}
        onConfirm={refresh}
      />
    </>
  );
}

function DemoGeneratorMenu({ autoCreate }: { autoCreate: boolean }) {
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
  const [isOpen, setIsOpen] = useState(!autoCreate);
  const [isConfirming, setIsConfirming] = useState(false);
  const [anonymize, setAnonymize] = useState("an");
  const [isCreating, setIsCreating] = useState(false);

  const source: DemoSource = useMemo(
    () => ({ products, materialTypes, suppliers, customers, batterTypes, storageLocations, imports, wips, periods, balancingInputs, balancingOutputs, nxtSnapshots, monthlyStock }),
    [products, materialTypes, suppliers, customers, batterTypes, storageLocations, imports, wips, periods, balancingInputs, balancingOutputs, nxtSnapshots, monthlyStock],
  );
  const demoParams = useMemo(() => scanDemoParams(source), [source]);

  const createAndEnter = async () => {
    setIsCreating(true);
    // Gói demo Xuất khẩu (số + file thật) nằm ở kho file riêng — chưa nạp thì bộ Xuất khẩu dùng số tự đặt.
    const exportPack = await fetchExportDemoPack();
    const bundle = generateDemoBundle(source, { today: todayIso(), anonymize: anonymize === "an", hat: Date.now() % 100_000, exportPack });
    setPendingDemoTask(null);
    if (!saveDemoBundle(bundle)) {
      setIsCreating(false);
      notify.error("Không tạo được bộ demo (bộ nhớ trình duyệt đầy?). Thử xóa bớt dữ liệu trình duyệt rồi làm lại.");
      return;
    }
    setDemoMode(true);
  };

  // Việc chờ từ chế độ demo ("Làm mới bộ demo"): nạp xong số thật thì tự sinh và vào lại.
  useEffect(() => {
    if (autoCreate && loaded) void createAndEnter();
    // createAndEnter tải lại trang ⇒ chỉ chạy một lần.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCreate, loaded]);

  if (autoCreate) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-background/80" role="status">
        <ProcessingState text="Đang quét số thật để làm mới bộ demo…" />
      </div>
    );
  }

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <DemoTriggerButton />
        </PopoverTrigger>
        <PopoverContent align="end" className="grid w-96 max-w-[calc(100vw-2rem)] gap-3">
          <div>
            <p className="font-semibold text-foreground">Chế độ demo</p>
            <p className="text-sm text-muted-foreground">
              {loaded
                ? `Sinh bộ số đủ chuỗi từ số thật: ${num(demoParams.realImportRowCount)} dòng nhập, ${demoParams.suppliers.length} đại lý, ${demoParams.workshops.length} xưởng, tỉ lệ ra TP ${num(demoParams.finishedRate * 100)}%. Số thật không bị đụng.`
                : "Đang nạp số thật…"}
            </p>
          </div>
          <ChoiceGroup
            label="Tên đối tác"
            value={anonymize}
            onChange={setAnonymize}
            options={[
              { value: "an", label: "Ẩn tên + đổi giá", description: "Cho người ngoài" },
              { value: "giu", label: "Giữ tên thật", description: "Nội bộ" },
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              title="Sinh bộ số demo từ số thật đã nhập rồi chuyển sang chế độ demo."
              disabled={!loaded || isCreating}
              onClick={() => {
                setIsOpen(false);
                setIsConfirming(true);
              }}
            >
              <FlaskConical />
              Tạo bộ mới
            </Button>
            <Button title="Vào chế độ demo, giữ nguyên bộ demo đã tạo lần trước." variant="outline" onClick={() => setDemoMode(true)}>
              Vào demo (giữ bộ cũ)
            </Button>
          </div>
          <ExportDemoPackUpload />
        </PopoverContent>
      </Popover>
      <ConfirmAction
        open={isConfirming}
        onOpenChange={setIsConfirming}
        title="Tạo bộ demo mới và vào chế độ demo?"
        description="Quét số thật, sinh bộ demo 60 ngày rồi chuyển cả app sang chế độ demo. Bộ demo cũ (nếu có) bị thay. Số thật của xưởng không bị đụng."
        confirmLabel="Tạo và vào demo"
        icon={FlaskConical}
        onConfirm={() => void createAndEnter()}
      />
    </>
  );
}
