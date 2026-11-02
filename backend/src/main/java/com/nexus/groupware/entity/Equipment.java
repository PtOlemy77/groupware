package com.nexus.groupware.entity;

import com.nexus.groupware.code.DepartmentCode;
import jakarta.persistence.*;

@Entity
@Table(name = "equipments")
public class Equipment extends VersionedEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "asset_no", nullable = false, unique = true)
  private String assetNo;

  @Column(nullable = false)
  private String category;

  @Column(name = "model_name", nullable = false)
  private String modelName;

  @Column(name = "serial_no", nullable = false)
  private String serialNo;

  @Column(nullable = false)
  private String status = "사용중";

  @Column(name = "emp_id")
  private Long empId;

  @Column(name = "emp_no", length = 50)
  private String empNo;

  @Column(name = "assigned_to", nullable = false)
  private String assignedTo = "미배정";

  @Column(name = "department_code", columnDefinition = "varchar(50) default 'DEPT_MGMT'")
  private String departmentCode = "DEPT_MGMT";

  @Column(nullable = false)
  private String department = "경영지원팀";

  @Column(name = "purchase_date", nullable = false)
  @Convert(converter = IsoDateConverter.class)
  private String purchaseDate;

  @Column(nullable = false)
  private Integer price = 0;

  @Column(nullable = false, length = 1000)
  private String notes = "";

  public Equipment() {}

  public Equipment(
      String assetNo,
      String category,
      String modelName,
      String serialNo,
      String status,
      Long empId,
      String empNo,
      String assignedTo,
      String department,
      String purchaseDate,
      Integer price,
      String notes) {
    this.assetNo = assetNo;
    this.category = category;
    this.modelName = modelName;
    this.serialNo = serialNo;
    this.status = status;
    this.empId = empId;
    this.empNo = empNo;
    this.assignedTo = assignedTo;
    this.setDepartment(department);
    this.purchaseDate = purchaseDate;
    this.price = price;
    this.notes = notes;
  }

  public Equipment(
      String assetNo,
      String category,
      String modelName,
      String serialNo,
      String status,
      String assignedTo,
      String department,
      String purchaseDate,
      Integer price,
      String notes) {
    this(
        assetNo,
        category,
        modelName,
        serialNo,
        status,
        null,
        null,
        assignedTo,
        department,
        purchaseDate,
        price,
        notes);
  }

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public String getAssetNo() {
    return assetNo;
  }

  public void setAssetNo(String assetNo) {
    this.assetNo = assetNo;
  }

  public String getCategory() {
    return category;
  }

  public void setCategory(String category) {
    this.category = category;
  }

  public String getModelName() {
    return modelName;
  }

  public void setModelName(String modelName) {
    this.modelName = modelName;
  }

  public String getSerialNo() {
    return serialNo;
  }

  public void setSerialNo(String serialNo) {
    this.serialNo = serialNo;
  }

  public String getStatus() {
    return status;
  }

  public void setStatus(String status) {
    this.status = status;
  }

  public Long getEmpId() {
    return empId;
  }

  public void setEmpId(Long empId) {
    this.empId = empId;
  }

  public String getEmpNo() {
    return empNo;
  }

  public void setEmpNo(String empNo) {
    this.empNo = empNo;
  }

  public String getAssignedTo() {
    return assignedTo;
  }

  public void setAssignedTo(String assignedTo) {
    this.assignedTo = assignedTo;
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

  public String getPurchaseDate() {
    return purchaseDate;
  }

  public void setPurchaseDate(String purchaseDate) {
    this.purchaseDate = purchaseDate;
  }

  public Integer getPrice() {
    return price;
  }

  public void setPrice(Integer price) {
    this.price = price;
  }

  public String getNotes() {
    return notes;
  }

  public void setNotes(String notes) {
    this.notes = notes;
  }
}
