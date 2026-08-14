// ============================================================
// demo-seed.js — Nạp dữ liệu mẫu DEMO cho Baseafood MES (chế độ localStorage)
// ------------------------------------------------------------
// DÙNG KHI NÀO: trình diễn báo cáo Nhập nguyên liệu → Cân đối kỳ.
// Dữ liệu trích từ 2 file Excel THẬT (bạch tuộc 2 da + báo cáo ngày).
//
// CÁCH CHẠY:
//   1. Chạy app chế độ demo (KHÔNG login):  npm run dev -- --mode demolocal --port 5174
//   2. Mở Chrome:  http://localhost:5174/#/catalog   (bước này tự tạo 141 thành phẩm seed)
//   3. F12 → tab Console → dán TOÀN BỘ file này → Enter → thấy "✅ SEED OK".
//   4. F5 reload. Vào /#/imports và /#/balancing để trình diễn.
//
// AN TOÀN: chỉ ghi localStorage của tab :5174 (chế độ demo, không có Supabase).
//          Không đụng server thật, không đụng .env. Chạy lại nhiều lần vẫn đúng
//          (idempotent). Xoá sạch demo: localStorage.clear() rồi F5.
// ============================================================
(function seedDemo() {
  const PID = "seed-ky-bt2da";
  const TODAY = new Date().toISOString().slice(0, 10); // ngày nhập hàng = hôm nay để màn Nhập hàng mở-là-thấy

  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const get = (k) => JSON.parse(localStorage.getItem(k) || "[]");

  // --- Cảnh báo nếu danh mục 141 thành phẩm chưa được nạp ---
  if (get("bsf.finished-goods.v2").length === 0) {
    alert("Chưa có danh mục 141 thành phẩm.\nHãy mở http://localhost:5174/#/catalog TRƯỚC, rồi chạy lại script này.");
    return;
  }

  // --- Danh mục bổ sung ---
  const customers = [
    ["seed-cust-1", "Seachemot"], ["seed-cust-2", "Lucky"], ["seed-cust-3", "Peacock"],
    ["seed-cust-4", "Hanwa"], ["seed-cust-5", "Matsuda"], ["seed-cust-6", "Hatchando"],
    ["seed-cust-7", "JFDA"], ["seed-cust-8", "Dairei"],
  ].map(([id, name]) => ({ id, code: "", name, market: "Xuất khẩu" }));
  put("bsf.customers.v2", customers);

  const suppliers = ["Bê 3", "Hồng Phú", "H Mũng", "Pháp M Né", "Hưng V Tàu", "Mậu H Tân"]
    .map((n, i) => ({ id: `seed-sup-${i + 1}`, code: "", shortName: n, billingName: n,
      address: "", nationalId: "", issuedDate: "", issuedPlace: "", phone: "", note: "Đại lý bạch tuộc 2 da" }));
  put("bsf.suppliers.v2", suppliers);

  // 21 mặt hàng bán thành phẩm (từ khối thành phẩm file Excel)
  const prodNames = [
    "2 rầu cắt luộc 16-20", "2 da cắt chần 1 - 2", "2 da cắt chần 4 - 5", "2 da cắt chần 5 - 6",
    "2 da cắt chần 380 - 420", "2 da cắt chần 455 - 555", "2 da cắt chần 700 - 750",
    "2 da luộc 230-250", "2 da luộc 370 - 420", "2 da luộc 300-330", "2 da luộc 600 - 900",
    "2 da luộc 1000 - 1300", "2 da luộc 1.5g", "2 da luộc 2g", "2 da luộc 3g", "2 da luộc 5,5g",
    "2 da luộc 4 - 5 1'", "2 da tẩm bột nước tương", "2 da tẩm bột 9 - 12", "2 da luộc màu", "2 da ncls",
  ];
  const newProds = prodNames.map((name, i) => ({
    id: `seed-prod-${i + 1}`, code: "", name, finishedGoodCode: "", category: "Bạch tuộc",
  }));
  // merge idempotent: giữ danh mục cũ, thay các seed-prod-* cũ bằng bản mới
  const keepProds = get("bsf.products.v2").filter((p) => !String(p.id).startsWith("seed-prod-"));
  put("bsf.products.v2", keepProds.concat(newProds));

  // --- Kỳ cân đối (bản sao "Bảng cân đối bạch tuộc 2 da" — kỳ 21-25/07) ---
  put("bsf.balancing-periods.v2", [{
    id: PID, materialTypeName: "Bạch tuộc 2 da", dateRangeDescription: "21/07/2025 – 25/07/2025",
    startDate: "2025-07-21", endDate: "2025-07-25", totalInputKg: 63926,
    exchangeRate: 26000, processingCostPerKg: 30000, createdAt: "2025-07-26T02:00:00.000Z",
  }]);

  // Khối 1 — Nguyên liệu vào (11 dòng). Đơn giá = tiền/kg từ file giấy.
  const IN = [
    ["Bán nội địa", "Thủy sản", -987, 145000, ""],
    ["x.đ Cò May", "Xả đông", 13584, 157000, "Mua về"],
    ["x.đ Tả", "Xả đông", 5100, 157000, "Mua về"],
    ["x.đ 2 da lớn", "Xả đông", 3984, 149000, "Mua về"],
    ["2 da nl lớn", "Thủy sản", 23150, 145000, ""],
    ["2 da nl nhỏ", "Thủy sản", 16356, 137737, ""],
    ["Bột 24v", "Bột phụ gia", 245, 50428, ""],
    ["Bột 18v", "Bột phụ gia", 1481, 52497, ""],
    ["Bột 27102", "Bột phụ gia", 670, 48540, ""],
    ["Bột 22601", "Bột phụ gia", 155, 53000, ""],
    ["Bột 2204", "Bột phụ gia", 188.3, 89340, ""],
  ].map(([name, groupName, quantityKg, unitPrice, sourceWarehouse], i) => ({
    id: `seed-in-${i + 1}`, periodId: PID, groupName, name, quantityKg, unitPrice,
    ratioPercentage: null, sourceWarehouse,
  }));
  put("bsf.balancing-inputs.v2", IN);

  // Khối 3 — Bán thành phẩm ra (24 dòng: productIdx, custId, kg, giá USD)
  const OUT = [
    [1, "seed-cust-1", 1083, 10.81], [2, "seed-cust-1", 93, 9.65], [3, "seed-cust-2", 6, 10.9],
    [4, "seed-cust-1", 2399, 10.75], [5, "seed-cust-1", 56, 10.51], [6, "seed-cust-3", 1815, 8.56],
    [7, "seed-cust-3", 7521, 8.51], [8, "seed-cust-4", 11591, 10.43], [9, "seed-cust-5", 12, 11.4],
    [10, "seed-cust-4", 1369, 10.23], [11, "seed-cust-1", 558, 10.06], [12, "seed-cust-1", 380, 10.06],
    [13, "seed-cust-6", 1890, 10.67], [14, "seed-cust-6", 538, 10.87], [15, "seed-cust-6", 70, 11.02],
    [16, "seed-cust-1", 325, 10.75], [17, "seed-cust-1", 169, 11.1], [18, "seed-cust-7", 5119, 9.3],
    [18, "seed-cust-8", 2000, 9.2], [19, "seed-cust-1", 1411, 7.95], [19, "seed-cust-1", 1000, 9.2],
    [20, "", 1260, 9.75], [20, "", 261, 8.55], [21, "", 2218, 6.55],
  ].map(([p, customerId, quantityKg, unitPrice], i) => ({
    id: `seed-out-${i + 1}`, periodId: PID, productId: `seed-prod-${p}`, customerId,
    channel: "Xuất khẩu", quantityKg, unitPrice, spec: "",
  }));
  put("bsf.balancing-outputs.v2", OUT);

  // Khối 2 — Phế liệu (1 dòng minh hoạ)
  put("bsf.scraps.v2", [{
    id: "seed-scrap-1", periodId: PID, name: "Nội tạng bạch tuộc", quantityKg: 820,
    sellingPrice: 9000, date: "2025-07-23", workshop: "Đông", source: "Cân đối",
  }]);

  // --- Nhập nguyên liệu: 2 chuyến hôm nay (kg thật từ báo cáo ngày) ---
  put("bsf.import-shipments.v2", [
    { id: "seed-sh-1", deliveryDate: TODAY, postingDate: TODAY, backdateReason: "", workshop: "Đông",
      supplierName: "Bê 3", driverName: "", licensePlate: "", note: "Demo — báo cáo ngày (đại lý Bê 3)" },
    { id: "seed-sh-2", deliveryDate: TODAY, postingDate: TODAY, backdateReason: "", workshop: "Đông",
      supplierName: "Hồng Phú", driverName: "", licensePlate: "", note: "Demo — báo cáo ngày (đại lý Hồng Phú)" },
  ]);
  const imp = (id, sh, sup, mt, kg, gia) => ({
    id, shipmentId: sh, deliveryDate: TODAY, workshop: "Đông", category: "Bạch tuộc",
    supplierName: sup, materialTypeName: mt, quantityKg: kg, unitPrice: gia,
    driverName: "", licensePlate: "", note: "",
  });
  put("bsf.material-imports.v2", [
    imp("seed-imp-1", "seed-sh-1", "Bê 3", "2 da nguyên liệu", 5298, 145000),
    imp("seed-imp-2", "seed-sh-1", "Bê 3", "1 da nguyên liệu", 1391, 130000),
    imp("seed-imp-3", "seed-sh-2", "Hồng Phú", "2 da nguyên liệu", 5173, 145000),
    imp("seed-imp-4", "seed-sh-2", "Hồng Phú", "1 da nguyên liệu", 1320, 130000),
  ]);

  console.log("%c✅ SEED OK", "color:green;font-weight:bold", {
    "mặt hàng (+21)": get("bsf.products.v2").length, khách: customers.length, "đại lý": suppliers.length,
    "kỳ cân đối": 1, "NL vào": IN.length, "TP ra": OUT.length, "chuyến nhập": 2, "ngày nhập": TODAY,
  });
  alert("✅ SEED OK — F5 để reload. Vào /#/imports (2 chuyến hôm nay) và /#/balancing (kỳ bạch tuộc 2 da).");
})();
