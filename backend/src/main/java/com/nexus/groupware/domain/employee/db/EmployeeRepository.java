package com.nexus.groupware.domain.employee.db;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmployeeRepository extends JpaRepository<Employee, Long> {
  List<Employee> findAllByOrderByIdDesc();

  Optional<Employee> findByEmpNo(String empNo);

  Optional<Employee> findByEmailIgnoreCase(String email);

  java.util.List<Employee> findAllByName(String name);

  Optional<Employee> findByName(String name);
}
