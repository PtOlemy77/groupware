package com.nexus.groupware.domain.procurement.controller;

import com.nexus.groupware.domain.procurement.db.ProcurementRule;
import com.nexus.groupware.domain.procurement.dto.ProcurementDtos.OkResponse;
import com.nexus.groupware.domain.procurement.dto.ProcurementDtos.ProcurementAlertPageResponse;
import com.nexus.groupware.domain.procurement.dto.ProcurementDtos.ProcurementAlertVo;
import com.nexus.groupware.domain.procurement.dto.ProcurementDtos.ProcurementStatusResponse;
import com.nexus.groupware.domain.procurement.dto.ProcurementDtos.RuleSaveRequest;
import com.nexus.groupware.domain.procurement.dto.ProcurementDtos.SyncTriggerResponse;
import com.nexus.groupware.domain.procurement.dto.ProcurementDtos.VersionRequest;
import com.nexus.groupware.domain.procurement.service.ProcurementService;
import java.util.List;
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
    public ProcurementStatusResponse getStatus() {
        return procurementService.status();
    }

    /**
     * 로그인한 임직원의 관심조건 목록 조회
     */
    @GetMapping("/rules")
    public List<ProcurementRule> getRules() {
        return procurementService.rules();
    }

    /**
     * 신규 관심조건 등록
     */
    @PostMapping("/rules")
    public ProcurementRule createRule(@RequestBody RuleSaveRequest request) {
        return procurementService.save(null, request);
    }

    /**
     * 관심조건 수정
     */
    @PostMapping("/rules/{id}")
    public ProcurementRule updateRule(
            @PathVariable Long id,
            @RequestBody RuleSaveRequest request
    ) {
        return procurementService.save(id, request);
    }

    /**
     * 관심조건 삭제
     */
    @PostMapping("/rules/{id}/delete")
    public OkResponse deleteRule(
            @PathVariable Long id,
            @RequestBody VersionRequest request
    ) {
        procurementService.delete(id, request);
        return new OkResponse(true);
    }

    /**
     * 매칭된 공고 알림 목록 검색 및 페이징 조회
     */
    @GetMapping("/alerts")
    public ProcurementAlertPageResponse listAlerts(
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
    public ProcurementAlertVo getAlertDetail(@PathVariable Long id) {
        return procurementService.detail(id);
    }

    /**
     * 공고 알림 읽음 처리
     */
    @PostMapping("/alerts/{id}/read")
    public ProcurementAlertVo markAlertAsRead(
            @PathVariable Long id,
            @RequestBody VersionRequest request
    ) {
        return procurementService.read(id, request);
    }

    /**
     * 나라장터 공고 수동 동기화 요청
     */
    @PostMapping("/sync")
    public SyncTriggerResponse requestManualSync() {
        return procurementService.requestSync();
    }
}
