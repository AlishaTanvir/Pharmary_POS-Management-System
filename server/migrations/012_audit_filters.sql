CREATE INDEX audit_events_branch_action_date ON audit_events(branch_id,action,created_at DESC,id);
CREATE INDEX audit_events_branch_actor_date ON audit_events(branch_id,actor_id,created_at DESC,id);
