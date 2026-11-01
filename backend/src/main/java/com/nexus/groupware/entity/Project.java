package com.nexus.groupware.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "projects")
public class Project {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String department;

    @Column(name = "pm_name", nullable = false)
    private String pmName;

    @Column(name = "start_date", nullable = false)
    private String startDate;

    @Column(name = "end_date", nullable = false)
    private String endDate;

    @Column(nullable = false)
    private String status = "진행중";

    @Column(nullable = false)
    private Integer progress = 0;

    @Column(nullable = false)
    private Integer budget = 0;

    @Column(name = "share_rate", columnDefinition = "numeric(5,2) default 100.0")
    private Double shareRate = 100.0;

    @Column(name = "our_budget", columnDefinition = "integer default 0")
    private Integer ourBudget = 0;

    @Column(name = "is_consortium", columnDefinition = "boolean default false")
    private Boolean isConsortium = false;

    @Column(name = "consortium_partners", columnDefinition = "varchar(500) default ''")
    private String consortiumPartners = "";

    @Column(nullable = false)
    private String members = "";

    @Column(nullable = false)
    private String priority = "보통";

    @Column(nullable = false, length = 1000)
    private String description = "";

    public Project() {}

    public Project(String code, String name, String department, String pmName, String startDate,
                   String endDate, String status, Integer progress, Integer budget,
                   String members, String priority, String description) {
        this(code, name, department, pmName, startDate, endDate, status, progress, budget, 100.0, "", members, priority, description);
    }

    public Project(String code, String name, String department, String pmName, String startDate,
                   String endDate, String status, Integer progress, Integer budget,
                   Double shareRate, String consortiumPartners,
                   String members, String priority, String description) {
        this.code = code;
        this.name = name;
        this.department = department;
        this.pmName = pmName;
        this.startDate = startDate;
        this.endDate = endDate;
        this.status = status;
        this.progress = progress;
        this.budget = budget;
        this.shareRate = shareRate != null ? shareRate : 100.0;
        this.isConsortium = this.shareRate < 100.0;
        this.consortiumPartners = consortiumPartners != null ? consortiumPartners : "";
        this.ourBudget = (int) Math.round((budget != null ? budget : 0) * (this.shareRate / 100.0));
        this.members = members;
        this.priority = priority;
        this.description = description;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }

    public String getPmName() { return pmName; }
    public void setPmName(String pmName) { this.pmName = pmName; }

    public String getStartDate() { return startDate; }
    public void setStartDate(String startDate) { this.startDate = startDate; }

    public String getEndDate() { return endDate; }
    public void setEndDate(String endDate) { this.endDate = endDate; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Integer getProgress() { return progress; }
    public void setProgress(Integer progress) { this.progress = progress; }

    public Integer getBudget() { return budget; }
    public void setBudget(Integer budget) {
        this.budget = budget;
        if (this.shareRate != null) {
            this.ourBudget = (int) Math.round((budget != null ? budget : 0) * (this.shareRate / 100.0));
        }
    }

    public Double getShareRate() { return shareRate != null ? shareRate : 100.0; }
    public void setShareRate(Double shareRate) {
        this.shareRate = shareRate != null ? shareRate : 100.0;
        this.isConsortium = this.shareRate < 100.0;
        if (this.budget != null) {
            this.ourBudget = (int) Math.round(this.budget * (this.shareRate / 100.0));
        }
    }

    public Integer getOurBudget() {
        if (this.ourBudget == null || this.ourBudget == 0) {
            double rate = this.shareRate != null ? this.shareRate : 100.0;
            return (int) Math.round((this.budget != null ? this.budget : 0) * (rate / 100.0));
        }
        return ourBudget;
    }
    public void setOurBudget(Integer ourBudget) { this.ourBudget = ourBudget; }

    public Boolean getIsConsortium() { return isConsortium != null ? isConsortium : false; }
    public void setIsConsortium(Boolean isConsortium) { this.isConsortium = isConsortium; }

    public String getConsortiumPartners() { return consortiumPartners != null ? consortiumPartners : ""; }
    public void setConsortiumPartners(String consortiumPartners) { this.consortiumPartners = consortiumPartners; }

    public String getMembers() { return members; }
    public void setMembers(String members) { this.members = members; }

    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}

