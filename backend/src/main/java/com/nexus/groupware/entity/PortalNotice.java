package com.nexus.groupware.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "portal_notices")
public class PortalNotice extends VersionedEntity {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;
  @Column(nullable = false, length = 200)
  private String title;
  @Column(nullable = false, columnDefinition = "text")
  private String content;
  @Column(nullable = false)
  private boolean published;
  @Column(nullable = false)
  private boolean pinned;
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "created_by_id", nullable = false)
  private Employee createdBy;

  public Long getId() { return id; }
  public String getTitle() { return title; }
  public void setTitle(String value) { title = value; }
  public String getContent() { return content; }
  public void setContent(String value) { content = value; }
  public boolean isPublished() { return published; }
  public void setPublished(boolean value) { published = value; }
  public boolean isPinned() { return pinned; }
  public void setPinned(boolean value) { pinned = value; }
  public void setCreatedBy(Employee employee) { createdBy = employee; }
}
