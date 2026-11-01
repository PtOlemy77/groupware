package com.nexus.groupware.config;

import com.nexus.groupware.repository.EmployeeRepository;
import com.nexus.groupware.security.AccountSessionFilter;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;

@Configuration
public class SecurityConfig {
  @Bean
  PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(12);
  }

  @Bean
  SecurityFilterChain securityFilterChain(HttpSecurity http, EmployeeRepository employees)
      throws Exception {
    var csrf = new HttpSessionCsrfTokenRepository();
    csrf.setHeaderName("X-CSRF-TOKEN");
    http.csrf(c -> c.csrfTokenRepository(csrf))
        .authorizeHttpRequests(a ->
            a.requestMatchers("/api/auth/csrf", "/api/auth/login", "/api/health", "/error")
                .permitAll()
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
