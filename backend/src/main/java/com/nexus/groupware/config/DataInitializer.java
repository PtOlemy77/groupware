package com.nexus.groupware.config;

import com.nexus.groupware.entity.Employee;
import com.nexus.groupware.repository.EmployeeRepository;
import java.time.LocalDate;
import java.util.Locale;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class DataInitializer implements CommandLineRunner {
  private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

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
    // 사용자가 수정한 데이터와 비밀번호를 매 서버 기동 시 덮어쓰지 않습니다.
    // DB가 비어있는 극초기(최초 부트스트랩) 시에만 최소 관리자 계정을 보장합니다.
    long count = employees.count();
    if (count > 0) {
      log.info("기존 DB 데이터({}건)가 존재하므로 초기화 덮어쓰기를 생략합니다.", count);
      return;
    }

    if (email.isBlank() || password.isBlank()) {
      log.info("부트스트랩 계정 설정이 제공되지 않았습니다.");
      return;
    }

    com.nexus.groupware.security.AuthService.validatePassword(password);
    Employee admin = new Employee();
    admin.setEmpNo("ADMIN-" + UUID.randomUUID().toString().substring(0, 8));
    admin.setName("시스템 관리자");
    admin.setEmail(email.trim().toLowerCase(Locale.ROOT));
    admin.setPhone("010-0000-0000");
    admin.setHireDate(LocalDate.now(java.time.ZoneId.of("Asia/Seoul")).toString());
    admin.setDepartmentCode("DEPT_MGMT");
    admin.setDepartment("경영지원팀");
    admin.setPositionCode("POS_STAFF");
    admin.setPosition("담당");
    admin.setRole("시스템 관리자");
    admin.setRoleCode("ROLE_ADMIN");
    admin.setPassword(encoder.encode(password));
    admin.setAccountEnabled(true);
    admin.setPasswordChangeRequired(false);
    admin.setSessionVersion(1L);
    employees.save(admin);
    log.info("최초 부트스트랩 시스템 관리자 계정이 생성되었습니다: {}", email);
  }
}
