package com.nexus.groupware.domain.system.controller;

import org.springframework.boot.availability.ApplicationAvailability;
import org.springframework.boot.availability.ReadinessState;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {
  public record HealthResponse(boolean ready) {}

  private final ApplicationAvailability availability;

  public HealthController(ApplicationAvailability availability) {
    this.availability = availability;
  }

  @GetMapping("/api/health")
  public ResponseEntity<HealthResponse> health() {
    boolean ready = availability.getReadinessState() == ReadinessState.ACCEPTING_TRAFFIC;
    return ResponseEntity.status(ready ? 200 : 503).body(new HealthResponse(ready));
  }
}
