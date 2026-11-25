CREATE FUNCTION reconcile_purchase_journal_components() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE header journals; expected_inventory bigint; expected_tax bigint; expected_total bigint; totals record; journal_id_value uuid;
BEGIN
 IF TG_TABLE_NAME='journals' THEN journal_id_value:=NEW.id; ELSE journal_id_value:=NEW.journal_id; END IF;
 SELECT * INTO header FROM journals WHERE id=journal_id_value;
 IF header.source_type='PURCHASE' THEN
  SELECT inventory_paisa,CASE WHEN tax_treatment='RECOVERABLE' THEN tax_paisa ELSE 0 END,total_paisa INTO expected_inventory,expected_tax,expected_total FROM purchases WHERE id=header.source_id AND branch_id=header.branch_id;
 ELSIF header.source_type='SUPPLIER_RETURN' THEN
  SELECT inventory_paisa,recoverable_tax_paisa,amount_paisa INTO expected_inventory,expected_tax,expected_total FROM supplier_returns WHERE id=header.source_id AND branch_id=header.branch_id;
 ELSE RETURN NULL; END IF;
 IF expected_inventory IS NULL THEN RETURN NULL; END IF;
 SELECT COALESCE(sum(CASE WHEN account_code='1200' THEN debit_paisa-credit_paisa ELSE 0 END),0) inventory,COALESCE(sum(CASE WHEN account_code='1150' THEN debit_paisa-credit_paisa ELSE 0 END),0) tax,COALESCE(sum(CASE WHEN account_code='2000' THEN credit_paisa-debit_paisa ELSE 0 END),0) payable,COALESCE(sum(debit_paisa),0) debit,COALESCE(sum(credit_paisa),0) credit INTO totals FROM journal_lines WHERE journal_id=journal_id_value;
 IF header.source_type='SUPPLIER_RETURN' THEN expected_inventory:=-expected_inventory;expected_tax:=-expected_tax;expected_total:=-expected_total; END IF;
 IF totals.inventory<>expected_inventory OR totals.tax<>expected_tax OR totals.payable<>expected_total OR totals.debit<>abs(expected_total) OR totals.credit<>abs(expected_total) THEN RAISE EXCEPTION 'Purchase journal components do not reconcile'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER purchase_journal_components AFTER INSERT ON journals DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reconcile_purchase_journal_components();
CREATE CONSTRAINT TRIGGER purchase_journal_line_components AFTER INSERT ON journal_lines DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reconcile_purchase_journal_components();
