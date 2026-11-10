package com.nexus.groupware.domain.procurement.service;

import com.nexus.groupware.domain.procurement.db.ProcurementNotice;
import com.nexus.groupware.domain.procurement.db.ProcurementRule;
import java.text.Normalizer;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

/**
 * 관심 키워드·기관과 공고 간의 매칭 알고리즘
 */
public final class ProcurementMatcher {

    private ProcurementMatcher() {}

    /**
     * 공백 제거 및 유니코드 정규화(NFKC) 처리
     */
    private static String clean(String value) {
        return Normalizer.normalize(Objects.toString(value, ""), Normalizer.Form.NFKC)
                .toLowerCase(Locale.ROOT)
                .replaceAll("\\s+", "");
    }

    /**
     * 줄바꿈이나 쉼표로 구분된 단어 목록 파싱
     */
    public static List<String> terms(String value) {
        return Arrays.stream(Objects.toString(value, "").split("[\\n,]"))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .distinct()
                .toList();
    }

    /**
     * 특정 관심조건(Rule)과 공고(Notice) 간의 일치 여부 판정
     */
    public static boolean matches(ProcurementRule rule, ProcurementNotice notice) {
        if (!rule.enabled) {
            return false;
        }

        // 공고 범위 (입찰공고 / 사전규격) 검사
        boolean matchKind = "ALL".equals(rule.noticeKind) || rule.noticeKind.equals(notice.kind);
        if (!matchKind) {
            return false;
        }

        // 업무 구분 (용역 / 물품 / 공사 / 외자) 검사
        boolean matchBusiness = "ALL".equals(rule.businessType) || rule.businessType.equals(notice.businessType);
        if (!matchBusiness) {
            return false;
        }

        String cleanedTitle = clean(notice.title);

        // 제외 키워드가 공고명에 포함되어 있으면 매칭 제외 (제외 키워드 우선)
        boolean hasExcludedKeyword = terms(rule.excludedKeywords).stream()
                .anyMatch(term -> cleanedTitle.contains(clean(term)));
        if (hasExcludedKeyword) {
            return false;
        }

        List<String> keywords = terms(rule.keywords);
        List<String> institutions = terms(rule.institutions);

        // 관심 키워드 일치 여부
        boolean keywordMatched = keywords.stream()
                .anyMatch(term -> cleanedTitle.contains(clean(term)));

        // 관심 기관(공고기관명, 수요기관명, 공고기관코드, 수요기관코드) 일치 여부
        boolean institutionMatched = institutions.stream().anyMatch(term -> {
            String targetTerm = clean(term);
            return clean(notice.agency).contains(targetTerm)
                    || clean(notice.demandAgency).contains(targetTerm)
                    || (!Objects.toString(notice.agencyCode, "").isBlank() && clean(notice.agencyCode).equals(targetTerm))
                    || (!Objects.toString(notice.demandAgencyCode, "").isBlank() && clean(notice.demandAgencyCode).equals(targetTerm));
        });

        if (keywords.isEmpty()) {
            return institutionMatched;
        }
        if (institutions.isEmpty()) {
            return keywordMatched;
        }

        // AND 방식: 키워드와 기관 모두 일치해야 함 / OR 방식: 둘 중 하나라도 일치하면 됨
        return "AND".equals(rule.matchMode)
                ? (keywordMatched && institutionMatched)
                : (keywordMatched || institutionMatched);
    }
}
