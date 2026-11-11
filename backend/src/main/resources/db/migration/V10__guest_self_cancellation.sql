ALTER TABLE cancellation_request DROP CONSTRAINT cancellation_request_status_check;
ALTER TABLE cancellation_request ADD CONSTRAINT cancellation_request_status_check
    CHECK (status IN ('PENDING','APPROVED','REJECTED','SUPERSEDED'));

-- An old request to review is not consent to cancel automatically.
UPDATE cancellation_request SET status = 'SUPERSEDED' WHERE status = 'PENDING';

CREATE TABLE guest_cancellation (
    request_key UUID PRIMARY KEY,
    unit_id BIGINT NOT NULL UNIQUE REFERENCES fulfillment_unit(id) ON DELETE CASCADE,
    guest_device_hash VARCHAR(64) NOT NULL REFERENCES guest_device(token_hash),
    expected_version BIGINT NOT NULL CHECK (expected_version >= 0),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
