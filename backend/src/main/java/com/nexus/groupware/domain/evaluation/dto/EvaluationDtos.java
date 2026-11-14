package com.nexus.groupware.domain.evaluation.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 수행평가 계획·실적·평가 API 요청/응답 DTO 및 VO 모음
 */
public final class EvaluationDtos {
  private EvaluationDtos() {}

  public record EvaluationConfigResponse(
      boolean enabled, String policyVersion, int performanceWeight) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record GoalVo(
      String id,
      String category,
      String title,
      String criterion,
      String direction,
      BigDecimal target,
      BigDecimal weight,
      String unit) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record ResultVo(
      String goalId,
      BigDecimal actual,
      String evidence,
      @JsonInclude(JsonInclude.Include.NON_NULL) BigDecimal score,
      @JsonInclude(JsonInclude.Include.NON_NULL) String reason) {

    public ResultVo withEvaluation(BigDecimal nextScore, String nextReason) {
      return new ResultVo(goalId, actual, evidence, nextScore, nextReason);
    }
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record ScoreInputVo(String goalId, BigDecimal score, String reason) {}

  public record AssignmentVo(
      Long id,
      Long projectId,
      String projectName,
      String projectCode,
      String startDate,
      String endDate,
      boolean ended,
      Long pmId,
      boolean requiresExecutive,
      boolean needsPlan,
      String contractDocNo,
      Map<String, BigDecimal> syncedMm,
      BigDecimal syncedTotalMm,
      int progress,
      String stageCode) {}

  public record ReviewerVo(Long id, String name, boolean executive) {}

  public record EvaluationSummaryVo(
      BigDecimal actualMm,
      BigDecimal score,
      BigDecimal performancePoints,
      BigDecimal contractTotalMm,
      BigDecimal capacityPoints) {}

  public record EvaluationPlanVo(
      Long id,
      Long version,
      Instant createdOn,
      Instant updatedOn,
      Long employeeId,
      String employeeName,
      String empNo,
      Long projectId,
      String projectName,
      Long assignmentId,
      Long reviewerId,
      String reviewerName,
      Long approvedBy,
      String kind,
      String state,
      String title,
      LocalDate startDate,
      LocalDate endDate,
      String reviewComment,
      String resultComment,
      Instant approvedOn,
      Instant evaluatedOn,
      String goalsHash,
      Double score,
      boolean canReview,
      boolean canEditGoals,
      boolean canEditResults,
      BigDecimal plannedMmTotal,
      BigDecimal actualMmTotal,
      Double performancePoints,
      @JsonInclude(JsonInclude.Include.NON_NULL) List<GoalVo> goals,
      @JsonInclude(JsonInclude.Include.NON_NULL) List<ResultVo> results,
      @JsonInclude(JsonInclude.Include.NON_NULL) Map<String, BigDecimal> plannedMm,
      @JsonInclude(JsonInclude.Include.NON_NULL) Map<String, BigDecimal> actualMm) {}

  public record EvaluationListResponse(
      boolean enabled,
      List<EvaluationPlanVo> plans,
      long total,
      List<AssignmentVo> assignments,
      boolean poolAvailable,
      List<ReviewerVo> reviewers,
      EvaluationSummaryVo summary) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record EvaluationCreateRequest(
      String kind,
      Long assignmentId,
      Long reviewerId,
      String title,
      String startDate,
      String endDate,
      List<GoalVo> goals,
      Map<String, BigDecimal> plannedMm) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record EvaluationActionRequest(
      Long version,
      Long reviewerId,
      String title,
      String startDate,
      String endDate,
      List<GoalVo> goals,
      Map<String, BigDecimal> plannedMm,
      List<ResultVo> results,
      Map<String, BigDecimal> actualMm,
      List<ScoreInputVo> scores,
      String comment) {}

  public record EvaluationDeleteResponse(boolean deleted) {}
}
