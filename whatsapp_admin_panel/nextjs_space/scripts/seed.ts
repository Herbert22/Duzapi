import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create default admin user
  const hashedPassword = await bcrypt.hash('johndoe123', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'john@doe.com' },
    update: {},
    create: {
      email: 'john@doe.com',
      name: 'Administrator',
      password: hashedPassword,
      role: 'admin',
    },
  });

  // Create secondary test user
  const hashedPassword2 = await bcrypt.hash('admin123', 10);
  
  const testUser = await prisma.user.upsert({
    where: { email: 'admin@whatsapp.local' },
    update: {},
    create: {
      email: 'admin@whatsapp.local',
      name: 'Admin',
      password: hashedPassword2,
      role: 'admin',
    },
  });

  console.log('Created admin user:', adminUser.email);
  console.log('Created test user:', testUser.email);
  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
