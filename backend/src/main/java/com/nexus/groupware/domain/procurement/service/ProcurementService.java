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
import com.nexus.groupware.domain.procurement.dto.ProcurementDtos.ProcurementAlertPageResponse;
import com.nexus.groupware.domain.procurement.dto.ProcurementDtos.ProcurementAlertVo;
import com.nexus.groupware.domain.procurement.dto.ProcurementDtos.ProcurementStatusResponse;
import com.nexus.groupware.domain.procurement.dto.ProcurementDtos.RuleSaveRequest;
import com.nexus.groupware.domain.procurement.dto.ProcurementDtos.SyncSourceStatusVo;
import com.nexus.groupware.domain.procurement.dto.ProcurementDtos.SyncTriggerResponse;
import com.nexus.groupware.domain.procurement.dto.ProcurementDtos.UnreadCategoryCountVo;
import com.nexus.groupware.domain.procurement.dto.ProcurementDtos.VersionRequest;
import jakarta.persistence.criteria.Predicate;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
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
    public ProcurementStatusResponse status() {
        Employee currentActor = authService.current();
        List<ProcurementSyncState> sourceStates = stateRepository.findAll();

        boolean isLockRunning = sourceStates.stream()
                .anyMatch(s -> "LOCK".equals(s.id) && s.leaseUntil != null && s.leaseUntil.isAfter(Instant.now()));
        boolean isRunning = syncEngine.running() || isLockRunning;

        // 미읽음 알림 카테고리별 집계
        Map<String, Long> categoryCounts = new HashMap<>();
        for (Object[] row : alertRepository.unreadCategories(currentActor.getId())) {
            String key = row[0] + ":" + row[1];
            categoryCounts.put(key, ((Number) row[2]).longValue());
        }

        List<UnreadCategoryCountVo> categories = new ArrayList<>();
        for (String kind : List.of("BID", "SPEC")) {
            for (String business : List.of("SERVC", "THNG", "CNSTWK", "FRGCPT")) {
                long count = categoryCounts.getOrDefault(kind + ":" + business, 0L);
                categories.add(new UnreadCategoryCountVo(kind, business, count));
            }
        }

        long totalUnread = categoryCounts.values().stream().mapToLong(Long::longValue).sum();

        // 소스별 수집 상태
        List<SyncSourceStatusVo> sources = sourceStates.stream()
                .filter(s -> !"LOCK".equals(s.id) && settings.types().stream().anyMatch(t -> s.id.contains("_" + t + "_")))
                .map(s -> new SyncSourceStatusVo(
                        s.id,
                        s.lastSuccess,
                        s.lastError,
                        s.lastAttempt,
                        s.untilTime != null,
                        s.nextPage
                ))
                .toList();

        return new ProcurementStatusResponse(
                settings.configured(),
                settings.enabled,
                isRunning,
                AuthService.executive(currentActor),
                settings.intervalMs / 60000,
                settings.types(),
                totalUnread,
                categories,
                sources
        );
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
    public ProcurementRule save(Long id, RuleSaveRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("요청 본문이 필요합니다.");
        }
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
            validateVersion(rule.getVersion(), request.version());
        }

        rule.employeeId = ownerId;
        rule.name = validateText(request.name(), "name", 100);
        if (rule.name.isBlank()) {
            throw new IllegalArgumentException("조건 이름을 입력하세요.");
        }

        rule.keywords = parseTerms(request.keywords(), "keywords");
        rule.excludedKeywords = parseTerms(request.excludedKeywords(), "excluded_keywords");
        rule.institutions = parseTerms(request.institutions(), "institutions");

        if (rule.keywords.isBlank() && rule.institutions.isBlank()) {
            throw new IllegalArgumentException("관심 키워드나 기관을 한 개 이상 입력하세요.");
        }

        rule.matchMode = validateChoice(request.matchMode(), "match_mode", Set.of("AND", "OR"));
        rule.noticeKind = validateChoice(request.noticeKind(), "notice_kind", Set.of("ALL", "BID", "SPEC"));
        rule.businessType = validateChoice(
                request.businessType(), "business_type", Set.of("ALL", "SERVC", "THNG", "CNSTWK", "FRGCPT"));

        if (request.enabled() == null) {
            throw new IllegalArgumentException("사용 여부를 확인하세요.");
        }
        rule.enabled = request.enabled();

        return ruleRepository.saveAndFlush(rule);
    }

    /**
     * 관심조건 삭제
     */
    public void delete(Long id, VersionRequest request) {
        Long ownerId = authService.current().getId();
        ProcurementRule rule = ruleRepository.findById(id)
                .filter(r -> r.employeeId.equals(ownerId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "해당 관심조건을 찾을 수 없습니다."));

        validateVersion(rule.getVersion(), request == null ? null : request.version());
        ruleRepository.delete(rule);
        ruleRepository.flush();
    }

    /**
     * 매칭된 공고 알림 검색 및 목록 조회
     */
    @Transactional(readOnly = true)
    public ProcurementAlertPageResponse list(
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

        List<ProcurementAlertVo> items = pageResult.stream()
                .map(alert -> toVo(alert, noticeMap.get(alert.noticeId)))
                .toList();

        return new ProcurementAlertPageResponse(items, pageResult.getTotalElements(), page);
    }

    /**
     * 알림 상세 조회
     */
    @Transactional(readOnly = true)
    public ProcurementAlertVo detail(Long id) {
        ProcurementAlert alert = getOwnedAlert(id);
        ProcurementNotice notice = noticeRepository.findById(alert.noticeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "공고 정보를 찾을 수 없습니다."));
        return toVo(alert, notice);
    }

    /**
     * 알림 읽음 처리
     */
    public ProcurementAlertVo read(Long id, VersionRequest request) {
        ProcurementAlert alert = getOwnedAlert(id);
        validateVersion(alert.getVersion(), request == null ? null : request.version());

        if (alert.readOn == null) {
            alert.readOn = Instant.now();
        }

        alertRepository.saveAndFlush(alert);
        ProcurementNotice notice = noticeRepository.findById(alert.noticeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "공고 정보를 찾을 수 없습니다."));
        return toVo(alert, notice);
    }

    /**
     * 수동 공고 동기화 요청 (관리자/임원 전용)
     */
    public SyncTriggerResponse requestSync() {
        if (!AuthService.executive(authService.current())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "수동 조회는 관리자·임원만 실행할 수 있습니다.");
        }
        if (!settings.enabled || !settings.configured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "나라장터 API 인증키 및 연동 설정이 필요합니다.");
        }

        return new SyncTriggerResponse(syncEngine.request());
    }

    private ProcurementAlert getOwnedAlert(Long id) {
        Long ownerId = authService.current().getId();
        return alertRepository.findById(id)
                .filter(a -> a.employeeId.equals(ownerId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "알림을 찾을 수 없습니다."));
    }

    private static ProcurementAlertVo toVo(ProcurementAlert alert, ProcurementNotice notice) {
        return new ProcurementAlertVo(
                alert.id,
                alert.getVersion(),
                alert.readOn,
                alert.getCreatedOn(),
                alert.matchedRules,
                notice
        );
    }

    private static void validateVersion(Long currentVersion, Long requestedVersion) {
        if (requestedVersion == null) {
            throw new IllegalArgumentException("조회 당시 version이 필요합니다.");
        }
        if (!Objects.equals(currentVersion, requestedVersion)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "다른 창에서 변경되었습니다. 새로고침 후 다시 시도하세요.");
        }
    }

    private static String validateText(String text, String key, int maxLength) {
        if (text == null || text.length() > maxLength) {
            throw new IllegalArgumentException("입력값 길이와 형식을 확인하세요: " + key);
        }
        return text.strip();
    }

    private static String parseTerms(String rawText, String key) {
        String text = validateText(rawText, key, 3000);
        List<String> termList = ProcurementMatcher.terms(text);
        if (termList.size() > 30 || termList.stream().anyMatch(t -> t.length() > 100)) {
            throw new IllegalArgumentException("키워드·기관은 각 30개, 항목당 100자까지 입력할 수 있습니다.");
        }
        return String.join("\n", termList);
    }

    private static String validateChoice(String rawValue, String key, Set<String> allowedSet) {
        String value = validateText(rawValue, key, 10);
        if (!allowedSet.contains(value)) {
            throw new IllegalArgumentException("선택값을 확인하세요: " + key);
        }
        return value;
    }
}
