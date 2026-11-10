package com.nexus.groupware.domain.procurement.controller;

import com.nexus.groupware.domain.procurement.service.ProcurementService;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 입찰공고 및 사전규격 모니터링 API 컨트롤러
 */
@RestController
@RequestMapping("/api/procurement")
public class ProcurementController {

    private final ProcurementService procurementService;

    public ProcurementController(ProcurementService procurementService) {
        this.procurementService = procurementService;
    }

    /**
     * 연동 상태 및 미읽음 알림 통계 조회
     */
    @GetMapping("/status")
    public Map<String, Object> getStatus() {
        return procurementService.status();
    }

    /**
     * 로그인한 임직원의 관심조건 목록 조회
     */
    @GetMapping("/rules")
    public Object getRules() {
        return procurementService.rules();
    }

    /**
     * 신규 관심조건 등록
     */
    @PostMapping("/rules")
    public Object createRule(@RequestBody Map<String, Object> body) {
        return procurementService.save(null, body);
    }

    /**
     * 관심조건 수정
     */
    @PostMapping("/rules/{id}")
    public Object updateRule(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body
    ) {
        return procurementService.save(id, body);
    }

    /**
     * 관심조건 삭제
     */
    @PostMapping("/rules/{id}/delete")
    public Object deleteRule(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body
    ) {
        procurementService.delete(id, body);
        return Map.of("ok", true);
    }

    /**
     * 매칭된 공고 알림 목록 검색 및 페이징 조회
     */
    @GetMapping("/alerts")
    public Object listAlerts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "ALL") String kind,
            @RequestParam(defaultValue = "ALL") String business,
            @RequestParam(defaultValue = "false") boolean unread
    ) {
        return procurementService.list(page, size, q, kind, business, unread);
    }

    /**
     * 특정 공고 알림 상세 조회
     */
    @GetMapping("/alerts/{id}")
    public Object getAlertDetail(@PathVariable Long id) {
        return procurementService.detail(id);
    }

    /**
     * 공고 알림 읽음 처리
     */
    @PostMapping("/alerts/{id}/read")
    public Object markAlertAsRead(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body
    ) {
        return procurementService.read(id, body);
    }

    /**
     * 나라장터 공고 수동 동기화 요청
     */
    @PostMapping("/sync")
    public Object requestManualSync() {
        return procurementService.requestSync();
    }
}
