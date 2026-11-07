import fs from 'fs';
import path from 'path';

const API_ROOT = path.resolve('d:/Ravi/Radhe/Auto-Poster-Platform/api');

const routeFiles = [
  'src/modules/company/routes.ts',
  'src/modules/campaigns/company-campaigns.routes.ts',
  'src/modules/assignments/company-installations.routes.ts',
  'src/modules/daily-photos/company-daily-photos.routes.ts',
  'src/modules/disputes/company-disputes.routes.ts',
  'src/modules/auth/routes.ts',
  'src/routes.ts'
];

for (const rf of routeFiles) {
  const fullPath = path.join(API_ROOT, rf);
  if (fs.existsSync(fullPath)) {
    console.log(`\n=== ${rf} ===`);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');
    for (const l of lines) {
      if (
        l.includes('router.get(') ||
        l.includes('router.post(') ||
        l.includes('router.put(') ||
        l.includes('router.patch(') ||
        l.includes('router.delete(') ||
        l.includes('companyRouter.get(') ||
        l.includes('companyRouter.post(') ||
        l.includes('companyRouter.put(') ||
        l.includes('companyRouter.patch(') ||
        l.includes('companyRouter.delete(')
      ) {
        console.log('  ', l.trim());
      }
    }
  }
}

