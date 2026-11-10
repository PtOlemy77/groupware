package com.nexus.groupware.domain.procurement.db;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 공고 알림과 매칭 조건 간의 N:M 매핑 이력
 */
@Entity
@Table(name = "procurement_alert_rules")
public class ProcurementAlertRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    /** 알림 ID (ProcurementAlert.id) */
    public Long alertId;

    /** 관심조건 ID (ProcurementRule.id) */
    public Long ruleId;

    /** 매칭 당시 관심조건 이름 */
    @Column(length = 100)
    public String ruleName;
}
