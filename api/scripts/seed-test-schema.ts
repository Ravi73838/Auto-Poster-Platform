process.env.NODE_ENV = 'test';
process.env.AUTH_OTP_ENABLED = 'false';

const {
  ROLES,
  ACCOUNT_STATUS,
  CAMPAIGN_STATUS,
  COMPANY_MEMBER_ROLES,
  DISPUTE_STATUS,
  DISPUTE_REASONS,
} = await import('@ap/shared-constants');
const { prisma, disconnectPrisma } = await import('../src/shared/db/index.js');
const { hashPassword } = await import('../src/shared/crypto/index.js');
const { seedBase } = await import('../src/seeds/base.js');

export async function seedTestSchema() {
  console.log('[seed-test-schema] Starting full seed for test schema...');

  // 1. Run base seed (roles, permissions, ledger, system settings)
  await seedBase();

  const defaultPassword = 'CompanyPassword123!';
  const companyPasswordHash = await hashPassword(defaultPassword);
  const adminPasswordHash = await hashPassword('AdminPassword123!');
  const modPasswordHash = await hashPassword('ModeratorPassword123!');
  const finPasswordHash = await hashPassword('FinancePassword123!');

  // 2. Upsert City & Zones
  let city = await prisma.city.findFirst({ where: { name: 'Ahmedabad' } });
  if (!city) {
    city = await prisma.city.create({
      data: {
        name: 'Ahmedabad',
        state: 'Gujarat',
        country: 'IN',
        isActive: true,
      },
    });
  }

  let zone1 = await prisma.zone.findFirst({ where: { cityId: city.id, name: 'SG Highway' } });
  if (!zone1) {
    zone1 = await prisma.zone.create({
      data: {
        cityId: city.id,
        name: 'SG Highway',
        pinCodes: ['380054', '380058'],
        centerLat: 23.0338,
        centerLng: 72.5073,
        radiusMeters: 5000,
        isActive: true,
      },
    });
  }

  let zone2 = await prisma.zone.findFirst({ where: { cityId: city.id, name: 'Navrangpura' } });
  if (!zone2) {
    zone2 = await prisma.zone.create({
      data: {
        cityId: city.id,
        name: 'Navrangpura',
        pinCodes: ['380009'],
        centerLat: 23.0373,
        centerLng: 72.5524,
        radiusMeters: 4000,
        isActive: true,
      },
    });
  }

  // 3. Upsert Super Admin, Moderator, Finance
  await prisma.user.upsert({
    where: { email: 'admin@autoposter.in' },
    create: {
      email: 'admin@autoposter.in',
      mobile: '+919999999999',
      role: ROLES.SUPER_ADMIN,
      status: ACCOUNT_STATUS.APPROVED,
      passwordHash: adminPasswordHash,
      preferredLanguage: 'en',
      preferredTheme: 'system',
      mustChangePassword: false,
      mobileVerifiedAt: new Date(),
      emailVerifiedAt: new Date(),
    },
    update: {
      passwordHash: adminPasswordHash,
      status: ACCOUNT_STATUS.APPROVED,
      mustChangePassword: false,
    },
  });

  await prisma.user.upsert({
    where: { email: 'moderator@autoposter.in' },
    create: {
      email: 'moderator@autoposter.in',
      mobile: '+919888888888',
      role: ROLES.MODERATOR,
      status: ACCOUNT_STATUS.APPROVED,
      passwordHash: modPasswordHash,
      preferredLanguage: 'en',
      preferredTheme: 'system',
      mustChangePassword: false,
      mobileVerifiedAt: new Date(),
      emailVerifiedAt: new Date(),
    },
    update: {
      passwordHash: modPasswordHash,
      status: ACCOUNT_STATUS.APPROVED,
      mustChangePassword: false,
    },
  });

  await prisma.user.upsert({
    where: { email: 'finance@autoposter.in' },
    create: {
      email: 'finance@autoposter.in',
      mobile: '+919777777777',
      role: ROLES.FINANCE,
      status: ACCOUNT_STATUS.APPROVED,
      passwordHash: finPasswordHash,
      preferredLanguage: 'en',
      preferredTheme: 'system',
      mustChangePassword: false,
      mobileVerifiedAt: new Date(),
      emailVerifiedAt: new Date(),
    },
    update: {
      passwordHash: finPasswordHash,
      status: ACCOUNT_STATUS.APPROVED,
      mustChangePassword: false,
    },
  });

  // 3b. Secondary Admins for Maker-Checker and Concurrency testing
  await prisma.user.upsert({
    where: { email: 'admin2@autoposter.in' },
    create: {
      email: 'admin2@autoposter.in',
      mobile: '+919999999998',
      role: ROLES.SUPER_ADMIN,
      status: ACCOUNT_STATUS.APPROVED,
      passwordHash: adminPasswordHash,
      preferredLanguage: 'en',
      preferredTheme: 'system',
      mustChangePassword: false,
      mobileVerifiedAt: new Date(),
      emailVerifiedAt: new Date(),
    },
    update: {
      passwordHash: adminPasswordHash,
      status: ACCOUNT_STATUS.APPROVED,
      mustChangePassword: false,
    },
  });

  await prisma.user.upsert({
    where: { email: 'moderator2@autoposter.in' },
    create: {
      email: 'moderator2@autoposter.in',
      mobile: '+919888888887',
      role: ROLES.MODERATOR,
      status: ACCOUNT_STATUS.APPROVED,
      passwordHash: modPasswordHash,
      preferredLanguage: 'en',
      preferredTheme: 'system',
      mustChangePassword: false,
      mobileVerifiedAt: new Date(),
      emailVerifiedAt: new Date(),
    },
    update: {
      passwordHash: modPasswordHash,
      status: ACCOUNT_STATUS.APPROVED,
      mustChangePassword: false,
    },
  });

  await prisma.user.upsert({
    where: { email: 'mustchange.admin@autoposter.in' },
    create: {
      email: 'mustchange.admin@autoposter.in',
      mobile: '+919999999997',
      role: ROLES.SUPER_ADMIN,
      status: ACCOUNT_STATUS.APPROVED,
      passwordHash: adminPasswordHash,
      preferredLanguage: 'en',
      preferredTheme: 'system',
      mustChangePassword: true,
      mobileVerifiedAt: new Date(),
      emailVerifiedAt: new Date(),
    },
    update: {
      passwordHash: adminPasswordHash,
      status: ACCOUNT_STATUS.APPROVED,
      mustChangePassword: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'mustchange.tablet@autoposter.in' },
    create: {
      email: 'mustchange.tablet@autoposter.in',
      mobile: '+919999999996',
      role: ROLES.SUPER_ADMIN,
      status: ACCOUNT_STATUS.APPROVED,
      passwordHash: adminPasswordHash,
      preferredLanguage: 'en',
      preferredTheme: 'system',
      mustChangePassword: true,
      mobileVerifiedAt: new Date(),
      emailVerifiedAt: new Date(),
    },
    update: {
      passwordHash: adminPasswordHash,
      status: ACCOUNT_STATUS.APPROVED,
      mustChangePassword: true,
    },
  });

  // 4. Primary Company: demo.company@autoposter.in (OWNER)
  const primaryCompanyUser = await prisma.user.upsert({
    where: { email: 'demo.company@autoposter.in' },
    create: {
      email: 'demo.company@autoposter.in',
      mobile: '+919666666666',
      role: ROLES.COMPANY,
      status: ACCOUNT_STATUS.APPROVED,
      passwordHash: companyPasswordHash,
      preferredLanguage: 'en',
      preferredTheme: 'light',
      mustChangePassword: false,
      mobileVerifiedAt: new Date(),
      emailVerifiedAt: new Date(),
    },
    update: {
      passwordHash: companyPasswordHash,
      status: ACCOUNT_STATUS.APPROVED,
      mustChangePassword: false,
    },
  });

  let companyProfile = await prisma.companyProfile.findUnique({
    where: { userId: primaryCompanyUser.id },
  });

  if (!companyProfile) {
    companyProfile = await prisma.companyProfile.create({
      data: {
        userId: primaryCompanyUser.id,
        cityId: city.id,
        companyName: 'AdVantage Media Pvt Ltd',
        brandName: 'AdVantage',
        legalName: 'AdVantage Media Private Limited',
        gstin: '24AAACA1234A1Z5',
        pan: 'AAACA1234A',
        website: 'https://advantage.example.com',
        contactPersonName: 'Rajesh Sharma',
        contactPersonPhone: '+919666666666',
        isVerified: true,
        billingAddress: {
          addressLine1: '304, Titanium City Centre',
          addressLine2: 'Prahladnagar',
          city: 'Ahmedabad',
          state: 'Gujarat',
          postalCode: '380015',
          country: 'India',
        },
      },
    });
  } else {
    companyProfile = await prisma.companyProfile.update({
      where: { id: companyProfile.id },
      data: {
        companyName: 'AdVantage Media Pvt Ltd',
        isVerified: true,
      },
    });
  }

  // Ensure BillingProfile exists
  await prisma.billingProfile.upsert({
    where: { companyId: companyProfile.id },
    create: {
      companyId: companyProfile.id,
      legalName: 'AdVantage Media Private Limited',
      gstin: '24AAACA1234A1Z5',
      stateCode: '24',
      invoiceEmails: ['billing@advantage.example.com', 'demo.company@autoposter.in'],
      billingAddress: {
        line1: '304, Titanium City Centre',
        line2: 'Prahladnagar',
        city: 'Ahmedabad',
        state: 'Gujarat',
        pincode: '380015',
      },
    },
    update: {
      legalName: 'AdVantage Media Private Limited',
      gstin: '24AAACA1234A1Z5',
    },
  });

  // 5. Company Team Members: MANAGER, FINANCE, VIEWER
  const teamSpecs = [
    { email: 'manager.company@autoposter.in', mobile: '+919666666661', role: COMPANY_MEMBER_ROLES.MANAGER },
    { email: 'finance.company@autoposter.in', mobile: '+919666666662', role: COMPANY_MEMBER_ROLES.FINANCE },
    { email: 'viewer.company@autoposter.in', mobile: '+919666666663', role: COMPANY_MEMBER_ROLES.VIEWER },
  ];

  for (const member of teamSpecs) {
    const user = await prisma.user.upsert({
      where: { email: member.email },
      create: {
        email: member.email,
        mobile: member.mobile,
        role: ROLES.COMPANY,
        status: ACCOUNT_STATUS.APPROVED,
        passwordHash: companyPasswordHash,
        preferredLanguage: 'en',
        preferredTheme: 'light',
        mustChangePassword: false,
        mobileVerifiedAt: new Date(),
        emailVerifiedAt: new Date(),
      },
      update: {
        passwordHash: companyPasswordHash,
        status: ACCOUNT_STATUS.APPROVED,
        mustChangePassword: false,
      },
    });

    await prisma.companyMember.upsert({
      where: {
        companyId_userId: {
          companyId: companyProfile.id,
          userId: user.id,
        },
      },
      create: {
        companyId: companyProfile.id,
        userId: user.id,
        role: member.role as any,
        status: 'ACTIVE',
      },
      update: {
        role: member.role as any,
        status: 'ACTIVE',
      },
    });
  }

  // 6. Pending Company & Suspended Company
  const pendingUser = await prisma.user.upsert({
    where: { email: 'pending.company@autoposter.in' },
    create: {
      email: 'pending.company@autoposter.in',
      mobile: '+919666666670',
      role: ROLES.COMPANY,
      status: ACCOUNT_STATUS.PENDING,
      passwordHash: companyPasswordHash,
      preferredLanguage: 'en',
      preferredTheme: 'system',
      mustChangePassword: false,
      mobileVerifiedAt: new Date(),
      emailVerifiedAt: null,
    },
    update: {
      status: ACCOUNT_STATUS.PENDING,
      passwordHash: companyPasswordHash,
    },
  });

  await prisma.companyProfile.upsert({
    where: { userId: pendingUser.id },
    create: {
      userId: pendingUser.id,
      cityId: city.id,
      companyName: 'Pending Startups LLP',
      contactPersonName: 'Amit Patel',
      contactPersonPhone: '+919666666670',
      isVerified: false,
    },
    update: {
      isVerified: false,
    },
  });

  const suspendedUser = await prisma.user.upsert({
    where: { email: 'suspended.company@autoposter.in' },
    create: {
      email: 'suspended.company@autoposter.in',
      mobile: '+919666666680',
      role: ROLES.COMPANY,
      status: ACCOUNT_STATUS.SUSPENDED,
      passwordHash: companyPasswordHash,
      preferredLanguage: 'en',
      preferredTheme: 'system',
      mustChangePassword: false,
      mobileVerifiedAt: new Date(),
      emailVerifiedAt: new Date(),
    },
    update: {
      status: ACCOUNT_STATUS.SUSPENDED,
      passwordHash: companyPasswordHash,
    },
  });

  await prisma.companyProfile.upsert({
    where: { userId: suspendedUser.id },
    create: {
      userId: suspendedUser.id,
      cityId: city.id,
      companyName: 'Suspended Traders Co',
      contactPersonName: 'Vikram Mehta',
      contactPersonPhone: '+919666666680',
      isVerified: false,
    },
    update: {},
  });

  // 7. Seed Sample Campaigns for demo.company
  const existingCampaigns = await prisma.campaign.findMany({
    where: { companyId: primaryCompanyUser.id },
  });

  if (existingCampaigns.length === 0) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 31);

    // Active Campaign: 50 slots = 6,930,000 paise (₹69,300)
    const activeCamp = await prisma.campaign.create({
      data: {
        companyId: primaryCompanyUser.id,
        cityId: city.id,
        title: 'Festival Mega Sale 2026',
        description: 'Diwali mega billboard discounts on auto-rickshaw backs.',
        targetAutoCount: 50,
        enrolledCount: 15,
        startDate,
        endDate,
        dailyRentPaise: 4000,
        printingAllowancePaise: 10000,
        totalBudgetPaise: BigInt(6000000),
        platformFeePaise: BigInt(500000),
        gstAmountPaise: BigInt(430000),
        totalChargedPaise: BigInt(6930000),
        status: CAMPAIGN_STATUS.RUNNING as any,
        creativeUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800',
        creativeThumbnailUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=200',
        campaignZones: {
          create: [{ zoneId: zone1.id }, { zoneId: zone2.id }],
        },
      },
    });

    // Pending Approval Campaign
    await prisma.campaign.create({
      data: {
        companyId: primaryCompanyUser.id,
        cityId: city.id,
        title: 'Monsoon Brand Blitz',
        description: 'Citywide wet season promotional campaign.',
        targetAutoCount: 20,
        enrolledCount: 0,
        startDate,
        endDate,
        dailyRentPaise: 3500,
        printingAllowancePaise: 8000,
        totalBudgetPaise: BigInt(2400000),
        platformFeePaise: BigInt(200000),
        gstAmountPaise: BigInt(180000),
        totalChargedPaise: BigInt(2780000),
        status: CAMPAIGN_STATUS.UNDER_REVIEW as any,
        creativeUrl: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800',
        campaignZones: {
          create: [{ zoneId: zone1.id }],
        },
      },
    });

    // Draft Campaign
    await prisma.campaign.create({
      data: {
        companyId: primaryCompanyUser.id,
        cityId: city.id,
        title: 'Local Launch Draft',
        description: 'New product teaser draft.',
        targetAutoCount: 10,
        enrolledCount: 0,
        startDate,
        endDate,
        dailyRentPaise: 3000,
        printingAllowancePaise: 6000,
        totalBudgetPaise: BigInt(1000000),
        platformFeePaise: BigInt(80000),
        gstAmountPaise: BigInt(70000),
        totalChargedPaise: BigInt(1150000),
        status: CAMPAIGN_STATUS.DRAFT as any,
        campaignZones: {
          create: [{ zoneId: zone2.id }],
        },
      },
    });

    // 8. Seed 1 Sample Dispute for active campaign
    await prisma.dispute.create({
      data: {
        campaignId: activeCamp.id,
        raisedByUserId: primaryCompanyUser.id,
        role: ROLES.COMPANY,
        raisedByRole: ROLES.COMPANY,
        againstParty: 'PLATFORM',
        reason: DISPUTE_REASONS.PRINT_QUALITY as any,
        status: DISPUTE_STATUS.OPEN as any,
        details: 'The driver uploaded a verification photo where the contact number is cut off at the edge.',
        messages: {
          create: [
            {
              authorId: primaryCompanyUser.id,
              authorRole: ROLES.COMPANY,
              body: 'Hello, please review this driver poster. The contact number is unreadable.',
              visibleTo: 'BOTH',
            },
          ],
        },
      },
    });
  }

  // 9. Seed Sample Payment and Tax Document for demo.company if not present
  const existingPayments = await prisma.campaignPayment.findMany({
    where: { companyId: primaryCompanyUser.id },
  });
  if (existingPayments.length === 0) {
    const camp = await prisma.campaign.findFirst({
      where: { companyId: primaryCompanyUser.id, title: 'Festival Mega Sale 2026' },
    });
    if (camp) {
      const payment = await prisma.campaignPayment.create({
        data: {
          campaignId: camp.id,
          companyId: primaryCompanyUser.id,
          amountPaise: BigInt(6930000),
          currency: 'INR',
          gateway: 'RAZORPAY',
          gatewayPaymentId: 'pay_festival_2026_001',
          gatewayOrderId: 'order_festival_2026_001',
          status: 'PAID' as any,
          capturedAt: new Date(),
          signatureVerifiedAt: new Date(),
        },
      });

      await prisma.taxDocument.create({
        data: {
          documentType: 'TAX_INVOICE' as any,
          documentNumber: 'INV/2026-27/0001',
          financialYear: '2026-2027',
          sequenceNumber: 1,
          campaignId: camp.id,
          companyId: primaryCompanyUser.id,
          paymentId: payment.id,
          taxableAmountPaise: BigInt(500000),
          cgstPaise: BigInt(45000),
          sgstPaise: BigInt(45000),
          igstPaise: BigInt(0),
          totalAmountPaise: BigInt(6930000),
        },
      });
    }
  }

  console.log('[seed-test-schema] SUCCESS: Test database populated with test accounts and sample data.');
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) {
  seedTestSchema()
    .catch((err) => {
      console.error('[seed-test-schema] Failed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await disconnectPrisma();
    });
}
