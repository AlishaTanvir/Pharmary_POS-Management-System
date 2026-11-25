import type pg from 'pg';
// Also used after pg_restore, where constraint triggers alone do not validate restored rows.
export async function openingIntegrity(db:pg.ClientBase){
 const result=await db.query(`WITH sources AS (
 SELECT o.id,o.branch_id,o.kind,o.amount_paisa,o.posting_date,'OPENING_BALANCE' source_type,'3000' offset_code FROM opening_balances o
 UNION ALL SELECT e.id,e.branch_id,o.kind,e.amount_paisa,e.posting_date,'OPENING_EVENT',CASE WHEN e.type='CORRECTION' THEN '3000' WHEN e.method='CASH' THEN '1000' WHEN e.method='CARD' THEN '1010' ELSE '1020' END FROM opening_balance_events e JOIN opening_balances o ON o.id=e.opening_id
 ), expected AS (SELECT s.*,CASE WHEN kind='customer' THEN '1100' ELSE '2000' END control_code,CASE WHEN kind='customer' THEN amount_paisa ELSE -amount_paisa END delta FROM sources s)
 SELECT ((SELECT count(*) FROM expected s LEFT JOIN journals j ON j.branch_id=s.branch_id AND j.source_type=s.source_type AND j.source_id=s.id WHERE j.id IS NULL OR j.posting_date<>s.posting_date OR (SELECT count(*) FROM journal_lines WHERE journal_id=j.id)<>2 OR COALESCE((SELECT sum(debit_paisa-credit_paisa) FROM journal_lines WHERE journal_id=j.id AND account_code=s.control_code),0)<>s.delta OR COALESCE((SELECT sum(debit_paisa-credit_paisa) FROM journal_lines WHERE journal_id=j.id AND account_code=s.offset_code),0)<>-s.delta)
 +(SELECT count(*) FROM journals j WHERE j.source_type IN ('OPENING_BALANCE','OPENING_EVENT') AND NOT EXISTS(SELECT 1 FROM sources s WHERE s.branch_id=j.branch_id AND s.source_type=j.source_type AND s.id=j.source_id))
 +(SELECT count(*) FROM journals j JOIN journals original ON original.id=j.reverses_id WHERE original.source_type IN ('OPENING_BALANCE','OPENING_EVENT'))
 +(SELECT count(*) FROM opening_balances o WHERE (o.kind='customer' AND NOT EXISTS(SELECT 1 FROM customers c WHERE c.id=o.account_id AND c.branch_id=o.branch_id)) OR (o.kind='supplier' AND NOT EXISTS(SELECT 1 FROM suppliers s WHERE s.id=o.account_id AND s.branch_id=o.branch_id)))
 +(SELECT count(*) FROM opening_balance_positions o WHERE sign(o.outstanding_paisa) NOT IN (0,sign(o.amount_paisa)) OR abs(o.outstanding_paisa)>abs(o.amount_paisa))
 +(SELECT count(*) FROM opening_balance_events e JOIN opening_balances o ON o.id=e.opening_id WHERE e.branch_id<>o.branch_id OR e.posting_date<o.posting_date OR sign(e.amount_paisa)=sign(o.amount_paisa)))::int opening_mismatches`);
 return result.rows[0].opening_mismatches as number;
}
