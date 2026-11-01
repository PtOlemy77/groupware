package com.nexus.groupware.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "employees")
public class Employee {

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

    @Column(nullable = false)
    private String email;

    @Column(nullable = false)
    private String phone;

    @Column(name = "hire_date", nullable = false)
    private String hireDate;

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

    @Column(name = "password", columnDefinition = "varchar(100) default '1234'")
    private String password = "1234";

    public Employee() {}

    public Employee(String empNo, String name, String departmentCode, String department,
                    String positionCode, String position, String email,
                    String phone, String hireDate, String status, Double leaveRemaining,
                    Double leaveTotal, String skills, String avatarColor, String role) {
        this.empNo = empNo;
        this.name = name;
        this.departmentCode = departmentCode;
        this.department = department;
        this.positionCode = positionCode;
        this.position = position;
        this.email = email;
        this.phone = phone;
        this.hireDate = hireDate;
        this.status = status;
        this.leaveRemaining = leaveRemaining;
        this.leaveTotal = leaveTotal;
        this.skills = skills;
        this.avatarColor = avatarColor;
        this.role = role;
        this.password = "1234";
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getEmpNo() { return empNo; }
    public void setEmpNo(String empNo) { this.empNo = empNo; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDepartmentCode() { return departmentCode; }
    public void setDepartmentCode(String departmentCode) { this.departmentCode = departmentCode; }

    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }

    public String getPositionCode() { return positionCode; }
    public void setPositionCode(String positionCode) { this.positionCode = positionCode; }

    public String getPosition() { return position; }
    public void setPosition(String position) { this.position = position; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getHireDate() { return hireDate; }
    public void setHireDate(String hireDate) { this.hireDate = hireDate; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Double getLeaveRemaining() { return leaveRemaining; }
    public void setLeaveRemaining(Double leaveRemaining) { this.leaveRemaining = leaveRemaining; }

    public Double getLeaveTotal() { return leaveTotal; }
    public void setLeaveTotal(Double leaveTotal) { this.leaveTotal = leaveTotal; }

    public String getSkills() { return skills; }
    public void setSkills(String skills) { this.skills = skills; }

    public String getAvatarColor() { return avatarColor; }
    public void setAvatarColor(String avatarColor) { this.avatarColor = avatarColor; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
}
