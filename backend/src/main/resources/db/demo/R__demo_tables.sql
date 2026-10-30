-- Synthetic demo data only. Re-running never resets an existing table's state.
INSERT INTO restaurant_table (code, display_name, area, seats, status)
SELECT
    'B' || lpad(n::text, 2, '0'),
    'Bàn ' || lpad(n::text, 2, '0'),
    CASE WHEN n <= 15 THEN 'Khu A' ELSE 'Khu B' END,
    4,
    'AVAILABLE'
FROM generate_series(1, 30) AS n
ON CONFLICT (code) DO NOTHING;
