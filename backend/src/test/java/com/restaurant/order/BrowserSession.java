package com.restaurant.order;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.http.HttpClient;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;

/** Real HTTP cookies/CSRF, without mock users or bypassing the security filter chain. */
class BrowserSession {
    static final String STAFF_PASSWORD = "TestStaffOnly_2026!";
    static final String KITCHEN_PASSWORD = "TestKitchenOnly_2026!";
    final CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
    final RestClient client;

    BrowserSession(int port) {
        client = RestClient.builder().baseUrl("http://127.0.0.1:" + port)
                .requestFactory(new JdkClientHttpRequestFactory(HttpClient.newBuilder().cookieHandler(cookies).build()))
                .build();
    }

    Map<?, ?> csrf() {
        return client.get().uri("/api/auth/csrf").retrieve().body(Map.class);
    }

    int login(String username, String password) {
        var form = new LinkedMultiValueMap<String, String>();
        form.add("username", username);
        form.add("password", password);
        var csrf = csrf();
        return client.post().uri("/api/auth/login").contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .header(csrf.get("headerName").toString(), csrf.get("token").toString()).body(form)
                .exchange((request, response) -> response.getStatusCode().value());
    }

    int getStatus(String path) {
        return client.get().uri(path).exchange((request, response) -> response.getStatusCode().value());
    }

    int logout() {
        var csrf = csrf();
        return client.post().uri("/api/auth/logout")
                .header(csrf.get("headerName").toString(), csrf.get("token").toString())
                .exchange((request, response) -> response.getStatusCode().value());
    }
}
