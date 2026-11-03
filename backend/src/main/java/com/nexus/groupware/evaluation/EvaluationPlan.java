package com.nexus.groupware.evaluation;

import jakarta.persistence.*;
import com.nexus.groupware.entity.VersionedEntity;

@Entity
@Table(name="evaluation_plans")
public class EvaluationPlan extends VersionedEntity {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
  public Long getId() { return id; }
  @Column(name="employee_id") private Long employeeId;
  public Long getEmployeeId() { return employeeId; }
  public void setEmployeeId(Long value) { employeeId=value; }
  @Column(name="project_id") private Long projectId;
  public Long getProjectId() { return projectId; }
  public void setProjectId(Long value) { projectId=value; }
  @Column(name="assignment_id") private Long assignmentId;
  public Long getAssignmentId() { return assignmentId; }
  public void setAssignmentId(Long value) { assignmentId=value; }
  @Column(name="reviewer_id") private Long reviewerId;
  public Long getReviewerId() { return reviewerId; }
  public void setReviewerId(Long value) { reviewerId=value; }
  @Column(name="approved_by") private Long approvedBy;
  public Long getApprovedBy() { return approvedBy; }
  public void setApprovedBy(Long value) { approvedBy=value; }
  @Column(name="kind") private String kind;
  public String getKind() { return kind; }
  public void setKind(String value) { kind=value; }
  @Column(name="state") private String state;
  public String getState() { return state; }
  public void setState(String value) { state=value; }
  @Column(name="title", length=250) private String title;
  public String getTitle() { return title; }
  public void setTitle(String value) { title=value; }
  @Column(name="start_date") private java.time.LocalDate startDate;
  public java.time.LocalDate getStartDate() { return startDate; }
  public void setStartDate(java.time.LocalDate value) { startDate=value; }
  @Column(name="end_date") private java.time.LocalDate endDate;
  public java.time.LocalDate getEndDate() { return endDate; }
  public void setEndDate(java.time.LocalDate value) { endDate=value; }
  @Column(name="goals_json", columnDefinition="text") private String goalsJson;
  public String getGoalsJson() { return goalsJson; }
  public void setGoalsJson(String value) { goalsJson=value; }
  @Column(name="planned_mm_json", columnDefinition="text") private String plannedMmJson;
  public String getPlannedMmJson() { return plannedMmJson; }
  public void setPlannedMmJson(String value) { plannedMmJson=value; }
  @Column(name="actual_mm_json", columnDefinition="text") private String actualMmJson = "{}";
  public String getActualMmJson() { return actualMmJson; }
  public void setActualMmJson(String value) { actualMmJson=value; }
  @Column(name="results_json", columnDefinition="text") private String resultsJson = "[]";
  public String getResultsJson() { return resultsJson; }
  public void setResultsJson(String value) { resultsJson=value; }
  @Column(name="review_comment", columnDefinition="text") private String reviewComment = "";
  public String getReviewComment() { return reviewComment; }
  public void setReviewComment(String value) { reviewComment=value; }
  @Column(name="result_comment", columnDefinition="text") private String resultComment = "";
  public String getResultComment() { return resultComment; }
  public void setResultComment(String value) { resultComment=value; }
  @Column(name="approved_on") private java.time.Instant approvedOn;
  public java.time.Instant getApprovedOn() { return approvedOn; }
  public void setApprovedOn(java.time.Instant value) { approvedOn=value; }
  @Column(name="evaluated_on") private java.time.Instant evaluatedOn;
  public java.time.Instant getEvaluatedOn() { return evaluatedOn; }
  public void setEvaluatedOn(java.time.Instant value) { evaluatedOn=value; }
  @Column(name="goals_hash", length=64) private String goalsHash;
  public String getGoalsHash() { return goalsHash; }
  public void setGoalsHash(String value) { goalsHash=value; }
  @Column(name="score") private Double score;
  public Double getScore() { return score; }
  public void setScore(Double value) { score=value; }
}
