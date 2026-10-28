import { createHash, randomBytes, randomUUID } from 'node:crypto';

export const newId = (): string => randomUUID();

/** 256-bit opaque token, URL-safe. */
export const newOpaqueToken = (): string => randomBytes(32).toString('base64url');

export const sha256Hex = (value: string): string => createHash('sha256').update(value).digest('hex');
