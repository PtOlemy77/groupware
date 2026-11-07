package com.nexus.groupware.domain.evaluation.db;

import com.nexus.groupware.core.base.VersionedEntity;
import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "evaluation_assignments")
public class EvaluationAssignment extends VersionedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "employee_id")
    private Long employeeId;

    @Column(name = "project_id")
    private Long projectId;

    @Column(name = "assigned_on")
    private LocalDate assignedOn;

    @Column(name = "ended_on")
    private LocalDate endedOn;

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

    public LocalDate getAssignedOn() {
        return assignedOn;
    }

    public void setAssignedOn(LocalDate assignedOn) {
        this.assignedOn = assignedOn;
    }

    public LocalDate getEndedOn() {
        return endedOn;
    }

    public void setEndedOn(LocalDate endedOn) {
        this.endedOn = endedOn;
    }
}
