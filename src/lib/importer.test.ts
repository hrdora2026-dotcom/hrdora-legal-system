import { describe, expect, it } from "vitest";
import { parseAmount, parseDate, validateRows } from "./importer";

const map = { borrower_name: "B", bank: "Bk", branch: "Br", legal_opinion: "LO", ec: "EC", total: "T", received: "R", outstanding: "O" } as const;
const ex = { opinionNos: new Set<string>(["op-1"]), keys: new Set<string>() };

describe("Excel import validation", () => {
  it("parses Indian dates and rupee amounts", () => {
    expect(parseDate("05-04-2025")).toBe("2025-04-05");
    expect(parseDate("31/02/2025")).toBeUndefined();
    expect(parseAmount("₹ 2,800")).toBe(2800);
  });
  it("accepts a reconciled row", () => {
    const [r] = validateRows([{ B: "Ravi", Bk: "SBI", Br: "Main", LO: 2000, EC: 800, T: 2800, R: 1000, O: 1800 }], map, ex);
    expect(r.status).toBe("accepted");
    expect(r.bill_total).toBe(2800);
  });
  it("rejects charges that do not match the total", () => {
    const [r] = validateRows([{ B: "Ravi", Bk: "SBI", Br: "Main", LO: 2000, EC: 500, T: 2800 }], map, ex);
    expect(r.status).toBe("rejected");
  });
  it("rejects received + outstanding that do not reconcile", () => {
    const [r] = validateRows([{ B: "Ravi", Bk: "SBI", Br: "Main", T: 3000, R: 1000, O: 1500 }], map, ex);
    expect(r.status).toBe("rejected");
  });
  it("flags repeated rows in the same file as possible duplicates", () => {
    const row = { B: "Ravi", Bk: "SBI", Br: "Main", T: 3000 };
    const rows = validateRows([row, row], map, ex);
    expect(rows[1].status).toBe("duplicate");
  });
});
