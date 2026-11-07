package com.nexus.groupware.core.code;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

public enum PositionCode {
  POS_STAFF("POS_STAFF", "담당", 1),
  POS_AM("POS_AM", "대리", 2),
  POS_MGR("POS_MGR", "과장", 3),
  POS_DGM("POS_DGM", "차장", 4),
  POS_GM("POS_GM", "부장", 5),
  POS_DIR("POS_DIR", "이사", 6),
  POS_CEO("POS_CEO", "사장", 7);

  private final String code;
  private final String label;
  private final int level;

  PositionCode(String code, String label, int level) {
    this.code = code;
    this.label = label;
    this.level = level;
  }

  public String getCode() {
    return code;
  }

  public String getLabel() {
    return label;
  }

  public int getLevel() {
    return level;
  }

  public static PositionCode fromCodeOrLabel(String input) {
    if (input == null || input.isBlank()) {
      return POS_STAFF;
    }
    String clean = input.trim();
    // 구버전 코드 호환
    if ("POS_ASST".equalsIgnoreCase(clean)) return POS_AM;
    if ("POS_EXEC".equalsIgnoreCase(clean)) return POS_DIR;

    for (PositionCode pc : values()) {
      if (pc.code.equalsIgnoreCase(clean) || pc.label.equalsIgnoreCase(clean)) {
        return pc;
      }
    }
    throw new IllegalArgumentException("유효하지 않은 직급 코드입니다.");
  }

  public static List<Map<String, Object>> toList() {
    return Arrays.stream(values())
        .map(p ->
            Map.<String, Object>of(
                "code", p.code,
                "label", p.label,
                "level", p.level))
        .toList();
  }
}
