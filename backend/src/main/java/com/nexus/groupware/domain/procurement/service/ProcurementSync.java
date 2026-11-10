package com.nexus.groupware.domain.procurement.service;

import com.nexus.groupware.domain.procurement.db.ProcurementRule;
import com.nexus.groupware.domain.procurement.db.ProcurementRuleRepository;
import jakarta.annotation.PreDestroy;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 나라장터 공고 주기적 스케줄링 및 비동기 동기화 엔진
 */
@Component
public class ProcurementSync {

    private final ProcurementSettings settings;
    private final ProcurementStore store;
    private final ProcurementGateway gateway;
    private final ProcurementRuleRepository ruleRepository;

    private final AtomicBoolean running = new AtomicBoolean(false);
    private final ExecutorService executor = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "procurement-sync");
        thread.setDaemon(true);
        return thread;
    });

    public ProcurementSync(
            ProcurementSettings settings,
            ProcurementStore store,
            ProcurementGateway gateway,
            ProcurementRuleRepository ruleRepository
    ) {
        this.settings = settings;
        this.store = store;
        this.gateway = gateway;
        this.ruleRepository = ruleRepository;
    }

    /**
     * 비동기 동기화 1회 실행 요청
     */
    public boolean request() {
        if (!running.compareAndSet(false, true)) {
            return false;
        }

        executor.submit(() -> {
            try {
                runOnce();
            } finally {
                running.set(false);
            }
        });
        return true;
    }

    /**
     * 주기적 스케줄링 태스크
     */
    @Scheduled(
            initialDelayString = "${app.procurement.initial-delay-ms:60000}",
            fixedDelayString = "${app.procurement.interval-ms:3600000}"
    )
    public void scheduled() {
        if (settings.enabled && settings.configured()) {
            request();
        }
    }

    public boolean running() {
        return running.get();
    }

    /**
     * 동기화 실제 실행 로직
     */
    public void runOnce() {
        if (!settings.enabled || !settings.configured()) {
            return;
        }

        List<ProcurementRule> activeRules = ruleRepository.findActiveRules();
        if (activeRules.isEmpty()) {
            return;
        }

        String leaseToken = UUID.randomUUID().toString();
        if (!store.claim(leaseToken)) {
            return;
        }

        try {
            for (String business : settings.types()) {
                for (String kind : new String[]{"BID", "SPEC"}) {
                    // division 1: 등록일시 기준, division 3: 변경일시 기준
                    for (String division : new String[]{"1", "3"}) {
                        var relevantRules = activeRules.stream()
                                .filter(r -> ("ALL".equals(r.businessType) || business.equals(r.businessType))
                                        && ("ALL".equals(r.noticeKind) || kind.equals(r.noticeKind)))
                                .toList();

                        if (relevantRules.isEmpty()) {
                            continue;
                        }

                        // 변경일시(3) 검색은 세부 기관 필터를 허용하지 않으므로 전체(ALL)로 수집
                        var filters = "3".equals(division)
                                ? List.of(ProcurementSearch.ALL)
                                : ProcurementSearch.filters(relevantRules);

                        for (var filter : filters) {
                            String sourceId = ProcurementSearch.source(kind, business, division, filter, relevantRules);

                            try {
                                while (!Thread.currentThread().isInterrupted()) {
                                    var window = store.window(sourceId, leaseToken, "1".equals(division));
                                    var feedPage = gateway.getPage(
                                            kind,
                                            business,
                                            division,
                                            window.from(),
                                            window.until(),
                                            window.page(),
                                            filter
                                    );

                                    store.apply(sourceId, leaseToken, window, feedPage);

                                    boolean isLastPage = (long) feedPage.page() * feedPage.size() >= feedPage.total();
                                    if (isLastPage) {
                                        break;
                                    }
                                }
                            } catch (Exception e) {
                                store.failed(sourceId, leaseToken);
                            }
                        }
                    }
                }
            }
        } finally {
            store.release(leaseToken);
        }
    }

    @PreDestroy
    void close() {
        executor.shutdownNow();
    }
}

@Configuration
@EnableScheduling
class ProcurementSchedulingConfiguration {}
