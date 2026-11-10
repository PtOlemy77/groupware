package com.nexus.groupware.domain.procurement.service;

import com.nexus.groupware.core.security.AuthService;
import com.nexus.groupware.domain.employee.db.Employee;
import com.nexus.groupware.domain.procurement.db.ProcurementAlert;
import com.nexus.groupware.domain.procurement.db.ProcurementAlertRepository;
import com.nexus.groupware.domain.procurement.db.ProcurementNotice;
import com.nexus.groupware.domain.procurement.db.ProcurementNoticeRepository;
import com.nexus.groupware.domain.procurement.db.ProcurementRule;
import com.nexus.groupware.domain.procurement.db.ProcurementRuleRepository;
import com.nexus.groupware.domain.procurement.db.ProcurementSyncState;
import com.nexus.groupware.domain.procurement.db.ProcurementSyncStateRepository;
import jakarta.persistence.criteria.Predicate;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * 입찰공고 및 사전규격 관심조건/알림 비즈니스 서비스
 */
@Service
@Transactional
public class ProcurementService {

    private final AuthService authService;
    private final ProcurementRuleRepository ruleRepository;
    private final ProcurementAlertRepository alertRepository;
    private final ProcurementNoticeRepository noticeRepository;
    private final ProcurementSyncStateRepository stateRepository;
    private final ProcurementSettings settings;
    private final ProcurementSync syncEngine;

    public ProcurementService(
            AuthService authService,
            ProcurementRuleRepository ruleRepository,
            ProcurementAlertRepository alertRepository,
            ProcurementNoticeRepository noticeRepository,
            ProcurementSyncStateRepository stateRepository,
            ProcurementSettings settings,
            ProcurementSync syncEngine
    ) {
        this.authService = authService;
        this.ruleRepository = ruleRepository;
        this.alertRepository = alertRepository;
        this.noticeRepository = noticeRepository;
        this.stateRepository = stateRepository;
        this.settings = settings;
        this.syncEngine = syncEngine;
    }

    /**
     * 연동 상태 및 미읽음 알림 통계 정보 조회
     */
    @Transactional(readOnly = true)
    public Map<String, Object> status() {
        Employee currentActor = authService.current();
        Map<String, Object> result = new LinkedHashMap<>();
        List<ProcurementSyncState> sourceStates = stateRepository.findAll();

        boolean isLockRunning = sourceStates.stream()
                .anyMatch(s -> "LOCK".equals(s.id) && s.leaseUntil != null && s.leaseUntil.isAfter(Instant.now()));
        boolean isRunning = syncEngine.running() || isLockRunning;

        result.put("configured", settings.configured());
        result.put("enabled", settings.enabled);
        result.put("running", isRunning);
        result.put("can_sync", AuthService.executive(currentActor));
        result.put("interval_minutes", settings.intervalMs / 60000);
        result.put("business_types", settings.types());

        // 미읽음 알림 카테고리별 집계
        Map<String, Long> categoryCounts = new HashMap<>();
        for (Object[] row : alertRepository.unreadCategories(currentActor.getId())) {
            String key = row[0] + ":" + row[1];
            categoryCounts.put(key, ((Number) row[2]).longValue());
        }

        List<Map<String, Object>> categories = new ArrayList<>();
        for (String kind : List.of("BID", "SPEC")) {
            for (String business : List.of("SERVC", "THNG", "CNSTWK", "FRGCPT")) {
                long count = categoryCounts.getOrDefault(kind + ":" + business, 0L);
                categories.add(Map.of(
                        "kind", kind,
                        "business_type", business,
                        "count", count
                ));
            }
        }

        long totalUnread = categoryCounts.values().stream().mapToLong(Long::longValue).sum();
        result.put("unread", totalUnread);
        result.put("unread_categories", categories);

        // 소스별 수집 상태
        List<Map<String, Object>> sources = sourceStates.stream()
                .filter(s -> !"LOCK".equals(s.id) && settings.types().stream().anyMatch(t -> s.id.contains("_" + t + "_")))
                .map(s -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("source", s.id);
                    m.put("last_success", s.lastSuccess);
                    m.put("last_error", s.lastError);
                    m.put("last_attempt", s.lastAttempt);
                    m.put("backlog", s.untilTime != null);
                    m.put("next_page", s.nextPage);
                    return m;
                })
                .toList();
        result.put("sources", sources);

        return result;
    }

    /**
     * 로그인한 직원의 관심조건 목록 조회
     */
    @Transactional(readOnly = true)
    public List<ProcurementRule> rules() {
        return ruleRepository.findByEmployeeIdOrderByIdDesc(authService.current().getId());
    }

    /**
     * 관심조건 등록 및 수정
     */
    public ProcurementRule save(Long id, Map<String, Object> body) {
        Long ownerId = authService.current().getId();

        ProcurementRule rule;
        if (id == null) {
            rule = new ProcurementRule();
            if (ruleRepository.findByEmployeeIdOrderByIdDesc(ownerId).size() >= 50) {
                throw new IllegalArgumentException("관심조건은 최대 50개까지 등록할 수 있습니다.");
            }
        } else {
            rule = ruleRepository.findById(id)
                    .filter(r -> r.employeeId.equals(ownerId))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "해당 관심조건을 찾을 수 없습니다."));
            validateVersion(rule.getVersion(), body);
        }

        rule.employeeId = ownerId;
        rule.name = validateText(body, "name", 100);
        if (rule.name.isBlank()) {
            throw new IllegalArgumentException("조건 이름을 입력하세요.");
        }

        rule.keywords = parseTerms(body, "keywords");
        rule.excludedKeywords = parseTerms(body, "excluded_keywords");
        rule.institutions = parseTerms(body, "institutions");

        if (rule.keywords.isBlank() && rule.institutions.isBlank()) {
            throw new IllegalArgumentException("관심 키워드나 기관을 한 개 이상 입력하세요.");
        }

        rule.matchMode = validateChoice(body, "match_mode", Set.of("AND", "OR"));
        rule.noticeKind = validateChoice(body, "notice_kind", Set.of("ALL", "BID", "SPEC"));
        rule.businessType = validateChoice(body, "business_type", Set.of("ALL", "SERVC", "THNG", "CNSTWK", "FRGCPT"));

        if (!(body.get("enabled") instanceof Boolean enabled)) {
            throw new IllegalArgumentException("사용 여부를 확인하세요.");
        }
        rule.enabled = enabled;

        return ruleRepository.saveAndFlush(rule);
    }

    /**
     * 관심조건 삭제
     */
    public void delete(Long id, Map<String, Object> body) {
        Long ownerId = authService.current().getId();
        ProcurementRule rule = ruleRepository.findById(id)
                .filter(r -> r.employeeId.equals(ownerId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "해당 관심조건을 찾을 수 없습니다."));

        validateVersion(rule.getVersion(), body);
        ruleRepository.delete(rule);
        ruleRepository.flush();
    }

    /**
     * 매칭된 공고 알림 검색 및 목록 조회
     */
    @Transactional(readOnly = true)
    public Map<String, Object> list(
            int page,
            int size,
            String queryText,
            String kind,
            String business,
            boolean unreadOnly
    ) {
        Long ownerId = authService.current().getId();

        if (page < 0 || size < 1 || size > 100 || queryText.length() > 100
                || !Set.of("ALL", "BID", "SPEC").contains(kind)
                || !Set.of("ALL", "SERVC", "THNG", "CNSTWK", "FRGCPT").contains(business)) {
            throw new IllegalArgumentException("검색 범위를 확인하세요.");
        }

        Specification<ProcurementAlert> spec = (root, query, cb) -> {
            var notice = query.from(ProcurementNotice.class);
            List<Predicate> predicates = new ArrayList<>();

            predicates.add(cb.equal(root.get("employeeId"), ownerId));
            predicates.add(cb.equal(root.get("noticeId"), notice.get("id")));

            if (unreadOnly) {
                predicates.add(cb.isNull(root.get("readOn")));
            }
            if (!"ALL".equals(kind)) {
                predicates.add(cb.equal(notice.get("kind"), kind));
            }
            if (!"ALL".equals(business)) {
                predicates.add(cb.equal(notice.get("businessType"), business));
            }
            if (!queryText.isBlank()) {
                String likePattern = "%" + queryText.toLowerCase(Locale.ROOT)
                        .replace("!", "!!")
                        .replace("%", "!%")
                        .replace("_", "!_") + "%";

                predicates.add(cb.or(
                        cb.like(cb.lower(notice.get("title")), likePattern, '!'),
                        cb.like(cb.lower(notice.get("agency")), likePattern, '!'),
                        cb.like(cb.lower(notice.get("demandAgency")), likePattern, '!')
                ));
            }

            return cb.and(predicates.toArray(Predicate[]::new));
        };

        var pageResult = alertRepository.findAll(spec, PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "id")));

        List<Long> noticeIds = pageResult.stream().map(a -> a.noticeId).toList();
        Map<Long, ProcurementNotice> noticeMap = new HashMap<>();
        noticeRepository.findAllById(noticeIds).forEach(n -> noticeMap.put(n.id, n));

        List<Map<String, Object>> items = pageResult.stream()
                .map(alert -> toDto(alert, noticeMap.get(alert.noticeId)))
                .toList();

        return Map.of(
                "items", items,
                "total", pageResult.getTotalElements(),
                "page", page
        );
    }

    /**
     * 알림 상세 조회
     */
    @Transactional(readOnly = true)
    public Map<String, Object> detail(Long id) {
        ProcurementAlert alert = getOwnedAlert(id);
        ProcurementNotice notice = noticeRepository.findById(alert.noticeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "공고 정보를 찾을 수 없습니다."));
        return toDto(alert, notice);
    }

    /**
     * 알림 읽음 처리
     */
    public Map<String, Object> read(Long id, Map<String, Object> body) {
        ProcurementAlert alert = getOwnedAlert(id);
        validateVersion(alert.getVersion(), body);

        if (alert.readOn == null) {
            alert.readOn = Instant.now();
        }

        alertRepository.saveAndFlush(alert);
        ProcurementNotice notice = noticeRepository.findById(alert.noticeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "공고 정보를 찾을 수 없습니다."));
        return toDto(alert, notice);
    }

    /**
     * 수동 공고 동기화 요청 (관리자/임원 전용)
     */
    public Map<String, Object> requestSync() {
        if (!AuthService.executive(authService.current())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "수동 조회는 관리자·임원만 실행할 수 있습니다.");
        }
        if (!settings.enabled || !settings.configured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "나라장터 API 인증키 및 연동 설정이 필요합니다.");
        }

        return Map.of("accepted", syncEngine.request());
    }

    private ProcurementAlert getOwnedAlert(Long id) {
        Long ownerId = authService.current().getId();
        return alertRepository.findById(id)
                .filter(a -> a.employeeId.equals(ownerId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "알림을 찾을 수 없습니다."));
    }

    private static Map<String, Object> toDto(ProcurementAlert alert, ProcurementNotice notice) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", alert.id);
        dto.put("version", alert.getVersion());
        dto.put("read_on", alert.readOn);
        dto.put("created_on", alert.getCreatedOn());
        dto.put("matched_rules", alert.matchedRules);
        dto.put("notice", notice);
        return dto;
    }

    private static void validateVersion(Long currentVersion, Map<String, Object> body) {
        Object versionValue = body.get("version");
        if (versionValue == null || !versionValue.toString().matches("[0-9]+")) {
            throw new IllegalArgumentException("조회 당시 version이 필요합니다.");
        }
        if (!currentVersion.toString().equals(versionValue.toString())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "다른 창에서 변경되었습니다. 새로고침 후 다시 시도하세요.");
        }
    }

    private static String validateText(Map<String, Object> body, String key, int maxLength) {
        if (!(body.get(key) instanceof String text) || text.length() > maxLength) {
            throw new IllegalArgumentException("입력값 길이와 형식을 확인하세요: " + key);
        }
        return text.strip();
    }

    private static String parseTerms(Map<String, Object> body, String key) {
        String text = validateText(body, key, 3000);
        List<String> termList = ProcurementMatcher.terms(text);
        if (termList.size() > 30 || termList.stream().anyMatch(t -> t.length() > 100)) {
            throw new IllegalArgumentException("키워드·기관은 각 30개, 항목당 100자까지 입력할 수 있습니다.");
        }
        return String.join("\n", termList);
    }

    private static String validateChoice(Map<String, Object> body, String key, Set<String> allowedSet) {
        String value = validateText(body, key, 10);
        if (!allowedSet.contains(value)) {
            throw new IllegalArgumentException("선택값을 확인하세요: " + key);
        }
        return value;
    }
}
