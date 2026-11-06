import { describe, expect, it } from "vitest";
import { laterNxtPeriods, planNxtPeriodRemoval, restoreNxtLines } from "./nxtPeriods";

const line = (warehouseCode: string, periodFrom: string, periodTo: string, code: string, openingKg = 0) => ({
  id: `nxt|${warehouseCode}|${periodFrom}|${periodTo}|${code}`,
  warehouseCode,
  periodFrom,
  periodTo,
  itemCode: code,
  openingKg,
});

const JUL = ["2026-07-01", "2026-07-31"] as const;
const AUG = ["2026-08-01", "2026-08-31"] as const;
const ledger = [
  line("K1000T", ...JUL, "A", 10),
  line("K1000T", ...JUL, "B", 5),
  line("K1000T", ...AUG, "A", 10),
  line("K1000T", ...AUG, "B", 5),
  line("K1500T", "2026-09-01", "2026-09-30", "A", 1),
];
const ref = (w: string, [from, to]: readonly [string, string]) => ({ warehouseCode: w, periodFrom: from, periodTo: to });

describe("gỡ trọn một kỳ sổ NXT", () => {
  it("kỳ mới nhất của kho: gỡ đủ mọi dòng của kỳ, kho khác không đụng", () => {
    const r = planNxtPeriodRemoval(ledger, ref("K1000T", AUG));
    expect(r.blockers).toEqual([]);
    expect(r.removed.map((l) => l.itemCode)).toEqual(["A", "B"]);
    expect(r.kept).toHaveLength(3);
    expect(r.kept.some((l) => l.periodFrom === AUG[0])).toBe(false);
  });

  it("kỳ đã có kỳ sau cùng kho ⇒ chặn, không gỡ dòng nào", () => {
    const r = planNxtPeriodRemoval(ledger, ref("K1000T", JUL));
    expect(r.blockers).toEqual([{ from: AUG[0], to: AUG[1] }]);
    expect(r.removed).toEqual([]);
    expect(r.kept).toHaveLength(ledger.length);
  });

  it("kỳ sau của KHO KHÁC không chặn", () => {
    expect(laterNxtPeriods(ledger, ref("K1000T", AUG))).toEqual([]);
  });

  it("Hoàn tác trả đúng các dòng về sổ hiện tại, giữ số vừa gõ ở kỳ khác, không nhân đôi", () => {
    const r = planNxtPeriodRemoval(ledger, ref("K1000T", AUG));
    const edited = r.kept.map((l) => (l.itemCode === "A" && l.periodFrom === JUL[0] ? { ...l, openingKg: 99 } : l));
    const back = restoreNxtLines(edited, r.removed);
    expect(back).toHaveLength(ledger.length);
    expect(back.find((l) => l.id === ledger[0].id)?.openingKg).toBe(99);
    expect(restoreNxtLines(back, r.removed)).toHaveLength(ledger.length);
  });
});
