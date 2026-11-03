package com.nexus.groupware.evaluation;

import jakarta.persistence.*;
import com.nexus.groupware.entity.VersionedEntity;

@Entity
@Table(name="evaluation_assignments")
public class EvaluationAssignment extends VersionedEntity {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
  public Long getId() { return id; }
  @Column(name="employee_id") private Long employeeId;
  public Long getEmployeeId() { return employeeId; }
  public void setEmployeeId(Long value) { employeeId=value; }
  @Column(name="project_id") private Long projectId;
  public Long getProjectId() { return projectId; }
  public void setProjectId(Long value) { projectId=value; }
  @Column(name="assigned_on") private java.time.LocalDate assignedOn;
  public java.time.LocalDate getAssignedOn() { return assignedOn; }
  public void setAssignedOn(java.time.LocalDate value) { assignedOn=value; }
  @Column(name="ended_on") private java.time.LocalDate endedOn;
  public java.time.LocalDate getEndedOn() { return endedOn; }
  public void setEndedOn(java.time.LocalDate value) { endedOn=value; }
}
