package com.nexus.groupware.security;

import com.nexus.groupware.repository.EmployeeRepository;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.time.Instant;
import java.util.Objects;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

public class AccountSessionFilter extends OncePerRequestFilter {
  private final EmployeeRepository employees;

  public AccountSessionFilter(EmployeeRepository e) {
    employees = e;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest req, HttpServletResponse res, FilterChain chain)
      throws ServletException, IOException {
    var a = SecurityContextHolder.getContext().getAuthentication();
    if (a != null && a.isAuthenticated() && !"anonymousUser".equals(a.getPrincipal())) {
      var session = req.getSession(false);
      var emp = employees.findById(Long.valueOf(a.getName())).orElse(null);
      var signedAt = session == null ? null : (Instant) session.getAttribute("authenticatedAt");
      if (emp == null
          || session == null
          || !Boolean.TRUE.equals(emp.getAccountEnabled())
          || !"재직".equals(emp.getStatus())
          || !Objects.equals(emp.getSessionVersion(), session.getAttribute("credentialVersion"))
          || signedAt == null
          || signedAt.plusSeconds(43200).isBefore(Instant.now())) {
        if (session != null) session.invalidate();
        SecurityContextHolder.clearContext();
        res.setStatus(401);
        res.setContentType("application/json;charset=UTF-8");
        res.getWriter().write("{\"message\":\"세션이 만료되었습니다. 다시 로그인하세요.\"}");
        return;
      }
      if (Boolean.TRUE.equals(emp.getPasswordChangeRequired())
          && !req.getRequestURI().startsWith("/api/auth/")) {
        res.setStatus(403);
        res.setContentType("application/json;charset=UTF-8");
        res.getWriter()
            .write("{\"code\":\"PASSWORD_CHANGE_REQUIRED\",\"message\":\"비밀번호를 먼저 변경하세요.\"}");
        return;
      }
    }
    chain.doFilter(req, res);
  }
}
