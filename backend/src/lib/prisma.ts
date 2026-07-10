import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Intentionally omit 'query' — the per-statement SQL logging floods the
    // terminal and buries the meeting lifecycle logs. Keep warnings + errors.
    // Set PRISMA_QUERY_LOG=1 to temporarily re-enable query logging for debugging.
    log: process.env.PRISMA_QUERY_LOG === '1' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
