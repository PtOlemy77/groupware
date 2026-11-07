package com.nexus.groupware.domain.approval.db;
import com.nexus.groupware.core.base.IsoDateConverter;
import com.nexus.groupware.core.base.VersionedEntity;

import com.nexus.groupware.core.code.DepartmentCode;
import jakarta.persistence.*;

@Entity
@Table(name = "approvals")
public class Approval extends VersionedEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "doc_no", nullable = false, unique = true)
  private String docNo;

  @Column(nullable = false)
  private String category;

  @Column(nullable = false)
  private String title;

  @Column(nullable = false)
  private String requester;

  @Column(name = "requester_position", columnDefinition = "varchar(50) default '과장'")
  private String requesterPosition = "과장";

  @Column(name = "department_code", columnDefinition = "varchar(50) default 'DEPT_BIZ'")
  private String departmentCode = "DEPT_BIZ";

  @Column(nullable = false)
  private String department = "사업본부";

  @Column(name = "created_at", nullable = false)
  @Convert(converter = IsoDateConverter.class)
  private String createdAt;

  @Column(nullable = false)
  private String status = "결재대기";

  @Column(nullable = false)
  private Integer amount = 0;

  @Column(name = "project_name", columnDefinition = "varchar(255) default ''")
  private String projectName = "";

  @Column(name = "vendor", columnDefinition = "varchar(255) default ''")
  private String vendor = "";

  @Column(name = "payment_method", columnDefinition = "varchar(100) default '세금계산서(계좌이체)'")
  private String paymentMethod = "세금계산서(계좌이체)";

  @Column(name = "purpose", columnDefinition = "text default ''")
  private String purpose = "";

  @Column(name = "items_json", columnDefinition = "text default '[]'")
  private String itemsJson = "[]";

  @Column(name = "reviewer_comment", columnDefinition = "varchar(500) default ''")
  private String reviewerComment = "";

  @Column(name = "approved_by", columnDefinition = "varchar(100) default ''")
  private String approvedBy = "";

  @Column(name = "project_id")
  private Long projectId = null;

  public Long getProjectId() {
    return projectId;
  }

  public void setProjectId(Long value) {
    projectId = value;
  }

  @Column(name = "requester_id")
  private Long requesterId = null;

  public Long getRequesterId() {
    return requesterId;
  }

  public void setRequesterId(Long value) {
    requesterId = value;
  }

  @Column(name = "approver_id")
  private Long approverId = null;

  public Long getApproverId() {
    return approverId;
  }

  public void setApproverId(Long value) {
    approverId = value;
  }

  @Column(name = "approved_at")
  private String approvedAt = null;

  public String getApprovedAt() {
    return approvedAt;
  }

  public void setApprovedAt(String value) {
    approvedAt = value;
  }

  public Approval() {}

  public Approval(
      String docNo,
      String category,
      String title,
      String requester,
      String requesterPosition,
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
      String approvedBy) {
    this.docNo = docNo;
    this.category = category;
    this.title = title;
    this.requester = requester;
    this.requesterPosition = requesterPosition;
    this.setDepartment(department);
    this.createdAt = createdAt;
    this.status = status;
    this.amount = amount;
    this.projectName = projectName;
    this.vendor = vendor;
    this.paymentMethod = paymentMethod;
    this.purpose = purpose;
    this.itemsJson = itemsJson;
    this.reviewerComment = reviewerComment;
    this.approvedBy = approvedBy;
  }

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public String getDocNo() {
    return docNo;
  }

  public void setDocNo(String docNo) {
    this.docNo = docNo;
  }

  public String getCategory() {
    return category;
  }

  public void setCategory(String category) {
    this.category = category;
  }

  public String getTitle() {
    return title;
  }

  public void setTitle(String title) {
    this.title = title;
  }

  public String getRequester() {
    return requester;
  }

  public void setRequester(String requester) {
    this.requester = requester;
  }

  public String getRequesterPosition() {
    return requesterPosition;
  }

  public void setRequesterPosition(String requesterPosition) {
    this.requesterPosition = requesterPosition;
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

  public String getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(String createdAt) {
    this.createdAt = createdAt;
  }

  public String getStatus() {
    return status;
  }

  public void setStatus(String status) {
    this.status = status;
  }

  public Integer getAmount() {
    return amount;
  }

  public void setAmount(Integer amount) {
    this.amount = amount;
  }

  public String getProjectName() {
    return projectName;
  }

  public void setProjectName(String projectName) {
    this.projectName = projectName;
  }

  public String getVendor() {
    return vendor;
  }

  public void setVendor(String vendor) {
    this.vendor = vendor;
  }

  public String getPaymentMethod() {
    return paymentMethod;
  }

  public void setPaymentMethod(String paymentMethod) {
    this.paymentMethod = paymentMethod;
  }

  public String getPurpose() {
    return purpose;
  }

  public void setPurpose(String purpose) {
    this.purpose = purpose;
  }

  public String getItemsJson() {
    return itemsJson;
  }

  public void setItemsJson(String itemsJson) {
    this.itemsJson = itemsJson;
  }

  public String getReviewerComment() {
    return reviewerComment;
  }

  public void setReviewerComment(String reviewerComment) {
    this.reviewerComment = reviewerComment;
  }

  public String getApprovedBy() {
    return approvedBy;
  }

  public void setApprovedBy(String approvedBy) {
    this.approvedBy = approvedBy;
  }
}
