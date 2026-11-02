package com.restaurant.order.identity;

import java.sql.Connection;
import java.sql.SQLException;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/** Registered with Flyway by Boot only in demo; plaintext never enters SQL or migration history. */
@Component
@Profile("demo")
public class R__demo_serving_users extends BaseJavaMigration {
    private final PasswordEncoder encoder;
    private final Environment environment;

    public R__demo_serving_users(PasswordEncoder encoder, Environment environment) {
        this.encoder = encoder;
        this.environment = environment;
    }

    @Override
    // Increment this seed version when its behavior changes; never derive it from credentials.
    public Integer getChecksum() { return 1; }

    @Override
    public void migrate(Context context) throws SQLException {
        create(context.getConnection(), "nhanvien2", "Nhân viên demo 2", "STAFF", "DEMO_STAFF2_PASSWORD");
        create(context.getConnection(), "quanly", "Quản lý demo", "MANAGER", "DEMO_MANAGER_PASSWORD");
    }

    private void create(Connection connection, String username, String name, String role, String property) throws SQLException {
        try (var query = connection.prepareStatement("SELECT 1 FROM staff_user WHERE username = ?")) {
            query.setString(1, username);
            try (var rows = query.executeQuery()) { if (rows.next()) return; }
        }
        var password = environment.getProperty(property);
        if (password == null || password.length() < 16 || password.length() > 72 || password.startsWith("example_only")) {
            throw new IllegalStateException("Configure " + property + " (16–72 ASCII characters) before demo migration");
        }
        if (!password.chars().allMatch(character -> character >= 33 && character <= 126)) {
            throw new IllegalStateException("Demo passwords must contain printable ASCII characters without spaces");
        }
        try (var insert = connection.prepareStatement(
                "INSERT INTO staff_user(username,display_name,password_hash,role) VALUES (?,?,?,?) ON CONFLICT (username) DO NOTHING")) {
            insert.setString(1, username);
            insert.setString(2, name);
            insert.setString(3, encoder.encode(password));
            insert.setString(4, role);
            insert.executeUpdate();
        }
    }
}
