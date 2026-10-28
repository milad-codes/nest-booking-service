import { defineEntity, p } from '@mikro-orm/postgresql';

export const ROLES = ['admin', 'member'] as const;
export type Role = (typeof ROLES)[number];

const UserSchema = defineEntity({
  name: 'User',
  tableName: 'users',
  properties: {
    id: p.uuid().primary(),
    email: p.string().length(320).unique(),
    passwordHash: p.string().length(255).hidden(),
    role: p.enum(ROLES).default('member'),
    createdAt: p.datetime().onCreate(() => new Date()),
  },
});

export class User extends UserSchema.class {}
UserSchema.setClass(User);
