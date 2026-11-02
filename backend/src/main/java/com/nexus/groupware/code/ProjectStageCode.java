package com.nexus.groupware.code;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

public enum ProjectStageCode {
  STAGE_ORDER("STAGE_ORDER", "발주예상", 1),
  STAGE_PROPOSAL("STAGE_PROPOSAL", "제안준비중", 2),
  STAGE_EXEC("STAGE_EXEC", "프로젝트 수행", 3),
  STAGE_DONE("STAGE_DONE", "완료", 4);

  private final String code;
  private final String label;
  private final int sortOrder;

  ProjectStageCode(String code, String label, int sortOrder) {
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

  public static ProjectStageCode fromCodeOrLabel(String input) {
    if (input == null || input.isBlank()) {
      return STAGE_EXEC;
    }
    String clean = input.trim();
    if ("진행중".equalsIgnoreCase(clean)) {
      return STAGE_EXEC;
    }
    for (ProjectStageCode sc : values()) {
      if (sc.code.equalsIgnoreCase(clean) || sc.label.equalsIgnoreCase(clean)) {
        return sc;
      }
    }
    throw new IllegalArgumentException("유효하지 않은 프로젝트 단계 코드입니다: " + input);
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

