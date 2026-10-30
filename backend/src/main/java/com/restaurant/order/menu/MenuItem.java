package com.restaurant.order.menu;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "menu_item")
public class MenuItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true, length = 40)
    private String code;
    @Column(name = "category_id", nullable = false)
    private long categoryId;
    @Column(nullable = false, length = 160)
    private String name;
    @Column(name = "price_vnd", nullable = false)
    private long priceVnd;
    @Column(name = "image_path", nullable = false, length = 255)
    private String imagePath;
    @Column(nullable = false)
    private boolean available;
    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    protected MenuItem() { }

    public long categoryId() { return categoryId; }
    public MenuSnapshot.Item toView() {
        return new MenuSnapshot.Item(id, name, priceVnd, imagePath, available);
    }
}
