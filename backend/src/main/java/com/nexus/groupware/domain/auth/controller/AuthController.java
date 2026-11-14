package com.nexus.groupware.domain.auth.controller;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.nexus.groupware.core.security.AuthService;
import com.nexus.groupware.domain.employee.db.Employee;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  public record CsrfResponse(String token) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record LoginRequest(String identifier, String password) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record PasswordChangeRequest(String currentPassword, String newPassword) {}

  public record AuthUserResponse(boolean ok, Employee user) {}

  public record CurrentUserResponse(Employee user) {}

  public record OkResponse(boolean ok) {}

  private final AuthService auth;

  public AuthController(AuthService auth) {
    this.auth = auth;
  }

  @GetMapping("/csrf")
  public CsrfResponse csrf(CsrfToken token) {
    return new CsrfResponse(token.getToken());
  }

  @PostMapping("/login")
  public AuthUserResponse login(@RequestBody LoginRequest request, HttpServletRequest httpRequest) {
    return new AuthUserResponse(
        true, auth.login(request.identifier(), request.password(), httpRequest));
  }

  @GetMapping("/me")
  public CurrentUserResponse me() {
    return new CurrentUserResponse(auth.current());
  }

  @PostMapping("/password")
  public AuthUserResponse password(
      @RequestBody PasswordChangeRequest request, HttpServletRequest httpRequest) {
    return new AuthUserResponse(
        true,
        auth.changePassword(request.currentPassword(), request.newPassword(), httpRequest));
  }

  @PostMapping("/logout")
  public OkResponse logout(HttpServletRequest httpRequest) {
    var session = httpRequest.getSession(false);
    if (session != null) {
      session.invalidate();
    }
    SecurityContextHolder.clearContext();
    return new OkResponse(true);
  }
}
