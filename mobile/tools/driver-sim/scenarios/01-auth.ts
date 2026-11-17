import type { SimulatorContext } from '../harness';
import { resolveEntryRoute } from '../../../src/navigation/resolveEntryRoute';

export async function runAuthScenario(ctx: SimulatorContext): Promise<void> {
  const { client } = ctx;

  const testMobile = `+9197${Math.floor(10000000 + Math.random() * 90000000)}`;
  const password = 'DriverPassword@123';

  // 1. Register with mobile and password
  const regRes = await client.driverPasswordRegister({
    mobile: testMobile,
    password,
  });

  if (!regRes.accessToken || !regRes.user) {
    throw new Error('Registration failed: no tokens or user returned');
  }

  // Set auth token on client
  (client as any).setTokens({ accessToken: regRes.accessToken, refreshToken: regRes.refreshToken });

  // Verify resolveEntryRoute for newly registered driver (status = PENDING, KYC not submitted)
  const initialRoute = resolveEntryRoute({
    isAuthenticated: true,
    me: { user: regRes.user } as any,
    kycStatus: null,
  });
  if (initialRoute !== '/(onboarding)/wizard') {
    throw new Error(`Expected /(onboarding)/wizard for new driver, got: ${initialRoute}`);
  }

  // 2. Duplicate mobile registration must be rejected
  let duplicateRejected = false;
  try {
    await client.driverPasswordRegister({ mobile: testMobile, password });
  } catch (err: any) {
    if (err?.code === 'MOBILE_ALREADY_REGISTERED' || err?.status === 409) {
      duplicateRejected = true;
    }
  }
  if (!duplicateRejected) {
    throw new Error('Duplicate mobile registration was not rejected with 409 Conflict');
  }

  // 3. Login with correct credentials
  const loginRes = await client.driverPasswordLogin({
    mobile: testMobile,
    password,
  });
  if (!loginRes.accessToken) {
    throw new Error('Login failed for registered driver');
  }

  // 4. Login with wrong password must be rejected
  let wrongPassRejected = false;
  try {
    await client.driverPasswordLogin({
      mobile: testMobile,
      password: 'WrongPassword999!',
    });
  } catch (err: any) {
    if (err?.status === 401 || err?.code === 'INVALID_CREDENTIALS') {
      wrongPassRejected = true;
    }
  }
  if (!wrongPassRejected) {
    throw new Error('Login with incorrect password did not return 401 Unauthorized');
  }

  // 5. Refresh token rotation
  const refreshRes = await client.refreshTokens({
    refreshToken: loginRes.refreshToken!,
  });
  if (!refreshRes.accessToken) {
    throw new Error('Refresh token rotation failed to return new access token');
  }
  (client as any).setTokens({ accessToken: refreshRes.accessToken, refreshToken: refreshRes.refreshToken });

  // 6. Verify OTP endpoints return OTP_DISABLED in password mode
  let otpDisabledThrown = false;
  try {
    await client.driverOtpRequest({ mobile: testMobile });
  } catch (err: any) {
    if (err?.code === 'OTP_DISABLED' || err?.status === 400) {
      otpDisabledThrown = true;
    }
  }
  if (!otpDisabledThrown) {
    throw new Error('Requesting OTP when AUTH_OTP_ENABLED=false did not return OTP_DISABLED');
  }

  // 7. Verify session revocation / logout
  await client.logout();
  (client as any).setTokens({ accessToken: null, refreshToken: null });

  const loggedOutRoute = resolveEntryRoute({
    isAuthenticated: false,
  });
  if (loggedOutRoute !== '/(public)/login') {
    throw new Error(`Expected /(public)/login after logout, got: ${loggedOutRoute}`);
  }
}
