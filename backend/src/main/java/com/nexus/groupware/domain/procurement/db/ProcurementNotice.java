package com.nexus.groupware.domain.procurement.db;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * 나라장터 입찰공고 및 사전규격 원천 데이터 엔티티
 */
@Entity
@Table(name = "procurement_notices")
public class ProcurementNotice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    /** 공고 종류 (BID: 입찰공고, SPEC: 사전규격) */
    @Column(length = 10)
    public String kind;

    /** 업무 구분 (SERVC: 용역, THNG: 물품, CNSTWK: 공사, FRGCPT: 외자) */
    @Column(length = 10)
    public String businessType;

    /** 공고 번호 / 사전규격 등록번호 */
    @Column(length = 100)
    public String externalId;

    /** 공고 차수 */
    @Column(length = 100)
    public String revision;

    /** 공고 내용 중복 판정용 SHA-256 해시 */
    @Column(length = 64)
    public String fingerprint;

    /** 공고명 / 사전규격 품명 */
    @Column(length = 2000)
    public String title;

    /** 공고기관 / 발주기관명 */
    @Column(length = 500)
    public String agency;

    /** 수요기관명 */
    @Column(length = 500)
    public String demandAgency;

    /** 공고기관 코드 */
    @Column(length = 100)
    public String agencyCode;

    /** 수요기관 코드 */
    @Column(length = 100)
    public String demandAgencyCode;

    /** 게시일시 / 등록일시 */
    @Column(length = 50)
    public String publishedAt;

    /** 변경일시 */
    @Column(length = 50)
    public String changedAt;

    /** 입찰 마감일시 / 의견등록 마감일시 */
    @Column(length = 50)
    public String deadline;

    /** 배정예산액 / 추정가격 (원 단위 문자열) */
    @Column(length = 100)
    public String budget;

    /** 공고 상태 (등록공고, 변경공고 등) */
    @Column(length = 100)
    public String noticeStatus;

    /** 나라장터 원문 상세 URL */
    @Column(length = 2000)
    public String sourceUrl;

    /** 시스템 최초 감지 시각 */
    public Instant detectedOn = Instant.now();
}
