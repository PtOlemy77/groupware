package com.nexus.groupware.config;

import com.nexus.groupware.code.RoleCode;
import com.nexus.groupware.entity.Employee;
import com.nexus.groupware.repository.EmployeeRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class DataInitializer implements CommandLineRunner {
  public static final String DEFAULT_INITIAL_PASSWORD = "spatialt2019!!";

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
    // Preserve every business row. Legacy credentials are migrated to standard initial password (spatialt2019!!).
    List<Employee> allEmployees = employees.findAll();
    for (Employee e : allEmployees) {
      if ("kiwoo@spatialt.co.kr".equalsIgnoreCase(e.getEmail()) || "우광일".equals(e.getName())) {
        e.setRole("시스템 관리자");
        e.setRoleCode("ROLE_ADMIN");
      } else {
        var rc = RoleCode.fromCodeOrLabel(e.getRoleCode() != null && !e.getRoleCode().isBlank() ? e.getRoleCode() : e.getRole());
        e.setRoleCode(rc.getCode());
        e.setRole(rc.getLabel());
      }

      // 공통 초기 비밀번호(spatialt2019!!)로 전 직원 일괄 설정 및 활성화
      e.setPassword(encoder.encode(DEFAULT_INITIAL_PASSWORD));
      e.setAccountEnabled(true);
      e.setPasswordChangeRequired(true);
      e.setSessionVersion(e.getSessionVersion() + 1);
    }
    employees.saveAll(allEmployees);
    employees.flush();
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
