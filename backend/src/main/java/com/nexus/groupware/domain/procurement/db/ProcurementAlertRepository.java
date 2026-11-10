package com.nexus.groupware.domain.procurement.db;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProcurementAlertRepository extends JpaRepository<ProcurementAlert, Long>, JpaSpecificationExecutor<ProcurementAlert> {

    Optional<ProcurementAlert> findByEmployeeIdAndNoticeId(Long employeeId, Long noticeId);

    long countByEmployeeIdAndReadOnIsNull(Long employeeId);

    @Query("SELECT n.kind, n.businessType, count(a) " +
           "FROM ProcurementAlert a, ProcurementNotice n " +
           "WHERE a.noticeId = n.id " +
           "  AND a.employeeId = :employeeId " +
           "  AND a.readOn IS NULL " +
           "GROUP BY n.kind, n.businessType")
    List<Object[]> unreadCategories(@Param("employeeId") Long employeeId);
}
