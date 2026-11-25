ALTER TABLE medicines ADD COLUMN catalog_version integer NOT NULL DEFAULT 0 CHECK(catalog_version>=0);
UPDATE medicines m SET catalog_version=p.version FROM shared_products p WHERE p.id=m.catalog_id;
