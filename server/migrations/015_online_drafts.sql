CREATE TABLE online_cart_drafts(
 id uuid PRIMARY KEY,
 branch_id uuid NOT NULL REFERENCES branches,
 cashier_id uuid NOT NULL REFERENCES users,
 revision integer NOT NULL CHECK(revision>0),
 state jsonb NOT NULL,
 request_hash text NOT NULL,
 discarded boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX online_drafts_owner ON online_cart_drafts(branch_id,cashier_id,updated_at);
