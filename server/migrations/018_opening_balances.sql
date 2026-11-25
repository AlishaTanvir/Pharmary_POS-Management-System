-- Import only independently evidenced outstanding balances; no synthetic invoices.
CREATE TABLE opening_balances(
 id uuid PRIMARY KEY, branch_id uuid NOT NULL REFERENCES branches,
 kind text NOT NULL CHECK(kind IN ('customer','supplier')), account_id uuid NOT NULL,
 reference text NOT NULL CHECK(length(btrim(reference)) BETWEEN 1 AND 150),
 posting_date date NOT NULL, due_date date NOT NULL,
 amount_paisa bigint NOT NULL CHECK(amount_paisa<>0 AND abs(amount_paisa)<=100000000000),
 reason text NOT NULL, actor_id uuid NOT NULL REFERENCES users,
 idempotency_key uuid NOT NULL, request_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(branch_id,idempotency_key), UNIQUE(branch_id,kind,account_id,reference)
);
CREATE TABLE opening_balance_events(
 id uuid PRIMARY KEY, opening_id uuid NOT NULL REFERENCES opening_balances,
 branch_id uuid NOT NULL REFERENCES branches, type text NOT NULL CHECK(type IN ('SETTLEMENT','CORRECTION')),
 amount_paisa bigint NOT NULL CHECK(amount_paisa<>0 AND abs(amount_paisa)<=100000000000),
 posting_date date NOT NULL, method text CHECK(method IN ('CASH','CARD','WALLET')),
 shift_id uuid REFERENCES shifts, reference text NOT NULL, reason text NOT NULL,
 actor_id uuid NOT NULL REFERENCES users, idempotency_key uuid NOT NULL, request_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(branch_id,idempotency_key),
 CHECK((type='SETTLEMENT' AND method IS NOT NULL) OR (type='CORRECTION' AND method IS NULL AND shift_id IS NULL))
);
CREATE INDEX opening_balances_account ON opening_balances(branch_id,kind,account_id,posting_date);
CREATE INDEX opening_balance_events_source ON opening_balance_events(opening_id,posting_date);
CREATE VIEW opening_balance_positions AS SELECT o.*,o.amount_paisa+COALESCE((SELECT sum(e.amount_paisa) FROM opening_balance_events e WHERE e.opening_id=o.id),0) outstanding_paisa FROM opening_balances o;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['opening_balances','opening_balance_events'] LOOP EXECUTE format('CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION deny_history_change()',t); END LOOP; END $$;

CREATE FUNCTION validate_opening_source() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE o opening_balances; remaining numeric; last_day date;
BEGIN
 IF NEW.posting_date>(now() AT TIME ZONE 'Asia/Karachi')::date THEN RAISE EXCEPTION 'Opening postings cannot be future dated'; END IF;
 IF TG_TABLE_NAME='opening_balances' THEN
  IF NEW.kind='customer' THEN PERFORM 1 FROM customers WHERE id=NEW.account_id AND branch_id=NEW.branch_id FOR UPDATE;
  ELSE PERFORM 1 FROM suppliers WHERE id=NEW.account_id AND branch_id=NEW.branch_id FOR UPDATE; END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opening account is outside this branch'; END IF;
 ELSE
  SELECT * INTO o FROM opening_balances WHERE id=NEW.opening_id FOR UPDATE;
  IF o.id IS NULL OR o.branch_id<>NEW.branch_id THEN RAISE EXCEPTION 'Opening source is outside this branch'; END IF;
  SELECT o.amount_paisa+COALESCE(sum(amount_paisa),0),GREATEST(o.posting_date,COALESCE(max(posting_date),o.posting_date)) INTO remaining,last_day FROM opening_balance_events WHERE opening_id=o.id;
  IF NEW.posting_date<last_day THEN RAISE EXCEPTION 'Opening event precedes its source or a prior event'; END IF;
  IF remaining=0 OR sign(NEW.amount_paisa)=sign(remaining) OR abs(NEW.amount_paisa)>abs(remaining) THEN RAISE EXCEPTION 'Opening event exceeds the remaining balance'; END IF;
  IF NEW.type='CORRECTION' AND NEW.amount_paisa<>-remaining THEN RAISE EXCEPTION 'Correction must cancel the unpaid remainder'; END IF;
  IF NEW.method='CASH' AND NEW.posting_date<>(now() AT TIME ZONE 'Asia/Karachi')::date THEN RAISE EXCEPTION 'Cash opening settlements must post today'; END IF;
  IF NEW.method='CASH' AND NOT EXISTS(SELECT 1 FROM shifts s WHERE s.id=NEW.shift_id AND s.branch_id=NEW.branch_id AND s.cashier_id=NEW.actor_id AND NOT EXISTS(SELECT 1 FROM shift_closings c WHERE c.shift_id=s.id)) THEN RAISE EXCEPTION 'Cash settlement requires an open actor shift'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER opening_source_valid BEFORE INSERT ON opening_balances FOR EACH ROW EXECUTE FUNCTION validate_opening_source();
CREATE TRIGGER opening_event_valid BEFORE INSERT ON opening_balance_events FOR EACH ROW EXECUTE FUNCTION validate_opening_source();

CREATE FUNCTION reconcile_opening_journal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE j journals; o opening_balances; e opening_balance_events; jid uuid; source_kind text; source_key uuid; delta bigint; control text; offset_code text; expected_day date; n int; control_net numeric; offset_net numeric;
BEGIN
 IF TG_TABLE_NAME='opening_balances' THEN source_kind:='OPENING_BALANCE';source_key:=NEW.id;
 ELSIF TG_TABLE_NAME='opening_balance_events' THEN source_kind:='OPENING_EVENT';source_key:=NEW.id;
 ELSE
  IF TG_TABLE_NAME='journals' THEN jid:=NEW.id; ELSE jid:=NEW.journal_id; END IF;
  SELECT * INTO j FROM journals WHERE id=jid;
  IF j.source_type NOT IN ('OPENING_BALANCE','OPENING_EVENT') THEN RETURN NULL; END IF;
  source_kind:=j.source_type;source_key:=j.source_id;
 END IF;
 IF source_kind='OPENING_BALANCE' THEN
  SELECT * INTO o FROM opening_balances WHERE id=source_key;delta:=o.amount_paisa;expected_day:=o.posting_date;offset_code:='3000';
 ELSE
  SELECT * INTO e FROM opening_balance_events WHERE id=source_key;
  SELECT * INTO o FROM opening_balances WHERE id=e.opening_id;
  delta:=e.amount_paisa;expected_day:=e.posting_date;
  offset_code:=CASE WHEN e.type='CORRECTION' THEN '3000' WHEN e.method='CASH' THEN '1000' WHEN e.method='CARD' THEN '1010' ELSE '1020' END;
 END IF;
 SELECT * INTO j FROM journals WHERE branch_id=o.branch_id AND source_type=source_kind AND source_id=source_key;
 IF o.id IS NULL OR j.id IS NULL OR (jid IS NOT NULL AND jid<>j.id) OR j.posting_date<>expected_day THEN RAISE EXCEPTION 'Opening source requires its matching dated journal'; END IF;
 control:=CASE WHEN o.kind='customer' THEN '1100' ELSE '2000' END;
 IF o.kind='supplier' THEN delta:=-delta; END IF;
 SELECT count(*),COALESCE(sum(debit_paisa-credit_paisa) FILTER(WHERE account_code=control),0),COALESCE(sum(debit_paisa-credit_paisa) FILTER(WHERE account_code=offset_code),0) INTO n,control_net,offset_net FROM journal_lines WHERE journal_id=j.id;
 IF n<>2 OR control_net<>delta OR offset_net<>-delta THEN RAISE EXCEPTION 'Opening journal components do not match the source'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER opening_journal_required AFTER INSERT ON opening_balances DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reconcile_opening_journal();
CREATE CONSTRAINT TRIGGER opening_event_journal_required AFTER INSERT ON opening_balance_events DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reconcile_opening_journal();
CREATE CONSTRAINT TRIGGER opening_journal_matches AFTER INSERT ON journals DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reconcile_opening_journal();
CREATE CONSTRAINT TRIGGER opening_journal_line_matches AFTER INSERT ON journal_lines DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reconcile_opening_journal();
CREATE FUNCTION protect_opening_reversal() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.reverses_id IS NOT NULL AND EXISTS(SELECT 1 FROM journals WHERE id=NEW.reverses_id AND source_type IN ('OPENING_BALANCE','OPENING_EVENT')) THEN RAISE EXCEPTION 'Use the opening remainder correction workflow'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER opening_reversal_guard BEFORE INSERT ON journals FOR EACH ROW EXECUTE FUNCTION protect_opening_reversal();
