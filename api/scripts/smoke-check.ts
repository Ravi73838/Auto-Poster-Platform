interface SmokeTestResult {
  name: string;
  url: string;
  method: string;
  status: 'PASS' | 'FAIL';
  statusCode: number;
  expectedStatus: number;
  durationMs: number;
  notes?: string;
}

async function runCheck(
  name: string,
  url: string,
  options: RequestInit,
  expectedStatus: number | number[],
  validate?: (res: Response, body: any) => Promise<string | undefined>,
): Promise<SmokeTestResult> {
  const start = Date.now();
  try {
    const res = await fetch(url, options);
    const durationMs = Date.now() - start;
    let body: any = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      body = await res.json().catch(() => null);
    }

    const expectedList = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
    const isStatusMatch = expectedList.includes(res.status);

    let extraNote: string | undefined;
    if (validate) {
      extraNote = await validate(res, body);
    }

    const isPass = isStatusMatch && !extraNote;

    return {
      name,
      url,
      method: options.method || 'GET',
      status: isPass ? 'PASS' : 'FAIL',
      statusCode: res.status,
      expectedStatus: expectedList[0]!,
      durationMs,
      notes: extraNote || (isPass ? 'OK' : `Unexpected status ${res.status}`),
    };
  } catch (err: any) {
    return {
      name,
      url,
      method: options.method || 'GET',
      status: 'FAIL',
      statusCode: 0,
      expectedStatus: Array.isArray(expectedStatus) ? expectedStatus[0]! : expectedStatus,
      durationMs: Date.now() - start,
      notes: `Connection error: ${err.message}`,
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  let baseUrl = 'http://localhost:4000';
  const urlIdx = args.indexOf('--url');
  if (urlIdx !== -1 && args[urlIdx + 1]) {
    baseUrl = args[urlIdx + 1]!.replace(/\/$/, '');
  }

  console.log('================================================================');
  console.log('          AUTO POSTER PLATFORM - API SMOKE CHECK                ');
  console.log('================================================================');
  console.log(`Target URL:  ${baseUrl}`);
  console.log(`Timestamp:   ${new Date().toISOString()}`);
  console.log('----------------------------------------------------------------\n');

  const results: SmokeTestResult[] = [];

  // 1. Health Endpoint
  results.push(
    await runCheck(
      'Health Check & Latency',
      `${baseUrl}/api/v1/health`,
      { method: 'GET' },
      200,
      async (res, body) => {
        if (!body || body.status !== 'ok') return 'Health body missing { status: "ok" }';
        const nosniff = res.headers.get('x-content-type-options');
        if (nosniff !== 'nosniff') return 'Missing X-Content-Type-Options: nosniff header';
        return undefined;
      },
    ),
  );

  // 2. Public Cities
  results.push(
    await runCheck(
      'Public Cities Directory',
      `${baseUrl}/api/v1/public/cities`,
      { method: 'GET' },
      200,
      async (_res, body) => {
        if (!body || !Array.isArray(body.data)) return 'Expected body.data to be an array';
        return undefined;
      },
    ),
  );

  // 3. Legal Documents
  results.push(
    await runCheck(
      'Public Legal Document Lookup',
      `${baseUrl}/api/v1/legal/terms_driver`,
      { method: 'GET' },
      [200, 404], // 200 if seeded, 404 if draft
    ),
  );

  // 4. Admin Auth Negative Validation (Invalid Credentials)
  results.push(
    await runCheck(
      'Admin Auth Rejection & Rate Guard',
      `${baseUrl}/api/v1/auth/admin/login`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'probe@autoposter.invalid', password: 'BadPasswordProbe123!' }),
      },
      [400, 401],
      async (_res, body) => {
        if (!body || body.success !== false) return 'Expected error response { success: false }';
        return undefined;
      },
    ),
  );

  // 5. Driver OTP Request Format Validation
  results.push(
    await runCheck(
      'Driver OTP Request Validation',
      `${baseUrl}/api/v1/auth/driver/otp/request`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: '123' }), // Invalid mobile
      },
      [400, 422],
    ),
  );

  // Output Report
  console.log('RESULTS:');
  for (const r of results) {
    const badge =
      r.status === 'PASS'
        ? '\x1b[32m[PASS]\x1b[0m'
        : '\x1b[31m[FAIL]\x1b[0m';
    console.log(
      `  ${badge} ${r.name.padEnd(35)} : HTTP ${r.statusCode} (${r.durationMs}ms) - ${r.notes}`,
    );
  }

  const failures = results.filter((r) => r.status === 'FAIL');
  console.log('\n----------------------------------------------------------------');
  if (failures.length > 0) {
    console.log(`\x1b[31mSMOKE CHECK FAILED: ${failures.length} test(s) failed.\x1b[0m`);
    process.exit(1);
  } else {
    console.log(`\x1b[32mALL SMOKE CHECKS PASSED (${results.length}/${results.length}).\x1b[0m`);
    process.exit(0);
  }
}

main();

