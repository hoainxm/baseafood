import { describe, expect, it } from "vitest";
import { rowToServer, rowFromServer, toServerKey, modeLocalKey, fromServerKey, SITE_DEMO } from "./demoMode";

describe("modeLocalKey — tách bản sao + hàng chờ dưới máy", () => {
  it("demo: bsf.* → bsf-demo.*, khóa khác giữ nguyên", () => {
    expect(modeLocalKey("bsf.material-imports.v2", true)).toBe("bsf-demo.material-imports.v2");
    expect(modeLocalKey("bsf.material-imports.v2.cho", true)).toBe("bsf-demo.material-imports.v2.cho");
    expect(modeLocalKey("bsf1:nav-nhom", true)).toBe("bsf1:nav-nhom");
  });
  it("thật: không đổi gì", () => {
    expect(modeLocalKey("bsf.material-imports.v2", false)).toBe("bsf.material-imports.v2");
  });
});

describe("khóa chính ở ranh giới máy chủ (rào R1)", () => {
  it("demo: thêm tiền tố một lần, đọc về bỏ tiền tố", () => {
    expect(toServerKey("2026-10-12|Đông", true)).toBe("demo:2026-10-12|Đông");
    expect(toServerKey("demo:x", true)).toBe("demo:x");
    expect(fromServerKey("demo:2026-10-12|Đông", true)).toBe("2026-10-12|Đông");
  });
  it("demo: dòng không có tiền tố (dòng thật lọt site) bị bỏ qua", () => {
    expect(fromServerKey("1551001", true)).toBeNull();
    expect(rowFromServer({ code: "1551001" }, "code", true)).toBeNull();
  });
  it("thật: khóa đi về nguyên vẹn", () => {
    expect(toServerKey("abc", false)).toBe("abc");
    expect(fromServerKey("demo:abc", false)).toBe("demo:abc");
  });
  it("rowToServer: đổi đúng cột khóa + gắn site, cột khác giữ nguyên", () => {
    expect(rowToServer({ code: "1551001", name: "Mực" }, "code", SITE_DEMO, true)).toEqual({
      code: "demo:1551001",
      name: "Mực",
      site_id: SITE_DEMO,
    });
    expect(rowToServer({ id: "a", shipment_id: "b" }, "id", "bsf1", false)).toEqual({ id: "a", shipment_id: "b", site_id: "bsf1" });
  });
  it("khứ hồi demo: lên rồi về ra đúng dòng app", () => {
    const row = { id: "x-1", workshop: "Đông" };
    expect(rowFromServer(rowToServer(row, "id", SITE_DEMO, true), "id", true)).toEqual({ ...row, site_id: SITE_DEMO });
  });
});

describe("cột khóa ngoại (refColumns) — period_id → balancing_periods.id", () => {
  it("demo: khóa ngoại mang tiền tố như khóa chính kỳ; rỗng / null giữ nguyên", () => {
    expect(rowToServer({ id: "v1", period_id: "ky-1" }, "id", SITE_DEMO, true, ["period_id"])).toEqual({
      id: "demo:v1",
      period_id: "demo:ky-1",
      site_id: SITE_DEMO,
    });
    expect(rowToServer({ id: "p1", period_id: null }, "id", SITE_DEMO, true, ["period_id"]).period_id).toBeNull();
    expect(rowToServer({ id: "p1", period_id: "" }, "id", SITE_DEMO, true, ["period_id"]).period_id).toBe("");
  });
  it("demo: đọc về bỏ tiền tố cả khóa ngoại — khớp lại đúng id kỳ của app", () => {
    const period = rowFromServer(rowToServer({ id: "ky-1" }, "id", SITE_DEMO, true), "id", true);
    const row = rowFromServer(rowToServer({ id: "v1", period_id: "ky-1" }, "id", SITE_DEMO, true, ["period_id"]), "id", true, ["period_id"]);
    expect(row?.period_id).toBe(period?.id);
  });
  it("thật: khóa ngoại không đổi", () => {
    expect(rowToServer({ id: "v1", period_id: "ky-1" }, "id", "bsf1", false, ["period_id"]).period_id).toBe("ky-1");
  });
});

describe("khóa ngoại mềm (customer_id, mảng batter_ids)", () => {
  it("demo: customer_id mang tiền tố như customers.id — hết mồ côi trên máy chủ", () => {
    const customer = rowToServer({ id: "dm-kh-0" }, "id", SITE_DEMO, true);
    const output = rowToServer({ id: "o1", customer_id: "dm-kh-0" }, "id", SITE_DEMO, true, ["customer_id"]);
    expect(output.customer_id).toBe(customer.id);
  });
  it("demo: cột mảng id đổi từng phần tử, đọc về bỏ tiền tố từng phần tử", () => {
    const up = rowToServer({ id: "p1", batter_ids: ["bot-24v", "", "demo:bot-18v"] }, "id", SITE_DEMO, true, ["batter_ids"]);
    expect(up.batter_ids).toEqual(["demo:bot-24v", "", "demo:bot-18v"]);
    expect(rowFromServer(up, "id", true, ["batter_ids"])?.batter_ids).toEqual(["bot-24v", "", "bot-18v"]);
  });
  it("demo: dòng cũ trên máy chủ còn id thiếu tiền tố vẫn đọc về nguyên vẹn (không vỡ app)", () => {
    expect(rowFromServer({ id: "demo:o1", customer_id: "dm-kh-0" }, "id", true, ["customer_id"])?.customer_id).toBe("dm-kh-0");
  });
  it("đọc về: cột không có trong dòng thì không thêm khóa", () => {
    expect(rowFromServer({ id: "demo:o1" }, "id", true, ["customer_id"])).toEqual({ id: "o1" });
  });
});
