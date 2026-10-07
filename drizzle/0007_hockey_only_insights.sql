CREATE TABLE `nhl_insight_cache` (
  `key` text PRIMARY KEY NOT NULL,
  `payload_json` text NOT NULL,
  `fetched_at` integer NOT NULL,
  `expires_at` integer NOT NULL
);
--> statement-breakpoint
DELETE FROM `projections` WHERE `sport` <> 'nhl';
--> statement-breakpoint
DELETE FROM `premium_odds_cache` WHERE `sport` <> 'nhl';
--> statement-breakpoint
DROP TABLE IF EXISTS `league_roster_cache`;
