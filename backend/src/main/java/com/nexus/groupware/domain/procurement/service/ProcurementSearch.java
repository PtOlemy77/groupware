package com.nexus.groupware.domain.procurement.service;

import com.nexus.groupware.domain.procurement.db.ProcurementRule;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 나라장터 기관별 검색 파라미터 분할 및 수집 소스 식별자 생성 유틸리티
 */
public final class ProcurementSearch {

    private ProcurementSearch() {}

    /**
     * API 호출용 기관 검색 필터 레코드
     */
    public record Filter(String field, String value) {
        public Filter {
            Set<String> allowedFields = Set.of("", "ntceInsttNm", "dminsttNm", "ntceInsttCd", "dminsttCd");
            if (!allowedFields.contains(field) || value == null || (field.isEmpty() != value.isEmpty())) {
                throw new IllegalArgumentException("올바르지 않은 기관 검색 필터입니다.");
            }
        }
    }

    /** 전체 조회용 기본 필터 */
    public static final Filter ALL = new Filter("", "");

    /**
     * 활성화된 관심조건들로부터 API 기관별 분할 필터 목록 생성
     */
    public static List<Filter> filters(List<ProcurementRule> rules) {
        var result = new LinkedHashSet<Filter>();

        for (var rule : rules) {
            List<String> institutions = ProcurementMatcher.terms(rule.institutions);

            // 기관 조건이 없거나 OR 매칭 모드이면서 키워드가 있는 경우, 전체 조회(ALL)도 반드시 포함
            boolean hasKeywords = !ProcurementMatcher.terms(rule.keywords).isEmpty();
            if (institutions.isEmpty() || ("OR".equals(rule.matchMode) && hasKeywords)) {
                result.add(ALL);
            }

            for (String term : institutions) {
                // 공고기관명 및 수요기관명 검색 필터 추가
                result.add(new Filter("ntceInsttNm", term));
                result.add(new Filter("dminsttNm", term));

                // 영문/숫자/하이픈 코드 형태인 경우 기관코드 검색 필터도 추가
                if (term.matches("[A-Za-z0-9_-]+")) {
                    result.add(new Filter("ntceInsttCd", term));
                    result.add(new Filter("dminsttCd", term));
                }
            }
        }

        return List.copyOf(result);
    }

    /**
     * 동기화 상태 테이블에서 고유하게 사용할 소스 ID 생성
     */
    public static String source(
            String kind,
            String business,
            String division,
            Filter filter,
            List<ProcurementRule> rules
    ) {
        try {
            String scope = rules.stream()
                    .map(r -> r.id + ":" + r.getVersion())
                    .sorted()
                    .reduce("", (a, b) -> a + "|" + b);

            String identity = filter.field() + "\n" + filter.value() + "\n" + scope;
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            String hash = HexFormat.of().formatHex(digest.digest(identity.getBytes(StandardCharsets.UTF_8)));

            return kind + "_" + business + "_" + division + "_" + hash.substring(0, 24);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("해시 알고리즘 초기화 실패", e);
        }
    }
}
