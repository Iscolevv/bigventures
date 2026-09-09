import { text, timestamp, integer, date, index } from 'drizzle-orm/pg-core';
import type {
  DocumentOwnerType,
  DocumentType,
  DocumentStatus,
  Role,
} from '@bv/core/enums';
import { user } from './auth';
import { bv, pk, timestamps } from './_shared';

/**
 * One repository for every compliance document — driver, vehicle, and company.
 * `owner_type` + `owner_id` is a soft polymorphic link (owner_id null for
 * company docs). Expiry feeds the alerts panel via the document_expiry job.
 */
export const documents = bv.table(
  'documents',
  {
    id: pk(),
    owner_type: text('owner_type').$type<DocumentOwnerType>().notNull(),
    owner_id: text('owner_id'), // drivers.id | vehicles.id | null (company)
    doc_type: text('doc_type').$type<DocumentType>().notNull(),
    title: text('title').notNull(),
    storage_key: text('storage_key').notNull(),
    mime_type: text('mime_type'),
    file_size: integer('file_size'),
    issue_date: date('issue_date'),
    expiry_date: date('expiry_date'),
    status: text('status').$type<DocumentStatus>().notNull().default('pending_review'),
    reviewed_by: text('reviewed_by').references(() => user.id, { onDelete: 'set null' }),
    reviewed_at: timestamp('reviewed_at'),
    review_notes: text('review_notes'),
    uploaded_by: text('uploaded_by').references(() => user.id, { onDelete: 'set null' }),
    uploaded_by_role: text('uploaded_by_role').$type<Role>(),
    notes: text('notes'),
    ...timestamps,
  },
  (t) => [
    index('documents_owner_idx').on(t.owner_type, t.owner_id),
    index('documents_expiry_idx').on(t.expiry_date),
    index('documents_status_idx').on(t.status),
  ],
);
