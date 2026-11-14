package com.nexus.groupware.core.code;

import java.util.Arrays;
import java.util.List;

public enum RoleCode {
  ROLE_ADMIN("ROLE_ADMIN", "시스템 관리자", 4),
  ROLE_EXEC("ROLE_EXEC", "임원 권한", 3),
  ROLE_PM("ROLE_PM", "PM 권한", 2),
  ROLE_STAFF("ROLE_STAFF", "일반직원", 1);

  public record RoleOptionVo(String code, String label, int rank) {}

  private final String code;
  private final String label;
  private final int rank;

  RoleCode(String code, String label, int rank) {
    this.code = code;
    this.label = label;
    this.rank = rank;
  }

  public String getCode() {
    return code;
  }

  public String getLabel() {
    return label;
  }

  public int getRank() {
    return rank;
  }

  public static RoleCode fromCodeOrLabel(String input) {
    if (input == null || input.isBlank()) {
      return ROLE_STAFF;
    }
    String clean = input.trim();
    if ("관리자 권한".equalsIgnoreCase(clean) || "경영팀 권한".equalsIgnoreCase(clean)) {
      return ROLE_ADMIN;
    }
    for (RoleCode rc : values()) {
      if (rc.code.equalsIgnoreCase(clean) || rc.label.equalsIgnoreCase(clean)) {
        return rc;
      }
    }
    return ROLE_STAFF;
  }

  public boolean isAdmin() {
    return this == ROLE_ADMIN;
  }

  public boolean isExecutiveOrAbove() {
    return this == ROLE_ADMIN || this == ROLE_EXEC;
  }

  public boolean isPmOrAbove() {
    return this == ROLE_ADMIN || this == ROLE_EXEC || this == ROLE_PM;
  }

  public static List<RoleOptionVo> toOptions() {
    return Arrays.stream(values())
        .map(r -> new RoleOptionVo(r.getCode(), r.getLabel(), r.getRank()))
        .toList();
  }
}

