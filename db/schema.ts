import {integer,sqliteTable,text} from 'drizzle-orm/sqlite-core';
export const revisions=sqliteTable('revisions',{
 revision:integer('revision').primaryKey(), requestId:text('request_id').notNull().unique(),
 state:text('state').notNull(), actor:text('actor').notNull(), operation:text('operation').notNull(),
 createdAt:text('created_at').notNull(), justification:text('justification').notNull().default('')
});
