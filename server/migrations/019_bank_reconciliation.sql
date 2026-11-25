INSERT INTO accounts(code,name,type) VALUES('6100','Bank charges','EXPENSE'),('7100','Bank interest income','REVENUE');
CREATE TABLE bank_statements(id uuid PRIMARY KEY,branch_id uuid NOT NULL REFERENCES branches,bank_label text NOT NULL,reference text NOT NULL,from_date date NOT NULL,to_date date NOT NULL,opening_paisa bigint NOT NULL,closing_paisa bigint NOT NULL,csv_text text NOT NULL,source_sha256 text NOT NULL,reason text NOT NULL,actor_id uuid NOT NULL REFERENCES users,idempotency_key uuid NOT NULL,request_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(branch_id,idempotency_key),UNIQUE(branch_id,reference),CHECK(from_date<=to_date),CHECK(abs(opening_paisa)<=100000000000000 AND abs(closing_paisa)<=100000000000000),CHECK(source_sha256=encode(sha256(convert_to(csv_text,'UTF8')),'hex')));
CREATE TABLE bank_statement_lines(id uuid PRIMARY KEY,statement_id uuid NOT NULL REFERENCES bank_statements,line_no integer NOT NULL CHECK(line_no BETWEEN 1 AND 1000),transaction_date date NOT NULL,reference text NOT NULL,description text NOT NULL,amount_paisa bigint NOT NULL CHECK(amount_paisa<>0 AND abs(amount_paisa)<=100000000000),UNIQUE(statement_id,line_no));
CREATE TABLE bank_matches(id uuid PRIMARY KEY,branch_id uuid NOT NULL REFERENCES branches,statement_id uuid NOT NULL REFERENCES bank_statements,statement_line_id uuid REFERENCES bank_statement_lines,reason text NOT NULL,actor_id uuid NOT NULL REFERENCES users,idempotency_key uuid NOT NULL,request_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(branch_id,idempotency_key));
CREATE TABLE bank_match_lines(match_id uuid NOT NULL REFERENCES bank_matches,journal_line_id uuid NOT NULL REFERENCES journal_lines,PRIMARY KEY(match_id,journal_line_id));
CREATE TABLE bank_match_releases(id uuid PRIMARY KEY,branch_id uuid NOT NULL REFERENCES branches,match_id uuid NOT NULL UNIQUE REFERENCES bank_matches,reason text NOT NULL,actor_id uuid NOT NULL REFERENCES users,idempotency_key uuid NOT NULL,request_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(branch_id,idempotency_key));
CREATE VIEW bank_active_matches AS SELECT m.* FROM bank_matches m WHERE NOT EXISTS(SELECT 1 FROM bank_match_releases r WHERE r.match_id=m.id);
CREATE TABLE bank_adjustments(id uuid PRIMARY KEY,branch_id uuid NOT NULL REFERENCES branches,statement_id uuid NOT NULL REFERENCES bank_statements,statement_line_id uuid NOT NULL UNIQUE REFERENCES bank_statement_lines,posting_date date NOT NULL,amount_paisa bigint NOT NULL CHECK(amount_paisa<>0),offset_account text NOT NULL REFERENCES accounts CHECK(offset_account IN ('1010','1020','6100','7100')),reason text NOT NULL,actor_id uuid NOT NULL REFERENCES users,idempotency_key uuid NOT NULL,request_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(branch_id,idempotency_key));
CREATE TABLE bank_closings(id uuid PRIMARY KEY,branch_id uuid NOT NULL REFERENCES branches,statement_id uuid NOT NULL UNIQUE REFERENCES bank_statements,through_date date NOT NULL,book_balance_paisa bigint NOT NULL,outstanding_book_paisa bigint NOT NULL,evidence_text text NOT NULL,evidence_sha256 text NOT NULL,reason text NOT NULL,actor_id uuid NOT NULL REFERENCES users,idempotency_key uuid NOT NULL,request_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(branch_id,idempotency_key),CHECK(evidence_sha256=encode(sha256(convert_to(evidence_text,'UTF8')),'hex')));
CREATE TABLE bank_cancellations(id uuid PRIMARY KEY,branch_id uuid NOT NULL REFERENCES branches,statement_id uuid NOT NULL UNIQUE REFERENCES bank_statements,reason text NOT NULL,actor_id uuid NOT NULL REFERENCES users,idempotency_key uuid NOT NULL,request_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(branch_id,idempotency_key));
CREATE INDEX bank_statements_period ON bank_statements(branch_id,to_date);
CREATE INDEX bank_match_books ON bank_match_lines(journal_line_id);
CREATE FUNCTION bank_lock(b uuid) RETURNS void LANGUAGE sql AS $$ SELECT pg_advisory_xact_lock(hashtextextended('bank-reconciliation:'||b::text,0)) $$;
CREATE FUNCTION bank_assert_open(sid uuid,bid uuid) RETURNS bank_statements LANGUAGE plpgsql AS $$ DECLARE s bank_statements; BEGIN
 PERFORM bank_lock(bid);SELECT * INTO s FROM bank_statements WHERE id=sid AND branch_id=bid;
 IF s.id IS NULL OR EXISTS(SELECT 1 FROM bank_closings WHERE statement_id=sid) OR EXISTS(SELECT 1 FROM bank_cancellations WHERE statement_id=sid) THEN RAISE EXCEPTION 'Bank statement is not open in this branch'; END IF;RETURN s;
END $$;
CREATE FUNCTION bank_statement_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE last_s bank_statements; last_day date; before_balance numeric; BEGIN
 PERFORM bank_lock(NEW.branch_id);
 IF NEW.to_date>(now() AT TIME ZONE 'Asia/Karachi')::date THEN RAISE EXCEPTION 'Statement cannot end in the future'; END IF;
 IF EXISTS(SELECT 1 FROM bank_statements s WHERE s.branch_id=NEW.branch_id AND NOT EXISTS(SELECT 1 FROM bank_closings c WHERE c.statement_id=s.id) AND NOT EXISTS(SELECT 1 FROM bank_cancellations c WHERE c.statement_id=s.id)) THEN RAISE EXCEPTION 'Finish or cancel the open bank statement first'; END IF;
 SELECT s.* INTO last_s FROM bank_statements s JOIN bank_closings c ON c.statement_id=s.id WHERE s.branch_id=NEW.branch_id ORDER BY c.through_date DESC LIMIT 1;
 IF last_s.id IS NOT NULL THEN
  IF NEW.from_date<>last_s.to_date+1 OR NEW.opening_paisa<>last_s.closing_paisa OR NEW.bank_label<>last_s.bank_label THEN RAISE EXCEPTION 'Statement must continue the closed bank label, dates and balance'; END IF;
 ELSE
  SELECT COALESCE(sum(l.debit_paisa-l.credit_paisa),0) INTO before_balance FROM journal_lines l JOIN journals j ON j.id=l.journal_id WHERE j.branch_id=NEW.branch_id AND l.account_code='1030' AND j.posting_date<NEW.from_date;
  IF before_balance<>NEW.opening_paisa THEN RAISE EXCEPTION 'First statement opening must equal the posted bank opening balance'; END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER bank_statement_valid BEFORE INSERT ON bank_statements FOR EACH ROW EXECUTE FUNCTION bank_statement_guard();
CREATE FUNCTION bank_statement_totals() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE s bank_statements; sid uuid; n int; amount numeric; BEGIN
 IF TG_TABLE_NAME='bank_statements' THEN sid:=NEW.id;ELSE sid:=NEW.statement_id;END IF;
 SELECT * INTO s FROM bank_statements WHERE id=sid;SELECT count(*),COALESCE(sum(amount_paisa),0) INTO n,amount FROM bank_statement_lines WHERE statement_id=sid;
 IF n>1000 OR s.opening_paisa+amount<>s.closing_paisa OR EXISTS(SELECT 1 FROM bank_statement_lines WHERE statement_id=sid AND transaction_date NOT BETWEEN s.from_date AND s.to_date) THEN RAISE EXCEPTION 'Statement rows, dates and closing balance do not reconcile'; END IF;RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER bank_statement_balanced AFTER INSERT ON bank_statements DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION bank_statement_totals();
CREATE CONSTRAINT TRIGGER bank_statement_line_balanced AFTER INSERT ON bank_statement_lines DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION bank_statement_totals();
CREATE FUNCTION bank_child_open_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE bid uuid; sid uuid; BEGIN
 IF TG_TABLE_NAME='bank_statement_lines' THEN SELECT branch_id INTO bid FROM bank_statements WHERE id=NEW.statement_id;sid:=NEW.statement_id;
 ELSIF TG_TABLE_NAME='bank_match_lines' THEN SELECT branch_id,statement_id INTO bid,sid FROM bank_matches WHERE id=NEW.match_id;
 ELSIF TG_TABLE_NAME='bank_match_releases' THEN SELECT branch_id,statement_id INTO bid,sid FROM bank_matches WHERE id=NEW.match_id;IF bid<>NEW.branch_id THEN RAISE EXCEPTION 'Match is outside this branch';END IF;
 ELSE bid:=NEW.branch_id;sid:=NEW.statement_id;END IF;
 PERFORM bank_assert_open(sid,bid);RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['bank_statement_lines','bank_matches','bank_match_lines','bank_match_releases','bank_adjustments'] LOOP EXECUTE format('CREATE TRIGGER bank_open_only BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION bank_child_open_guard()',t);END LOOP;END $$;
CREATE FUNCTION bank_match_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE m bank_matches; s bank_statements; mid uuid; expected bigint; total numeric; n int; baseline date; BEGIN
 IF TG_TABLE_NAME='bank_matches' THEN mid:=NEW.id;ELSE mid:=NEW.match_id;END IF;
 SELECT * INTO m FROM bank_matches WHERE id=mid;SELECT * INTO s FROM bank_statements WHERE id=m.statement_id;
 SELECT COALESCE(min(bs.from_date),s.from_date) INTO baseline FROM bank_statements bs JOIN bank_closings c ON c.statement_id=bs.id WHERE bs.branch_id=m.branch_id;
 SELECT count(*),COALESCE(sum(l.debit_paisa-l.credit_paisa),0) INTO n,total FROM bank_match_lines ml JOIN journal_lines l ON l.id=ml.journal_line_id WHERE ml.match_id=mid;
 IF m.statement_line_id IS NULL THEN expected:=0;IF n<2 THEN RAISE EXCEPTION 'Offset clearing needs at least two book lines';END IF;
 ELSE SELECT amount_paisa INTO expected FROM bank_statement_lines WHERE id=m.statement_line_id AND statement_id=m.statement_id;IF expected IS NULL THEN RAISE EXCEPTION 'Statement line is outside this statement';END IF;END IF;
 IF s.branch_id<>m.branch_id OR n NOT BETWEEN 1 AND 100 OR total<>expected OR EXISTS(SELECT 1 FROM bank_match_lines ml JOIN journal_lines l ON l.id=ml.journal_line_id JOIN journals j ON j.id=l.journal_id WHERE ml.match_id=mid AND (j.branch_id<>m.branch_id OR l.account_code<>'1030' OR j.posting_date NOT BETWEEN baseline AND s.to_date)) THEN RAISE EXCEPTION 'Match dates, bank account and exact amounts must agree';END IF;
 IF EXISTS(SELECT 1 FROM bank_active_matches a JOIN bank_match_lines ml ON ml.match_id=a.id GROUP BY ml.journal_line_id HAVING count(*)>1) OR EXISTS(SELECT 1 FROM bank_active_matches WHERE statement_line_id IS NOT NULL GROUP BY statement_line_id HAVING count(*)>1) THEN RAISE EXCEPTION 'Statement or book line is already matched';END IF;RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER bank_match_exact AFTER INSERT ON bank_matches DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION bank_match_guard();
CREATE CONSTRAINT TRIGGER bank_match_line_exact AFTER INSERT ON bank_match_lines DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION bank_match_guard();

CREATE FUNCTION bank_close_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE s bank_statements; baseline date; book numeric; outstanding numeric; first_open numeric; evidence jsonb; BEGIN
 s:=bank_assert_open(NEW.statement_id,NEW.branch_id);
 SELECT COALESCE(min(bs.from_date),s.from_date) INTO baseline FROM bank_statements bs JOIN bank_closings c ON c.statement_id=bs.id WHERE bs.branch_id=s.branch_id;
 IF NOT EXISTS(SELECT 1 FROM bank_closings WHERE branch_id=s.branch_id) THEN
  SELECT COALESCE(sum(l.debit_paisa-l.credit_paisa),0) INTO first_open FROM journal_lines l JOIN journals j ON j.id=l.journal_id WHERE j.branch_id=s.branch_id AND l.account_code='1030' AND j.posting_date<s.from_date;
  IF first_open<>s.opening_paisa THEN RAISE EXCEPTION 'Opening book balance changed; cancel and reimport the first statement';END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM bank_statement_lines sl WHERE sl.statement_id=s.id AND NOT EXISTS(SELECT 1 FROM bank_active_matches m WHERE m.statement_line_id=sl.id)) THEN RAISE EXCEPTION 'Resolve every unmatched statement line before closing';END IF;
 SELECT COALESCE(sum(l.debit_paisa-l.credit_paisa),0) INTO book FROM journal_lines l JOIN journals j ON j.id=l.journal_id WHERE j.branch_id=s.branch_id AND l.account_code='1030' AND j.posting_date<=s.to_date;
 SELECT COALESCE(sum(l.debit_paisa-l.credit_paisa),0) INTO outstanding FROM journal_lines l JOIN journals j ON j.id=l.journal_id WHERE j.branch_id=s.branch_id AND l.account_code='1030' AND j.posting_date BETWEEN baseline AND s.to_date AND NOT EXISTS(SELECT 1 FROM bank_match_lines ml JOIN bank_active_matches m ON m.id=ml.match_id WHERE ml.journal_line_id=l.id);
 evidence:=NEW.evidence_text::jsonb;
 IF evidence->>'status' IS DISTINCT FROM 'CLOSED' OR book-outstanding<>s.closing_paisa OR NEW.through_date<>s.to_date OR NEW.book_balance_paisa<>book OR NEW.outstanding_book_paisa<>outstanding OR (evidence->>'statement_id')::uuid IS DISTINCT FROM s.id OR evidence->>'source_sha256' IS DISTINCT FROM s.source_sha256 OR (evidence->>'book_balance_paisa')::numeric IS DISTINCT FROM book OR (evidence->>'outstanding_book_paisa')::numeric IS DISTINCT FROM outstanding OR (evidence->>'statement_closing_paisa')::numeric IS DISTINCT FROM s.closing_paisa OR evidence->>'baseline_confirmed' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Closing evidence does not reconcile to its bank sources';END IF;RETURN NEW;
END $$;
CREATE TRIGGER bank_close_valid BEFORE INSERT ON bank_closings FOR EACH ROW EXECUTE FUNCTION bank_close_guard();
CREATE FUNCTION bank_cancel_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 PERFORM bank_assert_open(NEW.statement_id,NEW.branch_id);
 IF EXISTS(SELECT 1 FROM bank_adjustments WHERE statement_id=NEW.statement_id) OR EXISTS(SELECT 1 FROM bank_active_matches WHERE statement_id=NEW.statement_id) THEN RAISE EXCEPTION 'Release matches before cancelling; statements with posted adjustments cannot be cancelled';END IF;RETURN NEW;
END $$;
CREATE TRIGGER bank_cancel_valid BEFORE INSERT ON bank_cancellations FOR EACH ROW EXECUTE FUNCTION bank_cancel_guard();
CREATE FUNCTION bank_period_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE j journals; closed_day date; BEGIN
 IF NEW.account_code<>'1030' THEN RETURN NEW;END IF;SELECT * INTO j FROM journals WHERE id=NEW.journal_id;PERFORM bank_lock(j.branch_id);
 SELECT max(through_date) INTO closed_day FROM bank_closings WHERE branch_id=j.branch_id;
 IF j.posting_date<=closed_day THEN RAISE EXCEPTION 'Bank period is closed; use a later correcting entry';END IF;RETURN NEW;
END $$;
CREATE TRIGGER bank_period_frozen BEFORE INSERT ON journal_lines FOR EACH ROW EXECUTE FUNCTION bank_period_guard();
CREATE FUNCTION bank_adjustment_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE a bank_adjustments; s bank_statements; j journals; sid uuid; jid uuid; expected bigint; n int; bank_net numeric; offset_net numeric; BEGIN
 IF TG_TABLE_NAME='bank_adjustments' THEN sid:=NEW.id;
 ELSE IF TG_TABLE_NAME='journals' THEN jid:=NEW.id;ELSE jid:=NEW.journal_id;END IF;SELECT * INTO j FROM journals WHERE id=jid;IF j.source_type<>'BANK_ADJUSTMENT' THEN RETURN NULL;END IF;sid:=j.source_id;END IF;
 SELECT * INTO a FROM bank_adjustments WHERE id=sid;SELECT * INTO s FROM bank_statements WHERE id=a.statement_id;SELECT amount_paisa INTO expected FROM bank_statement_lines WHERE id=a.statement_line_id AND statement_id=a.statement_id;
 SELECT * INTO j FROM journals WHERE branch_id=a.branch_id AND source_type='BANK_ADJUSTMENT' AND source_id=a.id;
 SELECT count(*),COALESCE(sum(debit_paisa-credit_paisa) FILTER(WHERE account_code='1030'),0),COALESCE(sum(debit_paisa-credit_paisa) FILTER(WHERE account_code=a.offset_account),0) INTO n,bank_net,offset_net FROM journal_lines WHERE journal_id=j.id;
 IF a.id IS NULL OR j.id IS NULL OR (jid IS NOT NULL AND jid<>j.id) OR a.branch_id<>s.branch_id OR a.amount_paisa IS DISTINCT FROM expected OR a.posting_date NOT BETWEEN s.from_date AND s.to_date OR a.posting_date>(now() AT TIME ZONE 'Asia/Karachi')::date OR j.posting_date<>a.posting_date OR n<>2 OR bank_net<>expected OR offset_net<>-expected OR (a.offset_account='6100' AND expected>0) OR (a.offset_account='7100' AND expected<0) OR NOT EXISTS(SELECT 1 FROM bank_active_matches m JOIN bank_match_lines ml ON ml.match_id=m.id JOIN journal_lines l ON l.id=ml.journal_line_id WHERE m.statement_line_id=a.statement_line_id AND m.statement_id=a.statement_id AND l.journal_id=j.id AND l.account_code='1030') THEN RAISE EXCEPTION 'Bank adjustment source, journal and match must reconcile';END IF;RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER bank_adjustment_required AFTER INSERT ON bank_adjustments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION bank_adjustment_guard();
CREATE CONSTRAINT TRIGGER bank_adjustment_journal AFTER INSERT ON journals DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION bank_adjustment_guard();
CREATE CONSTRAINT TRIGGER bank_adjustment_line AFTER INSERT ON journal_lines DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION bank_adjustment_guard();
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['bank_statements','bank_statement_lines','bank_matches','bank_match_lines','bank_match_releases','bank_adjustments','bank_closings','bank_cancellations'] LOOP EXECUTE format('CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION deny_history_change()',t);END LOOP;END $$;
