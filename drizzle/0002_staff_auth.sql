CREATE TABLE `staff_accounts` (
	`email` text PRIMARY KEY NOT NULL,
	`password_hash` text NOT NULL,
	`totp_secret_enc` text NOT NULL,
	`totp_last_counter` integer,
	`password_changed_at` text NOT NULL,
	`last_login_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `staff_credential_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`purpose` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text
);
--> statement-breakpoint
CREATE INDEX `staff_credential_tokens_email_idx` ON `staff_credential_tokens` (`email`);--> statement-breakpoint
CREATE TABLE `staff_login_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`window_start` text NOT NULL,
	`failures` integer DEFAULT 0 NOT NULL,
	`locked_until` text
);
--> statement-breakpoint
CREATE TABLE `staff_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`revoked_at` text,
	`ip_hash` text,
	`user_agent` text
);
--> statement-breakpoint
CREATE INDEX `staff_sessions_email_idx` ON `staff_sessions` (`email`);