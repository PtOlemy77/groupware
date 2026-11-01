package com.nexus.groupware.config;

import com.nexus.groupware.entity.Employee;
import com.nexus.groupware.repository.EmployeeRepository;
import java.time.LocalDate;
import java.util.Locale;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class DataInitializer implements CommandLineRunner {
  private final EmployeeRepository employees;
  private final PasswordEncoder encoder;

  @Value("${app.bootstrap.email:}")
  private String email;

  @Value("${app.bootstrap.password:}")
  private String password;

  public DataInitializer(EmployeeRepository e, PasswordEncoder p) {
    employees = e;
    encoder = p;
  }

  @Override
  @Transactional
  public void run(String... args) {
    // Preserve every business row. Legacy credentials are migrated, never compared as plaintext.
    for (Employee e : employees.findAll()) {
      if ("관리자 권한".equals(e.getRole()) || "경영팀 권한".equals(e.getRole())) e.setRole("시스템 관리자");
      else if (e.getRole() == null || e.getRole().isBlank()) e.setRole("일반직원");
      if (e.getPassword() == null || !e.getPassword().matches("^[$]2[aby][$][0-9]{2}[$].{53}$")) {
        String old = e.getPassword();
        e.setPassword(
            encoder.encode(old == null || old.isBlank() ? UUID.randomUUID().toString() : old));
        e.setAccountEnabled(old != null && old.length() >= 12);
        e.setPasswordChangeRequired(true);
        e.setSessionVersion(e.getSessionVersion() + 1);
      }
    }
    if (email.isBlank()
        || password.isBlank()
        || employees.findAll().stream()
            .anyMatch(e ->
                "시스템 관리자".equals(e.getRole())
                    && Boolean.TRUE.equals(e.getAccountEnabled())
                    && "재직".equals(e.getStatus()))) return;
    com.nexus.groupware.security.AuthService.validatePassword(password);
    Employee e = employees.findByEmailIgnoreCase(email.trim()).orElse(null);
    if (e != null) {
      if (!"재직".equals(e.getStatus()))
        throw new IllegalArgumentException("퇴사·휴직 계정은 관리자 복구 대상으로 사용할 수 없습니다.");
      e.setPassword(encoder.encode(password));
      e.setRole("시스템 관리자");
      e.setAccountEnabled(true);
      e.setPasswordChangeRequired(true);
      e.setSessionVersion(e.getSessionVersion() + 1);
      return;
    }
    e = new Employee();
    e.setEmpNo("ADMIN-" + UUID.randomUUID());
    e.setName("시스템 관리자");
    e.setEmail(email.trim().toLowerCase(Locale.ROOT));
    e.setPhone("");
    e.setHireDate(LocalDate.now(java.time.ZoneId.of("Asia/Seoul")).toString());
    e.setDepartmentCode("DEPT_MGMT");
    e.setDepartment("경영지원팀");
    e.setPositionCode("POS_STAFF");
    e.setPosition("담당");
    e.setRole("시스템 관리자");
    e.setStatus("재직");
    e.setPassword(encoder.encode(password));
    e.setAccountEnabled(true);
    e.setPasswordChangeRequired(true);
    employees.save(e);
  }
}
