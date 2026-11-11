ALTER TABLE fulfillment_unit ADD COLUMN bill_excluded BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE fulfillment_unit DROP CONSTRAINT fulfillment_unit_status_check;
ALTER TABLE fulfillment_unit ADD CONSTRAINT fulfillment_unit_status_check CHECK (status IN ('QUEUED','PREPARING','READY','PICKED_UP','SERVED','CANCELLED'));
ALTER TABLE fulfillment_unit DROP CONSTRAINT fulfillment_unit_lifecycle_check;
ALTER TABLE fulfillment_unit ADD CONSTRAINT fulfillment_unit_lifecycle_check CHECK (
    (status = 'QUEUED' AND started_at IS NULL AND started_by IS NULL AND ready_at IS NULL AND ready_by IS NULL)
    OR (status = 'PREPARING' AND started_at IS NOT NULL AND started_by IS NOT NULL AND ready_at IS NULL AND ready_by IS NULL)
    OR (status IN ('READY','PICKED_UP','SERVED') AND started_at IS NOT NULL AND started_by IS NOT NULL AND ready_at IS NOT NULL AND ready_at >= started_at AND ready_by IS NOT NULL)
    OR (status = 'CANCELLED' AND bill_excluded AND (started_at IS NULL) = (started_by IS NULL)
        AND (ready_at IS NULL) = (ready_by IS NULL) AND (ready_at IS NULL OR (started_at IS NOT NULL AND ready_at >= started_at))));
ALTER TABLE fulfillment_unit DROP CONSTRAINT fulfillment_unit_serving_check;
ALTER TABLE fulfillment_unit ADD CONSTRAINT fulfillment_unit_serving_check CHECK (
    (status IN ('QUEUED','PREPARING','READY') AND picked_up_by IS NULL AND picked_up_at IS NULL AND served_by IS NULL AND served_at IS NULL)
    OR (status = 'PICKED_UP' AND picked_up_by IS NOT NULL AND picked_up_at IS NOT NULL AND picked_up_at >= ready_at AND served_by IS NULL AND served_at IS NULL)
    OR (status = 'SERVED' AND picked_up_by IS NOT NULL AND picked_up_at IS NOT NULL AND picked_up_at >= ready_at AND served_by IS NOT NULL AND served_at IS NOT NULL AND served_at >= picked_up_at)
    OR (status = 'CANCELLED' AND served_by IS NULL AND served_at IS NULL AND (picked_up_by IS NULL) = (picked_up_at IS NULL)
        AND (picked_up_at IS NULL OR (ready_at IS NOT NULL AND picked_up_at >= ready_at))));
ALTER TABLE fulfillment_unit ADD CONSTRAINT excluded_unit_check CHECK (NOT bill_excluded OR status IN ('CANCELLED','SERVED'));

CREATE TABLE cancellation_request (
    request_key UUID PRIMARY KEY,
    unit_id BIGINT NOT NULL REFERENCES fulfillment_unit(id) ON DELETE CASCADE,
    requested_by VARCHAR(64) NOT NULL REFERENCES guest_device(token_hash),
    reason VARCHAR(300) NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 300),
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX one_pending_cancellation ON cancellation_request(unit_id) WHERE status = 'PENDING';
CREATE TABLE cancellation_operation (
    request_key UUID PRIMARY KEY,
    unit_id BIGINT NOT NULL REFERENCES fulfillment_unit(id) ON DELETE CASCADE,
    actor_id BIGINT NOT NULL REFERENCES staff_user(id),
    expected_version BIGINT NOT NULL CHECK (expected_version >= 0),
    action VARCHAR(16) NOT NULL CHECK (action IN ('APPROVE','REJECT','CANCEL','EXCLUDE')),
    cancellation_key UUID REFERENCES cancellation_request(request_key),
    reason VARCHAR(300) NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 300),
    from_status VARCHAR(24) NOT NULL,
    to_status VARCHAR(24) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE(unit_id, expected_version)
);
