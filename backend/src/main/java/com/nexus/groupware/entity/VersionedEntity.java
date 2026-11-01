package com.nexus.groupware.entity;

import jakarta.persistence.*;
import java.time.Instant;

@MappedSuperclass
public abstract class VersionedEntity {
  @Version
  @Column(nullable = false)
  private Long version;

  @Column(name = "created_on", nullable = false, updatable = false)
  private Instant createdOn = Instant.now();

  @Column(name = "updated_on", nullable = false)
  private Instant updatedOn = Instant.now();

  @PreUpdate
  void touch() {
    updatedOn = Instant.now();
  }

  public Long getVersion() {
    return version;
  }

  public void setVersion(Long v) {
    version = v;
  }

  public Instant getCreatedOn() {
    return createdOn;
  }

  public Instant getUpdatedOn() {
    return updatedOn;
  }
}
