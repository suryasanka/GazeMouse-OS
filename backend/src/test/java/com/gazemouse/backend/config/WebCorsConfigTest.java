package com.gazemouse.backend.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;
import org.springframework.web.servlet.config.annotation.CorsRegistration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class WebCorsConfigTest {

    @RestController
    @RequestMapping("/api/v1/test")
    static class DummyApiController {
        @GetMapping
        public ResponseEntity<String> get() {
            return ResponseEntity.ok("ok");
        }

        @PostMapping
        public ResponseEntity<String> post() {
            return ResponseEntity.ok("created");
        }
    }

    private WebCorsConfig webCorsConfig;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() throws Exception {
        // Load application.yml dynamically into a MockEnvironment to verify real configuration binding
        MockEnvironment environment = new MockEnvironment();
        YamlPropertySourceLoader loader = new YamlPropertySourceLoader();
        ClassPathResource resource = new ClassPathResource("application.yml");
        List<PropertySource<?>> propertySources = loader.load("application.yml", resource);
        for (PropertySource<?> propertySource : propertySources) {
            environment.getPropertySources().addLast(propertySource);
        }

        webCorsConfig = new WebCorsConfig(environment);

        // Build a CorsFilter directly using the CorsConfiguration registered by WebCorsConfig
        UrlBasedCorsConfigurationSource configurationSource = new UrlBasedCorsConfigurationSource();
        CorsRegistry registry = new CorsRegistry();
        webCorsConfig.addCorsMappings(registry);

        Map<String, CorsConfiguration> configs = extractCorsConfigurations(registry);
        for (Map.Entry<String, CorsConfiguration> entry : configs.entrySet()) {
            configurationSource.registerCorsConfiguration(entry.getKey(), entry.getValue());
        }

        mockMvc = MockMvcBuilders.standaloneSetup(new DummyApiController())
                .addFilters(new CorsFilter(configurationSource))
                .build();
    }

    @SuppressWarnings("unchecked")
    private Map<String, CorsConfiguration> extractCorsConfigurations(CorsRegistry registry) {
        try {
            Field registrationsField = CorsRegistry.class.getDeclaredField("registrations");
            registrationsField.setAccessible(true);
            List<CorsRegistration> registrations = (List<CorsRegistration>) registrationsField.get(registry);

            UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
            for (CorsRegistration registration : registrations) {
                Field configField = CorsRegistration.class.getDeclaredField("config");
                configField.setAccessible(true);
                CorsConfiguration config = (CorsConfiguration) configField.get(registration);

                Field pathPatternField = CorsRegistration.class.getDeclaredField("pathPattern");
                pathPatternField.setAccessible(true);
                String pathPattern = (String) pathPatternField.get(registration);

                source.registerCorsConfiguration(pathPattern, config);
            }
            return source.getCorsConfigurations();
        } catch (Exception e) {
            throw new RuntimeException("Failed to extract CORS configurations", e);
        }
    }

    @Test
    @DisplayName("WebCorsConfig binds allowed-origins from application.yml dynamically")
    void shouldBindAllowedOriginsFromApplicationYml() {
        List<String> origins = webCorsConfig.getAllowedOrigins();
        assertThat(origins).containsExactlyInAnyOrder(
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "https://gazemouse-os.pages.dev"
        );
        assertThat(origins).doesNotContain("*");
    }

    @Test
    @DisplayName("CorsRegistry registers /api/** with required methods, headers, and disabled credentials")
    void shouldRegisterCorrectCorsMappingParameters() {
        CorsRegistry registry = new CorsRegistry();
        webCorsConfig.addCorsMappings(registry);
        Map<String, CorsConfiguration> configs = extractCorsConfigurations(registry);

        assertThat(configs).containsKey("/api/**");
        CorsConfiguration apiConfig = configs.get("/api/**");

        assertThat(apiConfig.getAllowedOrigins()).containsExactlyInAnyOrder(
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "https://gazemouse-os.pages.dev"
        );
        assertThat(apiConfig.getAllowedMethods()).containsExactlyInAnyOrder("GET", "PUT", "POST", "OPTIONS");
        assertThat(apiConfig.getAllowedHeaders()).containsExactlyInAnyOrder("Content-Type", "Accept", "X-Installation-Id");
        assertThat(apiConfig.getAllowCredentials()).isFalse();
        assertThat(apiConfig.getMaxAge()).isEqualTo(3600L);
    }

    @Test
    @DisplayName("Preflight OPTIONS from localhost:5173 receives allowed CORS headers")
    void shouldAllowPreflightForLocalhost5173() throws Exception {
        mockMvc.perform(options("/api/v1/test")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"))
                .andExpect(header().string("Access-Control-Allow-Methods", "GET,PUT,POST,OPTIONS"));
    }

    @Test
    @DisplayName("Preflight OPTIONS from production https://gazemouse-os.pages.dev with X-Installation-Id receives 200 OK")
    void shouldAllowPreflightForProductionDomainWithInstallationIdHeader() throws Exception {
        mockMvc.perform(options("/api/v1/test")
                        .header("Origin", "https://gazemouse-os.pages.dev")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "X-Installation-Id,Content-Type"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://gazemouse-os.pages.dev"))
                .andExpect(header().string("Access-Control-Allow-Headers", "X-Installation-Id, Content-Type"));
    }

    @Test
    @DisplayName("Preflight OPTIONS from unconfigured origin is rejected without allow-origin header")
    void shouldRejectPreflightFromDisallowedOrigin() throws Exception {
        mockMvc.perform(options("/api/v1/test")
                        .header("Origin", "https://unauthorized-domain.com")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }

    @Test
    @DisplayName("Actual GET request from allowed origin includes Access-Control-Allow-Origin header")
    void shouldIncludeCorsHeadersOnActualGetRequest() throws Exception {
        mockMvc.perform(get("/api/v1/test")
                        .header("Origin", "http://localhost:5173"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));
    }

    @Test
    @DisplayName("WebCorsConfig handles empty origins gracefully")
    void shouldHandleEmptyOriginsGracefully() {
        WebCorsConfig emptyConfig = new WebCorsConfig(List.of());
        CorsRegistry registry = new CorsRegistry();
        emptyConfig.addCorsMappings(registry);

        Map<String, CorsConfiguration> configs = extractCorsConfigurations(registry);
        assertThat(configs).isEmpty();
    }
}

