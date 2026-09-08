import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const perm1 = await prisma.permission.upsert({ where: { action: 'patient.create' }, update: {}, create: { action: 'patient.create' } });
  const perm2 = await prisma.permission.upsert({ where: { action: 'patient.read' }, update: {}, create: { action: 'patient.read' } });
  
  await prisma.role.update({
    where: { name: 'WORKER' },
    data: { permissions: { connect: [{ id: perm1.id }, { id: perm2.id }] } }
  });
  console.log('Fixed permissions');
}
main().finally(() => prisma.$disconnect());
