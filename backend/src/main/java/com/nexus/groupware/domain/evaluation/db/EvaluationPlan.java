package com.nexus.groupware.domain.evaluation.db;

import com.nexus.groupware.core.base.VersionedEntity;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "evaluation_plans")
public class EvaluationPlan extends VersionedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "employee_id")
    private Long employeeId;

    @Column(name = "project_id")
    private Long projectId;

    @Column(name = "assignment_id")
    private Long assignmentId;

    @Column(name = "reviewer_id")
    private Long reviewerId;

    @Column(name = "approved_by")
    private Long approvedBy;

    @Column(name = "kind")
    private String kind;

    @Column(name = "state")
    private String state;

    @Column(name = "title", length = 250)
    private String title;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "goals_json", columnDefinition = "text")
    private String goalsJson;

    @Column(name = "planned_mm_json", columnDefinition = "text")
    private String plannedMmJson;

    @Column(name = "actual_mm_json", columnDefinition = "text")
    private String actualMmJson = "{}";

    @Column(name = "results_json", columnDefinition = "text")
    private String resultsJson = "[]";

    @Column(name = "review_comment", columnDefinition = "text")
    private String reviewComment = "";

    @Column(name = "result_comment", columnDefinition = "text")
    private String resultComment = "";

    @Column(name = "approved_on")
    private Instant approvedOn;

    @Column(name = "evaluated_on")
    private Instant evaluatedOn;

    @Column(name = "goals_hash", length = 64)
    private String goalsHash;

    @Column(name = "score")
    private Double score;

    public Long getId() {
        return id;
    }

    public Long getEmployeeId() {
        return employeeId;
    }

    public void setEmployeeId(Long employeeId) {
        this.employeeId = employeeId;
    }

    public Long getProjectId() {
        return projectId;
    }

    public void setProjectId(Long projectId) {
        this.projectId = projectId;
    }

    public Long getAssignmentId() {
        return assignmentId;
    }

    public void setAssignmentId(Long assignmentId) {
        this.assignmentId = assignmentId;
    }

    public Long getReviewerId() {
        return reviewerId;
    }

    public void setReviewerId(Long reviewerId) {
        this.reviewerId = reviewerId;
    }

    public Long getApprovedBy() {
        return approvedBy;
    }

    public void setApprovedBy(Long approvedBy) {
        this.approvedBy = approvedBy;
    }

    public String getKind() {
        return kind;
    }

    public void setKind(String kind) {
        this.kind = kind;
    }

    public String getState() {
        return state;
    }

    public void setState(String state) {
        this.state = state;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDate startDate) {
        this.startDate = startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public void setEndDate(LocalDate endDate) {
        this.endDate = endDate;
    }

    public String getGoalsJson() {
        return goalsJson;
    }

    public void setGoalsJson(String goalsJson) {
        this.goalsJson = goalsJson;
    }

    public String getPlannedMmJson() {
        return plannedMmJson;
    }

    public void setPlannedMmJson(String plannedMmJson) {
        this.plannedMmJson = plannedMmJson;
    }

    public String getActualMmJson() {
        return actualMmJson;
    }

    public void setActualMmJson(String actualMmJson) {
        this.actualMmJson = actualMmJson;
    }

    public String getResultsJson() {
        return resultsJson;
    }

    public void setResultsJson(String resultsJson) {
        this.resultsJson = resultsJson;
    }

    public String getReviewComment() {
        return reviewComment;
    }

    public void setReviewComment(String reviewComment) {
        this.reviewComment = reviewComment;
    }

    public String getResultComment() {
        return resultComment;
    }

    public void setResultComment(String resultComment) {
        this.resultComment = resultComment;
    }

    public Instant getApprovedOn() {
        return approvedOn;
    }

    public void setApprovedOn(Instant approvedOn) {
        this.approvedOn = approvedOn;
    }

    public Instant getEvaluatedOn() {
        return evaluatedOn;
    }

    public void setEvaluatedOn(Instant evaluatedOn) {
        this.evaluatedOn = evaluatedOn;
    }

    public String getGoalsHash() {
        return goalsHash;
    }

    public void setGoalsHash(String goalsHash) {
        this.goalsHash = goalsHash;
    }

    public Double getScore() {
        return score;
    }

    public void setScore(Double score) {
        this.score = score;
    }
}
