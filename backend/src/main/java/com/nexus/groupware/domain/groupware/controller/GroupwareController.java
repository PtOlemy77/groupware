package com.nexus.groupware.domain.groupware.controller;

import com.nexus.groupware.domain.groupware.dto.GroupwareDtos.ApprovalDetailVo;
import com.nexus.groupware.domain.groupware.dto.GroupwareDtos.GroupwareDataResponse;
import com.nexus.groupware.domain.groupware.dto.GroupwareDtos.GroupwareMutationRequest;
import com.nexus.groupware.domain.groupware.dto.GroupwareDtos.GroupwareMutationResponse;
import com.nexus.groupware.domain.groupware.service.GroupwareService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/groupware")
public class GroupwareController {
  private final GroupwareService service;

  public GroupwareController(GroupwareService service) {
    this.service = service;
  }

  @GetMapping
  public GroupwareDataResponse all(
      @RequestParam(defaultValue = "dashboard") String scope,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "50") int size) {
    return service.getAllData(scope, page, size);
  }

  @GetMapping("/approvals/{id}")
  public ApprovalDetailVo detail(@PathVariable Long id) {
    return service.approvalDetail(id);
  }

  @PostMapping
  public GroupwareMutationResponse mutate(@RequestBody GroupwareMutationRequest request) {
    return service.processMutation(request);
  }
}
