ALTER TABLE "bigventures"."trips" ADD COLUMN "billed_amount" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "bigventures"."clients" ADD COLUMN "default_trip_rate" numeric(14, 2);