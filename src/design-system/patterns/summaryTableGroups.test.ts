import { describe, expect, test } from "vitest";
import { splitGroups } from "./summaryTableGroups";

describe("splitGroups — chia nhóm trong SummaryTable", () => {
  const rows = [
    { id: "b1", s: "Bạch tuộc" },
    { id: "c1", s: "Cá" },
    { id: "b2", s: "Bạch tuộc" },
    { id: "c2", s: "Cá" },
  ];
  const rank = (k: string) => ["Cá", "Bạch tuộc"].indexOf(k);

  test("nhóm theo rank, dòng trong nhóm giữ thứ tự đang hiện (đã sắp theo cột)", () => {
    expect(splitGroups(rows, { key: (r) => r.s, rank })?.map((g) => [g.key, g.rows.map((r) => r.id)])).toEqual([
      ["Cá", ["c1", "c2"]],
      ["Bạch tuộc", ["b1", "b2"]],
    ]);
  });

  test("không rank ⇒ theo lần xuất hiện đầu; một nhóm ⇒ không chia", () => {
    expect(splitGroups(rows, { key: (r) => r.s })?.map((g) => g.key)).toEqual(["Bạch tuộc", "Cá"]);
    expect(splitGroups([rows[0], rows[2]], { key: (r) => r.s })).toBeNull();
  });
});
