import type pg from 'pg';
export async function classificationIntegrity(db:pg.ClientBase){
 const result=await db.query(`WITH mh AS(SELECT DISTINCT ON(medicine_id) * FROM medicine_classification_history ORDER BY medicine_id,recorded_at DESC,seq DESC),ch AS(SELECT DISTINCT ON(category_id) * FROM category_classification_history ORDER BY category_id,recorded_at DESC,seq DESC),bh AS(SELECT DISTINCT ON(batch_id) * FROM batch_lifecycle_history ORDER BY batch_id,recorded_at DESC,seq DESC) SELECT (
 (SELECT count(*) FROM medicines m LEFT JOIN mh h ON h.medicine_id=m.id WHERE h.seq IS NULL OR h.event_type='DELETE' OR ROW(m.branch_id,m.name,m.generic,m.form,m.active,m.reorder_level,m.category_id,m.category_revision) IS DISTINCT FROM ROW(h.branch_id,h.name,h.generic,h.form,h.active,h.reorder_level,h.category_id,h.category_revision))
 +(SELECT count(*) FROM medicine_categories c LEFT JOIN ch h ON h.category_id=c.id WHERE h.seq IS NULL OR h.event_type='DELETE' OR ROW(c.branch_id,c.name,c.parent_id,c.revision) IS DISTINCT FROM ROW(h.branch_id,h.name,h.parent_id,h.revision))
 +(SELECT count(*) FROM batches b LEFT JOIN bh h ON h.batch_id=b.id WHERE h.seq IS NULL OR h.event_type='DELETE' OR ROW(b.branch_id,b.medicine_id,b.status,b.expiry) IS DISTINCT FROM ROW(h.branch_id,h.medicine_id,h.status,h.expiry))
 +(SELECT count(*) FROM mh h WHERE h.event_type<>'DELETE' AND NOT EXISTS(SELECT 1 FROM medicines m WHERE m.id=h.medicine_id))
 +(SELECT count(*) FROM ch h WHERE h.event_type<>'DELETE' AND NOT EXISTS(SELECT 1 FROM medicine_categories c WHERE c.id=h.category_id))
 +(SELECT count(*) FROM bh h WHERE h.event_type<>'DELETE' AND NOT EXISTS(SELECT 1 FROM batches b WHERE b.id=h.batch_id))
 +(SELECT count(*) FROM (SELECT recorded_at,event_type FROM medicine_classification_history UNION ALL SELECT recorded_at,event_type FROM category_classification_history UNION ALL SELECT recorded_at,event_type FROM batch_lifecycle_history) h WHERE h.recorded_at<(SELECT started_at FROM classification_capture) OR (h.event_type='BASELINE' AND h.recorded_at<>(SELECT started_at FROM classification_capture)))
 +CASE WHEN (SELECT count(*) FROM classification_capture)=1 THEN 0 ELSE 1 END)::int classification_mismatches`);
 return result.rows[0].classification_mismatches as number;
}
