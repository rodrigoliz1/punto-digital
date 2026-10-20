CREATE TABLE `prospect_activities` (
	`id` text PRIMARY KEY NOT NULL,
	`prospect_id` text NOT NULL,
	`type` text NOT NULL,
	`occurred_at` text NOT NULL,
	`scheduled_at` text,
	`summary` text NOT NULL,
	`deal_value_mxn` real,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `prospect_activities_prospect_idx` ON `prospect_activities` (`prospect_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `prospect_activities_type_idx` ON `prospect_activities` (`type`,`scheduled_at`);--> statement-breakpoint
CREATE TABLE `prospect_agent_configs` (
	`agent` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`provider` text DEFAULT 'deterministic' NOT NULL,
	`model` text,
	`prompt_version` text DEFAULT 'v1' NOT NULL,
	`settings` text DEFAULT '{}' NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `prospect_api_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`operation` text NOT NULL,
	`units` integer DEFAULT 1 NOT NULL,
	`cost_usd_micros` integer DEFAULT 0 NOT NULL,
	`prospect_id` text,
	`job_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `prospect_api_usage_provider_idx` ON `prospect_api_usage` (`provider`,`created_at`);--> statement-breakpoint
CREATE TABLE `prospect_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`prospect_id` text NOT NULL,
	`brand_audit_id` text,
	`storage_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`prompt` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`synthetic_label` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prospect_assets_key_idx` ON `prospect_assets` (`storage_key`);--> statement-breakpoint
CREATE INDEX `prospect_assets_prospect_idx` ON `prospect_assets` (`prospect_id`);--> statement-breakpoint
CREATE TABLE `prospect_brand_audits` (
	`id` text PRIMARY KEY NOT NULL,
	`prospect_id` text NOT NULL,
	`version` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`sources` text NOT NULL,
	`palette` text NOT NULL,
	`voice` text,
	`logo_license` text DEFAULT 'unknown' NOT NULL,
	`brief` text NOT NULL,
	`claims_to_verify` text DEFAULT '[]' NOT NULL,
	`asset_prompts` text DEFAULT '[]' NOT NULL,
	`generator` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prospect_brand_audits_version_idx` ON `prospect_brand_audits` (`prospect_id`,`version`);--> statement-breakpoint
CREATE TABLE `prospect_campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`city` text,
	`zone` text,
	`category` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`daily_contact_cap` integer DEFAULT 10 NOT NULL,
	`notes` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `prospect_campaigns_status_idx` ON `prospect_campaigns` (`status`);--> statement-breakpoint
CREATE TABLE `prospect_demos` (
	`id` text PRIMARY KEY NOT NULL,
	`prospect_id` text NOT NULL,
	`brand_audit_id` text,
	`version` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`html` text NOT NULL,
	`assets` text DEFAULT '[]' NOT NULL,
	`access_token_hash` text,
	`access_expires_at` text,
	`view_count` integer DEFAULT 0 NOT NULL,
	`last_viewed_at` text,
	`approved_by` text,
	`approved_at` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prospect_demos_version_idx` ON `prospect_demos` (`prospect_id`,`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `prospect_demos_token_idx` ON `prospect_demos` (`access_token_hash`);--> statement-breakpoint
CREATE TABLE `prospect_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`prospect_id` text NOT NULL,
	`kind` text NOT NULL,
	`source_url` text NOT NULL,
	`observed_at` text NOT NULL,
	`data` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `prospect_evidence_prospect_idx` ON `prospect_evidence` (`prospect_id`,`observed_at`);--> statement-breakpoint
CREATE TABLE `prospect_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`agent` text NOT NULL,
	`prospect_id` text,
	`idempotency_key` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`attempts` integer DEFAULT 1 NOT NULL,
	`input` text,
	`output` text,
	`error` text,
	`started_at` text NOT NULL,
	`finished_at` text,
	`created_by` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prospect_jobs_idempotency_idx` ON `prospect_jobs` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `prospect_jobs_agent_idx` ON `prospect_jobs` (`agent`,`started_at`);--> statement-breakpoint
CREATE TABLE `prospect_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`prospect_id` text NOT NULL,
	`campaign_id` text,
	`demo_id` text,
	`channel` text NOT NULL,
	`step` integer DEFAULT 1 NOT NULL,
	`recipient` text NOT NULL,
	`subject` text,
	`body` text NOT NULL,
	`evidence` text DEFAULT '[]' NOT NULL,
	`review` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`idempotency_key` text NOT NULL,
	`approved_by` text,
	`approved_at` text,
	`sent_by` text,
	`sent_at` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prospect_messages_idempotency_idx` ON `prospect_messages` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `prospect_messages_status_idx` ON `prospect_messages` (`status`);--> statement-breakpoint
CREATE INDEX `prospect_messages_prospect_idx` ON `prospect_messages` (`prospect_id`);--> statement-breakpoint
CREATE TABLE `prospect_prospects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`city` text NOT NULL,
	`zone` text,
	`address` text,
	`website` text,
	`website_domain` text,
	`email_public` text,
	`phone_public` text,
	`instagram_url` text,
	`facebook_url` text,
	`tiktok_url` text,
	`google_place_id` text,
	`source` text NOT NULL,
	`source_url` text NOT NULL,
	`source_checked_at` text NOT NULL,
	`places_content_expires_at` text,
	`status` text DEFAULT 'discovered' NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`score_breakdown` text,
	`missing_evidence` text,
	`signals` text DEFAULT '{}' NOT NULL,
	`campaign_id` text,
	`notes` text,
	`dedupe_key` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prospect_prospects_dedupe_idx` ON `prospect_prospects` (`dedupe_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `prospect_prospects_place_idx` ON `prospect_prospects` (`google_place_id`);--> statement-breakpoint
CREATE INDEX `prospect_prospects_status_score_idx` ON `prospect_prospects` (`status`,`score`);--> statement-breakpoint
CREATE INDEX `prospect_prospects_city_category_idx` ON `prospect_prospects` (`city`,`category`);--> statement-breakpoint
CREATE TABLE `prospect_provider_budgets` (
	`provider` text PRIMARY KEY NOT NULL,
	`monthly_limit_usd_cents` integer DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `prospect_suppressions` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`value` text NOT NULL,
	`reason` text NOT NULL,
	`source` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prospect_suppressions_value_idx` ON `prospect_suppressions` (`kind`,`value`);--> statement-breakpoint
CREATE TABLE `prospect_team` (
	`email` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`added_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
