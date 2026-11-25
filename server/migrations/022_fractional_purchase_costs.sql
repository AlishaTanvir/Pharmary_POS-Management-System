-- Additive: legacy values and historical cost snapshots are not rewritten.
ALTER TABLE batches ADD COLUMN value_revision bigint NOT NULL DEFAULT 0;
ALTER TABLE batches ADD COLUMN book_value_paisa bigint CHECK(book_value_paisa>=0);
ALTER TABLE batches ADD COLUMN basis_value_paisa bigint CHECK(basis_value_paisa>=0);
ALTER TABLE batches ADD COLUMN basis_quantity_base integer CHECK(basis_quantity_base>0);
ALTER TABLE batches ADD COLUMN last_value_delta_paisa bigint;
ALTER TABLE batches ADD COLUMN last_quantity_delta integer;
ALTER TABLE batches ADD CONSTRAINT valued_batch_complete CHECK(book_value_paisa IS NULL OR (basis_value_paisa IS NOT NULL AND basis_quantity_base IS NOT NULL AND (quantity>0 OR book_value_paisa=0)));
ALTER TABLE movements ADD COLUMN value_paisa bigint;
ALTER TABLE allocations ADD COLUMN cost_total_paisa bigint CHECK(cost_total_paisa>=0);
ALTER TABLE return_allocations ADD COLUMN cost_total_paisa bigint CHECK(cost_total_paisa>=0);
ALTER TABLE transfer_lines ADD COLUMN cost_total_paisa bigint CHECK(cost_total_paisa>=0);
ALTER TABLE supplier_return_lines ADD COLUMN inventory_total_paisa bigint CHECK(inventory_total_paisa>=0);
ALTER TABLE offline_reservations ADD COLUMN allocated_value_paisa bigint CHECK(allocated_value_paisa>=0);
ALTER TABLE offline_reservations ADD COLUMN remaining_value_paisa bigint CHECK(remaining_value_paisa>=0);
ALTER TABLE purchases ADD COLUMN valuation_version text CHECK(valuation_version='RESIDUAL_V1');
ALTER TABLE purchases ADD COLUMN tax_mode text CHECK(tax_mode IN ('INVOICE','PER_LINE'));
ALTER TABLE purchases ADD COLUMN recoverable_tax_paisa bigint CHECK(recoverable_tax_paisa>=0);
ALTER TABLE purchases ADD CONSTRAINT advanced_purchase_metadata CHECK(valuation_version IS NULL OR (tax_mode IS NOT NULL AND recoverable_tax_paisa IS NOT NULL));
ALTER TABLE purchases DROP CONSTRAINT purchases_tax_treatment_check;
ALTER TABLE purchases ADD CONSTRAINT purchases_tax_treatment_check CHECK(tax_treatment IN ('NONE','CAPITALIZE','RECOVERABLE','MIXED'));
ALTER TABLE purchases DROP CONSTRAINT purchase_adjusted_totals;
ALTER TABLE purchases ADD CONSTRAINT purchase_adjusted_totals CHECK(subtotal_paisa IS NULL OR (discount_paisa<=subtotal_paisa AND total_paisa=subtotal_paisa-discount_paisa+tax_paisa AND inventory_paisa=subtotal_paisa-discount_paisa+tax_paisa-COALESCE(recoverable_tax_paisa,CASE WHEN tax_treatment='RECOVERABLE' THEN tax_paisa ELSE 0 END) AND COALESCE(recoverable_tax_paisa,0)<=tax_paisa));
ALTER TABLE purchase_lines ADD COLUMN pack_cost_units bigint CHECK(pack_cost_units>=0); -- 1/10000 PKR
ALTER TABLE purchase_lines ADD COLUMN line_discount_paisa bigint CHECK(line_discount_paisa>=0);
ALTER TABLE purchase_lines ADD COLUMN invoice_discount_paisa bigint CHECK(invoice_discount_paisa>=0);
ALTER TABLE purchase_lines ADD COLUMN tax_treatment text CHECK(tax_treatment IN ('NONE','CAPITALIZE','RECOVERABLE','EXEMPT'));
ALTER TABLE purchase_lines ADD COLUMN tax_bps integer CHECK(tax_bps BETWEEN 0 AND 10000);
CREATE FUNCTION inventory_portion(v bigint,q integer,n integer) RETURNS bigint LANGUAGE plpgsql IMMUTABLE AS $$BEGIN IF v<0 OR q<=0 OR n<0 OR n>q THEN RAISE EXCEPTION 'Invalid inventory value portion';END IF;RETURN div(v::numeric*n+q/2,q)::bigint;END$$;
CREATE FUNCTION inventory_batch_value() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE reserved integer;reserved_value bigint;delta integer;amount bigint;source_value bigint;
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.transfer_line_id IS NOT NULL AND NEW.book_value_paisa IS NULL THEN SELECT cost_total_paisa INTO source_value FROM transfer_lines WHERE id=NEW.transfer_line_id;IF source_value IS NOT NULL THEN NEW.book_value_paisa:=source_value;NEW.basis_value_paisa:=source_value;NEW.basis_quantity_base:=NEW.quantity;NEW.cost_paisa:=source_value/NEW.quantity;END IF;END IF;
  RETURN NEW;
 END IF;
 IF NEW.quantity=OLD.quantity OR OLD.book_value_paisa IS NULL THEN RETURN NEW;END IF;
 delta:=NEW.quantity-OLD.quantity;
 SELECT COALESCE(sum(remaining),0)::int,COALESCE(sum(COALESCE(remaining_value_paisa,remaining*OLD.cost_paisa)),0)::bigint INTO reserved,reserved_value FROM offline_reservations WHERE batch_id=OLD.id;
 IF NEW.quantity<reserved THEN RAISE EXCEPTION 'Valued stock is reserved for an offline counter';END IF;
 IF NEW.value_revision<>OLD.value_revision THEN amount:=NEW.book_value_paisa-OLD.book_value_paisa;
 ELSIF delta<0 THEN amount:=-inventory_portion(OLD.book_value_paisa-reserved_value,OLD.quantity-reserved,-delta);NEW.book_value_paisa:=OLD.book_value_paisa+amount;
 ELSE amount:=CASE WHEN OLD.quantity>0 THEN div(OLD.book_value_paisa::numeric*delta+OLD.quantity/2,OLD.quantity)::bigint ELSE div(OLD.basis_value_paisa::numeric*delta+OLD.basis_quantity_base/2,OLD.basis_quantity_base)::bigint END;NEW.book_value_paisa:=OLD.book_value_paisa+amount;
 END IF;
 IF NEW.book_value_paisa<reserved_value OR (delta<0 AND amount>0) OR (delta>0 AND amount<0) THEN RAISE EXCEPTION 'Inventory value change is inconsistent';END IF;
 NEW.value_revision:=OLD.value_revision+1;NEW.last_value_delta_paisa:=amount;NEW.last_quantity_delta:=delta;RETURN NEW;
END$$;
CREATE TRIGGER valued_batch BEFORE INSERT OR UPDATE ON batches FOR EACH ROW EXECUTE FUNCTION inventory_batch_value();
CREATE FUNCTION inventory_reservation_value() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE b batches;free integer;v bigint;BEGIN
 IF TG_OP='INSERT' THEN SELECT * INTO b FROM batches WHERE id=NEW.batch_id;IF b.book_value_paisa IS NOT NULL THEN SELECT b.quantity-COALESCE(sum(remaining),0)::int,b.book_value_paisa-COALESCE(sum(COALESCE(remaining_value_paisa,remaining*b.cost_paisa)),0)::bigint INTO free,v FROM offline_reservations WHERE batch_id=b.id;NEW.allocated_value_paisa:=inventory_portion(v,free,NEW.allocated);NEW.remaining_value_paisa:=NEW.allocated_value_paisa;END IF;
 ELSIF OLD.remaining_value_paisa IS NOT NULL AND NEW.remaining<>OLD.remaining THEN IF NEW.remaining>OLD.remaining THEN RAISE EXCEPTION 'Cannot replenish a valued offline reservation';END IF;NEW.remaining_value_paisa:=OLD.remaining_value_paisa-inventory_portion(OLD.remaining_value_paisa,OLD.remaining,OLD.remaining-NEW.remaining);END IF;RETURN NEW;END$$;
CREATE TRIGGER valued_reservation BEFORE INSERT OR UPDATE ON offline_reservations FOR EACH ROW EXECUTE FUNCTION inventory_reservation_value();
CREATE OR REPLACE FUNCTION movement_cost_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE b batches;BEGIN SELECT * INTO b FROM batches WHERE id=NEW.batch_id;NEW.unit_cost_paisa:=b.cost_paisa;IF b.book_value_paisa IS NULL THEN NEW.value_paisa:=NEW.quantity_base*b.cost_paisa;ELSIF NEW.type IN ('RECEIPT','TRANSFER_IN','RETURN_QUARANTINE') THEN NEW.value_paisa:=b.book_value_paisa;ELSE IF b.last_quantity_delta IS DISTINCT FROM NEW.quantity_base THEN RAISE EXCEPTION 'Movement does not match valued quantity change';END IF;NEW.value_paisa:=b.last_value_delta_paisa;END IF;RETURN NEW;END$$;
CREATE FUNCTION inventory_allocation_value() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE b batches;BEGIN SELECT * INTO b FROM batches WHERE id=NEW.batch_id;IF b.book_value_paisa IS NOT NULL THEN IF b.last_quantity_delta IS DISTINCT FROM -NEW.quantity_base THEN RAISE EXCEPTION 'Allocation does not match valued stock change';END IF;NEW.cost_total_paisa:=-b.last_value_delta_paisa;END IF;RETURN NEW;END$$;
CREATE TRIGGER valued_allocation BEFORE INSERT ON allocations FOR EACH ROW EXECUTE FUNCTION inventory_allocation_value();
CREATE FUNCTION inventory_return_value() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE a allocations;returned integer;BEGIN SELECT * INTO a FROM allocations WHERE id=NEW.allocation_id;IF a.cost_total_paisa IS NOT NULL THEN SELECT COALESCE(sum(quantity_base),0)::int INTO returned FROM return_allocations WHERE allocation_id=a.id;IF returned+NEW.quantity_base>a.quantity_base THEN RAISE EXCEPTION 'Return exceeds original cost allocation';END IF;NEW.cost_total_paisa:=inventory_portion(a.cost_total_paisa,a.quantity_base,returned+NEW.quantity_base)-inventory_portion(a.cost_total_paisa,a.quantity_base,returned);END IF;RETURN NEW;END$$;
CREATE TRIGGER valued_return BEFORE INSERT ON return_allocations FOR EACH ROW EXECUTE FUNCTION inventory_return_value();
CREATE FUNCTION initialize_return_value() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.cost_total_paisa IS NOT NULL THEN UPDATE batches SET cost_paisa=NEW.cost_total_paisa/NEW.quantity_base,book_value_paisa=NEW.cost_total_paisa,basis_value_paisa=NEW.cost_total_paisa,basis_quantity_base=NEW.quantity_base WHERE id=NEW.quarantine_batch_id;END IF;RETURN NULL;END$$;
CREATE TRIGGER valued_return_batch AFTER INSERT ON return_allocations FOR EACH ROW EXECUTE FUNCTION initialize_return_value();
CREATE OR REPLACE FUNCTION reconcile_purchase_components() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE invoice purchases;totals record;invoice_id uuid;BEGIN
 IF TG_TABLE_NAME='purchases' THEN invoice_id:=NEW.id;ELSE invoice_id:=NEW.purchase_id;END IF;SELECT * INTO invoice FROM purchases WHERE id=invoice_id;IF invoice.subtotal_paisa IS NULL THEN RETURN NULL;END IF;
 SELECT count(*) n,count(gross_total_paisa) captured,count(inventory_total_paisa) cost_captured,sum(gross_total_paisa) gross,sum(discount_paisa) discount,sum(tax_paisa) tax,sum(inventory_total_paisa) inventory,sum(CASE WHEN COALESCE(tax_treatment,invoice.tax_treatment)='RECOVERABLE' THEN tax_paisa ELSE 0 END) recoverable INTO totals FROM purchase_lines WHERE purchase_id=invoice_id;
 IF totals.n=0 OR totals.n<>totals.captured OR totals.n<>totals.cost_captured OR totals.gross<>invoice.subtotal_paisa OR totals.discount<>invoice.discount_paisa OR totals.tax<>invoice.tax_paisa OR totals.inventory<>invoice.inventory_paisa OR totals.recoverable<>COALESCE(invoice.recoverable_tax_paisa,CASE WHEN invoice.tax_treatment='RECOVERABLE' THEN invoice.tax_paisa ELSE 0 END) THEN RAISE EXCEPTION 'Purchase invoice components do not reconcile';END IF;
 IF invoice.valuation_version IS NOT NULL AND EXISTS(SELECT 1 FROM purchase_lines l JOIN batches b ON b.id=l.batch_id WHERE l.purchase_id=invoice_id AND (l.pack_cost_units IS NULL OR l.line_discount_paisa IS NULL OR l.invoice_discount_paisa IS NULL OR l.tax_treatment IS NULL OR b.book_value_paisa IS NULL OR b.basis_quantity_base<>l.quantity_base OR l.discount_paisa<>l.line_discount_paisa+l.invoice_discount_paisa OR (l.tax_treatment='EXEMPT' AND (l.tax_paisa<>0 OR COALESCE(l.tax_bps,0)<>0)) OR (l.tax_bps IS NOT NULL AND l.tax_paisa<>div((l.gross_total_paisa-l.discount_paisa)::numeric*l.tax_bps+5000,10000)::bigint))) THEN RAISE EXCEPTION 'Advanced purchase metadata does not reconcile';END IF;
 IF EXISTS(SELECT 1 FROM purchase_lines l JOIN batches b ON b.id=l.batch_id WHERE l.purchase_id=invoice_id AND (l.gross_total_paisa<>CASE WHEN l.pack_cost_units IS NULL THEN l.quantity*l.unit_cost_paisa ELSE div(l.quantity::numeric*l.pack_cost_units+50,100)::bigint END OR l.inventory_total_paisa<>COALESCE(b.basis_value_paisa,l.quantity_base*b.cost_paisa) OR l.inventory_total_paisa<>l.gross_total_paisa-l.discount_paisa+CASE WHEN COALESCE(l.tax_treatment,invoice.tax_treatment)='CAPITALIZE' THEN l.tax_paisa ELSE 0 END)) THEN RAISE EXCEPTION 'Purchase line inventory cost does not reconcile';END IF;RETURN NULL;END$$;
CREATE OR REPLACE FUNCTION reconcile_supplier_credit_components() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE credit supplier_returns;totals record;credit_id uuid;BEGIN IF TG_TABLE_NAME='supplier_returns' THEN credit_id:=NEW.id;ELSE credit_id:=NEW.return_id;END IF;SELECT * INTO credit FROM supplier_returns WHERE id=credit_id;IF credit.inventory_paisa IS NULL THEN RETURN NULL;END IF;SELECT count(*) n,sum(COALESCE(inventory_total_paisa,quantity_base*unit_cost_paisa)) inventory,sum(recoverable_tax_paisa) tax INTO totals FROM supplier_return_lines WHERE return_id=credit_id;IF totals.n=0 OR totals.inventory<>credit.inventory_paisa OR totals.tax<>credit.recoverable_tax_paisa THEN RAISE EXCEPTION 'Supplier credit components do not reconcile';END IF;RETURN NULL;END$$;

CREATE OR REPLACE FUNCTION reconcile_purchase_journal_components() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE header journals; expected_inventory bigint; expected_tax bigint; expected_total bigint; totals record; journal_id_value uuid;
BEGIN
 IF TG_TABLE_NAME='journals' THEN journal_id_value:=NEW.id; ELSE journal_id_value:=NEW.journal_id; END IF;
 SELECT * INTO header FROM journals WHERE id=journal_id_value;
 IF header.source_type='PURCHASE' THEN
  SELECT inventory_paisa,COALESCE(recoverable_tax_paisa,CASE WHEN tax_treatment='RECOVERABLE' THEN tax_paisa ELSE 0 END),total_paisa INTO expected_inventory,expected_tax,expected_total FROM purchases WHERE id=header.source_id AND branch_id=header.branch_id;
 ELSIF header.source_type='SUPPLIER_RETURN' THEN
  SELECT inventory_paisa,recoverable_tax_paisa,amount_paisa INTO expected_inventory,expected_tax,expected_total FROM supplier_returns WHERE id=header.source_id AND branch_id=header.branch_id;
 ELSE RETURN NULL; END IF;
 IF expected_inventory IS NULL THEN RETURN NULL; END IF;
 SELECT COALESCE(sum(CASE WHEN account_code='1200' THEN debit_paisa-credit_paisa ELSE 0 END),0) inventory,COALESCE(sum(CASE WHEN account_code='1150' THEN debit_paisa-credit_paisa ELSE 0 END),0) tax,COALESCE(sum(CASE WHEN account_code='2000' THEN credit_paisa-debit_paisa ELSE 0 END),0) payable,COALESCE(sum(debit_paisa),0) debit,COALESCE(sum(credit_paisa),0) credit INTO totals FROM journal_lines WHERE journal_id=journal_id_value;
 IF header.source_type='SUPPLIER_RETURN' THEN expected_inventory:=-expected_inventory;expected_tax:=-expected_tax;expected_total:=-expected_total; END IF;
 IF totals.inventory<>expected_inventory OR totals.tax<>expected_tax OR totals.payable<>expected_total OR totals.debit<>abs(expected_total) OR totals.credit<>abs(expected_total) THEN RAISE EXCEPTION 'Purchase journal components do not reconcile'; END IF;
 RETURN NULL;
END $$;

ALTER TABLE purchase_order_lines ADD COLUMN pack_cost_units bigint CHECK(pack_cost_units>=0);

CREATE FUNCTION reconcile_sale_cost() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE line sale_lines;total numeric;BEGIN SELECT * INTO line FROM sale_lines WHERE id=NEW.line_id;IF EXISTS(SELECT 1 FROM allocations WHERE line_id=line.id AND cost_total_paisa IS NOT NULL) THEN SELECT sum(COALESCE(cost_total_paisa,quantity_base*cost_paisa)) INTO total FROM allocations WHERE line_id=line.id;IF total<>line.cost_paisa THEN RAISE EXCEPTION 'Sale allocated cost does not reconcile';END IF;END IF;RETURN NULL;END$$;
CREATE CONSTRAINT TRIGGER sale_value_components AFTER INSERT ON allocations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reconcile_sale_cost();
