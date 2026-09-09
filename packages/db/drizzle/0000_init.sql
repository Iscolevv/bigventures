CREATE TABLE "bigventures"."account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp,
	"refreshTokenExpiresAt" timestamp,
	"scope" text,
	"password" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bigventures"."session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "bigventures"."user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"phone" text,
	"role" text DEFAULT 'driver' NOT NULL,
	"status" text DEFAULT 'invited' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "bigventures"."verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bigventures"."drivers" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"national_id" text,
	"license_number" text,
	"license_expiry" date,
	"date_joined" date,
	"base_salary" numeric(14, 2) DEFAULT '0' NOT NULL,
	"advance_balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"loss_balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "drivers_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "bigventures"."vehicle_assignments" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"vehicle_id" text NOT NULL,
	"driver_id" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"assigned_by" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bigventures"."vehicles" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"registration" text NOT NULL,
	"make" text,
	"model" text,
	"year" integer,
	"vehicle_type" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"odometer_km" numeric(12, 1) DEFAULT '0' NOT NULL,
	"acquisition_date" date,
	"acquisition_cost" numeric(14, 2),
	"monthly_finance_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"last_service_odometer_km" numeric(12, 1),
	"next_service_due_km" numeric(12, 1),
	"next_service_due_date" date,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vehicles_registration_unique" UNIQUE("registration")
);
--> statement-breakpoint
CREATE TABLE "bigventures"."drops" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"trip_id" text NOT NULL,
	"sequence" integer NOT NULL,
	"destination_address" text NOT NULL,
	"dest_lat" double precision,
	"dest_lng" double precision,
	"geofence_radius_m" integer DEFAULT 120 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"signee_name" text,
	"issue_category" text,
	"issue_notes" text,
	"notes" text,
	"arrived_at" timestamp,
	"completed_at" timestamp,
	"geofence_entered_at" timestamp,
	"geofence_skipped" boolean DEFAULT false NOT NULL,
	"client_uuid" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "drops_client_uuid_unique" UNIQUE("client_uuid")
);
--> statement-breakpoint
CREATE TABLE "bigventures"."pod_photos" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"drop_id" text NOT NULL,
	"storage_key" text NOT NULL,
	"thumbnail_key" text,
	"captured_lat" double precision,
	"captured_lng" double precision,
	"captured_at" timestamp NOT NULL,
	"device_timestamp" timestamp,
	"sha256" text,
	"file_size" integer,
	"mime_type" text,
	"source" text DEFAULT 'camera' NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"client_uuid" text,
	CONSTRAINT "pod_photos_client_uuid_unique" UNIQUE("client_uuid")
);
--> statement-breakpoint
CREATE TABLE "bigventures"."routes" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"name" text NOT NULL,
	"origin_label" text NOT NULL,
	"origin_lat" double precision,
	"origin_lng" double precision,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bigventures"."trail_segments" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"trip_id" text NOT NULL,
	"points" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"point_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp,
	"ended_at" timestamp,
	"client_uuid" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trail_segments_client_uuid_unique" UNIQUE("client_uuid")
);
--> statement-breakpoint
CREATE TABLE "bigventures"."trip_deviations" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"trip_id" text NOT NULL,
	"type" text NOT NULL,
	"detected_at" timestamp NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"detail" jsonb,
	"reviewed" boolean DEFAULT false NOT NULL,
	"reviewed_by" text,
	"review_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bigventures"."trips" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"reference_code" text NOT NULL,
	"vehicle_id" text NOT NULL,
	"driver_id" text NOT NULL,
	"route_id" text,
	"route_key" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"loading_point_address" text NOT NULL,
	"loading_lat" double precision,
	"loading_lng" double precision,
	"planned_distance_m" integer,
	"planned_duration_s" integer,
	"planned_polyline" text,
	"started_at" timestamp,
	"ended_at" timestamp,
	"start_odometer_km" numeric(12, 1),
	"end_odometer_km" numeric(12, 1),
	"actual_distance_m" integer,
	"cargo_description" text,
	"client_id" text,
	"client_ref" text,
	"notes" text,
	"source" text DEFAULT 'mobile' NOT NULL,
	"device_id" text,
	"client_uuid" text,
	"created_by" text,
	"synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trips_reference_code_unique" UNIQUE("reference_code"),
	CONSTRAINT "trips_client_uuid_unique" UNIQUE("client_uuid")
);
--> statement-breakpoint
CREATE TABLE "bigventures"."vehicle_check_items" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"check_id" text NOT NULL,
	"item_key" text NOT NULL,
	"result" text NOT NULL,
	"value" text,
	"photo_key" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "bigventures"."vehicle_checks" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"trip_id" text,
	"vehicle_id" text NOT NULL,
	"driver_id" text NOT NULL,
	"performed_at" timestamp NOT NULL,
	"overall_result" text NOT NULL,
	"odometer_km" numeric(12, 1),
	"overridden_by" text,
	"override_reason" text,
	"notes" text,
	"client_uuid" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_checks_client_uuid_unique" UNIQUE("client_uuid")
);
--> statement-breakpoint
CREATE TABLE "bigventures"."advances" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"driver_id" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"direction" text NOT NULL,
	"issued_at" date NOT NULL,
	"method" text,
	"reference" text,
	"description" text,
	"trip_id" text,
	"payroll_run_id" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bigventures"."client_rates" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"client_id" text NOT NULL,
	"route_id" text,
	"vehicle_type" text,
	"rate_type" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bigventures"."clients" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"name" text NOT NULL,
	"contact_name" text,
	"phone" text,
	"email" text,
	"address" text,
	"payment_terms_days" integer DEFAULT 30 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bigventures"."cost_entries" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"vehicle_id" text,
	"driver_id" text,
	"trip_id" text,
	"category" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"incurred_at" date NOT NULL,
	"description" text,
	"vendor" text,
	"receipt_photo_key" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_by" text,
	"approved_at" timestamp,
	"source" text DEFAULT 'dashboard' NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bigventures"."fuel_entries" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"vehicle_id" text NOT NULL,
	"driver_id" text,
	"trip_id" text,
	"litres" numeric(10, 2) NOT NULL,
	"unit_price" numeric(10, 2),
	"total_cost" numeric(14, 2) NOT NULL,
	"odometer_km" numeric(12, 1) NOT NULL,
	"station" text,
	"receipt_photo_key" text,
	"filled_at" timestamp NOT NULL,
	"device_timestamp" timestamp,
	"source" text DEFAULT 'mobile' NOT NULL,
	"created_by" text,
	"client_uuid" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fuel_entries_client_uuid_unique" UNIQUE("client_uuid")
);
--> statement-breakpoint
CREATE TABLE "bigventures"."incentive_rules" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"config" jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bigventures"."invoice_lines" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"invoice_id" text NOT NULL,
	"trip_id" text,
	"drop_id" text,
	"description" text NOT NULL,
	"quantity" numeric(10, 2) DEFAULT '1' NOT NULL,
	"unit_amount" numeric(14, 2) NOT NULL,
	"line_total" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bigventures"."invoices" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"invoice_number" text NOT NULL,
	"client_id" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"issue_date" date,
	"due_date" date,
	"subtotal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"tax" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"amount_paid" numeric(14, 2) DEFAULT '0' NOT NULL,
	"has_unresolved_issues" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "bigventures"."payments" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"invoice_id" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"paid_at" date NOT NULL,
	"method" text,
	"reference" text,
	"recorded_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bigventures"."payroll_runs" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"driver_id" text NOT NULL,
	"period_key" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"trip_count" integer DEFAULT 0 NOT NULL,
	"base_salary" numeric(14, 2) NOT NULL,
	"incentive_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"incentive_rule_id" text,
	"quality_score" numeric(5, 4),
	"advance_deduction" numeric(14, 2) DEFAULT '0' NOT NULL,
	"loss_deduction" numeric(14, 2) DEFAULT '0' NOT NULL,
	"net_pay" numeric(14, 2) NOT NULL,
	"breakdown" jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"approved_by" text,
	"approved_at" timestamp,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bigventures"."quality_snapshots" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"driver_id" text NOT NULL,
	"period_key" text NOT NULL,
	"on_time_pct" numeric(5, 4),
	"damage_free_pct" numeric(5, 4),
	"check_compliance_pct" numeric(5, 4),
	"pod_compliance_pct" numeric(5, 4),
	"at_fault_incidents" integer DEFAULT 0 NOT NULL,
	"composite_score" numeric(5, 4) NOT NULL,
	"computed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bigventures"."documents" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"owner_type" text NOT NULL,
	"owner_id" text,
	"doc_type" text NOT NULL,
	"title" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text,
	"file_size" integer,
	"issue_date" date,
	"expiry_date" date,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"review_notes" text,
	"uploaded_by" text,
	"uploaded_by_role" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bigventures"."alerts" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"type" text NOT NULL,
	"severity" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"title" text NOT NULL,
	"detail" jsonb,
	"dedupe_key" text,
	"raised_at" timestamp DEFAULT now() NOT NULL,
	"acknowledged_by" text,
	"acknowledged_at" timestamp,
	"resolved_by" text,
	"resolved_at" timestamp,
	"resolution_notes" text
);
--> statement-breakpoint
CREATE TABLE "bigventures"."audit_log" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"actor_id" text,
	"actor_role" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"source" text,
	"ip" text,
	"user_agent" text,
	"at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bigventures"."devices" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"device_id" text NOT NULL,
	"driver_id" text,
	"platform" text,
	"model" text,
	"app_version" text,
	"push_token" text,
	"last_seen_at" timestamp,
	"registered_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "devices_device_id_unique" UNIQUE("device_id")
);
--> statement-breakpoint
CREATE TABLE "bigventures"."settings" (
	"key" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"company_name" text DEFAULT 'Big Ventures' NOT NULL,
	"company_kra_pin" text,
	"invoice_tax_pct" text DEFAULT '0' NOT NULL,
	"invoice_prefix" text DEFAULT 'BV' NOT NULL,
	"trip_prefix" text DEFAULT 'TRP' NOT NULL,
	"active_incentive_rule_id" text,
	"updated_by" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "bigventures"."sync_batches" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"batch_id" text NOT NULL,
	"device_id" text NOT NULL,
	"driver_id" text,
	"app_version" text,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"status" text NOT NULL,
	"summary" jsonb,
	"conflicts" jsonb,
	"rejected" jsonb,
	CONSTRAINT "sync_batches_batch_id_unique" UNIQUE("batch_id")
);
--> statement-breakpoint
ALTER TABLE "bigventures"."account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "bigventures"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "bigventures"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."drivers" ADD CONSTRAINT "drivers_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "bigventures"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."vehicle_assignments" ADD CONSTRAINT "vehicle_assignments_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "bigventures"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."vehicle_assignments" ADD CONSTRAINT "vehicle_assignments_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "bigventures"."drivers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."vehicle_assignments" ADD CONSTRAINT "vehicle_assignments_assigned_by_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "bigventures"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."drops" ADD CONSTRAINT "drops_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "bigventures"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."pod_photos" ADD CONSTRAINT "pod_photos_drop_id_drops_id_fk" FOREIGN KEY ("drop_id") REFERENCES "bigventures"."drops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."trail_segments" ADD CONSTRAINT "trail_segments_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "bigventures"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."trip_deviations" ADD CONSTRAINT "trip_deviations_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "bigventures"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."trip_deviations" ADD CONSTRAINT "trip_deviations_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "bigventures"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."trips" ADD CONSTRAINT "trips_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "bigventures"."vehicles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."trips" ADD CONSTRAINT "trips_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "bigventures"."drivers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."trips" ADD CONSTRAINT "trips_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "bigventures"."routes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."trips" ADD CONSTRAINT "trips_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "bigventures"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."vehicle_check_items" ADD CONSTRAINT "vehicle_check_items_check_id_vehicle_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "bigventures"."vehicle_checks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."vehicle_checks" ADD CONSTRAINT "vehicle_checks_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "bigventures"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."vehicle_checks" ADD CONSTRAINT "vehicle_checks_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "bigventures"."vehicles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."vehicle_checks" ADD CONSTRAINT "vehicle_checks_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "bigventures"."drivers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."vehicle_checks" ADD CONSTRAINT "vehicle_checks_overridden_by_user_id_fk" FOREIGN KEY ("overridden_by") REFERENCES "bigventures"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."advances" ADD CONSTRAINT "advances_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "bigventures"."drivers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."advances" ADD CONSTRAINT "advances_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "bigventures"."trips"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."advances" ADD CONSTRAINT "advances_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "bigventures"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."client_rates" ADD CONSTRAINT "client_rates_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "bigventures"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."cost_entries" ADD CONSTRAINT "cost_entries_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "bigventures"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."cost_entries" ADD CONSTRAINT "cost_entries_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "bigventures"."drivers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."cost_entries" ADD CONSTRAINT "cost_entries_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "bigventures"."trips"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."cost_entries" ADD CONSTRAINT "cost_entries_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "bigventures"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."cost_entries" ADD CONSTRAINT "cost_entries_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "bigventures"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."fuel_entries" ADD CONSTRAINT "fuel_entries_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "bigventures"."vehicles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."fuel_entries" ADD CONSTRAINT "fuel_entries_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "bigventures"."drivers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."fuel_entries" ADD CONSTRAINT "fuel_entries_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "bigventures"."trips"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."fuel_entries" ADD CONSTRAINT "fuel_entries_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "bigventures"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."incentive_rules" ADD CONSTRAINT "incentive_rules_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "bigventures"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "bigventures"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."invoice_lines" ADD CONSTRAINT "invoice_lines_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "bigventures"."trips"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."invoice_lines" ADD CONSTRAINT "invoice_lines_drop_id_drops_id_fk" FOREIGN KEY ("drop_id") REFERENCES "bigventures"."drops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "bigventures"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."invoices" ADD CONSTRAINT "invoices_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "bigventures"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "bigventures"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."payments" ADD CONSTRAINT "payments_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "bigventures"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."payroll_runs" ADD CONSTRAINT "payroll_runs_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "bigventures"."drivers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."payroll_runs" ADD CONSTRAINT "payroll_runs_incentive_rule_id_incentive_rules_id_fk" FOREIGN KEY ("incentive_rule_id") REFERENCES "bigventures"."incentive_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."payroll_runs" ADD CONSTRAINT "payroll_runs_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "bigventures"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."quality_snapshots" ADD CONSTRAINT "quality_snapshots_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "bigventures"."drivers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."documents" ADD CONSTRAINT "documents_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "bigventures"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."documents" ADD CONSTRAINT "documents_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "bigventures"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."alerts" ADD CONSTRAINT "alerts_acknowledged_by_user_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "bigventures"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."alerts" ADD CONSTRAINT "alerts_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "bigventures"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."audit_log" ADD CONSTRAINT "audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "bigventures"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."devices" ADD CONSTRAINT "devices_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "bigventures"."drivers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."settings" ADD CONSTRAINT "settings_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "bigventures"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigventures"."sync_batches" ADD CONSTRAINT "sync_batches_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "bigventures"."drivers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "drivers_status_idx" ON "bigventures"."drivers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "vehicle_assignments_vehicle_idx" ON "bigventures"."vehicle_assignments" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "vehicle_assignments_driver_idx" ON "bigventures"."vehicle_assignments" USING btree ("driver_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_assignments_open_per_vehicle" ON "bigventures"."vehicle_assignments" USING btree ("vehicle_id") WHERE "bigventures"."vehicle_assignments"."end_date" is null;--> statement-breakpoint
CREATE INDEX "vehicles_status_idx" ON "bigventures"."vehicles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "drops_trip_idx" ON "bigventures"."drops" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "drops_status_idx" ON "bigventures"."drops" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "drops_trip_sequence_key" ON "bigventures"."drops" USING btree ("trip_id","sequence");--> statement-breakpoint
CREATE INDEX "pod_photos_drop_idx" ON "bigventures"."pod_photos" USING btree ("drop_id");--> statement-breakpoint
CREATE INDEX "trail_segments_trip_idx" ON "bigventures"."trail_segments" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "trip_deviations_trip_idx" ON "bigventures"."trip_deviations" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "trip_deviations_reviewed_idx" ON "bigventures"."trip_deviations" USING btree ("reviewed");--> statement-breakpoint
CREATE INDEX "trips_vehicle_idx" ON "bigventures"."trips" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "trips_driver_idx" ON "bigventures"."trips" USING btree ("driver_id");--> statement-breakpoint
CREATE INDEX "trips_status_idx" ON "bigventures"."trips" USING btree ("status");--> statement-breakpoint
CREATE INDEX "trips_started_at_idx" ON "bigventures"."trips" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "trips_route_key_idx" ON "bigventures"."trips" USING btree ("route_key");--> statement-breakpoint
CREATE INDEX "vehicle_check_items_check_idx" ON "bigventures"."vehicle_check_items" USING btree ("check_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_check_items_check_key" ON "bigventures"."vehicle_check_items" USING btree ("check_id","item_key");--> statement-breakpoint
CREATE INDEX "vehicle_checks_trip_idx" ON "bigventures"."vehicle_checks" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "vehicle_checks_vehicle_idx" ON "bigventures"."vehicle_checks" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "advances_driver_idx" ON "bigventures"."advances" USING btree ("driver_id");--> statement-breakpoint
CREATE INDEX "advances_issued_at_idx" ON "bigventures"."advances" USING btree ("issued_at");--> statement-breakpoint
CREATE INDEX "client_rates_client_idx" ON "bigventures"."client_rates" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "cost_entries_vehicle_idx" ON "bigventures"."cost_entries" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "cost_entries_driver_idx" ON "bigventures"."cost_entries" USING btree ("driver_id");--> statement-breakpoint
CREATE INDEX "cost_entries_category_idx" ON "bigventures"."cost_entries" USING btree ("category");--> statement-breakpoint
CREATE INDEX "cost_entries_incurred_at_idx" ON "bigventures"."cost_entries" USING btree ("incurred_at");--> statement-breakpoint
CREATE INDEX "fuel_entries_vehicle_idx" ON "bigventures"."fuel_entries" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "fuel_entries_filled_at_idx" ON "bigventures"."fuel_entries" USING btree ("filled_at");--> statement-breakpoint
CREATE INDEX "fuel_entries_trip_idx" ON "bigventures"."fuel_entries" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "invoice_lines_invoice_idx" ON "bigventures"."invoice_lines" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_lines_trip_idx" ON "bigventures"."invoice_lines" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "invoices_client_idx" ON "bigventures"."invoices" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "bigventures"."invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoices_due_date_idx" ON "bigventures"."invoices" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "payments_invoice_idx" ON "bigventures"."payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_runs_driver_period_key" ON "bigventures"."payroll_runs" USING btree ("driver_id","period_key");--> statement-breakpoint
CREATE UNIQUE INDEX "quality_snapshots_driver_period_key" ON "bigventures"."quality_snapshots" USING btree ("driver_id","period_key");--> statement-breakpoint
CREATE INDEX "documents_owner_idx" ON "bigventures"."documents" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "documents_expiry_idx" ON "bigventures"."documents" USING btree ("expiry_date");--> statement-breakpoint
CREATE INDEX "documents_status_idx" ON "bigventures"."documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "alerts_status_idx" ON "bigventures"."alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "alerts_type_idx" ON "bigventures"."alerts" USING btree ("type");--> statement-breakpoint
CREATE INDEX "alerts_entity_idx" ON "bigventures"."alerts" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "alerts_open_dedupe_key" ON "bigventures"."alerts" USING btree ("dedupe_key") WHERE "bigventures"."alerts"."dedupe_key" is not null and "bigventures"."alerts"."status" in ('open','acknowledged');--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "bigventures"."audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "bigventures"."audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_log_at_idx" ON "bigventures"."audit_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "devices_driver_idx" ON "bigventures"."devices" USING btree ("driver_id");--> statement-breakpoint
CREATE INDEX "sync_batches_device_idx" ON "bigventures"."sync_batches" USING btree ("device_id");