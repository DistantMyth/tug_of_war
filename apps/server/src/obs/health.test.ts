import { describe, expect, it } from "vitest";
import { buildHealthReport } from "./health.js";

describe("buildHealthReport", () => {
  it("is ok when dependencies are not yet configured", () => {
    const report = buildHealthReport({
      redis: "not_configured",
      mongo: "not_configured",
      phase: null,
      connections: 0,
      uptime: 12.4,
    });
    expect(report).toEqual({
      ok: true,
      redis: "not_configured",
      mongo: "not_configured",
      phase: null,
      connections: 0,
      uptime: 12,
    });
  });

  it("is not ok when Redis is down", () => {
    const report = buildHealthReport({
      redis: "down",
      mongo: "ok",
      phase: "OPEN",
      connections: 12,
      uptime: 40,
    });
    expect(report.ok).toBe(false);
  });
});
