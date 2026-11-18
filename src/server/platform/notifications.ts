import type { NotificationType } from "@/generated/prisma/enums";
import { prisma } from "@/server/db";
import { cache } from "react";

export const getUnreadNotificationCount = cache((userId: string) =>
  prisma.notification.count({ where: { userId, readAt: null } }),
);

export async function notify(userId: string, type: NotificationType, title: string, body: string, href?: string) {
  return prisma.notification.create({ data: { userId, type, title, body, href: href ?? null } });
}

export async function markNotificationRead(userId: string, id: string) {
  return prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
}

export async function markAllNotificationsRead(userId: string) {
  return prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}
