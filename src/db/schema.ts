/**
 * Studievägledare — Drizzle schema (MySQL / Hostinger)
 *
 * Conventions (per internal playbook):
 * - Roles and statuses as DB enums from day 1.
 * - Public entities follow the status/published_at pattern.
 * - Consents are rows with history, never boolean columns.
 * - No personal identity numbers, no exact addresses anywhere.
 * - Knowledge-base entities carry validity periods (Gy25 transition) and a
 *   data_source reference so every fact can be cited with source + fetched date.
 */

import {
  bigint,
  boolean,
  date,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';

/* ────────────────────────────── helpers ────────────────────────────── */

const id = () => bigint('id', { mode: 'number' }).autoincrement().primaryKey();
const createdAt = () => timestamp('created_at').defaultNow().notNull();
const updatedAt = () => timestamp('updated_at').defaultNow().onUpdateNow().notNull();

/* ─────────────────────────── organizations ─────────────────────────── */

export const municipalities = mysqlTable('municipalities', {
  id: id(),
  // Official municipality code (SCB, 4 digits) — stable join key across sources.
  code: varchar('code', { length: 4 }).notNull().unique(),
  name: varchar('name', { length: 120 }).notNull(),
  countyCode: varchar('county_code', { length: 2 }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const schools = mysqlTable(
  'schools',
  {
    id: id(),
    // Skolverket school unit code (skolenhetskod) — join key to open data.
    schoolUnitCode: varchar('school_unit_code', { length: 12 }).unique(),
    name: varchar('name', { length: 200 }).notNull(),
    municipalityId: bigint('municipality_id', { mode: 'number' })
      .notNull()
      .references(() => municipalities.id),
    type: mysqlEnum('type', ['grundskola', 'gymnasieskola', 'komvux', 'other']).notNull(),
    principalType: mysqlEnum('principal_type', ['kommunal', 'fristaende', 'region', 'statlig']),
    status: mysqlEnum('status', ['active', 'inactive']).default('active').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('schools_municipality_idx').on(t.municipalityId)],
);

export const licenses = mysqlTable(
  'licenses',
  {
    id: id(),
    // A license belongs to a school OR a municipality (kommun-wide deals) — exactly one.
    schoolId: bigint('school_id', { mode: 'number' }).references(() => schools.id),
    municipalityId: bigint('municipality_id', { mode: 'number' }).references(
      () => municipalities.id,
    ),
    plan: mysqlEnum('plan', ['pilot', 'school_basic', 'school_plus', 'municipality']).notNull(),
    seats: int('seats'), // null = unlimited
    startsAt: date('starts_at').notNull(),
    endsAt: date('ends_at').notNull(),
    // Manual invoicing in v1 — reference to Fortnox invoice / agreement number.
    invoiceRef: varchar('invoice_ref', { length: 100 }),
    // Signed personuppgiftsbiträdesavtal is a sales requirement — track it.
    dpaSignedAt: date('dpa_signed_at'),
    status: mysqlEnum('status', ['active', 'expired', 'cancelled']).default('active').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('licenses_school_idx').on(t.schoolId),
    index('licenses_municipality_idx').on(t.municipalityId),
  ],
);

/* ────────────────────────────── users ─────────────────────────────── */

export const users = mysqlTable(
  'users',
  {
    id: id(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 100 }).notNull(),
    role: mysqlEnum('role', ['student', 'syv', 'school_admin', 'municipality', 'admin'])
      .default('student')
      .notNull(),
    displayName: varchar('display_name', { length: 100 }), // optional, first name is enough
    // Data minimization: birth year only — never personnummer, never full DOB.
    birthYear: smallint('birth_year'),
    // Prepared for BankID (phase 3): how identity was verified, if ever.
    authProvider: mysqlEnum('auth_provider', ['password', 'bankid']).default('password').notNull(),
    identityVerifiedAt: timestamp('identity_verified_at'),
    // Municipality users are scoped here; students/syv are scoped via school_memberships.
    municipalityId: bigint('municipality_id', { mode: 'number' }).references(
      () => municipalities.id,
    ),
    status: mysqlEnum('status', ['active', 'blocked', 'deletion_requested', 'deleted'])
      .default('active')
      .notNull(),
    lastLoginAt: timestamp('last_login_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('users_role_idx').on(t.role)],
);

/**
 * A user's link to a school. A table (not users.school_id) because:
 * students change schools, SYV can serve several schools, and history matters
 * for license accounting. Exactly one active membership enforced in code.
 */
export const schoolMemberships = mysqlTable(
  'school_memberships',
  {
    id: id(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id),
    schoolId: bigint('school_id', { mode: 'number' })
      .notNull()
      .references(() => schools.id),
    roleAtSchool: mysqlEnum('role_at_school', ['student', 'syv', 'school_admin']).notNull(),
    // For students: current grade (7-9 = grundskola, 10-12 ≈ gy1-gy3).
    gradeYear: smallint('grade_year'),
    startedAt: date('started_at').notNull(),
    endedAt: date('ended_at'),
    createdAt: createdAt(),
  },
  (t) => [
    index('memberships_user_idx').on(t.userId),
    index('memberships_school_idx').on(t.schoolId),
  ],
);

export const passwordResets = mysqlTable('password_resets', {
  id: id(),
  userId: bigint('user_id', { mode: 'number' })
    .notNull()
    .references(() => users.id),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: createdAt(),
});

/* ─────────────────────── consent & privacy (GDPR) ─────────────────────── */

export const consents = mysqlTable(
  'consents',
  {
    id: id(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id),
    type: mysqlEnum('type', [
      'terms_privacy', // account creation
      'grades_processing', // self-reported grades are voluntary & separate
      'share_with_syv',
      'share_with_guardian',
      'studiecoach_handoff',
      'lead_forwarding', // premium profile interest form
      'web_push',
    ]).notNull(),
    action: mysqlEnum('action', ['granted', 'revoked']).notNull(),
    // Where consent was collected (screen/flow) — required for accountability.
    source: varchar('source', { length: 100 }).notNull(),
    policyVersion: varchar('policy_version', { length: 20 }),
    createdAt: createdAt(), // immutable log — rows are never updated or deleted
  },
  (t) => [index('consents_user_type_idx').on(t.userId, t.type)],
);

/** Student → SYV (or guardian link) sharing. Revocable, auditable. */
export const shareGrants = mysqlTable(
  'share_grants',
  {
    id: id(),
    studentUserId: bigint('student_user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id),
    kind: mysqlEnum('kind', ['syv', 'guardian_link']).notNull(),
    // kind=syv: the receiving SYV's school (any active SYV there may read).
    schoolId: bigint('school_id', { mode: 'number' }).references(() => schools.id),
    // kind=guardian_link: unguessable token for the guardian web view.
    linkTokenHash: varchar('link_token_hash', { length: 64 }).unique(),
    expiresAt: timestamp('expires_at'), // guardian links always expire
    revokedAt: timestamp('revoked_at'),
    // SYV inbox workflow state.
    syvStatus: mysqlEnum('syv_status', ['new', 'read', 'meeting_booked', 'done']).default('new'),
    syvNotes: text('syv_notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('share_grants_student_idx').on(t.studentUserId),
    index('share_grants_school_status_idx').on(t.schoolId, t.syvStatus),
  ],
);

export const dataRequests = mysqlTable('data_requests', {
  id: id(),
  userId: bigint('user_id', { mode: 'number' })
    .notNull()
    .references(() => users.id),
  type: mysqlEnum('type', ['export', 'deletion']).notNull(),
  status: mysqlEnum('status', ['pending', 'completed', 'failed']).default('pending').notNull(),
  completedAt: timestamp('completed_at'),
  createdAt: createdAt(),
});

/* ───────────────────────── interview & profile ───────────────────────── */

export const interviews = mysqlTable(
  'interviews',
  {
    id: id(),
    // Nullable: guest interviews have no user yet; claimed on signup via guestToken.
    userId: bigint('user_id', { mode: 'number' }).references(() => users.id),
    guestTokenHash: varchar('guest_token_hash', { length: 64 }).unique(),
    mode: mysqlEnum('mode', ['gymnasieval', 'hogskola']).notNull(),
    variant: mysqlEnum('variant', ['full', 'guest_short']).default('full').notNull(),
    status: mysqlEnum('status', ['active', 'paused', 'completed', 'abandoned'])
      .default('active')
      .notNull(),
    // Resumable engine state: phase id, turn counters, engine version.
    engineState: json('engine_state').$type<{
      engineVersion: number;
      phaseId: string;
      phaseTurns: number;
      totalTurns: number;
    }>(),
    inputTokensUsed: int('input_tokens_used').default(0).notNull(),
    outputTokensUsed: int('output_tokens_used').default(0).notNull(),
    completedAt: timestamp('completed_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('interviews_user_idx').on(t.userId), index('interviews_status_idx').on(t.status)],
);

export const interviewMessages = mysqlTable(
  'interview_messages',
  {
    id: id(),
    interviewId: bigint('interview_id', { mode: 'number' })
      .notNull()
      .references(() => interviews.id),
    role: mysqlEnum('role', ['assistant', 'user']).notNull(),
    content: text('content').notNull(),
    // Tool activity for debugging quality issues (profile patches applied this turn).
    toolPatch: json('tool_patch'),
    createdAt: createdAt(),
  },
  (t) => [index('messages_interview_idx').on(t.interviewId)],
);

/**
 * Structured profile filled by the interview. Versioned: a new row per
 * completed interview (or major revision), never mutated after completion.
 * schemaVersion lets the app migrate/interpret old payloads safely.
 */
export const studentProfiles = mysqlTable(
  'student_profiles',
  {
    id: id(),
    userId: bigint('user_id', { mode: 'number' }).references(() => users.id),
    interviewId: bigint('interview_id', { mode: 'number' })
      .notNull()
      .references(() => interviews.id),
    schemaVersion: smallint('schema_version').default(1).notNull(),
    version: smallint('version').default(1).notNull(),
    // Pseudonymous by design: interests, strengths, preferences, constraints,
    // self-reported grade level, geography as municipality granularity, uncertainties.
    // Never name/email/school inside this JSON (it is what we send to the model).
    data: json('data').notNull(),
    isCurrent: boolean('is_current').default(true).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('profiles_user_idx').on(t.userId, t.isCurrent)],
);

/* ──────────────────────────── knowledge base ──────────────────────────── */

/** Registry of external sources so every fact in the UI cites source + date. */
export const dataSources = mysqlTable('data_sources', {
  id: id(),
  key: varchar('key', { length: 50 }).notNull().unique(), // 'skolverket_syllabus', 'uhr_excel', …
  name: varchar('name', { length: 200 }).notNull(),
  url: varchar('url', { length: 500 }),
  licenseNote: varchar('license_note', { length: 300 }),
  lastFetchedAt: timestamp('last_fetched_at'),
  createdAt: createdAt(),
});

export const importRuns = mysqlTable('import_runs', {
  id: id(),
  sourceKey: varchar('source_key', { length: 50 }).notNull(),
  status: mysqlEnum('status', ['running', 'ok', 'failed']).notNull(),
  rowsUpserted: int('rows_upserted').default(0).notNull(),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  finishedAt: timestamp('finished_at'),
});

/**
 * National gymnasium programs (and orientations as child rows).
 * validFrom/validTo handles the Gy11 → Gy25 transition: both structures
 * coexist; the app picks by the student's expected start year.
 */
export const gyPrograms = mysqlTable(
  'gy_programs',
  {
    id: id(),
    code: varchar('code', { length: 20 }).notNull(), // Skolverket program code
    slug: varchar('slug', { length: 100 }).notNull().unique(),
    name: varchar('name', { length: 200 }).notNull(),
    kind: mysqlEnum('kind', ['hogskoleforberedande', 'yrkesprogram', 'introduktion']).notNull(),
    parentId: bigint('parent_id', { mode: 'number' }), // orientation → program (self-ref, no FK constraint to keep import simple)
    curriculum: mysqlEnum('curriculum', ['gy11', 'gy25']).notNull(),
    description: text('description'),
    // What further eligibility (högskolebehörighet) the program gives, structured.
    eligibilityGiven: json('eligibility_given'),
    interestTags: json('interest_tags').$type<string[]>(), // matching hook for the recommender
    validFrom: date('valid_from'),
    validTo: date('valid_to'),
    sourceId: bigint('source_id', { mode: 'number' }).references(() => dataSources.id),
    status: mysqlEnum('status', ['draft', 'published', 'archived']).default('draft').notNull(),
    publishedAt: timestamp('published_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('gy_programs_code_curriculum_uq').on(t.code, t.curriculum),
    index('gy_programs_status_idx').on(t.status),
  ],
);

/** Higher-education institutions (lärosäten). */
export const institutions = mysqlTable('institutions', {
  id: id(),
  code: varchar('code', { length: 20 }).unique(), // UHR/Ladok institution code where available
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 200 }).notNull(),
  kind: mysqlEnum('kind', ['universitet', 'hogskola', 'yh', 'folkhogskola', 'other']).notNull(),
  municipalityId: bigint('municipality_id', { mode: 'number' }).references(() => municipalities.id),
  websiteUrl: varchar('website_url', { length: 300 }),
  sourceId: bigint('source_id', { mode: 'number' }).references(() => dataSources.id),
  status: mysqlEnum('status', ['draft', 'published', 'archived']).default('draft').notNull(),
  publishedAt: timestamp('published_at'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Higher-education programs/courses (utbildningar). */
export const hePrograms = mysqlTable(
  'he_programs',
  {
    id: id(),
    // Anmälningskod is per-round; use the stable program/course code + institution.
    code: varchar('code', { length: 30 }).notNull(),
    slug: varchar('slug', { length: 160 }).notNull().unique(),
    name: varchar('name', { length: 300 }).notNull(),
    institutionId: bigint('institution_id', { mode: 'number' })
      .notNull()
      .references(() => institutions.id),
    level: mysqlEnum('level', ['grundniva', 'avancerad', 'yh']).notNull(),
    credits: int('credits'), // hp
    // Structured entry requirements: områdesbehörighet / behörighetskrav.
    entryRequirements: json('entry_requirements'),
    description: text('description'),
    interestTags: json('interest_tags').$type<string[]>(),
    sourceId: bigint('source_id', { mode: 'number' }).references(() => dataSources.id),
    status: mysqlEnum('status', ['draft', 'published', 'archived']).default('draft').notNull(),
    publishedAt: timestamp('published_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('he_programs_code_inst_uq').on(t.code, t.institutionId),
    index('he_programs_institution_idx').on(t.institutionId),
  ],
);

/**
 * Admission statistics — one row per (subject, year, round, quota group).
 * Covers both HE (UHR: BI/BII/HP quotas) and gymnasium (regional: meritvärde),
 * discriminated by subjectType. Values nullable because sources are ragged.
 */
export const admissionStats = mysqlTable(
  'admission_stats',
  {
    id: id(),
    subjectType: mysqlEnum('subject_type', ['he_program', 'gy_school_offering']).notNull(),
    heProgramId: bigint('he_program_id', { mode: 'number' }).references(() => hePrograms.id),
    // Gymnasium admission points are per school offering a program, per region.
    gyProgramId: bigint('gy_program_id', { mode: 'number' }).references(() => gyPrograms.id),
    schoolId: bigint('school_id', { mode: 'number' }).references(() => schools.id),
    year: smallint('year').notNull(),
    round: mysqlEnum('round', ['ht', 'vt', 'preliminar', 'slutlig', 'reserv']).notNull(),
    quotaGroup: varchar('quota_group', { length: 10 }), // 'BI', 'BII', 'HP' — null for gymnasium
    applicants: int('applicants'),
    admitted: int('admitted'),
    // Cut-off: HP score, betygssnitt or meritvärde depending on context.
    cutoffValue: varchar('cutoff_value', { length: 20 }),
    medianValue: varchar('median_value', { length: 20 }),
    sourceId: bigint('source_id', { mode: 'number' }).references(() => dataSources.id),
    fetchedAt: timestamp('fetched_at').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('adm_stats_he_idx').on(t.heProgramId, t.year),
    index('adm_stats_gy_idx').on(t.gyProgramId, t.schoolId, t.year),
  ],
);

/** Occupations with labour-market outlook (AF/JobTech forecasts, SSYK-linked). */
export const occupations = mysqlTable('occupations', {
  id: id(),
  // JobTech taxonomy concept id — stable key into AF's ecosystem.
  taxonomyConceptId: varchar('taxonomy_concept_id', { length: 50 }).unique(),
  ssykCode: varchar('ssyk_code', { length: 10 }),
  slug: varchar('slug', { length: 120 }).notNull().unique(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  interestTags: json('interest_tags').$type<string[]>(),
  sourceId: bigint('source_id', { mode: 'number' }).references(() => dataSources.id),
  status: mysqlEnum('status', ['draft', 'published', 'archived']).default('draft').notNull(),
  publishedAt: timestamp('published_at'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const occupationForecasts = mysqlTable(
  'occupation_forecasts',
  {
    id: id(),
    occupationId: bigint('occupation_id', { mode: 'number' })
      .notNull()
      .references(() => occupations.id),
    horizon: mysqlEnum('horizon', ['1y', '5y']).notNull(),
    year: smallint('year').notNull(), // forecast publication year
    outlook: mysqlEnum('outlook', ['stor_konkurrens', 'balans', 'goda_mojligheter']).notNull(),
    regionCode: varchar('region_code', { length: 4 }), // null = national
    sourceId: bigint('source_id', { mode: 'number' }).references(() => dataSources.id),
    fetchedAt: timestamp('fetched_at').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('forecast_uq').on(t.occupationId, t.horizon, t.year, t.regionCode)],
);

/** M:N edges powering "program → yrken" and "yrke → utbildningsvägar" pages. */
export const educationOccupationLinks = mysqlTable(
  'education_occupation_links',
  {
    occupationId: bigint('occupation_id', { mode: 'number' })
      .notNull()
      .references(() => occupations.id),
    gyProgramId: bigint('gy_program_id', { mode: 'number' }).references(() => gyPrograms.id),
    heProgramId: bigint('he_program_id', { mode: 'number' }).references(() => hePrograms.id),
    id: id(),
  },
  (t) => [index('eol_occupation_idx').on(t.occupationId)],
);

/* ───────────────────────── recommendations ───────────────────────── */

export const recommendations = mysqlTable(
  'recommendations',
  {
    id: id(),
    userId: bigint('user_id', { mode: 'number' }).references(() => users.id),
    interviewId: bigint('interview_id', { mode: 'number' })
      .notNull()
      .references(() => interviews.id),
    profileId: bigint('profile_id', { mode: 'number' })
      .notNull()
      .references(() => studentProfiles.id),
    status: mysqlEnum('status', ['generating', 'ready', 'failed']).default('generating').notNull(),
    // SYV report content (summary, talking points, uncertainty areas).
    reportData: json('report_data'),
    modelUsed: varchar('model_used', { length: 60 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('recs_user_idx').on(t.userId)],
);

export const recommendationItems = mysqlTable(
  'recommendation_items',
  {
    id: id(),
    recommendationId: bigint('recommendation_id', { mode: 'number' })
      .notNull()
      .references(() => recommendations.id),
    rank: smallint('rank').notNull(),
    // Points at exactly one knowledge-base entity.
    gyProgramId: bigint('gy_program_id', { mode: 'number' }).references(() => gyPrograms.id),
    heProgramId: bigint('he_program_id', { mode: 'number' }).references(() => hePrograms.id),
    occupationId: bigint('occupation_id', { mode: 'number' }).references(() => occupations.id),
    motivation: text('motivation').notNull(), // LLM-written, references profile
    // Facts frozen at generation time (requirements, stats, source + date),
    // so the report stays stable when the knowledge base updates.
    factsSnapshot: json('facts_snapshot').notNull(),
    gapAnalysis: json('gap_analysis'), // deterministic, computed in TS
    createdAt: createdAt(),
  },
  (t) => [index('rec_items_rec_idx').on(t.recommendationId)],
);

/* ─────────────────────── premium profiles & leads ─────────────────────── */

export const premiumProfiles = mysqlTable('premium_profiles', {
  id: id(),
  institutionId: bigint('institution_id', { mode: 'number' }).references(() => institutions.id),
  heProgramId: bigint('he_program_id', { mode: 'number' }).references(() => hePrograms.id),
  // Extended presentation content (images, USPs, contact) managed via admin CMS.
  content: json('content'),
  leadWebhookUrl: varchar('lead_webhook_url', { length: 500 }),
  leadEmail: varchar('lead_email', { length: 255 }),
  startsAt: date('starts_at').notNull(),
  endsAt: date('ends_at').notNull(),
  status: mysqlEnum('status', ['draft', 'published', 'archived']).default('draft').notNull(),
  publishedAt: timestamp('published_at'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const leads = mysqlTable(
  'leads',
  {
    id: id(),
    premiumProfileId: bigint('premium_profile_id', { mode: 'number' })
      .notNull()
      .references(() => premiumProfiles.id),
    // Lead data is given explicitly by the user for forwarding (own consent row).
    userId: bigint('user_id', { mode: 'number' }).references(() => users.id),
    name: varchar('name', { length: 100 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    message: text('message'),
    consentId: bigint('consent_id', { mode: 'number' }).references(() => consents.id),
    forwardedAt: timestamp('forwarded_at'),
    createdAt: createdAt(),
  },
  (t) => [index('leads_profile_idx').on(t.premiumProfileId)],
);

/* ──────────────────── cross-product identity (studiecoach) ──────────────────── */

export const externalIds = mysqlTable(
  'external_ids',
  {
    id: id(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id),
    system: mysqlEnum('system', ['studiecoach']).notNull(),
    externalId: varchar('external_id', { length: 100 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('external_ids_uq').on(t.system, t.externalId)],
);

/** Replay protection for handoff tokens (jti claims), pruned by cron. */
export const handoffTokens = mysqlTable('handoff_tokens', {
  id: id(),
  jti: varchar('jti', { length: 64 }).notNull().unique(),
  userId: bigint('user_id', { mode: 'number' })
    .notNull()
    .references(() => users.id),
  expiresAt: timestamp('expires_at').notNull(),
  redeemedAt: timestamp('redeemed_at'),
  createdAt: createdAt(),
});

/* ───────────────────────── ops: audit & AI budget ───────────────────────── */

export const activityLog = mysqlTable(
  'activity_log',
  {
    id: id(),
    // Nullable for guest/system events. NEVER log message content or profile data here.
    userId: bigint('user_id', { mode: 'number' }),
    event: varchar('event', { length: 60 }).notNull(), // 'interview.completed', 'share.granted', …
    subjectType: varchar('subject_type', { length: 40 }),
    subjectId: bigint('subject_id', { mode: 'number' }),
    metadata: json('metadata'), // small, non-sensitive context only
    createdAt: createdAt(),
  },
  (t) => [index('activity_user_idx').on(t.userId), index('activity_event_idx').on(t.event, t.createdAt)],
);

export const aiUsage = mysqlTable(
  'ai_usage',
  {
    id: id(),
    userId: bigint('user_id', { mode: 'number' }), // null for guests (rate-limited by IP hash)
    ipHash: varchar('ip_hash', { length: 64 }),
    purpose: mysqlEnum('purpose', ['interview', 'report']).notNull(),
    model: varchar('model', { length: 60 }).notNull(),
    inputTokens: int('input_tokens').notNull(),
    outputTokens: int('output_tokens').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('ai_usage_day_idx').on(t.createdAt), index('ai_usage_user_idx').on(t.userId)],
);
