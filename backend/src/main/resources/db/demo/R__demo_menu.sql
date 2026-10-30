-- Synthetic sample menu. Never overwrite existing names, prices or availability.
INSERT INTO menu_category (code, name, display_order) VALUES
    ('KHAI_VI', 'Khai vị', 10),
    ('MON_CHINH', 'Món chính', 20),
    ('DO_UONG', 'Đồ uống', 30)
ON CONFLICT (code) DO NOTHING;

INSERT INTO menu_item (code, category_id, name, price_vnd, image_path, available, display_order)
SELECT sample.code, category.id, sample.name, sample.price_vnd, sample.image_path, sample.available, sample.display_order
FROM (VALUES
    ('GOI_CUON', 'KHAI_VI', 'Gỏi cuốn tôm', 45000, '/menu-images/goi-cuon.svg', TRUE, 10),
    ('NEM_RAN', 'KHAI_VI', 'Nem rán giòn', 55000, '/menu-images/nem-ran.svg', TRUE, 20),
    ('COM_GA', 'MON_CHINH', 'Cơm gà nướng', 85000, '/menu-images/com-ga.svg', TRUE, 10),
    ('BUN_CHA', 'MON_CHINH', 'Bún chả Hà Nội', 75000, '/menu-images/bun-cha.svg', FALSE, 20),
    ('TRA_DAO', 'DO_UONG', 'Trà đào cam sả', 35000, '/menu-images/tra-dao.svg', TRUE, 10),
    ('NUOC_CHANH', 'DO_UONG', 'Nước chanh tươi', 25000, '/menu-images/nuoc-chanh.svg', TRUE, 20)
) AS sample(code, category_code, name, price_vnd, image_path, available, display_order)
JOIN menu_category category ON category.code = sample.category_code
ON CONFLICT (code) DO NOTHING;
