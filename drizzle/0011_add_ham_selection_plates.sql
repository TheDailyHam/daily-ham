CREATE TABLE `ham_selection_plates` (
  `slug` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `tier_label` text NOT NULL,
  `tier_odds` text NOT NULL,
  `image_data` text,
  `description` text,
  `sort_order` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `ham_selection_plates` (`slug`, `name`, `tier_label`, `tier_odds`, `image_data`, `description`, `sort_order`, `updated_at`) VALUES
  ('bellota', 'Jamón Ibérico de Bellota', 'Highest tier', '+1500', NULL, 'The top shelf — long-shot picks starting at +1500 odds.', 1, 0),
  ('parma', 'Prosciutto di Parma', 'Medium tier', '+900', NULL, 'The middle cut — value picks starting at +900 odds.', 2, 0),
  ('san-daniele', 'Prosciutto di San Daniele', 'Low tier', '+500', NULL, 'The everyday plate — picks starting at +500 odds.', 3, 0);
