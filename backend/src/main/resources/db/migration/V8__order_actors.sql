-- Legacy batches were submitted by guest devices; keep their snapshots unchanged.
ALTER TABLE order_batch ADD COLUMN created_by BIGINT REFERENCES staff_user(id);
