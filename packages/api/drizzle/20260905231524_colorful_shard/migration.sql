CREATE TABLE "settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"group_id" uuid NOT NULL,
	"from_user_id" uuid NOT NULL,
	"to_user_id" uuid NOT NULL,
	"amount_minor" integer NOT NULL,
	"settled_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "settlements_amount_minor_positive" CHECK ("amount_minor" > 0),
	CONSTRAINT "settlements_from_user_id_not_to_user_id" CHECK ("from_user_id" <> "to_user_id")
);
--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD COLUMN "settlement_id" uuid;--> statement-breakpoint
ALTER TABLE "ledger_entries" ALTER COLUMN "expense_id" DROP NOT NULL;--> statement-breakpoint
CREATE INDEX "ledger_entries_settlement_id_idx" ON "ledger_entries" ("settlement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_entries_settlement_id_user_id_used_idx" ON "ledger_entries" ("settlement_id","user_id") WHERE "amount_minor" < 0;--> statement-breakpoint
CREATE INDEX "settlements_group_id_settled_at_idx" ON "settlements" ("group_id","settled_at");--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_settlement_id_settlements_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "settlements"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_group_id_groups_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_from_user_id_users_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_to_user_id_users_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_one_source" CHECK (("expense_id" is null) <> ("settlement_id" is null));