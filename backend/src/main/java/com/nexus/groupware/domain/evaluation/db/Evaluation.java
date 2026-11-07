package com.nexus.groupware.domain.evaluation.db;
import com.nexus.groupware.core.base.VersionedEntity;

import jakarta.persistence.*;

@Entity
@Table(name = "evaluations")
public class Evaluation extends VersionedEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "emp_no", nullable = false)
  private String empNo;

  @Column(name = "emp_name", nullable = false)
  private String empName;

  @Column(name = "department_code", columnDefinition = "varchar(50) default 'DEPT_RND'")
  private String departmentCode = "DEPT_RND";

  @Column(nullable = false)
  private String department;

  @Column(name = "position_code", columnDefinition = "varchar(50) default 'POS_STAFF'")
  private String positionCode = "POS_STAFF";

  @Column(nullable = false)
  private String position;

  @Column(nullable = false)
  private String period = "2026 하반기";

  @Column(name = "kpi_score", nullable = false)
  private Integer kpiScore = 85;

  @Column(name = "competency_score", nullable = false)
  private Integer competencyScore = 85;

  @Column(name = "peer_score", nullable = false)
  private Integer peerScore = 85;

  @Column(name = "total_score", nullable = false)
  private Double totalScore = 85.0;

  @Column(nullable = false)
  private String grade = "A";

  @Column(nullable = false)
  private String reviewer;

  @Column(nullable = false)
  private String status = "평가완료";

  @Column(nullable = false, length = 1000)
  private String feedback = "";

  @Column(name = "employee_id")
  private Long employeeId = null;

  public Long getEmployeeId() {
    return employeeId;
  }

  public void setEmployeeId(Long value) {
    employeeId = value;
  }

  @Column(name = "reviewer_id")
  private Long reviewerId = null;

  public Long getReviewerId() {
    return reviewerId;
  }

  public void setReviewerId(Long value) {
    reviewerId = value;
  }

  public Evaluation() {}

  public Evaluation(
      String empNo,
      String empName,
      String departmentCode,
      String department,
      String positionCode,
      String position,
      String period,
      Integer kpiScore,
      Integer competencyScore,
      Integer peerScore,
      Double totalScore,
      String grade,
      String reviewer,
      String status,
      String feedback) {
    this.empNo = empNo;
    this.empName = empName;
    this.departmentCode = departmentCode;
    this.department = department;
    this.positionCode = positionCode;
    this.position = position;
    this.period = period;
    this.kpiScore = kpiScore;
    this.competencyScore = competencyScore;
    this.peerScore = peerScore;
    this.totalScore = totalScore;
    this.grade = grade;
    this.reviewer = reviewer;
    this.status = status;
    this.feedback = feedback;
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

  public String getEmpName() {
    return empName;
  }

  public void setEmpName(String empName) {
    this.empName = empName;
  }

  public String getDepartmentCode() {
    return departmentCode;
  }

  public void setDepartmentCode(String departmentCode) {
    this.departmentCode = departmentCode;
  }

  public String getDepartment() {
    return department;
  }

  public void setDepartment(String department) {
    this.department = department;
  }

  public String getPositionCode() {
    return positionCode;
  }

  public void setPositionCode(String positionCode) {
    this.positionCode = positionCode;
  }

  public String getPosition() {
    return position;
  }

  public void setPosition(String position) {
    this.position = position;
  }

  public String getPeriod() {
    return period;
  }

  public void setPeriod(String period) {
    this.period = period;
  }

  public Integer getKpiScore() {
    return kpiScore;
  }

  public void setKpiScore(Integer kpiScore) {
    this.kpiScore = kpiScore;
  }

  public Integer getCompetencyScore() {
    return competencyScore;
  }

  public void setCompetencyScore(Integer competencyScore) {
    this.competencyScore = competencyScore;
  }

  public Integer getPeerScore() {
    return peerScore;
  }

  public void setPeerScore(Integer peerScore) {
    this.peerScore = peerScore;
  }

  public Double getTotalScore() {
    return totalScore;
  }

  public void setTotalScore(Double totalScore) {
    this.totalScore = totalScore;
  }

  public String getGrade() {
    return grade;
  }

  public void setGrade(String grade) {
    this.grade = grade;
  }

  public String getReviewer() {
    return reviewer;
  }

  public void setReviewer(String reviewer) {
    this.reviewer = reviewer;
  }

  public String getStatus() {
    return status;
  }

  public void setStatus(String status) {
    this.status = status;
  }

  public String getFeedback() {
    return feedback;
  }

  public void setFeedback(String feedback) {
    this.feedback = feedback;
  }
}
