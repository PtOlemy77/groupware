package com.nexus.groupware.code;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

public enum StatusCode {
  STATUS_ACTIVE("STATUS_ACTIVE", "재직", 1),
  STATUS_LEAVE("STATUS_LEAVE", "휴직", 2),
  STATUS_RETIRED("STATUS_RETIRED", "퇴사", 3);

  private final String code;
  private final String label;
  private final int sortOrder;

  StatusCode(String code, String label, int sortOrder) {
    this.code = code;
    this.label = label;
    this.sortOrder = sortOrder;
  }

  public String getCode() {
    return code;
  }

  public String getLabel() {
    return label;
  }

  public int getSortOrder() {
    return sortOrder;
  }

  public static StatusCode fromCodeOrLabel(String input) {
    if (input == null || input.isBlank()) {
      return STATUS_ACTIVE;
    }
    String clean = input.trim();
    // 과거 호환 및 오탈자 방지
    if ("대기".equalsIgnoreCase(clean) || "투입중".equalsIgnoreCase(clean)) {
      return STATUS_ACTIVE;
    }
    for (StatusCode sc : values()) {
      if (sc.code.equalsIgnoreCase(clean) || sc.label.equalsIgnoreCase(clean)) {
        return sc;
      }
    }
    throw new IllegalArgumentException("유효하지 않은 사원 상태 코드입니다: " + input);
  }

  public static List<Map<String, Object>> toList() {
    return Arrays.stream(values())
        .map(s -> Map.<String, Object>of(
            "code", s.code,
            "label", s.label,
            "sort_order", s.sortOrder
        ))
        .toList();
  }
}
