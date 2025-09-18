import { pgTable, text, uuid, timestamp, numeric, boolean, integer, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

// Profiles table
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid('user_id').notNull().unique(),
  email: text('email').notNull(),
  full_name: text('full_name'),
  wallet_address: text('wallet_address'),
  role: text('role').default('user'),
  kyc_status: text('kyc_status').default('pending'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`)
});

// Agreement types table
export const agreement_types = pgTable('agreement_types', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull().unique(),
  description: text('description'),
  cognito_form_url: text('cognito_form_url'),
  requires_kyc: boolean('requires_kyc').default(true),
  display_order: integer('display_order').default(0),
  is_active: boolean('is_active').default(true),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`)
});

// User agreements table
export const user_agreements = pgTable('user_agreements', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid('user_id').notNull(),
  agreement_type_id: uuid('agreement_type_id').notNull(),
  status: text('status').default('not_started'),
  cognito_submission_id: text('cognito_submission_id'),
  submitted_at: timestamp('submitted_at', { withTimezone: true }),
  approved_at: timestamp('approved_at', { withTimezone: true }),
  approved_by: uuid('approved_by'),
  notes: text('notes'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`)
});

// Multi-Token Smart Contract Enums (MultiTokenRwaBackedStablecoin.sol)
export const pledgeStatusEnum = ['Pending', 'Verified', 'Minted', 'Rejected', 'Cancelled', 'Redeemed', 'Liquidated'] as const;
export const rwaCategoryEnum = ['RealEstate', 'Commodities', 'Bonds', 'Equipment', 'Inventory', 'Other'] as const;

// Category Token Mappings (from MultiTokenRwaBackedStablecoin.sol)
export const categoryTokenMapping = {
  RealEstate: { name: 'Real Estate USD', symbol: 'RUSD' },
  Commodities: { name: 'Commodities USD', symbol: 'CUSD' },
  Bonds: { name: 'Bonds USD', symbol: 'BUSD' },
  Equipment: { name: 'Equipment USD', symbol: 'EUSD' },
  Inventory: { name: 'Inventory USD', symbol: 'IUSD' },
  Other: { name: 'Other Assets USD', symbol: 'OUSD' }
} as const;

// Pledges table - SAFELY adding smart contract fields while preserving existing structure
export const pledges = pgTable('pledges', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  pledge_id: integer('pledge_id').notNull().unique(), // Keep existing serial structure - DO NOT CHANGE
  user_id: uuid('user_id').notNull(),
  user_address: text('user_address').notNull(),
  asset_type: text('asset_type').notNull(),
  appraised_value: numeric('appraised_value').notNull(),
  token_amount: numeric('token_amount'),
  token_symbol: text('token_symbol').default('RWA'),
  contract_address: text('contract_address'),
  description: text('description'),
  document_hash: text('document_hash'),
  appraisal_date: timestamp('appraisal_date').default(sql`CURRENT_DATE`),
  appraiser_license: text('appraiser_license'),
  status: text('status').default('pending'), // Keep existing default
  approved_at: timestamp('approved_at', { withTimezone: true }),
  approved_by: uuid('approved_by'),
  rejection_reason: text('rejection_reason'),
  admin_notes: text('admin_notes'),
  nft_token_id: integer('nft_token_id'),
  tx_hash: text('tx_hash'),
  token_minted: boolean('token_minted').default(false), // Keep existing field
  
  // MULTI-TOKEN CONTRACT FIELDS - Enhanced for category-based tokens
  rwa_identifier: text('rwa_identifier'), // Unique asset identifier (required in new contract)
  rwa_category: text('rwa_category').default('Other'), // RwaCategory enum -> determines token type
  ltv_ratio: integer('ltv_ratio').default(8000), // LTV in basis points (flexible per pledge)
  metadata: text('metadata'), // Enhanced metadata (max 1024 chars in contract)
  is_redeemable: boolean('is_redeemable').default(true),
  last_valuation_time: timestamp('last_valuation_time', { withTimezone: true }),
  verified_by_address: text('verified_by_address'), // Smart contract verifier address
  
  // Multi-token specific fields
  category_token_address: text('category_token_address'), // Address of the category-specific token contract
  category_token_symbol: text('category_token_symbol'), // Symbol of minted token (RUSD, CUSD, etc.)
  reserve_amount: numeric('reserve_amount', { precision: 28, scale: 18 }), // Reserve portion minted to treasury
  
  // Minting enforcement fields
  approved_token_amount: numeric('approved_token_amount', { precision: 28, scale: 18 }), // Admin-approved token amount
  minted_amount: numeric('minted_amount', { precision: 28, scale: 18 }).default('0'), // Cumulative minted amount
  mint_count: integer('mint_count').default(0), // Number of minting operations
  last_minted_at: timestamp('last_minted_at', { withTimezone: true }), // Last minting timestamp
  
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`)
});

// Token balances table
export const token_balances = pgTable('token_balances', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  user_address: text('user_address').notNull(),
  token_symbol: text('token_symbol').notNull(),
  balance: numeric('balance').notNull().default('0'),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`)
});

// Mint events audit table for tracking all minting activities
export const mint_events = pgTable('mint_events', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid('user_id').notNull(),
  pledge_id: uuid('pledge_id').notNull(),
  user_address: text('user_address').notNull(),
  token_symbol: text('token_symbol').notNull(),
  category: text('category').notNull(),
  amount_minted: numeric('amount_minted', { precision: 28, scale: 18 }).notNull(),
  reserve_amount: numeric('reserve_amount', { precision: 28, scale: 18 }).default('0'),
  tx_hash: text('tx_hash'),
  contract_address: text('contract_address'),
  fireblocks_tx_id: text('fireblocks_tx_id'),
  appraised_value: numeric('appraised_value', { precision: 28, scale: 18 }),
  ltv_ratio: integer('ltv_ratio'),
  request_id: text('request_id').unique(), // For idempotency
  status: text('status').default('completed'), // completed, failed, pending
  error_message: text('error_message'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`)
});

// Liquidity pools table
export const liquidity_pools = pgTable('liquidity_pools', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid('user_id').notNull(),
  token_a: text('token_a').notNull(),
  token_b: text('token_b').notNull(),
  pool_type: text('pool_type').notNull().default('uniswap_v3'),
  fee_rate: text('fee_rate').notNull().default('0.3'),
  status: text('status').notNull().default('pending'),
  initial_liquidity_a: numeric('initial_liquidity_a').notNull(),
  initial_liquidity_b: numeric('initial_liquidity_b').notNull(),
  fireblocks_tx_id: text('fireblocks_tx_id'),
  pool_address: text('pool_address'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`)
});

// Liquidity operations table
export const liquidity_operations = pgTable('liquidity_operations', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid('user_id').notNull(),
  pool_id: uuid('pool_id').notNull(),
  operation_type: text('operation_type').notNull(),
  token_a_amount: numeric('token_a_amount').notNull(),
  token_b_amount: numeric('token_b_amount').notNull(),
  fireblocks_tx_id: text('fireblocks_tx_id'),
  status: text('status').notNull().default('pending'),
  slippage_tolerance: text('slippage_tolerance').default('2.0'),
  lp_tokens_received: numeric('lp_tokens_received'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`)
});

// Blockchain transactions table
export const blockchain_transactions = pgTable('blockchain_transactions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  transaction_id: text('transaction_id').notNull().unique(),
  transaction_type: text('transaction_type').notNull(),
  user_id: uuid('user_id'),
  user_address: text('user_address'),
  contract_address: text('contract_address'),
  transaction_data: jsonb('transaction_data'),
  status: text('status').default('PENDING'),
  created_at: timestamp('created_at', { withTimezone: true }).default(sql`now()`),
  completed_at: timestamp('completed_at', { withTimezone: true })
});

// Audit logs table
export const audit_logs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid('user_id').notNull(),
  admin_role: text('admin_role'),
  action: text('action').notNull(),
  table_name: text('table_name').notNull(),
  record_id: uuid('record_id'),
  accessed_data: jsonb('accessed_data'),
  ip_address: text('ip_address'),
  user_agent: text('user_agent'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`)
});

// Cognito submissions table
export const cognito_submissions = pgTable('cognito_submissions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  user_agreement_id: uuid('user_agreement_id'),
  cognito_entry_id: text('cognito_entry_id').notNull(),
  cognito_form_id: text('cognito_form_id').notNull(),
  submission_data: jsonb('submission_data').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`)
});

// Relations
export const profilesRelations = relations(profiles, ({ many }) => ({
  pledges: many(pledges),
  userAgreements: many(user_agreements),
  liquidityPools: many(liquidity_pools),
  liquidityOperations: many(liquidity_operations)
}));

export const pledgesRelations = relations(pledges, ({ one }) => ({
  profile: one(profiles, {
    fields: [pledges.user_id],
    references: [profiles.user_id]
  }),
  approver: one(profiles, {
    fields: [pledges.approved_by],
    references: [profiles.user_id]
  })
}));

export const userAgreementsRelations = relations(user_agreements, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [user_agreements.user_id],
    references: [profiles.user_id]
  }),
  agreementType: one(agreement_types, {
    fields: [user_agreements.agreement_type_id],
    references: [agreement_types.id]
  }),
  cognitoSubmissions: many(cognito_submissions)
}));

export const agreementTypesRelations = relations(agreement_types, ({ many }) => ({
  userAgreements: many(user_agreements)
}));

export const liquidityPoolsRelations = relations(liquidity_pools, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [liquidity_pools.user_id],
    references: [profiles.user_id]
  }),
  operations: many(liquidity_operations)
}));

export const liquidityOperationsRelations = relations(liquidity_operations, ({ one }) => ({
  profile: one(profiles, {
    fields: [liquidity_operations.user_id],
    references: [profiles.user_id]
  }),
  pool: one(liquidity_pools, {
    fields: [liquidity_operations.pool_id],
    references: [liquidity_pools.id]
  })
}));

export const cognitoSubmissionsRelations = relations(cognito_submissions, ({ one }) => ({
  userAgreement: one(user_agreements, {
    fields: [cognito_submissions.user_agreement_id],
    references: [user_agreements.id]
  })
}));

// Multi-token system tables
export const category_tokens = pgTable('category_tokens', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  category: text('category').notNull().unique(), // RwaCategory enum
  token_address: text('token_address').notNull(), // Deployed token contract address
  token_name: text('token_name').notNull(), // e.g., "Real Estate USD"
  token_symbol: text('token_symbol').notNull(), // e.g., "RUSD"
  total_minted: numeric('total_minted', { precision: 28, scale: 18 }).default('0'),
  total_reserves: numeric('total_reserves', { precision: 28, scale: 18 }).default('0'),
  category_limit: numeric('category_limit', { precision: 28, scale: 18 }), // Max value for this category
  category_value: numeric('category_value', { precision: 28, scale: 18 }).default('0'), // Current value
  is_active: boolean('is_active').default(true),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`)
});

// Enhanced token balances for multi-token system
export const token_balances_multi = pgTable('token_balances_multi', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  user_address: text('user_address').notNull(),
  category: text('category').notNull(), // RwaCategory
  token_address: text('token_address').notNull(), // Contract address
  token_symbol: text('token_symbol').notNull(), // RUSD, CUSD, etc.
  balance: numeric('balance', { precision: 28, scale: 18 }).notNull().default('0'),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`)
});

// Type definitions for multi-token smart contract alignment
export type PledgeStatus = typeof pledgeStatusEnum[number];
export type RwaCategory = typeof rwaCategoryEnum[number];
export type CategoryTokenInfo = typeof categoryTokenMapping[keyof typeof categoryTokenMapping];