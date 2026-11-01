package com.nexus.groupware.repository;

import com.nexus.groupware.entity.Employee;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EmployeeRepository extends JpaRepository<Employee, Long> {
    List<Employee> findAllByOrderByIdDesc();
    Optional<Employee> findByEmpNo(String empNo);
    Optional<Employee> findByName(String name);
}
