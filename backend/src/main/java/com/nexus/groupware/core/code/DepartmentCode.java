package com.nexus.groupware.core.code;

import java.util.Arrays;
import java.util.List;

public enum DepartmentCode {
  DEPT_CEO("DEPT_CEO", "대표이사", "ROOT", 1),
  DEPT_BIZ("DEPT_BIZ", "사업본부", "DEPT_CEO", 2),
  DEPT_RND("DEPT_RND", "기술연구소", "DEPT_CEO", 3),
  DEPT_QM("DEPT_QM", "품질경영팀", "DEPT_CEO", 4),
  DEPT_MGMT("DEPT_MGMT", "경영지원팀", "ROOT", 5);

  public record DepartmentOptionVo(String code, String label, String parentCode, int sortOrder) {}

  private final String code;
  private final String label;
  private final String parentCode;
  private final int sortOrder;

  DepartmentCode(String code, String label, String parentCode, int sortOrder) {
    this.code = code;
    this.label = label;
    this.parentCode = parentCode;
    this.sortOrder = sortOrder;
  }

  public String getCode() {
    return code;
  }

  public String getLabel() {
    return label;
  }

  public String getParentCode() {
    return parentCode;
  }

  public int getSortOrder() {
    return sortOrder;
  }

  public static DepartmentCode fromCodeOrLabel(String input) {
    if (input == null || input.isBlank()) {
      return DEPT_RND;
    }
    if ("경영지원".equals(input)) return DEPT_MGMT;
    if ("사장".equals(input)) return DEPT_CEO;
    String cleanInput = input.trim().replace("ST", "");
    for (DepartmentCode dc : values()) {
      if (dc.code.equalsIgnoreCase(input.trim())
          || dc.label.equalsIgnoreCase(input.trim())
          || dc.label.equalsIgnoreCase(cleanInput)) {
        return dc;
      }
    }
    throw new IllegalArgumentException("유효하지 않은 부서 코드입니다.");
  }

  public static List<DepartmentOptionVo> toList() {
    return Arrays.stream(values())
        .map(d -> new DepartmentOptionVo(d.code, d.label, d.parentCode, d.sortOrder))
        .toList();
  }
}
