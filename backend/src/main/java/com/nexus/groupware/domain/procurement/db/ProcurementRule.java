package com.nexus.groupware.domain.procurement.db;

import com.nexus.groupware.core.base.VersionedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 임직원별 입찰공고 관심 키워드 및 알림 조건 엔티티
 */
@Entity
@Table(name = "procurement_rules")
public class ProcurementRule extends VersionedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    /** 조건 등록 직원 ID */
    public Long employeeId;

    /** 조건명 (예: 공간정보 용역) */
    @Column(length = 100)
    public String name;

    /** 포함 키워드 (줄바꿈 구분) */
    @Column(columnDefinition = "text", nullable = false)
    public String keywords;

    /** 제외 키워드 (줄바꿈 구분) */
    @Column(columnDefinition = "text", nullable = false)
    public String excludedKeywords;

    /** 관심 기관명 또는 기관코드 (줄바꿈 구분) */
    @Column(columnDefinition = "text", nullable = false)
    public String institutions;

    /** 일치 방식 (AND: 키워드 & 기관 모두 일치, OR: 하나라도 일치) */
    @Column(length = 10)
    public String matchMode;

    /** 공고 범위 (ALL: 전체, BID: 입찰공고, SPEC: 사전규격) */
    @Column(length = 10)
    public String noticeKind;

    /** 업무 구분 (ALL: 전체, SERVC: 용역, THNG: 물품, CNSTWK: 공사, FRGCPT: 외자) */
    @Column(length = 10)
    public String businessType;

    /** 자동 알림 활성화 여부 */
    public boolean enabled;
}
