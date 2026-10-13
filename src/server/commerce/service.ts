import { z } from "zod";
import { createHash } from "node:crypto";
import { prisma } from "@/server/db";
import type { AuthUser } from "@/server/auth/session";
import { assertStudent } from "@/server/student/service";
import { assertPlatformAdmin } from "@/server/operations/service";
import { ConflictApiError, ValidationApiError } from "@/server/api/errors";
import { atomic, audit, type Tx } from "./transaction";
import { packageSchema, studentCommerceSchema, adminCommerceSchema, money } from "./validation";
import { configuredCommerceProvider, paymentUnavailable, type CommerceProvider, type ProviderPayment, type VerifiedEvent } from "./provider";
import { notify, dispatchNotifications, expiryReminders } from "./notifications";
import { inAppNotice } from "@/server/notifications/service";
import { entitlementState } from "@/shared/entitlement-state";
export function snapshotPackage(p: { code: string; revision: number; title: string; description: string; amountMinor: number; currency: string; interval: string; durationDays: number; features: string[] }) {
 return { code: p.code, revision: p.revision, title: p.title, description: p.description, amountMinor: p.amountMinor, currency: p.currency,
   interval: p.interval, durationDays: p.durationDays, features: p.features };
}
const snapshotSchema = z.object(packageSchema.shape).omit({ availableFrom: true, availableUntil: true }).strict();
export async function commerceHome(user: AuthUser) {
 assertStudent(user); const now = new Date();
 const [packages, orders, entitlements, notifications, preference] = await Promise.all([
   prisma.commercePackage.findMany({ where: { status: "PUBLISHED", availableFrom: { lte: now }, availableUntil: { gt: now } }, orderBy: [{ code: "asc" }, { revision: "desc" }], take: 100 }),
   prisma.commerceOrder.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100, include: { receipt: true, refunds: true } }),
   prisma.entitlement.findMany({ where: { userId: user.id }, orderBy: { endsAt: "desc" }, take: 100, include: { order: { select: { userId: true, status: true, capturedAt: true } } } }),
   prisma.commerceNotification.findMany({ where: { userId: user.id, channel: "IN_APP", status: "AVAILABLE" }, orderBy: { createdAt: "desc" }, take: 100 }),
   prisma.notificationPreference.findUnique({ where: { userId: user.id } }),
 ]);
 return { paymentsAvailable: false, packages: packages.map((p) => ({ id: p.id, ...snapshotPackage(p) })),
   orders: orders.map((o) => ({ id: o.id, status: o.status, amountMinor: o.amountMinor, currency: o.currency, snapshot: o.snapshot,
     createdAt: o.createdAt.toISOString(), capturedAt: o.capturedAt?.toISOString() ?? null,
     receipt: o.receipt ? { id: o.receipt.id, amountMinor: o.receipt.amountMinor, currency: o.receipt.currency, issuedAt: o.receipt.issuedAt.toISOString(), type: "PAYMENT_RECEIPT" } : null,
     refunds: o.refunds.map((r) => ({ id: r.id, amountMinor: r.amountMinor, status: r.status, createdAt: r.createdAt.toISOString() })) })),
   entitlements: entitlements.map((e) => ({ id: e.id, featureCode: e.featureCode, source: e.source, status: entitlementState(e, now),
     startsAt: e.startsAt.toISOString(), endsAt: e.endsAt.toISOString() })),
   notifications: notifications.map((n) => ({ id: n.id, message: n.message, read: Boolean(n.readAt), at: n.createdAt.toISOString() })),
   preferences: { email: preference?.email ?? false, whatsapp: preference?.whatsapp ?? false } };
}
async function ownerOrder(tx: Tx, userId: string, id: string) {
 const order = await tx.commerceOrder.findFirst({ where: { id, userId } });
 if (!order) throw new ValidationApiError("Order unavailable"); return order;
}
export async function createPurchase(user: AuthUser, packageId: string, requestKey: string, provider: CommerceProvider | null = configuredCommerceProvider()) {
 assertStudent(user); if (!provider) throw paymentUnavailable();
 const order = await atomic(async (tx) => {
   const old = await tx.commerceOrder.findUnique({ where: { userId_requestKey: { userId: user.id, requestKey } } });
   if (old) { if (old.packageId !== packageId) throw new ConflictApiError(); return old; }
   const now = new Date(); const p = await tx.commercePackage.findFirst({ where: { id: packageId, status: "PUBLISHED", availableFrom: { lte: now }, availableUntil: { gt: now } } });
   if (!p) throw new ValidationApiError("Package unavailable");
   const checked = packageSchema.parse({ ...snapshotPackage(p), availableFrom: p.availableFrom.toISOString(), availableUntil: p.availableUntil.toISOString() });
   if (checked.amountMinor === 0) throw new ValidationApiError("Free pilot access requires an administrator invitation");
   const created = await tx.commerceOrder.create({ data: { userId: user.id, packageId, requestKey, amountMinor: checked.amountMinor, currency: checked.currency, snapshot: snapshotPackage(checked) } });
   await notify(tx, user.id, `order:${created.id}`, "ORDER_CREATED", { reference: created.id }); return created;
 });
 if (order.providerOrderId) return { id: order.id, status: order.status };
 const claimed = await prisma.commerceOrder.updateMany({ where: { id: order.id, status: "PENDING", checkoutState: "NOT_STARTED" }, data: { checkoutState: "CREATING" } });
 if (!claimed.count) throw new ConflictApiError("Order creation needs operational review");
 try {
   const external = await provider.createOrder({ orderId: order.id, amountMinor: order.amountMinor, currency: order.currency });
   if (external.amountMinor !== order.amountMinor || external.currency !== order.currency) throw paymentUnavailable();
   const changed = await prisma.commerceOrder.updateMany({ where: { id: order.id, checkoutState: "CREATING", status: "PENDING" }, data: { providerOrderId: external.id, checkoutState: "READY" } });
   if (!changed.count) throw new ConflictApiError();
 } catch { await prisma.commerceOrder.updateMany({ where: { id: order.id, checkoutState: "CREATING" }, data: { checkoutState: "REVIEW" } }); throw paymentUnavailable(); }
 return { id: order.id, status: "PENDING" };
}
export async function applyVerifiedPayment(tx: Tx, payment: ProviderPayment) {
 if (!money.safeParse(payment.amountMinor).success) throw new ConflictApiError("Payment accounting mismatch");
 const order = await tx.commerceOrder.findUnique({ where: { providerOrderId: payment.orderId } });
 if (!order || order.amountMinor !== payment.amountMinor || order.currency !== payment.currency) throw new ConflictApiError("Payment association mismatch");
 const previous = await tx.commercePayment.findUnique({ where: { id: payment.id } });
 if (previous && (previous.orderId !== order.id || previous.amountMinor !== payment.amountMinor || previous.currency !== payment.currency)) throw new ConflictApiError("Payment association mismatch");
 if (!Number.isInteger(payment.refundedMinor) || payment.refundedMinor < 0 || payment.refundedMinor > payment.amountMinor) throw new ConflictApiError("Payment accounting mismatch");
 if (payment.refundedMinor > 0 || payment.status === "refunded") {
   if (order.capturedAt && previous?.status === "captured" && ["REFUNDED", "PARTIALLY_REFUNDED"].includes(order.status)) return { id: order.id, status: order.status };
   throw new ConflictApiError("Provider refund requires reconciliation");
 }
 if (["created", "authorized"].includes(payment.status)) return { id: order.id, status: order.status };
 if (payment.status === "failed") {
   if (previous?.status !== "captured") await tx.commercePayment.upsert({ where: { id: payment.id }, create: { id: payment.id, orderId: order.id, amountMinor: payment.amountMinor, currency: payment.currency, status: "failed" }, update: { status: "failed" } });
   const changed = await tx.commerceOrder.updateMany({ where: { id: order.id, status: "PENDING", capturedAt: null }, data: { status: "FAILED" } });
   if (changed.count) await notify(tx, order.userId, `failed:${order.id}`, "PAYMENT_FAILED", { reference: order.id });
   return { id: order.id, status: changed.count ? "FAILED" : order.status };
 }
 if (!payment.capturedAt) throw new ConflictApiError("Capture verification missing");
 if (["CANCELLED", "REFUNDED", "PARTIALLY_REFUNDED"].includes(order.status)) {
   if (order.capturedAt && previous?.status === "captured") return { id: order.id, status: order.status };
   throw new ConflictApiError("Capture requires operational review");
 }
 if (order.capturedAt) {
   if (previous?.status !== "captured") throw new ConflictApiError("Additional capture requires review");
   return { id: order.id, status: order.status };
 }
 const snap = snapshotSchema.parse(order.snapshot);
 if (snap.amountMinor !== order.amountMinor || snap.currency !== order.currency) throw new ConflictApiError("Price snapshot mismatch");
 const startsAt = new Date(); const endsAt = new Date(startsAt.getTime() + snap.durationDays * 86400000);
 const changed = await tx.commerceOrder.updateMany({ where: { id: order.id, capturedAt: null, status: { in: ["PENDING", "FAILED"] } }, data: { status: "CAPTURED", capturedAt: startsAt } });
 if (!changed.count) throw new ConflictApiError();
 await tx.commercePayment.upsert({ where: { id: payment.id }, create: { id: payment.id, orderId: order.id, amountMinor: payment.amountMinor, currency: payment.currency, status: "captured", capturedAt: startsAt }, update: { status: "captured", capturedAt: startsAt } });
 for (const featureCode of snap.features) await tx.entitlement.upsert({ where: { provenance: `purchase:${order.id}:${featureCode}` },
   create: { userId: order.userId, featureCode, source: "PURCHASE", provenance: `purchase:${order.id}:${featureCode}`, orderId: order.id, startsAt, endsAt }, update: {} });
 await tx.commerceReceipt.upsert({ where: { orderId: order.id }, create: { id: `receipt_${order.id}`, orderId: order.id, amountMinor: order.amountMinor, currency: order.currency, issuedAt: startsAt }, update: {} });
 await notify(tx, order.userId, `capture:${order.id}`, "PAYMENT_CAPTURED", { reference: order.id, date: endsAt.toISOString().slice(0, 10) });
 return { id: order.id, status: "CAPTURED" };
}
export async function processEvent(event: VerifiedEvent, provider: CommerceProvider) {
 const record = await atomic(async (tx) => {
   const old = await tx.commerceEvent.findUnique({ where: { id: event.id } });
   if (old) { if (old.digest !== event.digest) throw new ConflictApiError("Event identifier collision"); return old; }
   return tx.commerceEvent.create({ data: { id: event.id, digest: event.digest, kind: event.kind, providerOrderId: event.orderId, paymentId: event.paymentId, refundId: event.refundId } });
 });
 if (record.status === "PROCESSED") return { duplicate: true };
 try {
   if (event.refundId) {
     const refund = await prisma.commerceRefund.findUnique({ where: { providerRefundId: event.refundId } });
     if (!refund || refund.paymentId !== event.paymentId) throw new ConflictApiError("Refund needs review");
     await refreshRefund(refund.id, provider);
   } else {
     const payment = await provider.payment(event.paymentId);
     if (payment.id !== event.paymentId || payment.orderId !== event.orderId) throw new ConflictApiError("Payment association mismatch");
     if (event.kind === "payment.captured" && !["captured", "refunded"].includes(payment.status)) throw new ConflictApiError("Capture not yet verified");
     await atomic(async (tx) => { await applyVerifiedPayment(tx, payment); });
   }
   await prisma.commerceEvent.update({ where: { id: event.id }, data: { status: "PROCESSED", errorCode: null, processedAt: new Date() } });
   return { processed: true };
 } catch {
   await prisma.commerceEvent.updateMany({ where: { id: event.id, status: { not: "PROCESSED" } }, data: { status: "RETRY", errorCode: "VERIFICATION_OR_ASSOCIATION_FAILED" } });
   throw new ConflictApiError("Payment event requires retry or review");
 }
}
export async function refreshRefund(id: string, provider: CommerceProvider) {
 const saved = await prisma.commerceRefund.findUnique({ where: { id } });
 if (!saved?.providerRefundId || !saved.paymentId) throw new ConflictApiError("Refund is not associated");
 const verified = await provider.refundStatus(saved.paymentId, saved.providerRefundId);
 if (verified.id !== saved.providerRefundId || verified.paymentId !== saved.paymentId || verified.amountMinor !== saved.amountMinor) throw new ConflictApiError("Refund association mismatch");
 return atomic(async (tx) => {
   const refund = await tx.commerceRefund.findUniqueOrThrow({ where: { id } });
   if (refund.status === "PROCESSED") return { id, status: "PROCESSED" };
   if (!["SUBMITTING", "PENDING"].includes(refund.status)) throw new ConflictApiError();
   const order = await tx.commerceOrder.findUniqueOrThrow({ where: { id: refund.orderId } });
   const status = verified.status.toUpperCase();
   await tx.commerceRefund.update({ where: { id }, data: { status } });
   if (status === "PROCESSED") {
     const total = await tx.commerceRefund.aggregate({ where: { orderId: order.id, status: "PROCESSED" }, _sum: { amountMinor: true } });
     const refunded = total._sum.amountMinor ?? 0; if (refunded > order.amountMinor) throw new ConflictApiError("Refund accounting mismatch");
     await tx.commerceOrder.update({ where: { id: order.id }, data: { status: refunded === order.amountMinor ? "REFUNDED" : "PARTIALLY_REFUNDED" } });
     // Conservative explicit policy: any confirmed refund revokes only this order's grants.
     await tx.entitlement.updateMany({ where: { orderId: order.id, source: "PURCHASE" }, data: { status: "REVOKED", reason: "Confirmed refund" } });
   }
   await notify(tx, order.userId, `refund:${id}:${status}`, "REFUND_UPDATED", { reference: id, status });
   return { id, status };
 });
}
export async function studentCommerceMutation(user: AuthUser, raw: z.output<typeof studentCommerceSchema>, provider: CommerceProvider | null = configuredCommerceProvider()) {
 assertStudent(user); const input = studentCommerceSchema.parse(raw);
 if (input.action === "purchase") return createPurchase(user, input.packageId, input.requestKey, provider);
 if (input.action === "verify") {
   if (!provider) throw paymentUnavailable();
   const order = await ownerOrder(prisma, user.id, input.orderId);
   const payment = await provider.payment(input.paymentId);
   if (payment.id !== input.paymentId || payment.orderId !== order.providerOrderId) throw new ValidationApiError("Payment unavailable");
   return atomic((tx) => applyVerifiedPayment(tx, payment));
 }
 return atomic(async (tx) => {
   if (input.action === "read") { await tx.commerceNotification.updateMany({ where: { id: input.id, userId: user.id, channel: "IN_APP", status: "AVAILABLE", readAt: null }, data: { readAt: new Date() } }); return { read: true }; }
   if (input.action === "preferences") return tx.notificationPreference.upsert({ where: { userId: user.id }, create: { userId: user.id, email: input.email, whatsapp: input.whatsapp }, update: { email: input.email, whatsapp: input.whatsapp } });
   const order = await ownerOrder(tx, user.id, input.orderId);
   if (input.action === "cancel") {
     if (order.status === "CANCELLED") return { id: order.id, status: "CANCELLED" };
     // A provider order cannot be cancelled by a local flag; no false cancellation claim.
     if (order.status !== "PENDING" || order.checkoutState !== "NOT_STARTED" || order.providerOrderId) throw new ConflictApiError("Provider-linked orders need review");
     await tx.commerceOrder.update({ where: { id: order.id }, data: { status: "CANCELLED" } }); return { id: order.id, status: "CANCELLED" };
   }
   const old = await tx.commerceRefund.findUnique({ where: { orderId_requestKey: { orderId: order.id, requestKey: input.requestKey } } });
   if (old) { if (old.amountMinor !== input.amountMinor || old.reason !== input.reason) throw new ConflictApiError(); return { id: old.id, status: old.status }; }
   if (!["CAPTURED", "PARTIALLY_REFUNDED"].includes(order.status)) throw new ConflictApiError("Verified payment required");
   const reserved = await tx.commerceRefund.aggregate({ where: { orderId: order.id, status: { notIn: ["REJECTED", "FAILED"] } }, _sum: { amountMinor: true } });
   if (input.amountMinor + (reserved._sum.amountMinor ?? 0) > order.amountMinor) throw new ValidationApiError("Refund exceeds remaining amount");
   const payment = await tx.commercePayment.findFirst({ where: { orderId: order.id, status: "captured" } });
   if (!payment) throw new ConflictApiError();
   const refund = await tx.commerceRefund.create({ data: { orderId: order.id, requestKey: input.requestKey, amountMinor: input.amountMinor, reason: input.reason, paymentId: payment.id } });
   await notify(tx, user.id, `refund:${refund.id}:REQUESTED`, "REFUND_UPDATED", { reference: refund.id, status: "REQUESTED" });
   return { id: refund.id, status: refund.status };
 });
}
export async function adminCommerceData(user: AuthUser) {
 assertPlatformAdmin(user);
 const [features, packages, gates, orders, events, refunds, notifications, audits] = await Promise.all([
   prisma.commerceFeature.findMany({ take: 100 }), prisma.commercePackage.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
   prisma.commerceGate.findMany({ take: 100 }), prisma.commerceOrder.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
   prisma.commerceEvent.findMany({ orderBy: { createdAt: "desc" }, take: 100, select: { id: true, kind: true, status: true, errorCode: true, createdAt: true } }),
   prisma.commerceRefund.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
   prisma.commerceNotification.findMany({ where: { channel: { not: "IN_APP" } }, take: 100, select: { id: true, channel: true, status: true, attempts: true, errorCode: true } }),
   prisma.auditEvent.findMany({ where: { entity: "COMMERCE" }, orderBy: { createdAt: "desc" }, take: 100 }),
 ]);
 return { paymentsAvailable: false, features, packages, gates, orders: orders.map(({ providerOrderId: _provider, requestKey: _request, ...o }) => o), events, refunds: refunds.map(({ providerRefundId: _provider, paymentId: _payment, ...r }) => r), notifications, audits };
}
export async function adminCommerceMutation(user: AuthUser, raw: z.input<typeof adminCommerceSchema>, provider: CommerceProvider | null = configuredCommerceProvider()) {
 assertPlatformAdmin(user); const input = adminCommerceSchema.parse(raw);
 if (input.action === "dispatch") { const reminders = await expiryReminders(); return { ...await dispatchNotifications(), ...reminders }; }
 if (input.action === "eventRetry") {
   if (!provider) throw paymentUnavailable();
   const e = await prisma.commerceEvent.findUnique({ where: { id: input.id } });
   if (!e) throw new ValidationApiError("Event unavailable");
   await audit(prisma, user.id, e.id, "EVENT_RETRY");
   return processEvent({ id: e.id, digest: e.digest, kind: e.kind, paymentId: e.paymentId, orderId: e.providerOrderId, refundId: e.refundId ?? undefined }, provider);
 }
 if (input.action === "refundRefresh") { if (!provider) throw paymentUnavailable(); await audit(prisma, user.id, input.id, "REFUND_REFRESH"); return refreshRefund(input.id, provider); }
 if (input.action === "refundSubmit") {
   if (!provider) throw paymentUnavailable();
   const saved = await atomic(async (tx) => {
     const r = await tx.commerceRefund.findUnique({ where: { id: input.id } });
     if (!r?.paymentId || !["APPROVED", "SUBMITTING"].includes(r.status)) throw new ConflictApiError("Refund is not approved");
     await tx.commerceRefund.update({ where: { id: r.id }, data: { status: "SUBMITTING" } });
     await audit(tx, user.id, r.id, "REFUND_SUBMIT"); return r;
   });
   const r = await provider.refund({ paymentId: saved.paymentId!, amountMinor: saved.amountMinor, requestKey: saved.id });
   if (r.paymentId !== saved.paymentId || r.amountMinor !== saved.amountMinor) throw new ConflictApiError("Refund association mismatch");
   await prisma.commerceRefund.updateMany({ where: { id: saved.id, status: "SUBMITTING" }, data: { providerRefundId: r.id, status: "PENDING" } });
   return refreshRefund(saved.id, provider);
 }
 return atomic(async (tx) => {
   if (input.action === "pilotGrant") {
     if (!await tx.user.findFirst({ where: { id: input.userId, role: "STUDENT", status: "ACTIVE" }, select: { id: true } })) throw new ValidationApiError("Student unavailable");
     const p = await tx.commercePackage.findUnique({ where: { id: input.packageId } });
     if (!p || p.amountMinor !== 0) throw new ValidationApiError("A free pilot package is required");
     const checked = packageSchema.parse({ ...snapshotPackage(p), availableFrom: p.availableFrom.toISOString(), availableUntil: p.availableUntil.toISOString() });
     const endsAt = new Date(input.startsAt.getTime() + checked.durationDays * 86400000);
     const intent = createHash("sha256").update(input.reason).digest("hex");
     const prefix = `pilot:${input.requestKey}:`, provenance = (feature: string) => `${prefix}${p.id}:${feature}:${intent}`;
     const existing = await tx.entitlement.findMany({ where: { provenance: { startsWith: prefix } }, take: 31 });
     if (existing.length) {
       if (existing.length !== checked.features.length || checked.features.some(feature => !existing.some(e => e.provenance === provenance(feature) && e.featureCode === feature && e.userId === input.userId && e.source === "ADMIN" && !e.orderId && e.startsAt.getTime() === input.startsAt.getTime() && e.endsAt.getTime() === endsAt.getTime()))) throw new ConflictApiError("Pilot invitation identifier was already used");
       return { ids: existing.map(e => e.id), replayed: true };
     }
     const now = new Date();
     if (p.status !== "PUBLISHED" || p.availableFrom > now || p.availableUntil <= now || endsAt <= now) throw new ValidationApiError("Pilot package or access window is unavailable");
     if (await tx.commerceFeature.count({ where: { code: { in: checked.features } } }) !== checked.features.length) throw new ValidationApiError("Define all package features first");
     const ids: string[] = [];
     for (const featureCode of checked.features) {
       const grant = await tx.entitlement.create({ data: { userId: input.userId, featureCode, source: "ADMIN", startsAt: input.startsAt, endsAt, reason: input.reason, provenance: provenance(featureCode) } });
       ids.push(grant.id); await audit(tx, user.id, grant.id, "PILOT_PACKAGE_GRANTED", `Package ${p.id}; ${input.reason}`);
     }
     await inAppNotice(tx, input.userId, `pilot:${input.requestKey}:granted`, "PILOT_ACCESS_GRANTED");
     return { ids, replayed: false };
   }
   if (input.action === "feature") { const result = await tx.commerceFeature.upsert({ where: { code: input.code }, create: { code: input.code, title: input.title }, update: { title: input.title } }); await audit(tx, user.id, input.code, "FEATURE_SAVED"); return result; }
   if (input.action === "package") {
     const count = await tx.commerceFeature.count({ where: { code: { in: input.package.features } } });
     if (count !== input.package.features.length) throw new ValidationApiError("Define all features first");
     const p = await tx.commercePackage.create({ data: input.package }); await audit(tx, user.id, p.id, "PACKAGE_DRAFT_CREATED"); return { id: p.id };
   }
   if (input.action === "publication") {
     const p = await tx.commercePackage.findUnique({ where: { id: input.id } });
     if (!p || (input.status === "PUBLISHED" && p.status !== "DRAFT") || (input.status === "RETIRED" && p.status === "RETIRED")) throw new ConflictApiError();
     if (input.status === "PUBLISHED") {
       packageSchema.parse({ ...snapshotPackage(p), availableFrom: p.availableFrom.toISOString(), availableUntil: p.availableUntil.toISOString() });
       if (p.availableUntil <= new Date()) throw new ValidationApiError("Availability has expired");
       // One current published version per commercial code; previous orders remain immutable.
       await tx.commercePackage.updateMany({ where: { code: p.code, status: "PUBLISHED" }, data: { status: "RETIRED" } });
     }
     await tx.commercePackage.update({ where: { id: p.id }, data: { status: input.status } }); await audit(tx, user.id, p.id, `PACKAGE_${input.status}`, input.reason); return { id: p.id };
   }
   if (input.action === "gate") {
     const resource = input.kind === "MOCK" ? await tx.mockExam.findUnique({ where: { id: input.resourceId } }) : await tx.lesson.findUnique({ where: { id: input.resourceId } });
     if (!resource) throw new ValidationApiError("Resource unavailable");
     if (input.featureCode) await tx.commerceGate.upsert({ where: { kind_resourceId: { kind: input.kind, resourceId: input.resourceId } },
       create: { kind: input.kind, resourceId: input.resourceId, featureCode: input.featureCode }, update: { featureCode: input.featureCode } });
     else await tx.commerceGate.deleteMany({ where: { kind: input.kind, resourceId: input.resourceId } });
     await audit(tx, user.id, input.resourceId, "ACCESS_GATE_CHANGED", input.reason); return { saved: true };
   }
   if (input.action === "grant") {
     const target = await tx.user.findFirst({ where: { id: input.userId, status: "ACTIVE", role: "STUDENT" }, select: { id: true } });
     if (!target) throw new ValidationApiError("Student unavailable");
     const provenance = `grant:${input.requestKey}`;
     const old = await tx.entitlement.findUnique({ where: { provenance } });
     if (old && (old.userId !== input.userId || old.featureCode !== input.featureCode || old.source !== input.source || old.startsAt.getTime() !== input.startsAt.getTime() || old.endsAt.getTime() !== input.endsAt.getTime())) throw new ConflictApiError();
     const e = await tx.entitlement.upsert({ where: { provenance }, create: { userId: input.userId, featureCode: input.featureCode, source: input.source, startsAt: input.startsAt, endsAt: input.endsAt, reason: input.reason, provenance }, update: {} });
     if (!old) { await audit(tx, user.id, e.id, "ACCESS_GRANTED", input.reason); await notify(tx, input.userId, `grant:${e.id}`, "GRANT_CREATED", { reference: e.id, date: e.endsAt.toISOString().slice(0, 10) }); }
     return { id: e.id };
   }
   if (input.action === "revoke") {
     const e = await tx.entitlement.findUniqueOrThrow({ where: { id: input.id } });
     if (e.status === "REVOKED") return { id: e.id };
     await tx.entitlement.update({ where: { id: e.id }, data: { status: "REVOKED", reason: input.reason } });
     await audit(tx, user.id, e.id, "ACCESS_REVOKED", input.reason);
     if (e.provenance.startsWith("pilot:")) await inAppNotice(tx, e.userId, `revoke:${e.id}`, "PILOT_ACCESS_REVOKED");
     else await notify(tx, e.userId, `revoke:${e.id}`, "ACCESS_REVOKED", { reference: e.id }); return { id: e.id };
   }
   const r = await tx.commerceRefund.findUnique({ where: { id: input.id } });
   if (!r || r.status !== "REQUESTED") throw new ConflictApiError("Refund request changed");
   await tx.commerceRefund.update({ where: { id: r.id }, data: { status: input.status, decision: input.reason } });
   await audit(tx, user.id, r.id, `REFUND_${input.status}`, input.reason);
   const order = await tx.commerceOrder.findUniqueOrThrow({ where: { id: r.orderId } });
   await notify(tx, order.userId, `refund:${r.id}:${input.status}`, "REFUND_UPDATED", { reference: r.id, status: input.status }); return { id: r.id, status: input.status };
 });
}
