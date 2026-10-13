import { describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { RazorpayTestProvider, configuredCommerceProvider, validSignature } from "@/server/commerce/provider";
import { packageSchema, studentCommerceSchema, adminCommerceSchema } from "@/server/commerce/validation";
import { render, retryDelay } from "@/server/commerce/notifications";
vi.mock("@/server/db", () => ({ prisma: {} }));
const config = { keyId: "rzp_test_fixture", keySecret: "fixture-key-only", webhookSecret: "fixture-webhook-only", accountId: "acc_fixture" };
const payment = { id: "pay_fixture", order_id: "order_fixture", amount: 12500, amount_refunded: 0, currency: "INR", status: "captured", captured: true, created_at: 1791590400 };
function fixture(overrides = {}) { return Buffer.from(JSON.stringify({ account_id: config.accountId, event: "payment.captured", payload: { payment: { entity: payment } }, ...overrides })); }
function headers(raw: Uint8Array) { return new Headers({ "x-razorpay-signature": createHmac("sha256", config.webhookSecret).update(raw).digest("hex"), "x-razorpay-event-id": "fixture-event" }); }
const packageInput = { code: "TEST_PACKAGE", revision: 1, title: "Fixture only", description: "Not an approved commercial product", amountMinor: 12500, currency: "INR", interval: "ONCE", durationDays: 30, features: ["MOCK_ACCESS"], availableFrom: "2026-10-10T00:00:00Z", availableUntil: "2026-12-10T00:00:00Z" };
describe("Razorpay transport: simulated fixtures, no network", () => {
 it("runtime remains disabled even when credentials/activation flags exist", () => { vi.stubEnv("PAYMENTS_ACTIVATED", "true"); expect(configuredCommerceProvider()).toBeNull(); vi.unstubAllEnvs(); });
 it("rejects live-mode credentials", () => expect(() => new RazorpayTestProvider({ ...config, keyId: "rzp_live_fixture" })).toThrow());
 it("bounds provider timeouts with cancellation (simulated transport)", async () => {
   vi.useFakeTimers();
   try {
     const transport = vi.fn().mockImplementation((_url, options) => new Promise((_, reject) => options.signal.addEventListener("abort", () => reject(new Error("aborted")))));
     const failure = expect(new RazorpayTestProvider(config, transport).payment("pay_fixture")).rejects.toThrow("Payment processing is unavailable");
     await vi.advanceTimersByTimeAsync(5001); await failure;
   } finally { vi.useRealTimers(); }
 });
 it("bounds provider response bytes", async () => { const p = new RazorpayTestProvider(config, vi.fn().mockResolvedValue(new Response("x".repeat(1048577)))); await expect(p.payment("pay_fixture")).rejects.toThrow("Payment processing is unavailable"); });
 it("returns generic malformed signed-event errors without merchant details", () => { const raw = Buffer.from("{"); expect(() => new RazorpayTestProvider(config).verify(raw, headers(raw))).toThrow("Invalid payment event"); });
 it("validates simulated raw-body HMAC and event association", () => { const raw = fixture(); expect(new RazorpayTestProvider(config).verify(raw, headers(raw))).toMatchObject({ id: "fixture-event", orderId: "order_fixture", paymentId: "pay_fixture", kind: "payment.captured" }); });
 it("rejects parsed/reserialized or altered raw bytes", () => { const raw = fixture(); expect(() => new RazorpayTestProvider(config).verify(Buffer.concat([raw, Buffer.from(" ")]), headers(raw))).toThrow(); });
 it.each([null, "", "not-hex", "0".repeat(64)])("rejects invalid signature %s", (sig) => expect(validSignature(fixture(), sig, config.webhookSecret)).toBe(false));
 it("rejects absent event IDs", () => { const raw = fixture(), h = headers(raw); h.delete("x-razorpay-event-id"); expect(() => new RazorpayTestProvider(config).verify(raw, h)).toThrow(); });
 it("rejects another merchant", () => { const raw = fixture({ account_id: "acc_other" }); expect(() => new RazorpayTestProvider(config).verify(raw, headers(raw))).toThrow(); });
 it("rejects malformed capture state", () => { const raw = fixture({ payload: { payment: { entity: { ...payment, captured: false } } } }); expect(() => new RazorpayTestProvider(config).verify(raw, headers(raw))).toThrow(); });
 it("does not accept unsupported authorization as fulfilment event", () => { const raw = fixture({ event: "payment.authorized" }); expect(() => new RazorpayTestProvider(config).verify(raw, headers(raw))).toThrow(); });
 it("verifies payment status using server API fixture", async () => { const transport = vi.fn().mockResolvedValue(new Response(JSON.stringify(payment))); const p = new RazorpayTestProvider(config, transport); expect(await p.payment("pay_fixture")).toMatchObject({ status: "captured", amountMinor: 12500 }); expect(transport.mock.calls[0][0]).toBe("https://api.razorpay.com/v1/payments/pay_fixture"); });
 it("rejects provider payment identity mismatch", async () => { const p = new RazorpayTestProvider(config, vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...payment, id: "pay_other" })))); await expect(p.payment("pay_fixture")).rejects.toThrow(); });
 it("does not expose provider errors or credentials", async () => { const p = new RazorpayTestProvider(config, vi.fn().mockResolvedValue(new Response("sensitive-provider-error", { status: 500 }))); await expect(p.payment("pay_fixture")).rejects.toThrow("Payment processing is unavailable"); });
 it("sends immutable order amount, currency and local receipt", async () => { const transport = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "order_fixture", amount: 12500, currency: "INR", receipt: "local-order" }))); await new RazorpayTestProvider(config, transport).createOrder({ orderId: "local-order", amountMinor: 12500, currency: "INR" }); expect(JSON.parse(transport.mock.calls[0][1].body)).toEqual({ receipt: "local-order", amount: 12500, currency: "INR", partial_payment: false }); });
 it("rejects an order response with different amount", async () => { const transport = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "order_fixture", amount: 1, currency: "INR", receipt: "local" }))); await expect(new RazorpayTestProvider(config, transport).createOrder({ orderId: "local", amountMinor: 12500, currency: "INR" })).rejects.toThrow(); });
 it("uses documented refund idempotency header, not a completion assumption", async () => { const transport = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "rfnd_fixture", payment_id: "pay_fixture", amount: 100, status: "pending" }))); expect(await new RazorpayTestProvider(config, transport).refund({ paymentId: "pay_fixture", amountMinor: 100, requestKey: "refund-key" })).toMatchObject({ status: "pending" }); expect(transport.mock.calls[0][1].headers["X-Refund-Idempotency"]).toBe("refund-key"); });
 it("fetches and checks refund ownership", async () => { const transport = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "rfnd_fixture", payment_id: "pay_fixture", amount: 100, status: "processed" }))); expect(await new RazorpayTestProvider(config, transport).refundStatus("pay_fixture", "rfnd_fixture")).toMatchObject({ status: "processed" }); });
 it("rejects refund events that disagree with their payment", () => { const raw = fixture({ event: "refund.processed", payload: { payment: { entity: payment }, refund: { entity: { id: "rfnd_fixture", payment_id: "pay_other", amount: 100, status: "processed" } } } }); expect(() => new RazorpayTestProvider(config).verify(raw, headers(raw))).toThrow(); });
});
describe("commercial inputs and templates", () => {
 it("accepts a validated fixture catalogue, never seeds it", () => expect(packageSchema.parse(packageInput).durationDays).toBe(30));
 it.each([-1, 1.1, 100000001])("rejects invalid price %s", (amountMinor) => expect(packageSchema.safeParse({ ...packageInput, amountMinor }).success).toBe(false));
 it("accepts zero only for a fixed free-package offering", () => { expect(packageSchema.safeParse({ ...packageInput, amountMinor: 0, interval: "ONCE" }).success).toBe(true); expect(packageSchema.safeParse({ ...packageInput, amountMinor: 0, interval: "MONTH" }).success).toBe(false); });
 it.each(["USD", "inr", "", "INR "])("rejects unsupported currency %s", (currency) => expect(packageSchema.safeParse({ ...packageInput, currency }).success).toBe(false));
 it("rejects duplicate feature privileges and invalid availability", () => { expect(packageSchema.safeParse({ ...packageInput, features: ["MOCK_ACCESS", "MOCK_ACCESS"] }).success).toBe(false); expect(packageSchema.safeParse({ ...packageInput, availableUntil: packageInput.availableFrom }).success).toBe(false); });
 it.each(["AI_CREDITS", "AI_TOKENS", "WALLET_BALANCE", "EARNINGS", "CREDIT_POOL"])("blocks accounting-backed feature %s", (code) => expect(adminCommerceSchema.safeParse({ action: "feature", code, title: "Fixture" }).success).toBe(false));
 it.each(["amountMinor", "currency", "userId", "durationDays", "features", "status", "role"])("rejects untrusted purchase %s", (field) => expect(studentCommerceSchema.safeParse({ action: "purchase", packageId: "p", requestKey: "8664dc14-a97f-4e63-9747-0a76e597a077", [field]: "injected" }).success).toBe(false));
 it("rejects client administrative grants", () => expect(studentCommerceSchema.safeParse({ action: "grant", featureCode: "MOCK_ACCESS" }).success).toBe(false));
 it("renders only bounded plain-text substitution", () => { expect(render("ORDER_CREATED", { reference: "order-1" })).toBe("Order order-1 is pending payment."); expect(() => render("ORDER_CREATED", { reference: "<script>" })).toThrow(); expect(() => render("ORDER_CREATED", {})).toThrow(); });
 it("bounds exponential retry delays", () => { expect(retryDelay(1)).toBe(2000); expect(retryDelay(100)).toBe(3600000); });
});
