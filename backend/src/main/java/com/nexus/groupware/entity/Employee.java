package com.nexus.groupware.entity;

import com.nexus.groupware.code.DepartmentCode;
import com.nexus.groupware.code.PositionCode;
import com.nexus.groupware.code.RoleCode;
import com.nexus.groupware.code.StatusCode;
import jakarta.persistence.*;

@Entity
@Table(name = "employees")
public class Employee extends VersionedEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "emp_no", nullable = false, unique = true)
  private String empNo;

  @Column(nullable = false)
  private String name;

  @Column(name = "department_code", columnDefinition = "varchar(50) default 'DEPT_RND'")
  private String departmentCode = "DEPT_RND";

  @Column(nullable = false)
  private String department;

  @Column(name = "position_code", columnDefinition = "varchar(50) default 'POS_STAFF'")
  private String positionCode = "POS_STAFF";

  @Column(nullable = false)
  private String position;

  @Column(nullable = false, unique = true)
  private String email;

  @Column(nullable = false)
  private String phone;

  @Column(name = "hire_date", nullable = false)
  @Convert(converter = IsoDateConverter.class)
  private String hireDate;

  @Column(name = "status_code", columnDefinition = "varchar(50) default 'STATUS_ACTIVE'")
  private String statusCode = "STATUS_ACTIVE";

  @Column(nullable = false)
  private String status = "재직";

  @Column(name = "leave_remaining", nullable = false)
  private Double leaveRemaining = 15.0;

  @Column(name = "leave_total", nullable = false)
  private Double leaveTotal = 15.0;

  @Column(nullable = false)
  private String skills = "";

  @Column(name = "avatar_color", nullable = false)
  private String avatarColor = "indigo";

  @Column(name = "role", columnDefinition = "varchar(50) default '일반직원'")
  private String role = "일반직원";

  @Column(name = "role_code", columnDefinition = "varchar(50) default 'ROLE_STAFF'")
  private String roleCode = "ROLE_STAFF";

  @Column(name = "password", length = 100)
  private String password;

  @Column(name = "account_enabled")
  private Boolean accountEnabled = false;

  public Boolean getAccountEnabled() {
    return accountEnabled;
  }

  public void setAccountEnabled(Boolean value) {
    accountEnabled = value;
  }

  @Column(name = "password_change_required")
  private Boolean passwordChangeRequired = true;

  public Boolean getPasswordChangeRequired() {
    return passwordChangeRequired;
  }

  public void setPasswordChangeRequired(Boolean value) {
    passwordChangeRequired = value;
  }

  @Column(name = "session_version")
  private Long sessionVersion = 0L;

  @com.fasterxml.jackson.annotation.JsonIgnore
  public Long getSessionVersion() {
    return sessionVersion;
  }

  public void setSessionVersion(Long value) {
    sessionVersion = value;
  }

  public Employee() {}

  public Employee(
      String empNo,
      String name,
      String departmentCode,
      String department,
      String positionCode,
      String position,
      String email,
      String phone,
      String hireDate,
      String status,
      Double leaveRemaining,
      Double leaveTotal,
      String skills,
      String avatarColor,
      String role) {
    this.empNo = empNo;
    this.name = name;
    if (departmentCode != null && !departmentCode.isBlank()) {
      this.setDepartmentCode(departmentCode);
    } else if (department != null && !department.isBlank()) {
      this.setDepartment(department);
    } else {
      this.setDepartmentCode("DEPT_RND");
    }
    if (positionCode != null && !positionCode.isBlank()) {
      this.setPositionCode(positionCode);
    } else if (position != null && !position.isBlank()) {
      this.setPosition(position);
    } else {
      this.setPositionCode("POS_STAFF");
    }
    this.email = email;
    this.phone = phone;
    this.hireDate = hireDate;
    this.setStatus(status != null ? status : "재직");
    this.leaveRemaining = leaveRemaining;
    this.leaveTotal = leaveTotal;
    this.skills = skills;
    this.avatarColor = avatarColor;
    this.setRole(role != null ? role : "일반직원");
    this.password = null;
  }

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public String getEmpNo() {
    return empNo;
  }

  public void setEmpNo(String empNo) {
    this.empNo = empNo;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public String getDepartmentCode() {
    return departmentCode;
  }

  public void setDepartmentCode(String departmentCode) {
    this.departmentCode = departmentCode;
    if (departmentCode != null && !departmentCode.isBlank()) {
      try {
        this.department = DepartmentCode.fromCodeOrLabel(departmentCode).getLabel();
      } catch (Exception ignored) {}
    }
  }

  public String getDepartment() {
    return department;
  }

  public void setDepartment(String department) {
    this.department = department;
    if (department != null && !department.isBlank()) {
      try {
        this.departmentCode = DepartmentCode.fromCodeOrLabel(department).getCode();
      } catch (Exception ignored) {}
    }
  }

  public String getPositionCode() {
    return positionCode;
  }

  public void setPositionCode(String positionCode) {
    this.positionCode = positionCode;
    if (positionCode != null && !positionCode.isBlank()) {
      try {
        this.position = PositionCode.fromCodeOrLabel(positionCode).getLabel();
      } catch (Exception ignored) {}
    }
  }

  public String getPosition() {
    return position;
  }

  public void setPosition(String position) {
    this.position = position;
    if (position != null && !position.isBlank()) {
      try {
        this.positionCode = PositionCode.fromCodeOrLabel(position).getCode();
      } catch (Exception ignored) {}
    }
  }

  public String getEmail() {
    return email;
  }

  public void setEmail(String email) {
    this.email = email;
  }

  public String getPhone() {
    return phone;
  }

  public void setPhone(String phone) {
    this.phone = phone;
  }

  public String getHireDate() {
    return hireDate;
  }

  public void setHireDate(String hireDate) {
    this.hireDate = hireDate;
  }

  public String getStatusCode() {
    return statusCode;
  }

  public void setStatusCode(String statusCode) {
    this.statusCode = statusCode;
    if (statusCode != null && !statusCode.isBlank()) {
      try {
        this.status = StatusCode.fromCodeOrLabel(statusCode).getLabel();
      } catch (Exception ignored) {}
    }
  }

  public String getStatus() {
    return status;
  }

  public void setStatus(String status) {
    this.status = status;
    if (status != null && !status.isBlank()) {
      try {
        this.statusCode = StatusCode.fromCodeOrLabel(status).getCode();
      } catch (Exception ignored) {}
    }
  }

  public Double getLeaveRemaining() {
    return leaveRemaining;
  }

  public void setLeaveRemaining(Double leaveRemaining) {
    this.leaveRemaining = leaveRemaining;
  }

  public Double getLeaveTotal() {
    return leaveTotal;
  }

  public void setLeaveTotal(Double leaveTotal) {
    this.leaveTotal = leaveTotal;
  }

  public String getSkills() {
    return skills;
  }

  public void setSkills(String skills) {
    this.skills = skills;
  }

  public String getAvatarColor() {
    return avatarColor;
  }

  public void setAvatarColor(String avatarColor) {
    this.avatarColor = avatarColor;
  }

  public String getRole() {
    return role;
  }

  public void setRole(String role) {
    this.role = role;
    if (role != null) {
      this.roleCode = com.nexus.groupware.code.RoleCode.fromCodeOrLabel(role).getCode();
    }
  }

  public String getRoleCode() {
    return roleCode;
  }

  public void setRoleCode(String roleCode) {
    this.roleCode = roleCode;
    if (roleCode != null) {
      this.role = com.nexus.groupware.code.RoleCode.fromCodeOrLabel(roleCode).getLabel();
    }
  }

  @com.fasterxml.jackson.annotation.JsonIgnore
  public String getPassword() {
    return password;
  }

  public void setPassword(String password) {
    this.password = password;
  }
}
