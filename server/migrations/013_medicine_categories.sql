CREATE TABLE medicine_categories(id uuid PRIMARY KEY,branch_id uuid NOT NULL REFERENCES branches,name text NOT NULL,parent_id uuid,revision integer NOT NULL DEFAULT 1 CHECK(revision>0),UNIQUE(branch_id,id),FOREIGN KEY(branch_id,parent_id) REFERENCES medicine_categories(branch_id,id));
CREATE UNIQUE INDEX medicine_categories_sibling_name ON medicine_categories(branch_id,parent_id,lower(name)) NULLS NOT DISTINCT;
ALTER TABLE medicines ADD COLUMN category_id uuid;
ALTER TABLE medicines ADD COLUMN category_revision integer NOT NULL DEFAULT 1 CHECK(category_revision>0);
ALTER TABLE medicines ADD CONSTRAINT medicine_category_branch FOREIGN KEY(branch_id,category_id) REFERENCES medicine_categories(branch_id,id);
CREATE INDEX medicines_branch_category ON medicines(branch_id,category_id);
