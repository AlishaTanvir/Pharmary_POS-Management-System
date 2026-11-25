CREATE TABLE field_acceptance_events(
 id uuid PRIMARY KEY,sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE NOT NULL,
 branch_id uuid NOT NULL REFERENCES branches,actor_id uuid NOT NULL REFERENCES users,recorder_name text NOT NULL,
 idempotency_key uuid NOT NULL,request_hash text NOT NULL CHECK(length(request_hash)=64),
 drill_key text NOT NULL CHECK(drill_key IN ('PRINTER_80MM','USB_SCANNER','OUTAGE_REPLAY','OFF_DEVICE_RECOVERY','CASHIER_TRAINING','OWNER_REVIEW')),
 status text NOT NULL CHECK(status IN ('PENDING','DEFERRED','FAILED','ATTESTED')),
 evidence text NOT NULL CHECK(length(evidence) BETWEEN 20 AND 2000),
 observed_by text NOT NULL,observed_at timestamptz,environment text NOT NULL,release_version text NOT NULL,
 metrics jsonb NOT NULL CHECK(jsonb_typeof(metrics)='object'),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(branch_id,idempotency_key),
 CHECK(status<>'ATTESTED' OR (length(observed_by)>=2 AND observed_at IS NOT NULL AND length(environment)>=3 AND length(release_version)>=3))
);
CREATE INDEX field_acceptance_branch_history ON field_acceptance_events(branch_id,sequence DESC);
CREATE FUNCTION reject_field_acceptance_change() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'Field acceptance history is append only';END$$;
CREATE TRIGGER field_acceptance_immutable BEFORE UPDATE OR DELETE ON field_acceptance_events FOR EACH ROW EXECUTE FUNCTION reject_field_acceptance_change();
