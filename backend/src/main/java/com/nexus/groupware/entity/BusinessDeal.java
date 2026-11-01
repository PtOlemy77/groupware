package com.nexus.groupware.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "business_deals")
public class BusinessDeal extends VersionedEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false)
  private String title;

  @Column(name = "client_name", nullable = false)
  private String clientName;

  @Column(name = "owner_name", nullable = false)
  private String ownerName;

  @Column(nullable = false)
  private String stage = "제안";

  @Column(nullable = false)
  private Integer amount = 0;

  @Column(nullable = false)
  private Integer probability = 50;

  @Column(name = "close_date", nullable = false)
  @Convert(converter = IsoDateConverter.class)
  private String closeDate;

  @Column(name = "deal_type", nullable = false)
  private String dealType = "신규구축";

  @Column(nullable = false, length = 1000)
  private String notes = "";

  @Column(name = "owner_id")
  private Long ownerId = null;

  public Long getOwnerId() {
    return ownerId;
  }

  public void setOwnerId(Long value) {
    ownerId = value;
  }

  @Column(name = "converted_project_id")
  private Long convertedProjectId = null;

  public Long getConvertedProjectId() {
    return convertedProjectId;
  }

  public void setConvertedProjectId(Long value) {
    convertedProjectId = value;
  }

  @Column(name = "start_date")
  @Convert(converter = IsoDateConverter.class)
  private String startDate = null;

  public String getStartDate() {
    return startDate;
  }

  public void setStartDate(String value) {
    startDate = value;
  }

  @Column(name = "end_date")
  @Convert(converter = IsoDateConverter.class)
  private String endDate = null;

  public String getEndDate() {
    return endDate;
  }

  public void setEndDate(String value) {
    endDate = value;
  }

  @Column(name = "target_year")
  private Integer targetYear = null;

  public Integer getTargetYear() {
    return targetYear;
  }

  public void setTargetYear(Integer value) {
    targetYear = value;
  }

  @Column(name = "yearly_revenue_json", columnDefinition = "text")
  private String yearlyRevenueJson = "{}";

  public String getYearlyRevenueJson() {
    return yearlyRevenueJson;
  }

  public void setYearlyRevenueJson(String value) {
    yearlyRevenueJson = value;
  }

  public BusinessDeal() {}

  public BusinessDeal(
      String title,
      String clientName,
      String ownerName,
      String stage,
      Integer amount,
      Integer probability,
      String closeDate,
      String dealType,
      String notes) {
    this.title = title;
    this.clientName = clientName;
    this.ownerName = ownerName;
    this.stage = stage;
    this.amount = amount;
    this.probability = probability;
    this.closeDate = closeDate;
    this.dealType = dealType;
    this.notes = notes;
  }

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public String getTitle() {
    return title;
  }

  public void setTitle(String title) {
    this.title = title;
  }

  public String getClientName() {
    return clientName;
  }

  public void setClientName(String clientName) {
    this.clientName = clientName;
  }

  public String getOwnerName() {
    return ownerName;
  }

  public void setOwnerName(String ownerName) {
    this.ownerName = ownerName;
  }

  public String getStage() {
    return stage;
  }

  public void setStage(String stage) {
    this.stage = stage;
  }

  public Integer getAmount() {
    return amount;
  }

  public void setAmount(Integer amount) {
    this.amount = amount;
  }

  public Integer getProbability() {
    return probability;
  }

  public void setProbability(Integer probability) {
    this.probability = probability;
  }

  public String getCloseDate() {
    return closeDate;
  }

  public void setCloseDate(String closeDate) {
    this.closeDate = closeDate;
  }

  public String getDealType() {
    return dealType;
  }

  public void setDealType(String dealType) {
    this.dealType = dealType;
  }

  public String getNotes() {
    return notes;
  }

  public void setNotes(String notes) {
    this.notes = notes;
  }
}
