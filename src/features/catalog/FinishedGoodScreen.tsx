// ============================================================
// Tên file cũ: src/features/catalog/ThanhPham.tsx
// Tên tiếng Việt: Màn hình Tra cứu Danh mục 141 Mã Thành Phẩm 1551
// Description: Finished Goods Code 1551 Lookup Screen
// ============================================================
import { useMemo, useState } from "react";
import type { FinishedGood } from "@/types";
import { useFinishedGoods } from "@/lib/catalogRepo";
import {
  Button,
  Combobox,
  EmptyState,
  Tag,
  RecordTable,
  TableSkeleton,
  toneByName,
  type RecordTableColumn,
} from "@/design-system";
import { Search, X } from "lucide-react";

/**
 * Danh mục thành phẩm 141 mã (tài khoản 1551) — CHỈ ĐỌC.
 *
 * Danh mục do kế toán phát hành, sửa ở đây sẽ lệch sổ kế toán nên màn này
 * không có Thêm/Sửa/Xóa. Việc dùng thực tế là TRA CỨU và ÁNH XẠ sang mặt hàng
 * cân đối — nên màn tối ưu cho tìm kiếm và sắp xếp, không phải nhập liệu.
 */
export default function FinishedGoodScreen() {
  const [nhom, setNhom] = useState("");
  const [items, , { trangThai: status }] = useFinishedGoods();
  const isLoading = status === "dang-tai" && items.length === 0;

  const nhomList = useMemo(
    () => Array.from(new Set(items.map((i) => i.groupName))).sort(),
    [items]
  );

  const rows = useMemo(
    () => (nhom ? items.filter((i) => i.groupName === nhom) : items),
    [nhom, items]
  );

  const cols: RecordTableColumn<FinishedGood>[] = [
    {
      key: "name",
      header: "Tên thành phẩm",
      primary: true,
      render: (r) => r.name,
      getSortValue: (r) => r.name,
    },
    {
      key: "code",
      header: "Mã",
      render: (r) => <span className="tnum font-medium">{r.code}</span>,
      getSortValue: (r) => r.code,
    },
    {
      key: "groupName",
      header: "Nhóm",
      render: (r) => <Tag variant="phan-loai" tone={toneByName(r.groupName)}>{r.groupName}</Tag>,
      getSortValue: (r) => r.groupName,
    },
    {
      key: "unit",
      header: "Đơn vị",
      render: (r) => r.unit,
      hideOnMobile: true,
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Thành phẩm theo danh mục kế toán
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {items.length} mã, tài khoản 1551, đơn vị ki-lô-gam. Danh mục chỉ để
          tra cứu — muốn đổi phải sửa ở sổ kế toán.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-64 flex-1">
          <Combobox
            label="Nhóm hàng"
            value={nhom}
            onChange={setNhom}
            options={nhomList.map((n) => ({ value: n, label: n }))}
            placeholder="Tất cả nhóm"
          />
        </div>
        <p className="pb-3 text-sm text-muted-foreground">
          Đang hiện{" "}
          <span className="tnum font-semibold text-foreground">
            {rows.length}
          </span>{" "}
          / {items.length} mã
        </p>
        {nhom && (
          <Button
            title="Bỏ lọc theo nhóm — hiện lại toàn bộ 141 mã thành phẩm." variant="outline" className="mb-1" onClick={() => setNhom("")}>
            <X />
            Bỏ lọc nhóm
          </Button>
        )}
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Không có mã nào trong nhóm này"
          description="Bỏ lọc nhóm để xem lại toàn bộ danh mục."
          action={
            <Button
              title="Bỏ lọc theo nhóm để xem lại toàn bộ danh mục." size="lg" onClick={() => setNhom("")}>
              Bỏ lọc nhóm
            </Button>
          }
        />
      ) : (
        <RecordTable
          columns={cols}
          rows={rows}
          getKey={(r) => r.code}
          rowMarkKey="danh-muc-tp-141"
          getSearchText={(r) => `${r.code} ${r.name} ${r.groupName}`}
          searchLabel="Tìm theo tên hoặc mã thành phẩm…"
        />
      )}
    </div>
  );
}
