package com.restaurant.order.identity;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class IdentityConfiguration {
    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    UserDetailsService staffUsers(JdbcTemplate jdbc) {
        return username -> jdbc.query(
                "SELECT username, password_hash, role, enabled FROM staff_user WHERE username = ?",
                (row, index) -> User.withUsername(row.getString("username"))
                        .password(row.getString("password_hash")).roles(row.getString("role"))
                        .disabled(!row.getBoolean("enabled")).build(), username)
                .stream().findFirst().orElseThrow(() -> new UsernameNotFoundException("Invalid credentials"));
    }
}
