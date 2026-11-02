ALTER TABLE staff_user DROP CONSTRAINT staff_user_role_check;
ALTER TABLE staff_user ADD CONSTRAINT staff_user_role_check CHECK (role IN ('STAFF', 'KITCHEN', 'MANAGER'));

ALTER TABLE fulfillment_unit DROP CONSTRAINT fulfillment_unit_status_check;
ALTER TABLE fulfillment_unit DROP CONSTRAINT fulfillment_unit_check;
ALTER TABLE fulfillment_unit ADD COLUMN version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0);
ALTER TABLE fulfillment_unit ADD COLUMN picked_up_by BIGINT REFERENCES staff_user(id);
ALTER TABLE fulfillment_unit ADD COLUMN picked_up_at TIMESTAMPTZ;
ALTER TABLE fulfillment_unit ADD COLUMN served_by BIGINT REFERENCES staff_user(id);
ALTER TABLE fulfillment_unit ADD COLUMN served_at TIMESTAMPTZ;
ALTER TABLE fulfillment_unit ADD CONSTRAINT fulfillment_unit_status_check
    CHECK (status IN ('QUEUED', 'PREPARING', 'READY', 'PICKED_UP', 'SERVED'));
ALTER TABLE fulfillment_unit ADD CONSTRAINT fulfillment_unit_lifecycle_check CHECK (
    (status = 'QUEUED' AND started_at IS NULL AND started_by IS NULL AND ready_at IS NULL AND ready_by IS NULL)
    OR (status = 'PREPARING' AND started_at IS NOT NULL AND started_by IS NOT NULL AND ready_at IS NULL AND ready_by IS NULL)
    OR (status IN ('READY', 'PICKED_UP', 'SERVED') AND started_at IS NOT NULL AND started_by IS NOT NULL
        AND ready_at IS NOT NULL AND ready_at >= started_at AND ready_by IS NOT NULL));
ALTER TABLE fulfillment_unit ADD CONSTRAINT fulfillment_unit_serving_check CHECK (
    (status IN ('QUEUED', 'PREPARING', 'READY') AND picked_up_by IS NULL AND picked_up_at IS NULL AND served_by IS NULL AND served_at IS NULL)
    OR (status = 'PICKED_UP' AND picked_up_by IS NOT NULL AND picked_up_at IS NOT NULL AND picked_up_at >= ready_at AND served_by IS NULL AND served_at IS NULL)
    OR (status = 'SERVED' AND picked_up_by IS NOT NULL AND picked_up_at IS NOT NULL AND picked_up_at >= ready_at AND served_by IS NOT NULL AND served_at IS NOT NULL AND served_at >= picked_up_at));

-- One immutable record per accepted serving command, also used to resolve lost responses.
CREATE TABLE serving_operation (
    request_key UUID PRIMARY KEY,
    unit_id BIGINT NOT NULL REFERENCES fulfillment_unit(id) ON DELETE CASCADE,
    actor_id BIGINT NOT NULL REFERENCES staff_user(id),
    action VARCHAR(16) NOT NULL CHECK (action IN ('PICK_UP', 'RETURN', 'SERVE')),
    expected_version BIGINT NOT NULL CHECK (expected_version >= 0),
    from_status VARCHAR(24) NOT NULL,
    to_status VARCHAR(24) NOT NULL,
    reason VARCHAR(300) NOT NULL DEFAULT '',
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CHECK ((action = 'PICK_UP' AND from_status = 'READY' AND to_status = 'PICKED_UP')
        OR (action = 'RETURN' AND from_status = 'PICKED_UP' AND to_status = 'READY')
        OR (action = 'SERVE' AND from_status = 'PICKED_UP' AND to_status = 'SERVED')),
    CHECK ((action = 'RETURN' AND length(trim(reason)) BETWEEN 1 AND 300) OR (action <> 'RETURN' AND reason = '')),
    UNIQUE(unit_id, expected_version)
);
CREATE INDEX serving_operation_history ON serving_operation(unit_id, occurred_at);
