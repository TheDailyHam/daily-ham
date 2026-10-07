CREATE TABLE `provider_credentials` (
  `provider` text PRIMARY KEY NOT NULL,
  `secret_value` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
