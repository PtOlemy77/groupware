package com.nexus.groupware.core.security;

import com.nexus.groupware.domain.employee.db.EmployeeRepository;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpMethod;
import org.springframework.security.access.expression.method.DefaultMethodSecurityExpressionHandler;
import org.springframework.security.access.expression.method.MethodSecurityExpressionHandler;
import org.springframework.security.access.hierarchicalroles.RoleHierarchy;
import org.springframework.security.access.hierarchicalroles.RoleHierarchyImpl;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;

@Configuration
@EnableMethodSecurity(prePostEnabled = true)
public class SecurityConfig {
  @Bean
  PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(12);
  }

  @Bean
  RoleHierarchy roleHierarchy() {
    return RoleHierarchyImpl.withDefaultRolePrefix()
        .role("ADMIN").implies("EXEC")
        .role("EXEC").implies("PM")
        .role("PM").implies("STAFF")
        .role("STAFF").implies("USER")
        .build();
  }

  @Bean
  MethodSecurityExpressionHandler methodSecurityExpressionHandler(RoleHierarchy roleHierarchy) {
    var handler = new DefaultMethodSecurityExpressionHandler();
    handler.setRoleHierarchy(roleHierarchy);
    return handler;
  }

  @Bean
  SecurityFilterChain securityFilterChain(HttpSecurity http, EmployeeRepository employees)
      throws Exception {
    var csrf = new HttpSessionCsrfTokenRepository();
    csrf.setHeaderName("X-CSRF-TOKEN");
    http.csrf(c -> c.csrfTokenRepository(csrf))
        .authorizeHttpRequests(a ->
            a.requestMatchers(HttpMethod.GET, "/api/portal/notices", "/api/portal/notices/*")
                .permitAll()
                .requestMatchers("/api/auth/csrf", "/api/auth/login", "/api/health", "/error")
                .permitAll()
                .requestMatchers("/api/portal/admin/**")
                .hasRole("ADMIN")
                .anyRequest()
                .authenticated())
        .sessionManagement(s -> s.sessionFixation(f -> f.changeSessionId()))
        .securityContext(c -> c.requireExplicitSave(true))
        .requestCache(AbstractHttpConfigurer::disable)
        .formLogin(AbstractHttpConfigurer::disable)
        .httpBasic(AbstractHttpConfigurer::disable)
        .logout(AbstractHttpConfigurer::disable)
        .exceptionHandling(e ->
            e.authenticationEntryPoint(
                    (r, s, x) -> {
                      s.setStatus(401);
                      s.setContentType("application/json;charset=UTF-8");
                      s.getWriter().write("{\"message\":\"로그인이 필요합니다.\"}");
                    })
                .accessDeniedHandler((r, s, x) -> {
                  s.setStatus(403);
                  s.setContentType("application/json;charset=UTF-8");
                  s.getWriter().write("{\"message\":\"접근 권한 또는 CSRF 토큰을 확인하세요.\"}");
                }))
        .headers(h ->
            h.contentSecurityPolicy(
                c -> c.policyDirectives("default-src 'none'; frame-ancestors 'none'")))
        .addFilterBefore(new AccountSessionFilter(employees), AuthorizationFilter.class);
    return http.build();
  }
}
