package com.nexus.groupware.domain.procurement.service;

import jakarta.annotation.PostConstruct;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 나라장터 연동 환경설정 프로퍼티 바인딩 및 유효성 검증
 */
@Component
public class ProcurementSettings {

    private static final Set<String> ALLOWED_TYPES = Set.of("SERVC", "THNG", "CNSTWK", "FRGCPT");

    @Value("${app.procurement.enabled:true}")
    public boolean enabled;

    @Value("${app.procurement.service-key:}")
    public String serviceKey;

    @Value("${app.procurement.interval-ms:3600000}")
    public long intervalMs;

    @Value("${app.procurement.business-types:SERVC,THNG,CNSTWK,FRGCPT}")
    public String businessTypes;

    @PostConstruct
    void validate() {
        if (intervalMs < 300_000 || intervalMs > 86_400_000) {
            throw new IllegalArgumentException("나라장터 조회 주기는 5분(300000ms)에서 24시간(86400000ms) 사이여야 합니다.");
        }

        List<String> types = types();
        if (types.isEmpty() || Arrays.stream(businessTypes.split(","))
                .map(String::trim)
                .anyMatch(t -> !ALLOWED_TYPES.contains(t))) {
            throw new IllegalArgumentException("올바르지 않은 업무 구분 설정입니다: " + businessTypes);
        }
    }

    /**
     * 공공데이터포털 API 인증키 설정 여부
     */
    public boolean configured() {
        return serviceKey != null && !serviceKey.isBlank();
    }

    /**
     * 연동 대상 업무 구분 목록
     */
    public List<String> types() {
        return Arrays.stream(businessTypes.split(","))
                .map(String::trim)
                .filter(ALLOWED_TYPES::contains)
                .distinct()
                .toList();
    }
}
