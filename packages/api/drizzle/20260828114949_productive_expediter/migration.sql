CREATE TABLE "expense_splits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"expense_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"amount_minor" integer NOT NULL,
	CONSTRAINT "expense_splits_expense_id_user_id_unique" UNIQUE("expense_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"group_id" uuid NOT NULL,
	"description" text NOT NULL,
	"total_minor" integer NOT NULL,
	"paid_by_user_id" uuid NOT NULL,
	"spent_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "expense_splits_user_id_idx" ON "expense_splits" ("user_id");--> statement-breakpoint
CREATE INDEX "expenses_group_id_spent_at_idx" ON "expenses" ("group_id","spent_at");--> statement-breakpoint
ALTER TABLE "expense_splits" ADD CONSTRAINT "expense_splits_expense_id_expenses_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "expense_splits" ADD CONSTRAINT "expense_splits_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_group_id_groups_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_paid_by_user_id_users_id_fkey" FOREIGN KEY ("paid_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;