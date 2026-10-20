import { describe, expect, it } from "vitest";
import { ageBucket, ageDays, billTotal, outstanding, paymentStatus } from "./finance";

describe("billing rules", () => {
  it("bill with ₹2,000 + ₹500 + ₹300 totals ₹2,800", () => {
    expect(billTotal([{ quantity: 1, rate: 2000 }, { quantity: 1, rate: 500 }, { quantity: 1, rate: 300 }])).toBe(2800);
  });
  it("₹1,000 received on ₹2,800 leaves ₹1,800 outstanding, partially paid", () => {
    expect(outstanding(2800, 1000, 0)).toBe(1800);
    expect(paymentStatus(2800, 1000, 0)).toBe("partial");
  });
  it("₹2,000 received + ₹800 write-off is settled with zero outstanding", () => {
    expect(outstanding(2800, 2000, 800)).toBe(0);
    expect(paymentStatus(2800, 2000, 800)).toBe("settled");
  });
  it("full receipt is paid; nothing received is unpaid", () => {
    expect(paymentStatus(3000, 3000, 0)).toBe("paid");
    expect(paymentStatus(3000, 0, 0)).toBe("unpaid");
  });
  it("ageing buckets 0–30, 31–60, 61–90, over 90", () => {
    expect(ageBucket(ageDays("2026-01-01", "2026-01-31"))).toBe("0-30");
    expect(ageBucket(31)).toBe("31-60");
    expect(ageBucket(90)).toBe("61-90");
    expect(ageBucket(91)).toBe("90+");
  });
});
