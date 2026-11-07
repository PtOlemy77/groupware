package com.nexus.groupware.domain.system.controller;

import java.util.Map;
import org.springframework.boot.availability.ApplicationAvailability;
import org.springframework.boot.availability.ReadinessState;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
public class HealthController {
  private final ApplicationAvailability availability;

  public HealthController(ApplicationAvailability a) {
    availability = a;
  }

  @GetMapping("/api/health")
  public ResponseEntity<?> health() {
    boolean ready = availability.getReadinessState() == ReadinessState.ACCEPTING_TRAFFIC;
    return ResponseEntity.status(ready ? 200 : 503).body(Map.of("ready", ready));
  }
}
