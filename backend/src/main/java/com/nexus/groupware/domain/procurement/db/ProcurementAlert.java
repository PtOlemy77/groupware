package com.nexus.groupware.domain.procurement.db;

import com.nexus.groupware.core.base.VersionedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * 임직원에게 매칭되어 발송된 관심공고 알림 내역
 */
@Entity
@Table(name = "procurement_alerts")
public class ProcurementAlert extends VersionedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    /** 수신 대상 직원 ID */
    public Long employeeId;

    /** 매칭된 공고 ID (ProcurementNotice) */
    public Long noticeId;

    /** 매칭된 관심조건명 목록 (쉼표 구분) */
    @Column(length = 2000)
    public String matchedRules;

    /** 사용자가 확인(읽음)한 시각 (null이면 미읽음) */
    public Instant readOn;
}
