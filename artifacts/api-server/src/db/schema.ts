import { pgTable, serial, text, boolean, integer, timestamp, real } from 'drizzle-orm/pg-core';

export const botUsers = pgTable('bot_users', {
  id: serial('id').primaryKey(),
  telegramId: text('telegram_id').unique().notNull(),
  username: text('username'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  language: text('language').default('uz'),
  isSubscribed: boolean('is_subscribed').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const legalDocuments = pgTable('legal_documents', {
  id: serial('id').primaryKey(),
  titleUz: text('title_uz').notNull(),
  titleRu: text('title_ru').notNull(),
  titleEn: text('title_en').notNull(),
  fileId: text('file_id').notNull(),
  fileType: text('file_type').default('document'),
  // category: 'sample' or 'template'
  category: text('category').notNull(), // e.g. 'sud', 'ariza', 'shartnoma_misol', 'boshqa', 'shartnoma', 'davo', 'korporativ', 'template_boshqa'
  docType: text('doc_type').notNull().default('sample'), // 'sample' | 'template'
  code: text('code').unique(), // e.g. HA001, SD001
  price: real('price').default(0), // 0 = free, >0 = paid
  isPaid: boolean('is_paid').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const ads = pgTable('ads', {
  id: serial('id').primaryKey(),
  userId: integer('user_id'),
  telegramId: text('telegram_id').notNull(),
  adType: text('ad_type').notNull(), // 'client' | 'specialist'
  field: text('field').notNull(),
  region: text('region').notNull(),
  experience: text('experience'),
  price: text('price'),
  description: text('description').notNull(),
  contact: text('contact').notNull(),
  messageId: integer('message_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const serviceRequests = pgTable('service_requests', {
  id: serial('id').primaryKey(),
  telegramId: text('telegram_id').notNull(),
  firstName: text('first_name'),
  serviceType: text('service_type').notNull(), // 'legal_consult' | 'doc_create'
  description: text('description').notNull(),
  status: text('status').default('pending'), // 'pending' | 'accepted' | 'rejected'
  assignedAccount: text('assigned_account'),
  adminComment: text('admin_comment'),
  messageId: integer('message_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const paymentCards = pgTable('payment_cards', {
  id: serial('id').primaryKey(),
  ownerName: text('owner_name').notNull(),
  cardNumber: text('card_number').notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const paymentScreenshots = pgTable('payment_screenshots', {
  id: serial('id').primaryKey(),
  telegramId: text('telegram_id').notNull(),
  documentCode: text('document_code').notNull(),
  fileId: text('file_id').notNull(),
  status: text('status').default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
});
