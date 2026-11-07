package com.nexus.groupware.domain.evaluation.controller;

import com.nexus.groupware.domain.evaluation.service.EvaluationPlanService;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/evaluation-plans")
public class EvaluationPlanController {

    private final EvaluationPlanService service;

    public EvaluationPlanController(EvaluationPlanService service) {
        this.service = service;
    }

    @GetMapping("/config")
    public Map<String, Object> config() {
        return service.config();
    }

    @GetMapping
    public Map<String, Object> list(
            @RequestParam int year,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "") String state) {
        return service.list(year, page, size, q, state);
    }

    @GetMapping("/{id}")
    public Map<String, Object> detail(@PathVariable Long id) {
        return service.detail(id);
    }

    @PostMapping
    public Map<String, Object> create(@RequestBody Map<String, Object> body) {
        return service.create(body);
    }

    @PostMapping("/{id}/{action}")
    public Map<String, Object> action(
            @PathVariable Long id,
            @PathVariable String action,
            @RequestBody Map<String, Object> body) {
        return service.action(id, action, body);
    }
}
