-- Capture begins here. Current values are not evidence for earlier periods.
-- Hold writers until the baseline and all capture triggers are installed together.
LOCK TABLE medicine_categories,medicines,batches IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE classification_capture(id boolean PRIMARY KEY DEFAULT true CHECK(id),started_at timestamptz(3) NOT NULL,source_version text NOT NULL);
INSERT INTO classification_capture(started_at,source_version) VALUES(date_trunc('milliseconds',transaction_timestamp()),'0.23.0-dev.1');
CREATE TABLE medicine_classification_history(seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,medicine_id uuid NOT NULL,branch_id uuid NOT NULL REFERENCES branches,recorded_at timestamptz(3) NOT NULL,event_type text NOT NULL CHECK(event_type IN ('BASELINE','INSERT','UPDATE','DELETE')),name text NOT NULL,generic text NOT NULL,form text NOT NULL,active boolean NOT NULL,reorder_level integer NOT NULL,category_id uuid,category_revision integer NOT NULL);
CREATE TABLE category_classification_history(seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,category_id uuid NOT NULL,branch_id uuid NOT NULL REFERENCES branches,recorded_at timestamptz(3) NOT NULL,event_type text NOT NULL CHECK(event_type IN ('BASELINE','INSERT','UPDATE','DELETE')),name text NOT NULL,parent_id uuid,revision integer NOT NULL);
CREATE TABLE batch_lifecycle_history(seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,batch_id uuid NOT NULL,branch_id uuid NOT NULL REFERENCES branches,medicine_id uuid NOT NULL,recorded_at timestamptz(3) NOT NULL,event_type text NOT NULL CHECK(event_type IN ('BASELINE','INSERT','UPDATE','DELETE')),status text NOT NULL,expiry date NOT NULL);
INSERT INTO medicine_classification_history(medicine_id,branch_id,recorded_at,event_type,name,generic,form,active,reorder_level,category_id,category_revision) SELECT m.id,m.branch_id,c.started_at,'BASELINE',m.name,m.generic,m.form,m.active,m.reorder_level,m.category_id,m.category_revision FROM medicines m CROSS JOIN classification_capture c;
INSERT INTO category_classification_history(category_id,branch_id,recorded_at,event_type,name,parent_id,revision) SELECT n.id,n.branch_id,c.started_at,'BASELINE',n.name,n.parent_id,n.revision FROM medicine_categories n CROSS JOIN classification_capture c;
INSERT INTO batch_lifecycle_history(batch_id,branch_id,medicine_id,recorded_at,event_type,status,expiry) SELECT b.id,b.branch_id,b.medicine_id,c.started_at,'BASELINE',b.status,b.expiry FROM batches b CROSS JOIN classification_capture c;
CREATE INDEX medicine_classification_asof ON medicine_classification_history(branch_id,medicine_id,recorded_at DESC,seq DESC);
CREATE INDEX category_classification_asof ON category_classification_history(branch_id,category_id,recorded_at DESC,seq DESC);
CREATE INDEX batch_lifecycle_asof ON batch_lifecycle_history(branch_id,batch_id,recorded_at DESC,seq DESC);
CREATE FUNCTION classification_record_time() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.recorded_at<>date_trunc('milliseconds',transaction_timestamp()) OR NEW.recorded_at<(SELECT started_at FROM classification_capture) OR NEW.event_type='BASELINE' THEN RAISE EXCEPTION 'Classification history uses database transaction time; legacy backdating is not supported';END IF;RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['medicine_classification_history','category_classification_history','batch_lifecycle_history'] LOOP EXECUTE format('CREATE TRIGGER classification_time_guard BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION classification_record_time()',t);END LOOP;FOREACH t IN ARRAY ARRAY['classification_capture','medicine_classification_history','category_classification_history','batch_lifecycle_history'] LOOP EXECUTE format('CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION deny_history_change()',t);END LOOP;END $$;
CREATE FUNCTION capture_medicine_classification() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE m medicines; BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.id<>OLD.id OR NEW.branch_id<>OLD.branch_id THEN RAISE EXCEPTION 'Captured medicine identity cannot move between branches';END IF;
  IF ROW(NEW.name,NEW.generic,NEW.form,NEW.active,NEW.reorder_level,NEW.category_id,NEW.category_revision) IS NOT DISTINCT FROM ROW(OLD.name,OLD.generic,OLD.form,OLD.active,OLD.reorder_level,OLD.category_id,OLD.category_revision) THEN RETURN NEW;END IF;
 END IF;
 IF TG_OP='DELETE' THEN m:=OLD;ELSE m:=NEW;END IF;
 INSERT INTO medicine_classification_history(medicine_id,branch_id,recorded_at,event_type,name,generic,form,active,reorder_level,category_id,category_revision) VALUES(m.id,m.branch_id,date_trunc('milliseconds',transaction_timestamp()),TG_OP,m.name,m.generic,m.form,m.active,m.reorder_level,m.category_id,m.category_revision);RETURN NULL;
END $$;
CREATE FUNCTION capture_category_classification() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE c medicine_categories; BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.id<>OLD.id OR NEW.branch_id<>OLD.branch_id THEN RAISE EXCEPTION 'Captured category identity cannot move between branches';END IF;
  IF ROW(NEW.name,NEW.parent_id,NEW.revision) IS NOT DISTINCT FROM ROW(OLD.name,OLD.parent_id,OLD.revision) THEN RETURN NEW;END IF;
 END IF;
 IF TG_OP='DELETE' THEN c:=OLD;ELSE c:=NEW;END IF;
 INSERT INTO category_classification_history(category_id,branch_id,recorded_at,event_type,name,parent_id,revision) VALUES(c.id,c.branch_id,date_trunc('milliseconds',transaction_timestamp()),TG_OP,c.name,c.parent_id,c.revision);RETURN NULL;
END $$;
CREATE FUNCTION capture_batch_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE b batches; BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.id<>OLD.id OR NEW.branch_id<>OLD.branch_id OR NEW.medicine_id<>OLD.medicine_id THEN RAISE EXCEPTION 'Captured batch identity cannot move';END IF;
  IF ROW(NEW.status,NEW.expiry) IS NOT DISTINCT FROM ROW(OLD.status,OLD.expiry) THEN RETURN NEW;END IF;
 END IF;
 IF TG_OP='DELETE' THEN b:=OLD;ELSE b:=NEW;END IF;
 INSERT INTO batch_lifecycle_history(batch_id,branch_id,medicine_id,recorded_at,event_type,status,expiry) VALUES(b.id,b.branch_id,b.medicine_id,date_trunc('milliseconds',transaction_timestamp()),TG_OP,b.status,b.expiry);RETURN NULL;
END $$;
CREATE TRIGGER capture_classification AFTER INSERT OR UPDATE OR DELETE ON medicines FOR EACH ROW EXECUTE FUNCTION capture_medicine_classification();
CREATE TRIGGER capture_classification AFTER INSERT OR UPDATE OR DELETE ON medicine_categories FOR EACH ROW EXECUTE FUNCTION capture_category_classification();
CREATE TRIGGER capture_lifecycle AFTER INSERT OR UPDATE OR DELETE ON batches FOR EACH ROW EXECUTE FUNCTION capture_batch_lifecycle();
