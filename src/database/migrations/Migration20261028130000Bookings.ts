import { Migration } from '@mikro-orm/migrations';

export class Migration20261028130000Bookings extends Migration {
  override up(): void {
    // btree_gist lets one GiST index combine equality on resource_id with range overlap on the period.
    this.addSql(`create extension if not exists btree_gist;`);
    this.addSql(`create table "resources" (
      "id" uuid primary key,
      "name" varchar(120) not null,
      "description" text null,
      "active" boolean not null default true,
      "created_at" timestamptz not null,
      constraint "resources_name_unique" unique ("name")
    );`);
    this.addSql(`create table "bookings" (
      "id" uuid primary key,
      "resource_id" uuid not null references "resources" ("id") on delete restrict,
      "user_id" uuid not null references "users" ("id") on delete cascade,
      "starts_at" timestamptz not null,
      "ends_at" timestamptz not null,
      "status" text not null default 'confirmed' check ("status" in ('confirmed', 'cancelled')),
      "note" text null,
      "created_at" timestamptz not null,
      "cancelled_at" timestamptz null,
      "version" int not null default 1,
      constraint "bookings_period_check" check ("ends_at" > "starts_at"),
      constraint "bookings_no_overlap" exclude using gist (
        "resource_id" with =,
        tstzrange("starts_at", "ends_at", '[)') with &&
      ) where ("status" = 'confirmed')
    );`);
    this.addSql(
      `create index "bookings_user_id_starts_at_id_index" on "bookings" ("user_id", "starts_at", "id");`,
    );
    this.addSql(`create table "idempotency_keys" (
      "id" uuid primary key,
      "user_id" uuid not null references "users" ("id") on delete cascade,
      "key" varchar(255) not null,
      "request_hash" varchar(64) not null,
      "status_code" int null,
      "response_body" jsonb null,
      "created_at" timestamptz not null,
      "expires_at" timestamptz not null,
      constraint "idempotency_keys_user_id_key_unique" unique ("user_id", "key")
    );`);
    this.addSql(`create index "idempotency_keys_expires_at_index" on "idempotency_keys" ("expires_at");`);
  }

  override down(): void {
    this.addSql(`drop table if exists "idempotency_keys";`);
    this.addSql(`drop table if exists "bookings";`);
    this.addSql(`drop table if exists "resources";`);
  }
}
