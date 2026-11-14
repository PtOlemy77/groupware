package com.nexus.groupware.domain.groupware.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.nexus.groupware.core.code.DepartmentCode.DepartmentOptionVo;
import com.nexus.groupware.core.code.PositionCode.PositionOptionVo;
import com.nexus.groupware.domain.approval.db.Approval;
import com.nexus.groupware.domain.employee.db.Employee;
import com.nexus.groupware.domain.equipment.db.Equipment;
import com.nexus.groupware.domain.evaluation.db.Evaluation;
import com.nexus.groupware.domain.master.db.BusinessDeal;
import com.nexus.groupware.domain.master.db.CommonCode;
import com.nexus.groupware.domain.master.db.Holiday;
import com.nexus.groupware.domain.project.db.Project;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 그룹웨어 공통 API 요청/응답 DTO 및 VO 모음
 */
public final class GroupwareDtos {
  private GroupwareDtos() {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record GroupwareMutationRequest(
      String module,
      String action,
      Object id,
      Object version,
      Object projectId,
      Object projectVersion,
      Boolean syncProject,
      Map<String, Object> data) {}

  @JsonInclude(JsonInclude.Include.NON_NULL)
  public record GroupwareMutationResponse(boolean ok, String module, Object record) {}

  public record CompanyInfoVo(String nameKo, String nameEn, String domain) {}

  public record ModuleCountsVo(
      long employees,
      long projects,
      long equipments,
      long deals,
      long evaluations,
      long approvals) {}

  public record EmployeeDirectoryVo(
      Long id,
      Long version,
      Instant createdOn,
      Instant updatedOn,
      String empNo,
      String name,
      String departmentCode,
      String department,
      String positionCode,
      String position,
      @JsonInclude(JsonInclude.Include.NON_NULL) String email,
      @JsonInclude(JsonInclude.Include.NON_NULL) String phone,
      @JsonInclude(JsonInclude.Include.NON_NULL) String hireDate,
      String statusCode,
      String status,
      @JsonInclude(JsonInclude.Include.NON_NULL) Double leaveRemaining,
      @JsonInclude(JsonInclude.Include.NON_NULL) Double leaveTotal,
      String skills,
      String avatarColor,
      String role,
      String roleCode,
      Integer recognizedCareerYears,
      Integer recognizedCareerMonths) {

    public static EmployeeDirectoryVo from(Employee e, boolean includePrivate) {
      return new EmployeeDirectoryVo(
          e.getId(),
          e.getVersion(),
          e.getCreatedOn(),
          e.getUpdatedOn(),
          e.getEmpNo(),
          e.getName(),
          e.getDepartmentCode(),
          e.getDepartment(),
          e.getPositionCode(),
          e.getPosition(),
          includePrivate ? e.getEmail() : null,
          includePrivate ? e.getPhone() : null,
          includePrivate ? e.getHireDate() : null,
          e.getStatusCode(),
          e.getStatus(),
          includePrivate ? e.getLeaveRemaining() : null,
          includePrivate ? e.getLeaveTotal() : null,
          e.getSkills(),
          e.getAvatarColor(),
          e.getRole(),
          e.getRoleCode(),
          e.getRecognizedCareerYears(),
          e.getRecognizedCareerMonths());
    }
  }

  public record ProjectViewVo(
      Long id,
      Long version,
      Instant createdOn,
      Instant updatedOn,
      String code,
      String name,
      String clientName,
      String departmentCode,
      String department,
      String pmName,
      Long pmId,
      Set<Long> memberIds,
      String startDate,
      String endDate,
      String statusCode,
      String status,
      Integer progress,
      Integer budget,
      Double shareRate,
      Integer ourBudget,
      Boolean isConsortium,
      String consortiumPartners,
      String members,
      String priority,
      String description,
      String yearlyRevenueJson) {

    public static ProjectViewVo from(Project p, String resolvedPmName, String resolvedMembers) {
      return new ProjectViewVo(
          p.getId(),
          p.getVersion(),
          p.getCreatedOn(),
          p.getUpdatedOn(),
          p.getCode(),
          p.getName(),
          p.getClientName(),
          p.getDepartmentCode(),
          p.getDepartment(),
          resolvedPmName,
          p.getPmId(),
          p.getMemberIds(),
          p.getStartDate(),
          p.getEndDate(),
          p.getStatusCode(),
          p.getStatus(),
          p.getProgress(),
          p.getBudget(),
          p.getShareRate(),
          p.getOurBudget(),
          p.getIsConsortium(),
          p.getConsortiumPartners(),
          resolvedMembers,
          p.getPriority(),
          p.getDescription(),
          p.getYearlyRevenueJson());
    }
  }

  public record EquipmentViewVo(
      Long id,
      Long version,
      Instant createdOn,
      Instant updatedOn,
      String assetNo,
      String category,
      String modelName,
      String serialNo,
      String status,
      Long empId,
      String empNo,
      String assignedTo,
      String departmentCode,
      String department,
      String purchaseDate,
      Integer price,
      String notes) {

    public static EquipmentViewVo from(
        Equipment e, String resolvedAssignedTo, String resolvedEmpNo, String resolvedDepartment) {
      return new EquipmentViewVo(
          e.getId(),
          e.getVersion(),
          e.getCreatedOn(),
          e.getUpdatedOn(),
          e.getAssetNo(),
          e.getCategory(),
          e.getModelName(),
          e.getSerialNo(),
          e.getStatus(),
          e.getEmpId(),
          resolvedEmpNo,
          resolvedAssignedTo,
          e.getDepartmentCode(),
          resolvedDepartment,
          e.getPurchaseDate(),
          e.getPrice(),
          e.getNotes());
    }
  }

  public record ApprovalDetailVo(
      Long id,
      Long version,
      Instant createdOn,
      Instant updatedOn,
      String docNo,
      String category,
      String title,
      String requester,
      String requesterPosition,
      String departmentCode,
      String department,
      String createdAt,
      String status,
      Integer amount,
      String projectName,
      String vendor,
      String paymentMethod,
      String purpose,
      String itemsJson,
      String reviewerComment,
      String approvedBy,
      Long projectId,
      Long requesterId,
      Long approverId,
      String approvedAt,
      @JsonInclude(JsonInclude.Include.NON_NULL) Boolean detailsLoaded) {

    public static ApprovalDetailVo from(Approval a, String itemsJson, Boolean detailsLoaded) {
      return new ApprovalDetailVo(
          a.getId(),
          a.getVersion(),
          a.getCreatedOn(),
          a.getUpdatedOn(),
          a.getDocNo(),
          a.getCategory(),
          a.getTitle(),
          a.getRequester(),
          a.getRequesterPosition(),
          a.getDepartmentCode(),
          a.getDepartment(),
          a.getCreatedAt(),
          a.getStatus(),
          a.getAmount(),
          a.getProjectName(),
          a.getVendor(),
          a.getPaymentMethod(),
          a.getPurpose(),
          itemsJson,
          a.getReviewerComment(),
          a.getApprovedBy(),
          a.getProjectId(),
          a.getRequesterId(),
          a.getApproverId(),
          a.getApprovedAt(),
          detailsLoaded);
    }
  }

  @JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
  public record ContractApproverSlotVo(
      String name,
      String position,
      @JsonInclude(JsonInclude.Include.NON_NULL) String dept,
      String status,
      @JsonInclude(JsonInclude.Include.NON_NULL) String date,
      @JsonInclude(JsonInclude.Include.NON_NULL) String comment) {}

  @JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
  public record ContractApprovalLineVo(
      ContractApproverSlotVo drafter,
      ContractApproverSlotVo bizHead,
      ContractApproverSlotVo ceo) {}

  public record GroupwareDataResponse(
      List<EmployeeDirectoryVo> employees,
      List<ProjectViewVo> projects,
      List<EquipmentViewVo> equipments,
      List<BusinessDeal> businessDeals,
      List<Evaluation> evaluations,
      List<?> approvals,
      List<CommonCode> commonCodes,
      List<Holiday> holidays,
      List<DepartmentOptionVo> departmentCodes,
      List<PositionOptionVo> positionCodes,
      CompanyInfoVo companyInfo,
      ModuleCountsVo counts,
      @JsonInclude(JsonInclude.Include.NON_NULL) Long pageTotal,
      Instant loadedAt) {}
}
