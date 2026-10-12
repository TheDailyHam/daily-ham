CREATE TABLE `usage_daily` (
  `date` text NOT NULL,
  `visitor_hash` text NOT NULL,
  `sport` text NOT NULL,
  `views` integer NOT NULL DEFAULT 1,
  PRIMARY KEY (`date`, `visitor_hash`, `sport`)
);
