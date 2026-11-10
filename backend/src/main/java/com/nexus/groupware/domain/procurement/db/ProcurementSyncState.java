package com.nexus.groupware.domain.procurement.db;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDateTime;

/**
 * 나라장터 API 수집 동기화 상태 및 분산 락 관리 엔티티
 */
@Entity
@Table(name = "procurement_sync_state")
public class ProcurementSyncState {

    /** 동기화 소스 식별자 또는 LOCK */
    @Id
    @Column(length = 50)
    public String id;

    /** 수집 시작 시점 */
    public LocalDateTime fromTime;

    /** 수집 종료 시점 */
    public LocalDateTime untilTime;

    /** 다음 수집할 페이지 번호 */
    public int nextPage = 1;

    /** 최근 성공 시각 */
    public Instant lastSuccess;

    /** 최근 시도 시각 */
    public Instant lastAttempt;

    /** 최근 발생한 에러 메시지 */
    @Column(length = 300)
    public String lastError;

    /** 분산 락 만료 시각 */
    public Instant leaseUntil;

    /** 락 획득 토큰 */
    @Column(length = 100)
    public String leaseToken;
}
