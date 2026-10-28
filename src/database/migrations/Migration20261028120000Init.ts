import { Migration } from '@mikro-orm/migrations';

export class Migration20261028120000Init extends Migration {
  override up(): void {
    this.addSql(`create table "users" (
      "id" uuid primary key,
      "email" varchar(320) not null,
      "password_hash" varchar(255) not null,
      "role" text not null default 'member' check ("role" in ('admin', 'member')),
      "created_at" timestamptz not null,
      constraint "users_email_unique" unique ("email")
    );`);
    this.addSql(`create table "refresh_tokens" (
      "id" uuid primary key,
      "user_id" uuid not null references "users" ("id") on delete cascade,
      "family_id" uuid not null,
      "token_hash" varchar(64) not null,
      "expires_at" timestamptz not null,
      "created_at" timestamptz not null,
      "revoked_at" timestamptz null,
      "replaced_by_id" uuid null,
      constraint "refresh_tokens_token_hash_unique" unique ("token_hash")
    );`);
    this.addSql(`create index "refresh_tokens_family_id_index" on "refresh_tokens" ("family_id");`);
    this.addSql(`create index "refresh_tokens_user_id_index" on "refresh_tokens" ("user_id");`);
  }

  override down(): void {
    this.addSql(`drop table if exists "refresh_tokens";`);
    this.addSql(`drop table if exists "users";`);
  }
}
