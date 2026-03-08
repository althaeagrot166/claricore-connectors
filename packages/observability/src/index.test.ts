import { describe, expect, it } from "vitest";
import { startSpan } from "./index";

describe("observability", () => {
  it("creates span and ends", () => {
    const span = startSpan("test-span", { orgId: "o1" });
    expect(typeof span.end).toBe("function");
    span.end();
  });
});
