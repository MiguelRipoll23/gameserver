ALTER TABLE "anticheat_rules" RENAME TO "anti_cheat_rules";
--> statement-breakpoint
ALTER TABLE "anticheat_definitions" RENAME TO "anti_cheat_definitions";
--> statement-breakpoint
ALTER TYPE "anticheat_rule_action" RENAME TO "anti_cheat_rule_action";
--> statement-breakpoint
ALTER INDEX "anticheat_definitions_unique_entry" RENAME TO "anti_cheat_definitions_unique_entry";
--> statement-breakpoint
ALTER TABLE "anti_cheat_rules" RENAME CONSTRAINT "anticheat_rules_pkey" TO "anti_cheat_rules_pkey";
--> statement-breakpoint
ALTER TABLE "anti_cheat_rules" RENAME CONSTRAINT "anticheat_rules_rule_id_key" TO "anti_cheat_rules_rule_id_key";
--> statement-breakpoint
ALTER TABLE "anti_cheat_definitions" RENAME CONSTRAINT "anticheat_definitions_pkey" TO "anti_cheat_definitions_pkey";
--> statement-breakpoint
ALTER SEQUENCE "anticheat_definitions_id_seq" RENAME TO "anti_cheat_definitions_id_seq";
