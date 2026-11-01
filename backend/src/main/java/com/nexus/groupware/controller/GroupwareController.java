package com.nexus.groupware.controller;

import com.nexus.groupware.service.GroupwareService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/groupware")
@CrossOrigin(origins = "*")
public class GroupwareController {

    private final GroupwareService groupwareService;

    public GroupwareController(GroupwareService groupwareService) {
        this.groupwareService = groupwareService;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getAllGroupwareData() {
        return ResponseEntity.ok(groupwareService.getAllData());
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> mutateGroupwareData(@RequestBody Map<String, Object> payload) {
        if ("login".equals(payload.get("action"))) {
            String identifier = payload.get("identifier") != null ? payload.get("identifier").toString() : "";
            String password = payload.get("password") != null ? payload.get("password").toString() : "";
            return ResponseEntity.ok(groupwareService.authenticate(identifier, password));
        }
        groupwareService.processMutation(payload);
        return ResponseEntity.ok(Map.of("ok", true));
    }
}
