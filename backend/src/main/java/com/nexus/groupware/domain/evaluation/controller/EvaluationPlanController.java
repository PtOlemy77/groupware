package com.nexus.groupware.domain.evaluation.controller;

import com.nexus.groupware.domain.evaluation.dto.EvaluationDtos.EvaluationActionRequest;
import com.nexus.groupware.domain.evaluation.dto.EvaluationDtos.EvaluationConfigResponse;
import com.nexus.groupware.domain.evaluation.dto.EvaluationDtos.EvaluationCreateRequest;
import com.nexus.groupware.domain.evaluation.dto.EvaluationDtos.EvaluationListResponse;
import com.nexus.groupware.domain.evaluation.dto.EvaluationDtos.EvaluationPlanVo;
import com.nexus.groupware.domain.evaluation.service.EvaluationPlanService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/evaluation-plans")
public class EvaluationPlanController {

    private final EvaluationPlanService service;

    public EvaluationPlanController(EvaluationPlanService service) {
        this.service = service;
    }

    @GetMapping("/config")
    public EvaluationConfigResponse config() {
        return service.config();
    }

    @GetMapping
    public EvaluationListResponse list(
            @RequestParam int year,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "") String state) {
        return service.list(year, page, size, q, state);
    }

    @GetMapping("/{id}")
    public EvaluationPlanVo detail(@PathVariable Long id) {
        return service.detail(id);
    }

    @PostMapping
    public EvaluationPlanVo create(@RequestBody EvaluationCreateRequest request) {
        return service.create(request);
    }

    @PostMapping("/{id}/{action}")
    public Object action(
            @PathVariable Long id,
            @PathVariable String action,
            @RequestBody EvaluationActionRequest request) {
        return service.action(id, action, request);
    }
}
