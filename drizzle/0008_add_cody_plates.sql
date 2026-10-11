CREATE TABLE `cody_plates` (
  `id` text PRIMARY KEY NOT NULL,
  `sport` text NOT NULL,
  `matchup` text NOT NULL,
  `pick` text NOT NULL,
  `note` text,
  `is_public` integer NOT NULL DEFAULT 1,
  `created_at` integer NOT NULL
);
