package com.nexus.groupware.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "audit_events")
public class AuditEvent {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false)
  private Long actorId;

  @Column(nullable = false)
  private String module;

  @Column(nullable = false)
  private String action;

  @Column(nullable = false)
  private Long recordId;

  @Column(nullable = false)
  private Instant occurredAt = Instant.now();

  @Column(columnDefinition = "text", nullable = false)
  private String snapshot;

  protected AuditEvent() {}

  public AuditEvent(Long actor, String mod, String act, Long record, String body) {
    actorId = actor;
    module = mod;
    action = act;
    recordId = record;
    snapshot = body;
  }
}
