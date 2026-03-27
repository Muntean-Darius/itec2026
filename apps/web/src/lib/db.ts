// apps/web/src/lib/db.ts
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../server/src/generated/prisma/client';

const prismaClientSingleton = () => {
  // 1. Create the database adapter using your environment variable
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });

  // 2. Pass the adapter to the PrismaClient constructor
  return new PrismaClient({ adapter });
};

declare global {
  // eslint-disable-next-line no-var
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;