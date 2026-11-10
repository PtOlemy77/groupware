package com.nexus.groupware.domain.procurement.db;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ProcurementRuleRepository extends JpaRepository<ProcurementRule, Long> {

    List<ProcurementRule> findByEmployeeIdOrderByIdDesc(Long employeeId);

    @Query("SELECT r FROM ProcurementRule r, Employee e " +
           "WHERE r.employeeId = e.id " +
           "  AND r.enabled = true " +
           "  AND e.accountEnabled = true " +
           "  AND e.statusCode = 'STATUS_ACTIVE'")
    List<ProcurementRule> findActiveRules();
}
