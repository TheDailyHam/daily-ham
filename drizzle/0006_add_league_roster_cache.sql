CREATE TABLE `league_roster_cache` (
  `sport` text PRIMARY KEY NOT NULL,
  `payload_json` text NOT NULL,
  `fetched_at` integer NOT NULL,
  `expires_at` integer NOT NULL
);
