const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create Zones
  const zones = await Promise.all([
    prisma.zone.upsert({
      where: { name: 'Colombo Metropolitan' },
      update: {},
      create: {
        name: 'Colombo Metropolitan',
        description: 'Colombo city and suburbs',
        baseFee: 250,
        feePerKg: 50,
        estimatedDays: 1,
      },
    }),
    prisma.zone.upsert({
      where: { name: 'Western Province' },
      update: {},
      create: {
        name: 'Western Province',
        description: 'Western Province excluding Colombo Metro',
        baseFee: 350,
        feePerKg: 75,
        estimatedDays: 1,
      },
    }),
    prisma.zone.upsert({
      where: { name: 'Southern Province' },
      update: {},
      create: {
        name: 'Southern Province',
        description: 'Galle, Matara, Hambantota',
        baseFee: 500,
        feePerKg: 100,
        estimatedDays: 2,
      },
    }),
    prisma.zone.upsert({
      where: { name: 'Central Province' },
      update: {},
      create: {
        name: 'Central Province',
        description: 'Kandy, Matale, Nuwara Eliya',
        baseFee: 600,
        feePerKg: 120,
        estimatedDays: 2,
      },
    }),
    prisma.zone.upsert({
      where: { name: 'Northern Province' },
      update: {},
      create: {
        name: 'Northern Province',
        description: 'Jaffna, Kilinochchi, Mannar, Mullaitivu, Vavuniya',
        baseFee: 800,
        feePerKg: 150,
        estimatedDays: 3,
      },
    }),
  ]);
  console.log(`✅ Created ${zones.length} zones`);

  // Create Admin user
  const adminHash = await bcrypt.hash('Admin@123!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@swiftdrop.lk' },
    update: {},
    create: {
      email: 'admin@swiftdrop.lk',
      passwordHash: adminHash,
      name: 'System Admin',
      phone: '+94111234567',
      role: 'ADMIN',
    },
  });
  console.log(`✅ Created admin: ${admin.email}`);

  // Create Dispatcher
  const dispatcherHash = await bcrypt.hash('Dispatch@123!', 12);
  const dispatcher = await prisma.user.upsert({
    where: { email: 'dispatcher@swiftdrop.lk' },
    update: {},
    create: {
      email: 'dispatcher@swiftdrop.lk',
      passwordHash: dispatcherHash,
      name: 'John Dispatcher',
      phone: '+94111234568',
      role: 'DISPATCHER',
    },
  });
  console.log(`✅ Created dispatcher: ${dispatcher.email}`);

  // Create Courier users
  const courierHash = await bcrypt.hash('Courier@123!', 12);
  const courier1User = await prisma.user.upsert({
    where: { email: 'courier1@swiftdrop.lk' },
    update: {},
    create: {
      email: 'courier1@swiftdrop.lk',
      passwordHash: courierHash,
      name: 'Kamal Perera',
      phone: '+94771234567',
      role: 'COURIER',
    },
  });
  await prisma.courier.upsert({
    where: { userId: courier1User.id },
    update: {},
    create: {
      userId: courier1User.id,
      vehicleType: 'Motorcycle',
      licenseNo: 'WP-1234',
      zone: 'Colombo Metropolitan',
    },
  });

  const courier2User = await prisma.user.upsert({
    where: { email: 'courier2@swiftdrop.lk' },
    update: {},
    create: {
      email: 'courier2@swiftdrop.lk',
      passwordHash: courierHash,
      name: 'Nimal Silva',
      phone: '+94772345678',
      role: 'COURIER',
    },
  });
  await prisma.courier.upsert({
    where: { userId: courier2User.id },
    update: {},
    create: {
      userId: courier2User.id,
      vehicleType: 'Van',
      licenseNo: 'WP-5678',
      zone: 'Western Province',
    },
  });
  console.log('✅ Created 2 couriers');

  // Create Customer user
  const customerHash = await bcrypt.hash('Customer@123!', 12);
  const customer = await prisma.user.upsert({
    where: { email: 'customer@example.com' },
    update: {},
    create: {
      email: 'customer@example.com',
      passwordHash: customerHash,
      name: 'Saman Wickrama',
      phone: '+94701234567',
      role: 'CUSTOMER',
    },
  });
  console.log(`✅ Created customer: ${customer.email}`);

  // Create Merchant user and merchant record
  const merchantHash = await bcrypt.hash('Merchant@123!', 12);
  const merchantUser = await prisma.user.upsert({
    where: { email: 'merchant@shopexample.lk' },
    update: {},
    create: {
      email: 'merchant@shopexample.lk',
      passwordHash: merchantHash,
      name: 'Shop Manager',
      phone: '+94761234567',
      role: 'MERCHANT',
    },
  });

  // Generate API key
  const rawApiKey = `sk_test_${crypto.randomBytes(24).toString('hex')}`;
  const apiKeyHash = await bcrypt.hash(rawApiKey, 10);

  await prisma.merchant.upsert({
    where: { userId: merchantUser.id },
    update: {},
    create: {
      userId: merchantUser.id,
      businessName: 'Example Shop LK',
      businessEmail: 'merchant@shopexample.lk',
      apiKey: rawApiKey,
      apiKeyHash: apiKeyHash,
      webhookUrl: 'https://webhook.site/your-test-endpoint',
      webhookSecret: crypto.randomBytes(32).toString('hex'),
      isApproved: true,
    },
  });
  console.log(`✅ Created merchant: ${merchantUser.email}`);
  console.log(`   API Key: ${rawApiKey}`);

  // Create a sample parcel
  const trackingNumber = `SD${Date.now()}`;
  await prisma.parcel.upsert({
    where: { trackingNumber },
    update: {},
    create: {
      trackingNumber,
      customerId: customer.id,
      zoneId: zones[0].id,
      pickupAddress: '123 Galle Road',
      pickupCity: 'Colombo 03',
      dropoffAddress: '456 Kandy Road',
      dropoffCity: 'Nugegoda',
      recipientName: 'Priya Fernando',
      recipientPhone: '+94711234567',
      weightKg: 2.5,
      size: 'MEDIUM',
      description: 'Electronics - Handle with care',
      estimatedFee: 375,
      status: 'CREATED',
      statusHistory: {
        create: {
          status: 'CREATED',
          note: 'Parcel booking confirmed',
          updatedBy: customer.id,
        },
      },
    },
  });
  console.log(`✅ Created sample parcel: ${trackingNumber}`);

  console.log('\n🎉 Database seeded successfully!');
  console.log('\n📝 Test Credentials:');
  console.log('  Admin:      admin@swiftdrop.lk / Admin@123!');
  console.log('  Dispatcher: dispatcher@swiftdrop.lk / Dispatch@123!');
  console.log('  Courier:    courier1@swiftdrop.lk / Courier@123!');
  console.log('  Customer:   customer@example.com / Customer@123!');
  console.log('  Merchant:   merchant@shopexample.lk / Merchant@123!');
  console.log(`  Merchant API Key: ${rawApiKey}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
