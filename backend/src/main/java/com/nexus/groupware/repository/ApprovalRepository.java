package com.nexus.groupware.repository;

import com.nexus.groupware.entity.Approval;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ApprovalRepository extends JpaRepository<Approval, Long> {
    List<Approval> findAllByOrderByIdDesc();
}

