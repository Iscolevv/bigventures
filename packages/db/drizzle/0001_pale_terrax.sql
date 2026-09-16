ALTER TABLE "bigventures"."fuel_entries" ALTER COLUMN "odometer_km" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bigventures"."trips" ADD COLUMN "load_tonnes" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "bigventures"."trips" ADD COLUMN "load_bales" integer;