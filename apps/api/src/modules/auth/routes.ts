import { Router } from 'express';
import { AuthController } from './controller.js';
import { requireAuth } from '../../shared/middleware/auth.js';

export const authRouter = Router();

// Public Authentication Endpoints
authRouter.post('/driver/otp/request', AuthController.requestDriverOtp);
authRouter.post('/driver/otp/verify', AuthController.verifyDriverOtp);

authRouter.post('/company/register', AuthController.registerCompany);
authRouter.post('/company/verify-mobile', AuthController.verifyCompanyMobile);
authRouter.post('/company/login', AuthController.loginCompany);

authRouter.post('/admin/login', AuthController.loginAdminStep1);
authRouter.post('/admin/verify-otp', AuthController.loginAdminStep2);

authRouter.post('/refresh', AuthController.refreshTokens);

authRouter.post('/password/forgot', AuthController.forgotPassword);
authRouter.post('/password/reset', AuthController.resetPassword);

// Authenticated Endpoints
authRouter.post('/logout', requireAuth(), AuthController.logout);
authRouter.post('/logout-all', requireAuth(), AuthController.logoutAll);
authRouter.get('/me', requireAuth(), AuthController.getMe);
authRouter.patch('/me/preferences', requireAuth(), AuthController.updatePreferences);
authRouter.post('/password/change', requireAuth(), AuthController.changePassword);
authRouter.get('/sessions', requireAuth(), AuthController.listSessions);
authRouter.delete('/sessions/:id', requireAuth(), AuthController.revokeSession);

export function createAuthRouter(): Router {
  return authRouter;
}
