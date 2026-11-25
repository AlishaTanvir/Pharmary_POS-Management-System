ALTER TABLE suppliers ADD COLUMN contact_name text NOT NULL DEFAULT '';
ALTER TABLE suppliers ADD COLUMN email text NOT NULL DEFAULT '';
ALTER TABLE suppliers ADD COLUMN address text NOT NULL DEFAULT '';
ALTER TABLE suppliers ADD COLUMN registration_number text NOT NULL DEFAULT '';
ALTER TABLE suppliers ADD COLUMN tax_identifier text NOT NULL DEFAULT '';
ALTER TABLE suppliers ADD COLUMN notes text NOT NULL DEFAULT '';
ALTER TABLE suppliers ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK(revision>0);
CREATE INDEX suppliers_branch_name ON suppliers(branch_id,name,id);
