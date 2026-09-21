ALTER TABLE "bigventures"."drops" ADD COLUMN "po_number" text;--> statement-breakpoint
CREATE INDEX "drops_po_number_idx" ON "bigventures"."drops" USING btree ("po_number");