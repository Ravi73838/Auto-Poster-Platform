process.env.NODE_ENV = 'test';
process.env.AUTH_OTP_ENABLED = 'false';
process.env.CLOCK_CONTROL_ENABLED = 'true';
process.env.API_PORT = '4000';

await import('../src/main.js');
