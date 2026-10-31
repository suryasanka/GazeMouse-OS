package com.gazemouse.backend.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.bind.Bindable;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.ArrayList;
import java.util.List;

/**
 * Spring Web MVC CORS configuration for GazeMouse-OS REST APIs.
 * Binds allowed origins dynamically from app.cors.allowed-origins in application.yml.
 */
@Configuration
public class WebCorsConfig implements WebMvcConfigurer {

    private final List<String> allowedOrigins;

    @Autowired
    public WebCorsConfig(Environment environment) {
        if (environment != null) {
            this.allowedOrigins = Binder.get(environment)
                    .bind("app.cors.allowed-origins", Bindable.listOf(String.class))
                    .orElseGet(ArrayList::new);
        } else {
            this.allowedOrigins = new ArrayList<>();
        }
    }

    // Package-private constructor for unit and slice testing without Spring context
    WebCorsConfig(List<String> allowedOrigins) {
        this.allowedOrigins = allowedOrigins != null ? new ArrayList<>(allowedOrigins) : new ArrayList<>();
    }

    public List<String> getAllowedOrigins() {
        return List.copyOf(allowedOrigins);
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        if (allowedOrigins.isEmpty()) {
            return;
        }

        registry.addMapping("/api/**")
                .allowedOrigins(allowedOrigins.toArray(new String[0]))
                .allowedMethods("GET", "PUT", "POST", "OPTIONS")
                .allowedHeaders("Content-Type", "Accept", "X-Installation-Id")
                .allowCredentials(false)
                .maxAge(3600);
    }
}

