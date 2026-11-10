package com.nexus.groupware.domain.procurement.service;

import com.nexus.groupware.domain.procurement.db.ProcurementAlert;
import com.nexus.groupware.domain.procurement.db.ProcurementAlertRepository;
import com.nexus.groupware.domain.procurement.db.ProcurementAlertRule;
import com.nexus.groupware.domain.procurement.db.ProcurementAlertRuleRepository;
import com.nexus.groupware.domain.procurement.db.ProcurementNotice;
import com.nexus.groupware.domain.procurement.db.ProcurementNoticeRepository;
import com.nexus.groupware.domain.procurement.db.ProcurementRule;
import com.nexus.groupware.domain.procurement.db.ProcurementRuleRepository;
import com.nexus.groupware.domain.procurement.db.ProcurementSyncState;
import com.nexus.groupware.domain.procurement.db.ProcurementSyncStateRepository;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 나라장터 수집 공고 영속화 및 관심조건 매칭 알림 저장소
 */
@Service
@Transactional
public class ProcurementStore {

    private final ProcurementRuleRepository ruleRepository;
    private final ProcurementNoticeRepository noticeRepository;
    private final ProcurementAlertRepository alertRepository;
    private final ProcurementSyncStateRepository stateRepository;
    private final ProcurementAlertRuleRepository alertRuleRepository;

    public ProcurementStore(
            ProcurementRuleRepository ruleRepository,
            ProcurementNoticeRepository noticeRepository,
            ProcurementAlertRepository alertRepository,
            ProcurementSyncStateRepository stateRepository,
            ProcurementAlertRuleRepository alertRuleRepository
    ) {
        this.ruleRepository = ruleRepository;
        this.noticeRepository = noticeRepository;
        this.alertRepository = alertRepository;
        this.stateRepository = stateRepository;
        this.alertRuleRepository = alertRuleRepository;
    }

    public record Window(LocalDateTime from, LocalDateTime until, int page) {}

    private ProcurementSyncState getOrCreateState(String id) {
        return stateRepository.lock(id).orElseGet(() -> {
            var state = new ProcurementSyncState();
            state.id = id;
            return stateRepository.saveAndFlush(state);
        });
    }

    /**
     * 분산 락(LOCK) 획득 시도 (2분 리스 타임아웃)
     */
    public boolean claim(String token) {
        var lockState = getOrCreateState("LOCK");
        if (lockState.leaseUntil != null && lockState.leaseUntil.isAfter(Instant.now())) {
            return false;
        }

        lockState.leaseToken = token;
        lockState.leaseUntil = Instant.now().plusSeconds(120);
        lockState.lastAttempt = Instant.now();
        return true;
    }

    /**
     * 분산 락 연장 (2분 갱신)
     */
    private void renewLease(String token) {
        var lockState = getOrCreateState("LOCK");
        if (!token.equals(lockState.leaseToken)) {
            throw new IllegalStateException("동기화 실행권이 만료되었습니다.");
        }
        lockState.leaseUntil = Instant.now().plusSeconds(120);
    }

    public Window window(String id, String token) {
        return window(id, token, true);
    }

    /**
     * 특정 소스의 수집 시간 범위(Window)와 다음 페이지 번호 조회
     */
    public Window window(String id, String token, boolean weekly) {
        renewLease(token);
        var state = getOrCreateState(id);

        if (state.untilTime == null) {
            var now = LocalDateTime.now(ZoneId.of("Asia/Seoul")).withSecond(0).withNano(0);
            // 최소 7일 전부터의 변경/등록 공고를 재확인하여 지연 등록된 공고 누락 방지
            if (state.fromTime == null || (weekly && state.fromTime.isAfter(now.minusDays(7)))) {
                state.fromTime = now.minusDays(7);
            }

            state.untilTime = state.fromTime.plusDays(7).isBefore(now)
                    ? state.fromTime.plusDays(7)
                    : now;
            state.nextPage = 1;
        }

        state.lastAttempt = Instant.now();
        return new Window(state.fromTime, state.untilTime, state.nextPage);
    }

    /**
     * 수신된 공고 목록을 저장하고 활성 관심조건과 매칭하여 알림 생성
     */
    public void apply(String id, String token, Window window, ProcurementGateway.FeedPage data) {
        renewLease(token);
        var state = getOrCreateState(id);

        if (!window.from.equals(state.fromTime) || !window.until.equals(state.untilTime) || window.page != state.nextPage) {
            throw new IllegalStateException("동기화 조회 위치가 변경되었습니다.");
        }

        List<ProcurementRule> activeRules = ruleRepository.findActiveRules();

        for (var noticeRow : data.items()) {
            // 직원별로 매칭된 규칙들을 취합
            Map<Long, List<ProcurementRule>> recipients = new LinkedHashMap<>();
            for (var rule : activeRules) {
                if (ProcurementMatcher.matches(rule, noticeRow)) {
                    recipients.computeIfAbsent(rule.employeeId, k -> new ArrayList<>()).add(rule);
                }
            }

            if (recipients.isEmpty()) {
                continue;
            }

            // 공고 원천 데이터 영속화
            ProcurementNotice savedNotice = noticeRepository.findByKindAndBusinessTypeAndExternalIdAndRevisionAndFingerprint(
                    noticeRow.kind,
                    noticeRow.businessType,
                    noticeRow.externalId,
                    noticeRow.revision,
                    noticeRow.fingerprint
            ).orElseGet(() -> noticeRepository.saveAndFlush(noticeRow));

            // 각 수신 대상 직원에게 알림 생성 (이미 존재하는 경우 중복 발송 방지)
            for (var entry : recipients.entrySet()) {
                Long employeeId = entry.getKey();
                if (alertRepository.findByEmployeeIdAndNoticeId(employeeId, savedNotice.id).isPresent()) {
                    continue;
                }

                List<ProcurementRule> matched = entry.getValue();
                String ruleNames = String.join(", ", matched.stream().map(r -> r.name).toList());

                ProcurementAlert alert = new ProcurementAlert();
                alert.employeeId = employeeId;
                alert.noticeId = savedNotice.id;
                alert.matchedRules = ruleNames.substring(0, Math.min(2000, ruleNames.length()));
                alertRepository.saveAndFlush(alert);

                for (var rule : matched) {
                    ProcurementAlertRule alertRule = new ProcurementAlertRule();
                    alertRule.alertId = alert.id;
                    alertRule.ruleId = rule.id;
                    alertRule.ruleName = rule.name;
                    alertRuleRepository.save(alertRule);
                }
            }
        }

        // 해당 시간 윈도우의 모든 페이지 수집 완료 시
        boolean finishedWindow = (long) data.page() * data.size() >= data.total();
        if (finishedWindow) {
            // 경계 시점의 공고 누락을 방지하기 위해 1분 오버랩 적용
            state.fromTime = window.until.minusMinutes(1);
            state.untilTime = null;
            state.nextPage = 1;
        } else {
            state.nextPage = window.page + 1;
        }

        state.lastSuccess = Instant.now();
        state.lastError = null;
    }

    /**
     * 수집 실패 시 상태 기록
     */
    public void failed(String id, String token) {
        renewLease(token);
        getOrCreateState(id).lastError = "조회 실패 · API 승인, 호출 한도 또는 네트워크를 확인하세요. 다음 실행에서 재시도합니다.";
    }

    /**
     * 분산 락 해제
     */
    public void release(String token) {
        var lockState = getOrCreateState("LOCK");
        if (token.equals(lockState.leaseToken)) {
            lockState.leaseUntil = null;
            lockState.leaseToken = null;
        }
    }
}
