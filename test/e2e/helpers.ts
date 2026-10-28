import type { INestApplication } from '@nestjs/common';
import { MikroORM } from '@mikro-orm/postgresql';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';

export const ADMIN_EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@example.com';

const resolveOrm = (app: INestApplication) => app.get(MikroORM);

export interface TestContext {
  app: INestApplication;
  orm: ReturnType<typeof resolveOrm>;
  http: () => ReturnType<typeof request>;
}

/** Boots the real AppModule against PostgreSQL with a freshly migrated schema. */
export async function createTestContext(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = configureApp(moduleRef.createNestApplication({ logger: false }));
  await app.init();
  const orm = resolveOrm(app);
  await orm.em.fork().execute('drop schema if exists public cascade; create schema public;');
  await orm.migrator.up();
  return { app, orm, http: () => request(app.getHttpServer()) };
}

export async function register(ctx: TestContext, email: string, password = 'correct horse battery staple') {
  const res = await ctx.http().post('/auth/register').send({ email, password }).expect(201);
  return res.body as { accessToken: string; refreshToken: string };
}
