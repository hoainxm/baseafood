import { describe, expect, it } from "vitest";
import { dongLenMay, dongTuMay, khoaLenMay, khoaLocal, khoaTuMay, SITE_DEMO } from "./cheDo";

describe("khoaLocal — tách bản sao + hàng chờ dưới máy", () => {
  it("demo: bsf.* → bsf-demo.*, khóa khác giữ nguyên", () => {
    expect(khoaLocal("bsf.material-imports.v2", true)).toBe("bsf-demo.material-imports.v2");
    expect(khoaLocal("bsf.material-imports.v2.cho", true)).toBe("bsf-demo.material-imports.v2.cho");
    expect(khoaLocal("bsf1:nav-nhom", true)).toBe("bsf1:nav-nhom");
  });
  it("thật: không đổi gì", () => {
    expect(khoaLocal("bsf.material-imports.v2", false)).toBe("bsf.material-imports.v2");
  });
});

describe("khóa chính ở ranh giới máy chủ (rào R1)", () => {
  it("demo: thêm tiền tố một lần, đọc về bỏ tiền tố", () => {
    expect(khoaLenMay("2026-10-12|Đông", true)).toBe("demo:2026-10-12|Đông");
    expect(khoaLenMay("demo:x", true)).toBe("demo:x");
    expect(khoaTuMay("demo:2026-10-12|Đông", true)).toBe("2026-10-12|Đông");
  });
  it("demo: dòng không có tiền tố (dòng thật lọt site) bị bỏ qua", () => {
    expect(khoaTuMay("1551001", true)).toBeNull();
    expect(dongTuMay({ code: "1551001" }, "code", true)).toBeNull();
  });
  it("thật: khóa đi về nguyên vẹn", () => {
    expect(khoaLenMay("abc", false)).toBe("abc");
    expect(khoaTuMay("demo:abc", false)).toBe("demo:abc");
  });
  it("dongLenMay: đổi đúng cột khóa + gắn site, cột khác giữ nguyên", () => {
    expect(dongLenMay({ code: "1551001", name: "Mực" }, "code", SITE_DEMO, true)).toEqual({
      code: "demo:1551001",
      name: "Mực",
      site_id: SITE_DEMO,
    });
    expect(dongLenMay({ id: "a", shipment_id: "b" }, "id", "bsf1", false)).toEqual({ id: "a", shipment_id: "b", site_id: "bsf1" });
  });
  it("khứ hồi demo: lên rồi về ra đúng dòng app", () => {
    const row = { id: "x-1", workshop: "Đông" };
    expect(dongTuMay(dongLenMay(row, "id", SITE_DEMO, true), "id", true)).toEqual({ ...row, site_id: SITE_DEMO });
  });
});

describe("cột khóa ngoại (cotThamChieu) — period_id → balancing_periods.id", () => {
  it("demo: khóa ngoại mang tiền tố như khóa chính kỳ; rỗng / null giữ nguyên", () => {
    expect(dongLenMay({ id: "v1", period_id: "ky-1" }, "id", SITE_DEMO, true, ["period_id"])).toEqual({
      id: "demo:v1",
      period_id: "demo:ky-1",
      site_id: SITE_DEMO,
    });
    expect(dongLenMay({ id: "p1", period_id: null }, "id", SITE_DEMO, true, ["period_id"]).period_id).toBeNull();
    expect(dongLenMay({ id: "p1", period_id: "" }, "id", SITE_DEMO, true, ["period_id"]).period_id).toBe("");
  });
  it("demo: đọc về bỏ tiền tố cả khóa ngoại — khớp lại đúng id kỳ của app", () => {
    const ky = dongTuMay(dongLenMay({ id: "ky-1" }, "id", SITE_DEMO, true), "id", true);
    const dong = dongTuMay(dongLenMay({ id: "v1", period_id: "ky-1" }, "id", SITE_DEMO, true, ["period_id"]), "id", true, ["period_id"]);
    expect(dong?.period_id).toBe(ky?.id);
  });
  it("thật: khóa ngoại không đổi", () => {
    expect(dongLenMay({ id: "v1", period_id: "ky-1" }, "id", "bsf1", false, ["period_id"]).period_id).toBe("ky-1");
  });
});
