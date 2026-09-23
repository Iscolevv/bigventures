CREATE TABLE "bigventures"."vehicle_day_notes" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"vehicle_id" text NOT NULL,
	"day" date NOT NULL,
	"note" text NOT NULL,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bigventures"."vehicle_day_notes" ADD CONSTRAINT "vehicle_day_notes_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "bigventures"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."vehicle_day_notes" ADD CONSTRAINT "vehicle_day_notes_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "bigventures"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_day_notes_vehicle_day_key" ON "bigventures"."vehicle_day_notes" USING btree ("vehicle_id","day");