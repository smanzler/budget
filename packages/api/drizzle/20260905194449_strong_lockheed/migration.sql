CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"group_id" uuid NOT NULL,
	"expense_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"amount_minor" integer NOT NULL
);
--> statement-breakpoint
DROP TABLE "expense_splits";--> statement-breakpoint
CREATE INDEX "ledger_entries_group_id_user_id_idx" ON "ledger_entries" ("group_id","user_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_expense_id_idx" ON "ledger_entries" ("expense_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_entries_expense_id_user_id_used_idx" ON "ledger_entries" ("expense_id","user_id") WHERE "amount_minor" < 0;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_group_id_groups_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_expense_id_expenses_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;