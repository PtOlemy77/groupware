package com.nexus.groupware.domain.approval.db;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApprovalRepository extends JpaRepository<Approval, Long> {
  List<Approval> findAllByOrderByIdDesc();

  @org.springframework.data.jpa.repository.Query(
      value =
          "select new"
              + " com.nexus.groupware.domain.approval.db.ApprovalSummary(a.id,a.version,a.docNo,a.category,a.title,a.requester,a.status,a.createdAt,a.amount,a.projectId,a.requesterId,a.approverId,a.vendor)"
              + " from Approval a where a.category in ('계약품의','계약품의서') and (:exec = true or (:pm ="
              + " true and (a.requesterId = :actorId or a.projectId in :projectIds)))",
      countQuery =
          "select count(a) from Approval a where a.category in ('계약품의','계약품의서') and (:exec = true"
              + " or (:pm = true and (a.requesterId = :actorId or a.projectId in :projectIds)))")
  org.springframework.data.domain.Page<com.nexus.groupware.domain.approval.db.ApprovalSummary> summaryPage(
      @org.springframework.data.repository.query.Param("exec") boolean exec,
      @org.springframework.data.repository.query.Param("pm") boolean pm,
      @org.springframework.data.repository.query.Param("actorId") Long actorId,
      @org.springframework.data.repository.query.Param("projectIds") java.util.Set<Long> projectIds,
      org.springframework.data.domain.Pageable pageable);

  @org.springframework.data.jpa.repository.Query(
      "select count(a) from Approval a where a.category in ('계약품의','계약품의서') and (:exec = true or"
          + " (:pm = true and (a.requesterId = :actorId or a.projectId in :projectIds)))")
  long visibleCount(
      @org.springframework.data.repository.query.Param("exec") boolean exec,
      @org.springframework.data.repository.query.Param("pm") boolean pm,
      @org.springframework.data.repository.query.Param("actorId") Long actorId,
      @org.springframework.data.repository.query.Param("projectIds")
          java.util.Set<Long> projectIds);

  List<Approval> findByCategoryInOrderByIdDesc(java.util.Collection<String> categories);
}
