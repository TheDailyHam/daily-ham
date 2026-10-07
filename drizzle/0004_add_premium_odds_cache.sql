CREATE TABLE `premium_odds_cache` (
  `sport` text PRIMARY KEY NOT NULL,
  `payload_json` text NOT NULL,
  `fetched_at` integer NOT NULL,
  `expires_at` integer NOT NULL,
  `status` text NOT NULL,
  `message` text NOT NULL
);