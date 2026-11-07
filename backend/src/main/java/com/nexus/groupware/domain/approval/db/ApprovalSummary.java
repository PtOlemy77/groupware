package com.nexus.groupware.domain.approval.db;

public record ApprovalSummary(
    Long id,
    Long version,
    String docNo,
    String category,
    String title,
    String requester,
    String status,
    String createdAt,
    Integer amount,
    Long projectId,
    Long requesterId,
    Long approverId,
    String vendor) {}
