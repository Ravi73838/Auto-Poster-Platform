import type { SimulatorContext } from '../harness';
import fs from 'node:fs';
import path from 'node:path';

export async function runAdsOffersScenario(ctx: SimulatorContext): Promise<void> {
  const { client } = ctx;

  // 1. Fetch public app configuration
  const config = await client.getPublicAppConfig();
  if (config.minVersion === undefined) {
    throw new Error('Public app config missing minVersion specification');
  }

  // 2. Verify AdMob placement invariant guards in mobile codebase
  const mobileSrcDir = path.resolve(__dirname, '../../../src');
  const forbiddenDirs = [
    'features/daily-photo',
    'features/installation',
    'features/kyc',
    'features/discipline',
    'features/disputes',
  ];

  for (const sub of forbiddenDirs) {
    const fullDir = path.join(mobileSrcDir, sub);
    if (!fs.existsSync(fullDir)) continue;
    const files = fs.readdirSync(fullDir).filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'));

    for (const f of files) {
      const content = fs.readFileSync(path.join(fullDir, f), 'utf-8');
      if (
        content.includes('react-native-google-mobile-ads') ||
        content.includes('AdSlot') ||
        content.includes('BannerAd')
      ) {
        throw new Error(`Sensitive screen file ${sub}/${f} violates AdMob policy by importing ad components!`);
      }
    }
  }

  // 3. Verify official Google sample Test Ad Unit ID is used in development/preview config
  const appConfigPath = path.resolve(__dirname, '../../../app.config.ts');
  const appConfigContent = fs.readFileSync(appConfigPath, 'utf-8');
  const GOOGLE_SAMPLE_AD_APP_ID = 'ca-app-pub-3940256099942544';

  if (!appConfigContent.includes(GOOGLE_SAMPLE_AD_APP_ID)) {
    throw new Error('app.config.ts does not contain Google sample AdMob test app ID for non-production builds');
  }
}
