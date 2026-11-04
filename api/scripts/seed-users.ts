import { prisma } from '../src/shared/db/index.js';
import { hashPassword } from '../src/shared/crypto/index.js';
import { ROLES, ACCOUNT_STATUS } from '@ap/shared-constants';

async function main() {
  console.log('Seeding login users into Supabase...');

  // 1. Admin User: admin@autoposter.com / Admin@123456
  const adminPasswordHash = await hashPassword('Admin@123456');

  const existingAdmin = await prisma.user.findFirst({
    where: {
      OR: [
        { email: 'admin@autoposter.com' },
        { email: 'admin@autoposter.in' },
        { mobile: '9999999999' },
      ],
    },
  });

  if (existingAdmin) {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        email: 'admin@autoposter.com',
        mobile: '9999999999',
        passwordHash: adminPasswordHash,
        status: ACCOUNT_STATUS.APPROVED,
        mustChangePassword: false,
      },
    });
    console.log('Updated Admin to admin@autoposter.com / Admin@123456');
  } else {
    await prisma.user.create({
      data: {
        email: 'admin@autoposter.com',
        mobile: '9999999999',
        role: ROLES.SUPER_ADMIN,
        passwordHash: adminPasswordHash,
        status: ACCOUNT_STATUS.APPROVED,
        mustChangePassword: false,
        preferredLanguage: 'en',
        emailVerifiedAt: new Date(),
        mobileVerifiedAt: new Date(),
      },
    });
    console.log('Created Admin admin@autoposter.com / Admin@123456');
  }

  // Also create admin@autoposter.in with different mobile
  const existingIn = await prisma.user.findFirst({ where: { email: 'admin@autoposter.in' } });
  if (!existingIn) {
    await prisma.user.create({
      data: {
        email: 'admin@autoposter.in',
        mobile: '9999999991',
        role: ROLES.SUPER_ADMIN,
        passwordHash: adminPasswordHash,
        status: ACCOUNT_STATUS.APPROVED,
        mustChangePassword: false,
        preferredLanguage: 'en',
        emailVerifiedAt: new Date(),
        mobileVerifiedAt: new Date(),
      },
    });
    console.log('Created Admin admin@autoposter.in / Admin@123456');
  }

  // 2. Company User: company@autoposter.com / Company@123456
  const companyPasswordHash = await hashPassword('Company@123456');
  const existingCompany = await prisma.user.findFirst({
    where: {
      OR: [
        { email: 'company@autoposter.com' },
        { mobile: '9876543200' },
      ],
    },
  });

  let companyUserId: string;
  if (existingCompany) {
    const updated = await prisma.user.update({
      where: { id: existingCompany.id },
      data: {
        email: 'company@autoposter.com',
        mobile: '9876543200',
        passwordHash: companyPasswordHash,
        status: ACCOUNT_STATUS.APPROVED,
      },
    });
    companyUserId = updated.id;
    console.log('Updated Company to company@autoposter.com / Company@123456');
  } else {
    const created = await prisma.user.create({
      data: {
        email: 'company@autoposter.com',
        mobile: '9876543200',
        role: ROLES.COMPANY,
        passwordHash: companyPasswordHash,
        status: ACCOUNT_STATUS.APPROVED,
        preferredLanguage: 'en',
        emailVerifiedAt: new Date(),
        mobileVerifiedAt: new Date(),
      },
    });
    companyUserId = created.id;
    console.log('Created Company company@autoposter.com / Company@123456');
  }

  await prisma.companyProfile.upsert({
    where: { userId: companyUserId },
    create: {
      userId: companyUserId,
      companyName: 'AutoPoster Demo Company',
      brandName: 'Demo Brand',
      contactPersonName: 'Demo Manager',
      contactPersonPhone: '9876543200',
      gstin: '24AAAAA0000A1Z5',
      isVerified: true,
    },
    update: {
      isVerified: true,
    },
  });

  console.log('All login users successfully seeded in Supabase!');
}

main().finally(() => prisma.$disconnect());
