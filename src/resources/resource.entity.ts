import { defineEntity, p } from '@mikro-orm/postgresql';

const ResourceSchema = defineEntity({
  name: 'Resource',
  tableName: 'resources',
  properties: {
    id: p.uuid().primary(),
    name: p.string().length(120).unique(),
    description: p.text().nullable(),
    active: p.boolean().default(true),
    createdAt: p.datetime().onCreate(() => new Date()),
  },
});

export class Resource extends ResourceSchema.class {}
ResourceSchema.setClass(Resource);
