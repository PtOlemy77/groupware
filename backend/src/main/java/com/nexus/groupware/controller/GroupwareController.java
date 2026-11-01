package com.nexus.groupware.controller;

import com.nexus.groupware.service.GroupwareService;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/groupware")
public class GroupwareController {
  private final GroupwareService service;

  public GroupwareController(GroupwareService s) {
    service = s;
  }

  @GetMapping
  public Map<String, Object> all(
      @RequestParam(defaultValue = "dashboard") String scope,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "50") int size) {
    return service.getAllData(scope, page, size);
  }

  @GetMapping("/approvals/{id}")
  public Map<String, Object> detail(@PathVariable Long id) {
    return service.approvalDetail(id);
  }

  @PostMapping
  public Map<String, Object> mutate(@RequestBody Map<String, Object> payload) {
    return service.processMutation(payload);
  }
}
