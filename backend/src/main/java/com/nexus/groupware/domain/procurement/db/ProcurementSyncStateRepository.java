package com.nexus.groupware.domain.procurement.db;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProcurementSyncStateRepository extends JpaRepository<ProcurementSyncState, String> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM ProcurementSyncState s WHERE s.id = :id")
    Optional<ProcurementSyncState> lock(@Param("id") String id);
}
