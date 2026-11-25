ALTER TABLE branches ADD COLUMN logo_data text NOT NULL DEFAULT '';
ALTER TABLE sales ADD COLUMN profile_snapshot jsonb;
CREATE TABLE suspended_carts(id uuid PRIMARY KEY,branch_id uuid NOT NULL REFERENCES branches,cashier_id uuid NOT NULL REFERENCES users,label text NOT NULL,payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX suspended_carts_owner ON suspended_carts(branch_id,cashier_id,created_at);
CREATE INDEX sales_branch_local_day ON sales(branch_id,((created_at AT TIME ZONE 'Asia/Karachi')::date));
