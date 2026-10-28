import { Inject, Injectable, Logger, Module, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { MikroORM, PostgreSqlDriver } from '@mikro-orm/postgresql';
import type { Env } from '../config/env.js';
import { createOrmConfig } from './mikro-orm.config.js';

@Injectable()
class MigrateOnStart implements OnApplicationBootstrap {
  private readonly logger = new Logger('Migrations');

  constructor(
    private readonly orm: MikroORM,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get('MIGRATE_ON_START', { infer: true })) return;
    const executed = await this.orm.migrator.up();
    this.logger.log(`applied ${executed.length} migration(s)`);
  }
}

@Module({
  imports: [
    MikroOrmModule.forRootAsync({
      driver: PostgreSqlDriver,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        createOrmConfig(config.get('DATABASE_URL', { infer: true })),
    }),
  ],
  providers: [MigrateOnStart],
})
export class DatabaseModule {}
