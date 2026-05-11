import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('Admin@1234', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@novia.app' },
    update: {},
    create: { email: 'admin@novia.app', password, name: 'Novia Admin', isSuperAdmin: true },
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'novia-default' },
    update: {},
    create: { name: 'Novia Default', slug: 'novia-default' },
  });

  await prisma.userTenant.upsert({
    where: { userId_tenantId: { userId: admin.id, tenantId: tenant.id } },
    update: {},
    create: { userId: admin.id, tenantId: tenant.id, role: Role.ADMIN },
  });

  console.log('Seed complete:', { admin: admin.email, tenant: tenant.slug });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
