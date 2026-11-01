package com.nexus.groupware.entity;

import jakarta.persistence.*;

@Entity
@Table(
    name = "common_codes",
    uniqueConstraints = {@UniqueConstraint(columnNames = {"group_code", "code"})})
public class CommonCode extends VersionedEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "group_code", nullable = false, length = 50)
  private String groupCode;

  @Column(name = "group_name", nullable = false, length = 100)
  private String groupName;

  @Column(name = "code", nullable = false, length = 50)
  private String code;

  @Column(name = "code_name", nullable = false, length = 100)
  private String codeName;

  @Column(name = "sort_order", nullable = false)
  private Integer sortOrder = 0;

  @Column(name = "is_active", nullable = false)
  private Boolean isActive = true;

  @Column(name = "extra_value", columnDefinition = "text")
  private String extraValue;

  public CommonCode() {}

  public CommonCode(
      String groupCode,
      String groupName,
      String code,
      String codeName,
      Integer sortOrder,
      Boolean isActive,
      String extraValue) {
    this.groupCode = groupCode;
    this.groupName = groupName;
    this.code = code;
    this.codeName = codeName;
    this.sortOrder = sortOrder;
    this.isActive = isActive;
    this.extraValue = extraValue;
  }

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public String getGroupCode() {
    return groupCode;
  }

  public void setGroupCode(String groupCode) {
    this.groupCode = groupCode;
  }

  public String getGroupName() {
    return groupName;
  }

  public void setGroupName(String groupName) {
    this.groupName = groupName;
  }

  public String getCode() {
    return code;
  }

  public void setCode(String code) {
    this.code = code;
  }

  public String getCodeName() {
    return codeName;
  }

  public void setCodeName(String codeName) {
    this.codeName = codeName;
  }

  public Integer getSortOrder() {
    return sortOrder;
  }

  public void setSortOrder(Integer sortOrder) {
    this.sortOrder = sortOrder;
  }

  public Boolean getIsActive() {
    return isActive;
  }

  public void setIsActive(Boolean active) {
    isActive = active;
  }

  public String getExtraValue() {
    return extraValue;
  }

  public void setExtraValue(String extraValue) {
    this.extraValue = extraValue;
  }
}
