CREATE TABLE `activity_log` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`user_id` bigint,
	`event` varchar(60) NOT NULL,
	`subject_type` varchar(40),
	`subject_id` bigint,
	`metadata` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `admission_stats` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`subject_type` enum('he_program','gy_school_offering') NOT NULL,
	`he_program_id` bigint,
	`gy_program_id` bigint,
	`school_id` bigint,
	`year` smallint NOT NULL,
	`round` enum('ht','vt','preliminar','slutlig','reserv') NOT NULL,
	`quota_group` varchar(10),
	`applicants` int,
	`admitted` int,
	`cutoff_value` varchar(20),
	`median_value` varchar(20),
	`source_id` bigint,
	`fetched_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admission_stats_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_usage` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`user_id` bigint,
	`ip_hash` varchar(64),
	`purpose` enum('interview','report') NOT NULL,
	`model` varchar(60) NOT NULL,
	`input_tokens` int NOT NULL,
	`output_tokens` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_usage_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consents` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`user_id` bigint NOT NULL,
	`type` enum('terms_privacy','grades_processing','share_with_syv','share_with_guardian','studiecoach_handoff','lead_forwarding','web_push') NOT NULL,
	`action` enum('granted','revoked') NOT NULL,
	`source` varchar(100) NOT NULL,
	`policy_version` varchar(20),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `consents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `data_requests` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`user_id` bigint NOT NULL,
	`type` enum('export','deletion') NOT NULL,
	`status` enum('pending','completed','failed') NOT NULL DEFAULT 'pending',
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `data_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `data_sources` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`key` varchar(50) NOT NULL,
	`name` varchar(200) NOT NULL,
	`url` varchar(500),
	`license_note` varchar(300),
	`last_fetched_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `data_sources_id` PRIMARY KEY(`id`),
	CONSTRAINT `data_sources_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `education_occupation_links` (
	`occupation_id` bigint NOT NULL,
	`gy_program_id` bigint,
	`he_program_id` bigint,
	`id` bigint AUTO_INCREMENT NOT NULL,
	CONSTRAINT `education_occupation_links_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `external_ids` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`user_id` bigint NOT NULL,
	`system` enum('studiecoach') NOT NULL,
	`external_id` varchar(100) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `external_ids_id` PRIMARY KEY(`id`),
	CONSTRAINT `external_ids_uq` UNIQUE(`system`,`external_id`)
);
--> statement-breakpoint
CREATE TABLE `gy_programs` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`code` varchar(20) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`name` varchar(200) NOT NULL,
	`kind` enum('hogskoleforberedande','yrkesprogram','introduktion') NOT NULL,
	`parent_id` bigint,
	`curriculum` enum('gy11','gy25') NOT NULL,
	`description` text,
	`eligibility_given` json,
	`interest_tags` json,
	`valid_from` date,
	`valid_to` date,
	`source_id` bigint,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`published_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gy_programs_id` PRIMARY KEY(`id`),
	CONSTRAINT `gy_programs_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `gy_programs_code_curriculum_uq` UNIQUE(`code`,`curriculum`)
);
--> statement-breakpoint
CREATE TABLE `handoff_tokens` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`jti` varchar(64) NOT NULL,
	`user_id` bigint NOT NULL,
	`expires_at` timestamp NOT NULL,
	`redeemed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `handoff_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `handoff_tokens_jti_unique` UNIQUE(`jti`)
);
--> statement-breakpoint
CREATE TABLE `he_programs` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`code` varchar(30) NOT NULL,
	`slug` varchar(160) NOT NULL,
	`name` varchar(300) NOT NULL,
	`institution_id` bigint NOT NULL,
	`level` enum('grundniva','avancerad','yh') NOT NULL,
	`credits` int,
	`entry_requirements` json,
	`description` text,
	`interest_tags` json,
	`source_id` bigint,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`published_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `he_programs_id` PRIMARY KEY(`id`),
	CONSTRAINT `he_programs_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `he_programs_code_inst_uq` UNIQUE(`code`,`institution_id`)
);
--> statement-breakpoint
CREATE TABLE `import_runs` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`source_key` varchar(50) NOT NULL,
	`status` enum('running','ok','failed') NOT NULL,
	`rows_upserted` int NOT NULL DEFAULT 0,
	`error_message` text,
	`started_at` timestamp NOT NULL DEFAULT (now()),
	`finished_at` timestamp,
	CONSTRAINT `import_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `institutions` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`code` varchar(20),
	`slug` varchar(100) NOT NULL,
	`name` varchar(200) NOT NULL,
	`kind` enum('universitet','hogskola','yh','folkhogskola','other') NOT NULL,
	`municipality_id` bigint,
	`website_url` varchar(300),
	`source_id` bigint,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`published_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `institutions_id` PRIMARY KEY(`id`),
	CONSTRAINT `institutions_code_unique` UNIQUE(`code`),
	CONSTRAINT `institutions_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `interview_messages` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`interview_id` bigint NOT NULL,
	`role` enum('assistant','user') NOT NULL,
	`content` text NOT NULL,
	`tool_patch` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `interview_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `interviews` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`user_id` bigint,
	`guest_token_hash` varchar(64),
	`mode` enum('gymnasieval','hogskola') NOT NULL,
	`variant` enum('full','guest_short') NOT NULL DEFAULT 'full',
	`status` enum('active','paused','completed','abandoned') NOT NULL DEFAULT 'active',
	`engine_state` json,
	`input_tokens_used` int NOT NULL DEFAULT 0,
	`output_tokens_used` int NOT NULL DEFAULT 0,
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `interviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `interviews_guest_token_hash_unique` UNIQUE(`guest_token_hash`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`premium_profile_id` bigint NOT NULL,
	`user_id` bigint,
	`name` varchar(100) NOT NULL,
	`email` varchar(255) NOT NULL,
	`message` text,
	`consent_id` bigint,
	`forwarded_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `licenses` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`school_id` bigint,
	`municipality_id` bigint,
	`plan` enum('pilot','school_basic','school_plus','municipality') NOT NULL,
	`seats` int,
	`starts_at` date NOT NULL,
	`ends_at` date NOT NULL,
	`invoice_ref` varchar(100),
	`dpa_signed_at` date,
	`status` enum('active','expired','cancelled') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `licenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `municipalities` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`code` varchar(4) NOT NULL,
	`name` varchar(120) NOT NULL,
	`county_code` varchar(2) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `municipalities_id` PRIMARY KEY(`id`),
	CONSTRAINT `municipalities_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `occupation_forecasts` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`occupation_id` bigint NOT NULL,
	`horizon` enum('1y','5y') NOT NULL,
	`year` smallint NOT NULL,
	`outlook` enum('stor_konkurrens','balans','goda_mojligheter') NOT NULL,
	`region_code` varchar(4),
	`source_id` bigint,
	`fetched_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `occupation_forecasts_id` PRIMARY KEY(`id`),
	CONSTRAINT `forecast_uq` UNIQUE(`occupation_id`,`horizon`,`year`,`region_code`)
);
--> statement-breakpoint
CREATE TABLE `occupations` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`taxonomy_concept_id` varchar(50),
	`ssyk_code` varchar(10),
	`slug` varchar(120) NOT NULL,
	`name` varchar(200) NOT NULL,
	`description` text,
	`interest_tags` json,
	`source_id` bigint,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`published_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `occupations_id` PRIMARY KEY(`id`),
	CONSTRAINT `occupations_taxonomy_concept_id_unique` UNIQUE(`taxonomy_concept_id`),
	CONSTRAINT `occupations_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `password_resets` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`user_id` bigint NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`used_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `password_resets_id` PRIMARY KEY(`id`),
	CONSTRAINT `password_resets_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `premium_profiles` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`institution_id` bigint,
	`he_program_id` bigint,
	`content` json,
	`lead_webhook_url` varchar(500),
	`lead_email` varchar(255),
	`starts_at` date NOT NULL,
	`ends_at` date NOT NULL,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`published_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `premium_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recommendation_items` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`recommendation_id` bigint NOT NULL,
	`rank` smallint NOT NULL,
	`gy_program_id` bigint,
	`he_program_id` bigint,
	`occupation_id` bigint,
	`motivation` text NOT NULL,
	`facts_snapshot` json NOT NULL,
	`gap_analysis` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recommendation_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recommendations` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`user_id` bigint,
	`interview_id` bigint NOT NULL,
	`profile_id` bigint NOT NULL,
	`status` enum('generating','ready','failed') NOT NULL DEFAULT 'generating',
	`report_data` json,
	`model_used` varchar(60),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recommendations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `school_memberships` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`user_id` bigint NOT NULL,
	`school_id` bigint NOT NULL,
	`role_at_school` enum('student','syv','school_admin') NOT NULL,
	`grade_year` smallint,
	`started_at` date NOT NULL,
	`ended_at` date,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `school_memberships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `schools` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`school_unit_code` varchar(12),
	`name` varchar(200) NOT NULL,
	`municipality_id` bigint NOT NULL,
	`type` enum('grundskola','gymnasieskola','komvux','other') NOT NULL,
	`principal_type` enum('kommunal','fristaende','region','statlig'),
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `schools_id` PRIMARY KEY(`id`),
	CONSTRAINT `schools_school_unit_code_unique` UNIQUE(`school_unit_code`)
);
--> statement-breakpoint
CREATE TABLE `share_grants` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`student_user_id` bigint NOT NULL,
	`kind` enum('syv','guardian_link') NOT NULL,
	`school_id` bigint,
	`link_token_hash` varchar(64),
	`expires_at` timestamp,
	`revoked_at` timestamp,
	`syv_status` enum('new','read','meeting_booked','done') DEFAULT 'new',
	`syv_notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `share_grants_id` PRIMARY KEY(`id`),
	CONSTRAINT `share_grants_link_token_hash_unique` UNIQUE(`link_token_hash`)
);
--> statement-breakpoint
CREATE TABLE `student_profiles` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`user_id` bigint,
	`interview_id` bigint NOT NULL,
	`schema_version` smallint NOT NULL DEFAULT 1,
	`version` smallint NOT NULL DEFAULT 1,
	`data` json NOT NULL,
	`is_current` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `student_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(100) NOT NULL,
	`role` enum('student','syv','school_admin','municipality','admin') NOT NULL DEFAULT 'student',
	`display_name` varchar(100),
	`birth_year` smallint,
	`auth_provider` enum('password','bankid') NOT NULL DEFAULT 'password',
	`identity_verified_at` timestamp,
	`municipality_id` bigint,
	`status` enum('active','blocked','deletion_requested','deleted') NOT NULL DEFAULT 'active',
	`last_login_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `admission_stats` ADD CONSTRAINT `admission_stats_he_program_id_he_programs_id_fk` FOREIGN KEY (`he_program_id`) REFERENCES `he_programs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admission_stats` ADD CONSTRAINT `admission_stats_gy_program_id_gy_programs_id_fk` FOREIGN KEY (`gy_program_id`) REFERENCES `gy_programs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admission_stats` ADD CONSTRAINT `admission_stats_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admission_stats` ADD CONSTRAINT `admission_stats_source_id_data_sources_id_fk` FOREIGN KEY (`source_id`) REFERENCES `data_sources`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `consents` ADD CONSTRAINT `consents_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `data_requests` ADD CONSTRAINT `data_requests_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `education_occupation_links` ADD CONSTRAINT `education_occupation_links_occupation_id_occupations_id_fk` FOREIGN KEY (`occupation_id`) REFERENCES `occupations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `education_occupation_links` ADD CONSTRAINT `education_occupation_links_gy_program_id_gy_programs_id_fk` FOREIGN KEY (`gy_program_id`) REFERENCES `gy_programs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `education_occupation_links` ADD CONSTRAINT `education_occupation_links_he_program_id_he_programs_id_fk` FOREIGN KEY (`he_program_id`) REFERENCES `he_programs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `external_ids` ADD CONSTRAINT `external_ids_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gy_programs` ADD CONSTRAINT `gy_programs_source_id_data_sources_id_fk` FOREIGN KEY (`source_id`) REFERENCES `data_sources`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `handoff_tokens` ADD CONSTRAINT `handoff_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `he_programs` ADD CONSTRAINT `he_programs_institution_id_institutions_id_fk` FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `he_programs` ADD CONSTRAINT `he_programs_source_id_data_sources_id_fk` FOREIGN KEY (`source_id`) REFERENCES `data_sources`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `institutions` ADD CONSTRAINT `institutions_municipality_id_municipalities_id_fk` FOREIGN KEY (`municipality_id`) REFERENCES `municipalities`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `institutions` ADD CONSTRAINT `institutions_source_id_data_sources_id_fk` FOREIGN KEY (`source_id`) REFERENCES `data_sources`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `interview_messages` ADD CONSTRAINT `interview_messages_interview_id_interviews_id_fk` FOREIGN KEY (`interview_id`) REFERENCES `interviews`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `interviews` ADD CONSTRAINT `interviews_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_premium_profile_id_premium_profiles_id_fk` FOREIGN KEY (`premium_profile_id`) REFERENCES `premium_profiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_consent_id_consents_id_fk` FOREIGN KEY (`consent_id`) REFERENCES `consents`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `licenses` ADD CONSTRAINT `licenses_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `licenses` ADD CONSTRAINT `licenses_municipality_id_municipalities_id_fk` FOREIGN KEY (`municipality_id`) REFERENCES `municipalities`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `occupation_forecasts` ADD CONSTRAINT `occupation_forecasts_occupation_id_occupations_id_fk` FOREIGN KEY (`occupation_id`) REFERENCES `occupations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `occupation_forecasts` ADD CONSTRAINT `occupation_forecasts_source_id_data_sources_id_fk` FOREIGN KEY (`source_id`) REFERENCES `data_sources`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `occupations` ADD CONSTRAINT `occupations_source_id_data_sources_id_fk` FOREIGN KEY (`source_id`) REFERENCES `data_sources`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `password_resets` ADD CONSTRAINT `password_resets_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `premium_profiles` ADD CONSTRAINT `premium_profiles_institution_id_institutions_id_fk` FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `premium_profiles` ADD CONSTRAINT `premium_profiles_he_program_id_he_programs_id_fk` FOREIGN KEY (`he_program_id`) REFERENCES `he_programs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recommendation_items` ADD CONSTRAINT `recommendation_items_recommendation_id_recommendations_id_fk` FOREIGN KEY (`recommendation_id`) REFERENCES `recommendations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recommendation_items` ADD CONSTRAINT `recommendation_items_gy_program_id_gy_programs_id_fk` FOREIGN KEY (`gy_program_id`) REFERENCES `gy_programs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recommendation_items` ADD CONSTRAINT `recommendation_items_he_program_id_he_programs_id_fk` FOREIGN KEY (`he_program_id`) REFERENCES `he_programs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recommendation_items` ADD CONSTRAINT `recommendation_items_occupation_id_occupations_id_fk` FOREIGN KEY (`occupation_id`) REFERENCES `occupations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recommendations` ADD CONSTRAINT `recommendations_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recommendations` ADD CONSTRAINT `recommendations_interview_id_interviews_id_fk` FOREIGN KEY (`interview_id`) REFERENCES `interviews`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recommendations` ADD CONSTRAINT `recommendations_profile_id_student_profiles_id_fk` FOREIGN KEY (`profile_id`) REFERENCES `student_profiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_memberships` ADD CONSTRAINT `school_memberships_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_memberships` ADD CONSTRAINT `school_memberships_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `schools` ADD CONSTRAINT `schools_municipality_id_municipalities_id_fk` FOREIGN KEY (`municipality_id`) REFERENCES `municipalities`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `share_grants` ADD CONSTRAINT `share_grants_student_user_id_users_id_fk` FOREIGN KEY (`student_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `share_grants` ADD CONSTRAINT `share_grants_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD CONSTRAINT `student_profiles_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD CONSTRAINT `student_profiles_interview_id_interviews_id_fk` FOREIGN KEY (`interview_id`) REFERENCES `interviews`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_municipality_id_municipalities_id_fk` FOREIGN KEY (`municipality_id`) REFERENCES `municipalities`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `activity_user_idx` ON `activity_log` (`user_id`);--> statement-breakpoint
CREATE INDEX `activity_event_idx` ON `activity_log` (`event`,`created_at`);--> statement-breakpoint
CREATE INDEX `adm_stats_he_idx` ON `admission_stats` (`he_program_id`,`year`);--> statement-breakpoint
CREATE INDEX `adm_stats_gy_idx` ON `admission_stats` (`gy_program_id`,`school_id`,`year`);--> statement-breakpoint
CREATE INDEX `ai_usage_day_idx` ON `ai_usage` (`created_at`);--> statement-breakpoint
CREATE INDEX `ai_usage_user_idx` ON `ai_usage` (`user_id`);--> statement-breakpoint
CREATE INDEX `consents_user_type_idx` ON `consents` (`user_id`,`type`);--> statement-breakpoint
CREATE INDEX `eol_occupation_idx` ON `education_occupation_links` (`occupation_id`);--> statement-breakpoint
CREATE INDEX `gy_programs_status_idx` ON `gy_programs` (`status`);--> statement-breakpoint
CREATE INDEX `he_programs_institution_idx` ON `he_programs` (`institution_id`);--> statement-breakpoint
CREATE INDEX `messages_interview_idx` ON `interview_messages` (`interview_id`);--> statement-breakpoint
CREATE INDEX `interviews_user_idx` ON `interviews` (`user_id`);--> statement-breakpoint
CREATE INDEX `interviews_status_idx` ON `interviews` (`status`);--> statement-breakpoint
CREATE INDEX `leads_profile_idx` ON `leads` (`premium_profile_id`);--> statement-breakpoint
CREATE INDEX `licenses_school_idx` ON `licenses` (`school_id`);--> statement-breakpoint
CREATE INDEX `licenses_municipality_idx` ON `licenses` (`municipality_id`);--> statement-breakpoint
CREATE INDEX `rec_items_rec_idx` ON `recommendation_items` (`recommendation_id`);--> statement-breakpoint
CREATE INDEX `recs_user_idx` ON `recommendations` (`user_id`);--> statement-breakpoint
CREATE INDEX `memberships_user_idx` ON `school_memberships` (`user_id`);--> statement-breakpoint
CREATE INDEX `memberships_school_idx` ON `school_memberships` (`school_id`);--> statement-breakpoint
CREATE INDEX `schools_municipality_idx` ON `schools` (`municipality_id`);--> statement-breakpoint
CREATE INDEX `share_grants_student_idx` ON `share_grants` (`student_user_id`);--> statement-breakpoint
CREATE INDEX `share_grants_school_status_idx` ON `share_grants` (`school_id`,`syv_status`);--> statement-breakpoint
CREATE INDEX `profiles_user_idx` ON `student_profiles` (`user_id`,`is_current`);--> statement-breakpoint
CREATE INDEX `users_role_idx` ON `users` (`role`);