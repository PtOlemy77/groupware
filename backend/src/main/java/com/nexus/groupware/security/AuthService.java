package com.nexus.groupware.security;

import com.nexus.groupware.code.RoleCode;
import com.nexus.groupware.entity.Employee;
import com.nexus.groupware.repository.EmployeeRepository;
import jakarta.servlet.http.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {
  private final EmployeeRepository employees;
  private final PasswordEncoder passwords;
  private final String dummyHash;

  private record Attempt(int failures, Instant expires) {}

  private final Map<Long, Deque<HttpSession>> sessions = new ConcurrentHashMap<>();
  private final Map<String, Attempt> attempts = new ConcurrentHashMap<>();

  public AuthService(EmployeeRepository e, PasswordEncoder p) {
    employees = e;
    passwords = p;
    dummyHash = p.encode(UUID.randomUUID().toString());
  }

  public static void validatePassword(String password) {
    if (password == null
        || password.length() < 12
        || password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72)
      throw new IllegalArgumentException("비밀번호는 12자 이상, UTF-8 72바이트 이하여야 합니다.");
  }

  public Employee current() {
    var a = SecurityContextHolder.getContext().getAuthentication();
    if (a == null || !a.isAuthenticated() || "anonymousUser".equals(a.getPrincipal()))
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
    return employees
        .findById(Long.valueOf(a.getName()))
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
  }

  @Transactional
  public Employee login(String identifier, String password, HttpServletRequest request) {
    String email = identifier == null ? "" : identifier.trim().toLowerCase(Locale.ROOT);
    if (!email.contains("@")) email += "@spatialt.co.kr";
    // Bound memory and rate-limit both the normalized account and the direct client address.
    attempts.entrySet().removeIf(e -> e.getValue().expires().isBefore(Instant.now()));
    List<String> keys = List.of("account:" + email, "ip:" + request.getRemoteAddr());
    for (String key : keys) {
      var a = attempts.get(key);
      if (a != null && a.failures() >= (key.startsWith("account:") ? 10 : 1000))
        throw new ResponseStatusException(
            HttpStatus.TOO_MANY_REQUESTS, "로그인 시도가 많습니다. 15분 후 다시 시도하세요.");
    }
    Employee emp = employees.findByEmailIgnoreCase(email).orElse(null);
    boolean valid =
        passwords.matches(
            password == null ? "" : password,
            emp == null || emp.getPassword() == null ? dummyHash : emp.getPassword());
    if (!valid
        || emp == null
        || !Boolean.TRUE.equals(emp.getAccountEnabled())
        || !"재직".equals(emp.getStatus())) {
      if (attempts.size() > 10000)
        throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "잠시 후 다시 시도하세요.");
      for (String key : keys)
        attempts.compute(
            key,
            (k, a) ->
                new Attempt(a == null ? 1 : a.failures() + 1, Instant.now().plusSeconds(900)));
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "아이디 또는 비밀번호를 확인하세요.");
    }
    attempts.remove("account:" + email);
    var old = request.getSession(false);
    if (old != null) old.invalidate();
    establish(emp, request);
    return emp;
  }

  public void establish(Employee emp, HttpServletRequest request) {
    var authentication =
        UsernamePasswordAuthenticationToken.authenticated(
            emp.getId().toString(), null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
    var context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(authentication);
    SecurityContextHolder.setContext(context);
    var session = request.getSession(true);
    session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);
    session.setAttribute("credentialVersion", emp.getSessionVersion());
    session.setAttribute("authenticatedAt", Instant.now());
    var active = sessions.computeIfAbsent(emp.getId(), k -> new ArrayDeque<>());
    synchronized (active) {
      active.removeIf(s -> {
        try {
          s.getCreationTime();
          return false;
        } catch (IllegalStateException e) {
          return true;
        }
      });
      while (active.size() >= 3) {
        try {
          active.removeFirst().invalidate();
        } catch (IllegalStateException ignored) {
        }
      }
      active.addLast(session);
    }
  }

  @Transactional
  public Employee changePassword(String current, String next, HttpServletRequest request) {
    Employee emp = current();
    if (!passwords.matches(current == null ? "" : current, emp.getPassword()))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "현재 비밀번호를 확인하세요.");
    validatePassword(next);
    if (passwords.matches(next, emp.getPassword()))
      throw new IllegalArgumentException("새 비밀번호는 기존 비밀번호와 달라야 합니다.");
    emp.setPassword(passwords.encode(next));
    emp.setPasswordChangeRequired(false);
    emp.setSessionVersion(emp.getSessionVersion() + 1);
    employees.flush();
    request.changeSessionId();
    request.getSession().setAttribute("credentialVersion", emp.getSessionVersion());
    return emp;
  }

  public static boolean admin(Employee e) {
    if (e == null) return false;
    RoleCode rc = RoleCode.fromCodeOrLabel(e.getRoleCode() != null ? e.getRoleCode() : e.getRole());
    return rc.isAdmin();
  }

  public static boolean executive(Employee e) {
    if (e == null) return false;
    RoleCode rc = RoleCode.fromCodeOrLabel(e.getRoleCode() != null ? e.getRoleCode() : e.getRole());
    return rc.isExecutiveOrAbove();
  }

  public static boolean pm(Employee e) {
    if (e == null) return false;
    RoleCode rc = RoleCode.fromCodeOrLabel(e.getRoleCode() != null ? e.getRoleCode() : e.getRole());
    return rc.isPmOrAbove();
  }
}
