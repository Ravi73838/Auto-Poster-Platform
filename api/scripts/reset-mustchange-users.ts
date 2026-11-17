process.env.NODE_ENV = 'test';
const { prisma, disconnectPrisma } = await import('../src/shared/db/index.js');
const { hashPassword } = await import('../src/shared/crypto/index.js');

async function main() {
  const h = await hashPassword('AdminPassword123!');
  await prisma.user.updateMany({
    where: {
      email: {
        in: ['mustchange.admin@autoposter.in', 'mustchange.tablet@autoposter.in'],
      },
    },
    data: {
      passwordHash: h,
      mustChangePassword: true,
    },
  });
  console.log('[reset-mustchange-users] Users reset successfully.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectPrisma();
  });
