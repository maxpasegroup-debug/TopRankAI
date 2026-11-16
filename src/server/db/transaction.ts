import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import { ConflictApiError } from "@/server/api/errors";

export type Tx = Prisma.TransactionClient;

export async function atomic<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(work, { isolationLevel: "Serializable" });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || !["P2002", "P2034"].includes(error.code)) throw error;
    }
  }
  throw new ConflictApiError("Concurrent update. Reload and retry.");
}
