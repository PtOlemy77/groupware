package com.nexus.groupware.domain.auth.controller;

import com.nexus.groupware.domain.employee.db.Employee;
import com.nexus.groupware.core.security.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private final AuthService auth;

  public AuthController(AuthService a) {
    auth = a;
  }

  @GetMapping("/csrf")
  public Map<String, String> csrf(CsrfToken token) {
    return Map.of("token", token.getToken());
  }

  @PostMapping("/login")
  public Map<String, Object> login(@RequestBody Map<String, String> p, HttpServletRequest req) {
    return Map.of("ok", true, "user", auth.login(p.get("identifier"), p.get("password"), req));
  }

  @GetMapping("/me")
  public Map<String, Employee> me() {
    return Map.of("user", auth.current());
  }

  @PostMapping("/password")
  public Map<String, Object> password(@RequestBody Map<String, String> p, HttpServletRequest req) {
    return Map.of(
        "ok",
        true,
        "user",
        auth.changePassword(p.get("current_password"), p.get("new_password"), req));
  }

  @PostMapping("/logout")
  public Map<String, Boolean> logout(HttpServletRequest req) {
    var s = req.getSession(false);
    if (s != null) s.invalidate();
    SecurityContextHolder.clearContext();
    return Map.of("ok", true);
  }
}
