CREATE TABLE offline_devices(id uuid PRIMARY KEY, branch_id uuid NOT NULL REFERENCES branches, user_id uuid NOT NULL REFERENCES users, shift_id uuid NOT NULL REFERENCES shifts, name text NOT NULL, secret_hash text NOT NULL, snapshot jsonb NOT NULL, issued_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL, status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','FINISHED')));
CREATE UNIQUE INDEX one_offline_grant_per_shift ON offline_devices(shift_id) WHERE status='ACTIVE';
CREATE TABLE offline_reservations(device_id uuid NOT NULL REFERENCES offline_devices, batch_id uuid NOT NULL REFERENCES batches, allocated integer NOT NULL CHECK(allocated>0), remaining integer NOT NULL CHECK(remaining>=0 AND remaining<=allocated), PRIMARY KEY(device_id,batch_id));
CREATE INDEX reservations_batch ON offline_reservations(batch_id);
CREATE TABLE sync_events(event_id uuid PRIMARY KEY, device_id uuid NOT NULL REFERENCES offline_devices, payload_hash text NOT NULL, status text NOT NULL CHECK(status IN ('ACCEPTED','CONFLICT')), sale_id uuid REFERENCES sales, message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE sales ADD COLUMN offline_device_id uuid REFERENCES offline_devices;
CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON sync_events FOR EACH ROW EXECUTE FUNCTION deny_history_change();
