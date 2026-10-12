// ============================================================
// Tên file: src/lib/db.ts
// Tên tiếng Việt tương đương: Khởi tạo Cơ sở Dữ liệu LocalStorage
// Description: Local storage database seed and initial data store
// ============================================================
// Bộ đệm localStorage cấp thấp. Màn hình KHÔNG gọi trực tiếp — đi qua
// src/lib/repo.ts để chạy được cả hai chế độ (Supabase / chỉ máy này).
// Khóa localStorage khai báo trong repo.ts (AnhXaBang.localKey).

export function load<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

/**
 * Ghi bản sao xuống localStorage. Trả `false` khi KHÔNG ghi được (hết dung lượng
 * ~5MB / chế độ riêng tư) — người gọi (repo.ts) phải BÁO lên đèn kết nối, đừng
 * nuốt: mất bản sao = mất lưới an toàn khi rớt mạng.
 */
export function save<T>(key: string, rows: T[]): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(rows));
    return true;
  } catch {
    return false;
  }
}

/** 16 byte ngẫu nhiên dạng UUID v4. `crypto.randomUUID` chỉ có ở ngữ cảnh an toàn
 *  (https/localhost) — mở app qua http IP mạng nội bộ thì dựng từ getRandomValues. */
function uuidNgauNhien(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === "function") return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

let msTruoc = 0;

/**
 * Sinh id bản ghi mới: `<mốc ms tăng dần>-<uuid>`.
 *
 * - Phần UUID chống TRÙNG: bản cũ `Date.now()-random(1e6)` tạo hàng loạt trong
 *   1ms (~2% với 200 dòng) ra id trùng ⇒ upsert "ON CONFLICT cannot affect row a
 *   second time" ⇒ kẹt cả hàng chờ của bảng.
 * - Tiền tố mốc ms (tăng ngặt trong một tab) giữ THỨ TỰ GHI khi sắp theo id: nhiều
 *   chỗ lấy id làm khóa phụ "cùng ngày thì cái ghi trước/sau" (importHelpers,
 *   truyXuatLo.dongCuaChuyen, /wip…) — id cũ dạng `ms-số` vẫn so đúng với id mới.
 * - Đuôi 4 ký tự của id làm hậu tố nhãn lô (truyXuatLo.duoiId) — UUID cho hex.
 */
export function uid(): string {
  const ms = Math.max(Date.now(), msTruoc + 1);
  msTruoc = ms;
  return `${ms}-${uuidNgauNhien()}`;
}

/**
 * Di trú dữ liệu localStorage từ tiếng Việt (.v1) sang tiếng Anh (.v2)
 * để bảo vệ dữ liệu offline chưa đồng bộ của người dùng khi cập nhật app.
 */
export function migrateOldLocalStorage(): void {
  const migrations: { oldKey: string; newKey: string; mapFn: (o: any) => any }[] = [
    {
      oldKey: "bsf.daily.v1",
      newKey: "bsf.suppliers.v2",
      mapFn: (o) => ({
        id: o.id,
        code: o.code,
        shortName: o.ten,
        phone: o.phone,
        note: o.note,
        billingName: o.billingName,
        address: o.address,
        nationalId: o.nationalId,
        issuedDate: o.issuedDate,
        issuedPlace: o.issuedPlace,
      }),
    },
    {
      oldKey: "bsf.loainl.v1",
      newKey: "bsf.material-types.v2",
      mapFn: (o) => ({
        id: o.id,
        name: o.ten,
        category: o.loai,
        note: o.note,
      }),
    },
    {
      oldKey: "bsf.thanhpham.v1",
      newKey: "bsf.finished-goods.v2",
      mapFn: (o) => ({
        code: o.code,
        name: o.ten,
        unit: o.unit,
        accountCode: o.accountCode,
        groupName: o.groupName,
      }),
    },
    {
      oldKey: "bsf.mathang.v1",
      newKey: "bsf.products.v2",
      mapFn: (o) => ({
        id: o.id,
        code: o.code,
        name: o.ten,
        finishedGoodCode: o.finishedGoodCode,
        category: o.loai,
        materialTypeId: o.loaiNLId,
      }),
    },
    {
      oldKey: "bsf.khachhang.v1",
      newKey: "bsf.customers.v2",
      mapFn: (o) => ({
        id: o.id,
        code: o.code,
        name: o.ten,
        market: o.market,
      }),
    },
    {
      oldKey: "bsf.chuyen.v1",
      newKey: "bsf.import-shipments.v2",
      mapFn: (o) => ({
        id: o.id,
        deliveryDate: o.deliveryDate,
        postingDate: o.postingDate,
        backdateReason: o.backdateReason,
        workshop: o.workshop,
        supplierName: o.supplierName,
        driverName: o.driverName,
        licensePlate: o.licensePlate,
        note: o.note,
      }),
    },
    {
      oldKey: "bsf.chot-ngay.v1",
      newKey: "bsf.daily-locks.v2",
      mapFn: (o) => ({
        id: o.id,
        lockDate: o.ngay,
        workshop: o.workshop,
        isLocked: o.isLocked,
        lockedAt: o.lockedAt,
        totalKgAtLock: o.totalKgAtLock,
        reopenReason: o.reopenReason,
        note: o.note,
      }),
    },
    {
      oldKey: "bsf.nhap-nl.v1",
      newKey: "bsf.material-imports.v2",
      mapFn: (o) => ({
        id: o.id,
        shipmentId: o.shipmentId,
        deliveryDate: o.ngay,
        workshop: o.workshop,
        category: o.loai,
        supplierName: o.supplierName,
        materialTypeName: o.materialTypeName,
        quantityKg: o.quantityKg,
        unitPrice: o.unitPrice,
        driverName: o.driverName,
        licensePlate: o.licensePlate,
        note: o.note,
      }),
    },
    {
      oldKey: "bsf.ky.v1",
      newKey: "bsf.balancing-periods.v2",
      mapFn: (o) => ({
        id: o.id,
        materialTypeName: o.materialTypeName,
        dateRangeDescription: o.dateRangeDescription,
        startDate: o.startDate,
        endDate: o.endDate,
        totalInputKg: o.totalInputKg,
        exchangeRate: o.exchangeRate,
        processingCostPerKg: o.processingCostPerKg,
        createdAt: o.createdAt,
      }),
    },
    {
      oldKey: "bsf.nlvao.v1",
      newKey: "bsf.balancing-inputs.v2",
      mapFn: (o) => ({
        id: o.id,
        periodId: o.periodId,
        groupName: o.groupName,
        name: o.ten,
        quantityKg: o.quantityKg,
        unitPrice: o.unitPrice,
        ratioPercentage: o.ratioPercentage,
        sourceWarehouse: o.sourceWarehouse,
      }),
    },
    {
      oldKey: "bsf.phelieu.v1",
      newKey: "bsf.scraps.v2",
      mapFn: (o) => ({
        id: o.id,
        periodId: o.periodId,
        name: o.loai,
        quantityKg: o.quantityKg,
        sellingPrice: o.sellingPrice,
        date: o.ngay,
        workshop: o.workshop,
        source: o.nguon,
      }),
    },
    {
      oldKey: "bsf.tp.v1",
      newKey: "bsf.balancing-outputs.v2",
      mapFn: (o) => ({
        id: o.id,
        periodId: o.periodId,
        productId: o.productId,
        customerId: o.customerId,
        channel: o.kenh,
        quantityKg: o.quantityKg,
        unitPrice: o.unitPrice,
        spec: o.spec,
        salesItemId: o.salesItemId,
      }),
    },
    {
      oldKey: "bsf.users.v1",
      newKey: "bsf.user-profiles.v2",
      mapFn: (o) => ({
        id: o.id,
        fullName: o.fullName,
        username: o.username,
        roles: o.roles,
      }),
    },
    {
      oldKey: "bsf.phieu-ban.v1",
      newKey: "bsf.sales-invoices.v2",
      mapFn: (o) => ({
        id: o.id,
        deliveryDate: o.deliveryDate,
        postingDate: o.postingDate,
        backdateReason: o.backdateReason,
        workshop: o.workshop,
        customerId: o.customerId,
        channel: o.kenh,
        note: o.note,
      }),
    },
    {
      oldKey: "bsf.sales.v1",
      newKey: "bsf.sales-items.v2",
      mapFn: (o) => ({
        id: o.id,
        invoiceId: o.invoiceId,
        deliveryDate: o.ngay,
        productId: o.productId,
        spec: o.spec,
        quantityKg: o.quantityKg,
        unitPrice: o.unitPrice,
        sourceWarehouse: o.sourceWarehouse,
      }),
    },
    {
      oldKey: "bsf.production.v1",
      newKey: "bsf.production-wips.v2",
      mapFn: (o) => ({
        id: o.id,
        productionDate: o.ngay,
        postingDate: o.postingDate,
        backdateReason: o.backdateReason,
        workshop: o.workshop,
        productId: o.productId,
        spec: o.spec,
        quantityKg: o.quantityKg,
        blocksCount: o.blocksCount,
        warehouse: o.warehouse,
        status: o.status,
        note: o.note,
      }),
    },
    {
      oldKey: "bsf.chot-production.v1",
      newKey: "bsf.production-locks.v2",
      mapFn: (o) => ({
        id: o.id,
        lockDate: o.ngay,
        workshop: o.workshop,
        isLocked: o.isLocked,
        lockedAt: o.lockedAt,
        totalKgAtLock: o.totalKgAtLock,
        reopenReason: o.reopenReason,
        note: o.note,
      }),
    },
    {
      oldKey: "bsf.orders.v1",
      newKey: "bsf.sales-orders.v2",
      mapFn: (o) => ({
        id: o.id,
        customerId: o.customerId,
        orderDate: o.orderDate,
        status: o.status,
        note: o.note,
      }),
    },
    {
      oldKey: "bsf.dong-don.v1",
      newKey: "bsf.order-items.v2",
      mapFn: (o) => ({
        id: o.id,
        orderId: o.orderId,
        productId: o.productId,
        spec: o.spec,
        requiredQuantityKg: o.requiredQuantityKg,
        requiredBlocksCount: o.requiredBlocksCount,
      }),
    },
    {
      oldKey: "bsf.lenh-xuat.v1",
      newKey: "bsf.export-orders.v2",
      mapFn: (o) => ({
        id: o.id,
        orderId: o.orderId,
        exportDate: o.ngay,
        status: o.status,
        note: o.note,
      }),
    },
    {
      oldKey: "bsf.dong-lenh.v1",
      newKey: "bsf.export-items.v2",
      mapFn: (o) => ({
        id: o.id,
        exportId: o.exportId,
        wipId: o.wipId,
        productId: o.productId,
        spec: o.spec,
        quantityKg: o.quantityKg,
        blocksCount: o.blocksCount,
      }),
    },
  ];

  for (const item of migrations) {
    const raw = localStorage.getItem(item.oldKey);
    if (raw) {
      try {
        const oldData = JSON.parse(raw);
        if (Array.isArray(oldData)) {
          const newData = oldData.map((x) => {
            try {
              return item.mapFn(x);
            } catch (err) {
              console.error(`Lỗi map dòng của bảng ${item.oldKey}:`, err);
              return x; // fallback
            }
          });
          localStorage.setItem(item.newKey, JSON.stringify(newData));
        }
      } catch (err) {
        console.error(`Lỗi parse dữ liệu cũ của bảng ${item.oldKey}:`, err);
      }
      localStorage.removeItem(item.oldKey);
    }

    // Di chuyển cả hàng chờ đồng bộ của bảng (.cho) sang newKey.cho
    const queueRaw = localStorage.getItem(`${item.oldKey}.cho`);
    if (queueRaw) {
      localStorage.setItem(`${item.newKey}.cho`, queueRaw);
      localStorage.removeItem(`${item.oldKey}.cho`);
    }
  }
}
