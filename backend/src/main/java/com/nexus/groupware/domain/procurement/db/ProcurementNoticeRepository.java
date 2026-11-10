package com.nexus.groupware.domain.procurement.db;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProcurementNoticeRepository extends JpaRepository<ProcurementNotice, Long> {

    Optional<ProcurementNotice> findByKindAndBusinessTypeAndExternalIdAndRevisionAndFingerprint(
            String kind,
            String businessType,
            String externalId,
            String revision,
            String fingerprint
    );
}
