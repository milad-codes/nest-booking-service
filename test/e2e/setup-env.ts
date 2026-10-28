// Runs before any test module is imported: AppModule validates the environment at import time.
process.env.DATABASE_URL ??= 'postgresql://booking:booking@localhost:5432/booking_test';
process.env.JWT_ACCESS_SECRET ??= 'e2e-secret-e2e-secret-e2e-secret-e2e';
process.env.BOOTSTRAP_ADMIN_EMAIL ??= 'admin@example.com';
process.env.RATE_LIMIT_PER_MINUTE ??= '100000';
process.env.LOG_LEVEL ??= 'silent';
