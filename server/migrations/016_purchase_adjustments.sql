ALTER TABLE purchases ADD COLUMN subtotal_paisa bigint CHECK(subtotal_paisa>=0);
ALTER TABLE purchases ADD COLUMN discount_paisa bigint NOT NULL DEFAULT 0 CHECK(discount_paisa>=0);
ALTER TABLE purchases ADD COLUMN tax_paisa bigint NOT NULL DEFAULT 0 CHECK(tax_paisa>=0);
ALTER TABLE purchases ADD COLUMN tax_treatment text NOT NULL DEFAULT 'NONE' CHECK(tax_treatment IN ('NONE','CAPITALIZE','RECOVERABLE'));
ALTER TABLE purchases ADD COLUMN inventory_paisa bigint CHECK(inventory_paisa>=0);
ALTER TABLE purchases ADD CONSTRAINT purchase_adjusted_totals CHECK(subtotal_paisa IS NULL OR (inventory_paisa IS NOT NULL AND discount_paisa<=subtotal_paisa AND total_paisa=subtotal_paisa-discount_paisa+tax_paisa AND inventory_paisa=subtotal_paisa-discount_paisa+CASE WHEN tax_treatment='CAPITALIZE' THEN tax_paisa ELSE 0 END AND ((tax_paisa=0 AND tax_treatment='NONE') OR (tax_paisa>0 AND tax_treatment IN ('CAPITALIZE','RECOVERABLE')))));
ALTER TABLE purchase_lines ADD COLUMN gross_total_paisa bigint CHECK(gross_total_paisa>=0);
ALTER TABLE purchase_lines ADD COLUMN discount_paisa bigint NOT NULL DEFAULT 0 CHECK(discount_paisa>=0);
ALTER TABLE purchase_lines ADD COLUMN tax_paisa bigint NOT NULL DEFAULT 0 CHECK(tax_paisa>=0);
ALTER TABLE purchase_lines ADD COLUMN inventory_total_paisa bigint CHECK(inventory_total_paisa>=0);
ALTER TABLE supplier_returns ADD COLUMN inventory_paisa bigint CHECK(inventory_paisa>=0);
ALTER TABLE supplier_returns ADD COLUMN recoverable_tax_paisa bigint NOT NULL DEFAULT 0 CHECK(recoverable_tax_paisa>=0);
ALTER TABLE supplier_returns ADD CONSTRAINT supplier_credit_component_sum CHECK(inventory_paisa IS NULL OR amount_paisa=inventory_paisa+recoverable_tax_paisa);
ALTER TABLE supplier_return_lines ADD COLUMN recoverable_tax_paisa bigint NOT NULL DEFAULT 0 CHECK(recoverable_tax_paisa>=0);
INSERT INTO accounts(code,name,type) VALUES('1150','Purchase input tax','ASSET');

CREATE FUNCTION reconcile_purchase_components() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE invoice purchases; totals record; invoice_id uuid;
BEGIN
 IF TG_TABLE_NAME='purchases' THEN invoice_id:=NEW.id; ELSE invoice_id:=NEW.purchase_id; END IF;
 SELECT * INTO invoice FROM purchases WHERE id=invoice_id;
 IF invoice.subtotal_paisa IS NULL THEN RETURN NULL; END IF;
 SELECT count(*) n,count(gross_total_paisa) captured,count(inventory_total_paisa) cost_captured,sum(gross_total_paisa) gross,sum(discount_paisa) discount,sum(tax_paisa) tax,sum(inventory_total_paisa) inventory INTO totals FROM purchase_lines WHERE purchase_id=invoice_id;
 IF totals.n=0 OR totals.n<>totals.captured OR totals.n<>totals.cost_captured OR totals.gross<>invoice.subtotal_paisa OR totals.discount<>invoice.discount_paisa OR totals.tax<>invoice.tax_paisa OR totals.inventory<>invoice.inventory_paisa THEN RAISE EXCEPTION 'Purchase invoice components do not reconcile'; END IF;
 IF EXISTS(SELECT 1 FROM purchase_lines l JOIN batches b ON b.id=l.batch_id WHERE l.purchase_id=invoice_id AND (l.gross_total_paisa<>l.quantity*l.unit_cost_paisa OR l.inventory_total_paisa<>l.quantity_base*b.cost_paisa OR l.inventory_total_paisa<>l.gross_total_paisa-l.discount_paisa+CASE WHEN invoice.tax_treatment='CAPITALIZE' THEN l.tax_paisa ELSE 0 END)) THEN RAISE EXCEPTION 'Purchase line inventory cost does not reconcile'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER purchase_components AFTER INSERT ON purchases DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reconcile_purchase_components();
CREATE CONSTRAINT TRIGGER purchase_line_components AFTER INSERT ON purchase_lines DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reconcile_purchase_components();

CREATE FUNCTION reconcile_supplier_credit_components() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE credit supplier_returns; totals record; credit_id uuid;
BEGIN
 IF TG_TABLE_NAME='supplier_returns' THEN credit_id:=NEW.id; ELSE credit_id:=NEW.return_id; END IF;
 SELECT * INTO credit FROM supplier_returns WHERE id=credit_id;
 IF credit.inventory_paisa IS NULL THEN RETURN NULL; END IF;
 SELECT count(*) n,sum(quantity_base*unit_cost_paisa) inventory,sum(recoverable_tax_paisa) tax INTO totals FROM supplier_return_lines WHERE return_id=credit_id;
 IF totals.n=0 OR totals.inventory<>credit.inventory_paisa OR totals.tax<>credit.recoverable_tax_paisa THEN RAISE EXCEPTION 'Supplier credit components do not reconcile'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER supplier_credit_components AFTER INSERT ON supplier_returns DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reconcile_supplier_credit_components();
CREATE CONSTRAINT TRIGGER supplier_credit_line_components AFTER INSERT ON supplier_return_lines DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reconcile_supplier_credit_components();

