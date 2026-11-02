package com.restaurant.order.identity;

import jakarta.servlet.DispatcherType;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class SecurityConfiguration {
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
                .authorizeHttpRequests(access -> access
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        // Finish an already-authorized SSE response even if logout invalidated its
                        // session. Initial REQUEST dispatches still require KITCHEN below.
                        .requestMatchers(request -> request.getDispatcherType() == DispatcherType.ASYNC
                                && request.getMethod().equals("GET")
                                && (request.getRequestURI().equals(request.getContextPath() + "/api/kitchen/events")
                                    || request.getRequestURI().equals(request.getContextPath() + "/api/serving/events"))).permitAll()
                        .requestMatchers(HttpMethod.GET, "/", "/index.html", "/assets/**", "/menu-images/**", "/favicon.svg", "/favicon.ico",
                                "/actuator/health", "/api/menu", "/api/auth/csrf").permitAll()
                        .requestMatchers("/api/auth/login").permitAll()
                        // Guest endpoints validate a separate DB-backed device credential on every request.
                        // CSRF remains enabled, including pairing and submitting orders.
                        .requestMatchers("/api/guest/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/auth/me").authenticated()
                        .requestMatchers("/api/tables", "/api/tables/**", "/api/staff/**").hasRole("STAFF")
                        .requestMatchers("/api/kitchen/**").hasRole("KITCHEN")
                        .requestMatchers(HttpMethod.GET, "/api/serving/units/*/history").hasRole("MANAGER")
                        .requestMatchers("/api/serving/**").hasAnyRole("STAFF", "MANAGER")
                        .anyRequest().denyAll())
                // Keep Spring's session CSRF repository and masked tokens. The SPA fetches a fresh
                // token before each POST; login and logout clear the previous token by default.
                .formLogin(login -> login.loginProcessingUrl("/api/auth/login")
                        .successHandler((request, response, authentication) -> response.setStatus(204))
                        .failureHandler((request, response, failure) -> error(response, 401,
                                "Tên đăng nhập hoặc mật khẩu không đúng.")))
                .logout(logout -> logout.logoutUrl("/api/auth/logout").deleteCookies("JSESSIONID")
                        .logoutSuccessHandler((request, response, authentication) -> response.setStatus(204)))
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, exception) -> error(response, 401,
                                "Phiên đăng nhập đã hết hạn hoặc bạn chưa đăng nhập."))
                        .accessDeniedHandler((request, response, exception) -> error(response, 403,
                                "Yêu cầu không được phép. Kiểm tra quyền hoặc tải lại phiên rồi thử lại.")))
                .requestCache(cache -> cache.disable())
                .build();
    }

    private static void error(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        response.setHeader("Cache-Control", "no-store");
        response.getWriter().write("{\"message\":\"" + message + "\"}");
    }
}
