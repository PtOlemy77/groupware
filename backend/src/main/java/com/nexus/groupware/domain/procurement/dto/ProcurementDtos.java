package com.nexus.groupware.domain.procurement.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.nexus.groupware.domain.procurement.db.ProcurementNotice;
import java.time.Instant;
import java.util.List;

/**
 * 조달 입찰공고·사전규격 API 요청/응답 DTO 및 VO 모음
 */
public final class ProcurementDtos {
  private ProcurementDtos() {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record RuleSaveRequest(
      String name,
      String keywords,
      String excludedKeywords,
      String institutions,
      String matchMode,
      String noticeKind,
      String businessType,
      Boolean enabled,
      Long version) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record VersionRequest(Long version) {}

  public record UnreadCategoryCountVo(String kind, String businessType, long count) {}

  public record SyncSourceStatusVo(
      String source,
      Instant lastSuccess,
      String lastError,
      Instant lastAttempt,
      boolean backlog,
      int nextPage) {}

  public record ProcurementStatusResponse(
      boolean configured,
      boolean enabled,
      boolean running,
      boolean canSync,
      long intervalMinutes,
      List<String> businessTypes,
      long unread,
      List<UnreadCategoryCountVo> unreadCategories,
      List<SyncSourceStatusVo> sources) {}

  public record ProcurementAlertVo(
      Long id,
      Long version,
      Instant readOn,
      Instant createdOn,
      String matchedRules,
      ProcurementNotice notice) {}

  public record ProcurementAlertPageResponse(
      List<ProcurementAlertVo> items, long total, int page) {}

  public record SyncTriggerResponse(boolean accepted) {}

  public record OkResponse(boolean ok) {}
}
