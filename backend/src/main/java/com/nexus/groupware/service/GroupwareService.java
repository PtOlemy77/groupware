package com.nexus.groupware.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.groupware.code.*;
import com.nexus.groupware.entity.*;
import com.nexus.groupware.repository.*;
import com.nexus.groupware.security.AuthService;
import java.math.*;
import java.time.*;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class GroupwareService {
  private final EmployeeRepository employees;
  private final ProjectRepository projects;
  private final EquipmentRepository equipment;
  private final BusinessDealRepository deals;
  private final EvaluationRepository evaluations;
  private final ApprovalRepository approvals;
  private final CommonCodeRepository codes;
  private final HolidayRepository holidays;
  private final AuditEventRepository audit;
  private final AuthService auth;
  private final PasswordEncoder passwords;
  private final ObjectMapper json;
  private final Map<String, JpaRepository<VersionedEntity, Long>> repositories;
  private static final Set<String> ROLES = Set.of("시스템 관리자", "임원 권한", "PM 권한", "일반직원");
  private static final Map<String, Set<String>> FIELDS =
      Map.of(
          "employees",
              fields(
                  "emp_no name department_code department position_code position email phone"
                      + " hire_date status status_code leave_remaining leave_total skills avatar_color role role_code"
                      + " account_enabled recognized_career_years recognized_career_months"),
          "projects",
              fields(
                  "code name client_name department department_code pm_name pm_id start_date end_date status status_code progress budget"
                      + " share_rate consortium_partners members member_ids priority description"
                      + " yearly_revenue_json"),
          "equipments",
              fields(
                  "asset_no category model_name serial_no status emp_id department department_code purchase_date"
                      + " price notes"),
          "business_deals",
              fields(
                  "title client_name owner_name owner_id stage amount probability close_date"
                      + " deal_type notes start_date end_date target_year yearly_revenue_json"),
          "evaluations",
              fields(
                  "employee_id emp_no period kpi_score competency_score peer_score status"
                      + " feedback"),
          "approvals",
              fields(
                  "category title project_id approver_id amount project_name vendor payment_method"
                      + " purpose items_json reviewer_comment department department_code"),
          "common_codes",
              fields("group_code group_name code code_name sort_order is_active extra_value"));

  private static Set<String> fields(String s) {
    return Set.of(s.split(" "));
  }

  public GroupwareService(
      EmployeeRepository e,
      ProjectRepository p,
      EquipmentRepository q,
      BusinessDealRepository d,
      EvaluationRepository v,
      ApprovalRepository a,
      CommonCodeRepository c,
      HolidayRepository h,
      AuditEventRepository logs,
      AuthService auth,
      PasswordEncoder pw,
      ObjectMapper mapper) {
    employees = e;
    projects = p;
    equipment = q;
    deals = d;
    evaluations = v;
    approvals = a;
    codes = c;
    holidays = h;
    audit = logs;
    this.auth = auth;
    passwords = pw;
    json = mapper;
    repositories =
        (Map)
            Map.of(
                "employees",
                e,
                "projects",
                p,
                "equipments",
                q,
                "business_deals",
                d,
                "evaluations",
                v,
                "approvals",
                a,
                "common_codes",
                c);
  }

  private ResponseStatusException error(HttpStatus code, String message) {
    return new ResponseStatusException(code, message);
  }

  private void require(boolean condition, String message) {
    if (!condition) throw new IllegalArgumentException(message);
  }

  private void permit(boolean condition) {
    if (!condition) throw error(HttpStatus.FORBIDDEN, "이 작업의 권한이 없습니다.");
  }

  private boolean projectAccess(Project p, Employee actor) {
    return AuthService.executive(actor)
        || Objects.equals(p.getPmId(), actor.getId())
        || p.getMemberIds().contains(actor.getId());
  }

  private boolean projectEdit(Project p, Employee actor) {
    return AuthService.executive(actor)
        || (AuthService.pm(actor) && (p.getPmId() == null || Objects.equals(p.getPmId(), actor.getId())));
  }

  private Map<String, Object> map(Object o) {
    return json.convertValue(o, new TypeReference<>() {});
  }

  private <T> T read(String s, Class<T> type) {
    try {
      return json.readValue(s, type);
    } catch (Exception e) {
      throw new IllegalArgumentException("문서 JSON 형식이 올바르지 않습니다.");
    }
  }

  private Map<String, Object> safeDocument(String s) {
    try {
      return read(s, Map.class);
    } catch (IllegalArgumentException e) {
      return new HashMap<>(Map.of("invalid_document", true));
    }
  }

  private String encode(Object o) {
    try {
      return json.writeValueAsString(o);
    } catch (Exception e) {
      throw new IllegalArgumentException("문서를 직렬화할 수 없습니다.");
    }
  }

  @Transactional(readOnly = true)
  public Map<String, Object> getAllData(String scope, int page, int size) {
    require(page >= 0 && size >= 1 && size <= 100, "페이지 범위를 확인하세요.");
    Employee actor = auth.current();
    boolean exec = AuthService.executive(actor);
    var visibleProjects =
        projects.findAllByOrderByIdDesc().stream().filter(p -> projectAccess(p, actor)).toList();
    Set<Long> projectIds = new HashSet<>();
    visibleProjects.forEach(p -> projectIds.add(p.getId()));
    var result = new HashMap<String, Object>();
    result.put(
        "employees",
        employees.findAllByOrderByIdDesc().stream()
            .map(e -> {
              var dto = map(e);
              dto.remove("password_change_required");
              dto.remove("account_enabled");
              if (!exec && !e.getId().equals(actor.getId()))
                for (String key :
                    List.of("email", "phone", "hire_date", "leave_remaining", "leave_total"))
                  dto.remove(key);
              return dto;
            })
            .toList());
    result.put(
        "projects",
        visibleProjects.stream()
            .map(p -> {
              var dto = map(p);
              if (p.getPmId() != null) dto.put("pm_name", employee(p.getPmId()).getName());
              dto.put(
                  "members",
                  p.getMemberIds().stream()
                      .sorted()
                      .map(id -> employee(id).getName())
                      .collect(java.util.stream.Collectors.joining(", ")));
              return dto;
            })
            .toList());
    var pageable =
        org.springframework.data.domain.PageRequest.of(
            page,
            size,
            org.springframework.data.domain.Sort.by(
                org.springframework.data.domain.Sort.Direction.DESC, "id"));
    long pageTotal = 0;
    var equipmentRows = org.springframework.data.domain.Page.<Equipment>empty(pageable);
    if ("equipments".equals(scope)) {
      equipmentRows =
          equipment.findAll(
              (root, query, builder) ->
                  exec ? builder.conjunction() : builder.equal(root.get("empId"), actor.getId()),
              pageable);
      pageTotal = equipmentRows.getTotalElements();
    }
    result.put(
        "equipments",
        equipmentRows.getContent().stream()
            .map(e -> {
              var dto = map(e);
              if (e.getEmpId() != null) {
                var owner = employee(e.getEmpId());
                dto.put("assigned_to", owner.getName());
                dto.put("emp_no", owner.getEmpNo());
                dto.put("department", owner.getDepartment());
              }
              return dto;
            })
            .toList());
    if ("business_deals".equals(scope)) {
      var rows =
          deals.findAll(
              (root, query, builder) ->
                  exec ? builder.conjunction() : builder.equal(root.get("ownerId"), actor.getId()),
              pageable);
      result.put("business_deals", rows.getContent());
      pageTotal = rows.getTotalElements();
    } else
      result.put(
          "business_deals",
          "dashboard".equals(scope)
              ? deals.findAllByOrderByIdDesc().stream()
                  .filter(d -> exec || Objects.equals(d.getOwnerId(), actor.getId()))
                  .toList()
              : List.of());
    if ("evaluations".equals(scope)) {
      var evaluationPage =
          org.springframework.data.domain.PageRequest.of(
              page,
              size,
              org.springframework.data.domain.Sort.by(
                  org.springframework.data.domain.Sort.Direction.DESC, "totalScore", "id"));
      var rows =
          evaluations.findAll(
              (root, query, builder) ->
                  exec
                      ? builder.conjunction()
                      : builder.equal(root.get("employeeId"), actor.getId()),
              evaluationPage);
      result.put("evaluations", rows.getContent());
      pageTotal = rows.getTotalElements();
    } else result.put("evaluations", List.of());
    Set<Long> queryProjectIds = projectIds.isEmpty() ? Set.of(-1L) : projectIds;
    // Contracts include confidential costs; staff receive project membership, not contract bodies.
    if ("approvals".equals(scope)) {
      var rows =
          approvals.summaryPage(
              exec, AuthService.pm(actor), actor.getId(), queryProjectIds, pageable);
      result.put("approvals", rows.getContent());
      pageTotal = rows.getTotalElements();
    } else if (Set.of("reports", "projects", "dashboard", "employees").contains(scope)) {
      boolean reports = "reports".equals(scope);
      var categories = reports ? List.of("주간보고", "월간보고") : List.of("계약품의", "계약품의서");
      result.put(
          "approvals",
          approvals.findByCategoryInOrderByIdDesc(categories).stream()
              .filter(a ->
                  reports
                      ? (exec
                          || (AuthService.pm(actor)
                              && (Objects.equals(a.getRequesterId(), actor.getId())
                                  || projectIds.contains(a.getProjectId()))))
                      : (!"반려".equals(a.getStatus())))
              .map(a -> {
                var dto = map(a);
                Map<String, Object> doc = safeDocument(a.getItemsJson());
                if (reports && !exec)
                  doc.put(
                      "items",
                      ((List<Map<String, Object>>) doc.getOrDefault("items", List.of()))
                          .stream()
                              .filter(i -> projectIds.contains(id(i.get("projectId"))))
                              .toList());
                if (!reports) {
                  // Only planning data is needed by roster/workload screens. Full financial sheets
                  // load on open.
                  var small = new HashMap<String, Object>();
                  for (String key :
                      List.of(
                          "title", "contractPeriod", "startDate", "endDate", "linkedProjectId", "linkedProjectCode"))
                    if (doc.containsKey(key)) small.put(key, doc.get(key));
                  small.put(
                      "manpowerPlans",
                      ((List<Map<String, Object>>) doc.getOrDefault("manpowerPlans", List.of()))
                          .stream()
                              .map(plan -> {
                                var p = new HashMap<>(plan);
                                if (!exec) {
                                  p.remove("unitPrice");
                                  p.remove("laborCost");
                                }
                                if (p.get("employeeId") == null && p.get("name") != null) {
                                  var matches = employees.findAllByName(p.get("name").toString().trim());
                                  if (matches.size() == 1)
                                    p.put("employeeId", matches.getFirst().getId());
                                }
                                return p;
                              })
                              .toList());
                  doc = small;
                  dto.put("details_loaded", false);
                }
                dto.put("items_json", encode(doc));
                return dto;
              })
              .toList());
    } else result.put("approvals", List.of());
    result.put("common_codes", codes.findAllByOrderByGroupCodeAscSortOrderAsc());
    result.put("holidays", holidays.findAllByOrderByHolidayDateAsc());
    result.put("department_codes", DepartmentCode.toList());
    result.put("position_codes", PositionCode.toList());
    result.put(
        "company_info",
        Map.of("name_ko", "(주)스패셜티", "name_en", "SpatialT", "domain", "spatialt.co.kr"));
    long approvalCount =
        approvals.visibleCount(exec, AuthService.pm(actor), actor.getId(), queryProjectIds);
    result.put(
        "counts",
        Map.of(
            "employees",
            employees.count(),
            "projects",
            visibleProjects.size(),
            "equipments",
            exec ? equipment.count() : equipment.countByEmpId(actor.getId()),
            "deals",
            exec ? deals.count() : deals.countByOwnerId(actor.getId()),
            "evaluations",
            exec ? evaluations.count() : evaluations.countByEmployeeId(actor.getId()),
            "approvals",
            approvalCount));
    if (Set.of("equipments", "business_deals", "evaluations", "approvals").contains(scope))
      result.put("page_total", pageTotal);
    result.put("loaded_at", Instant.now());
    return result;
  }

  @Transactional(readOnly = true)
  public Map<String, Object> approvalDetail(Long id) {
    Approval a = approvals.findById(id).orElseThrow(() -> error(HttpStatus.NOT_FOUND, "문서가 없습니다."));
    Employee actor = auth.current();
    permit(
        AuthService.executive(actor)
            || (AuthService.pm(actor)
                && (Objects.equals(a.getRequesterId(), actor.getId())
                    || (a.getProjectId() != null
                        && projectAccess(
                            projects.findById(a.getProjectId()).orElseThrow(), actor)))));
    return Set.of("주간보고", "월간보고").contains(Objects.toString(a.getCategory(), ""))
        ? reportView(a, actor)
        : map(a);
  }

  private Map<String, Object> reportView(Approval a, Employee actor) {
    var dto = map(a);
    if (AuthService.executive(actor)) return dto;
    Map<String, Object> doc = safeDocument(a.getItemsJson());
    doc.put(
        "items",
        ((List<Map<String, Object>>) doc.getOrDefault("items", List.of()))
            .stream()
                .filter(i -> {
                  var p = projects.findById(id(i.get("projectId")));
                  return p.isPresent() && projectAccess(p.get(), actor);
                })
                .toList());
    dto.put("items_json", encode(doc));
    return dto;
  }

  private VersionedEntity existing(String module, Long id) {
    return (VersionedEntity)
        repositories
            .get(module)
            .findById(id)
            .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "대상이 존재하지 않습니다."));
  }

  private Long id(Object raw) {
    if (raw == null) return null;
    String s = raw.toString().trim();
    if (s.isEmpty() || "null".equalsIgnoreCase(s) || "undefined".equalsIgnoreCase(s)) return null;
    try {
      long n = new BigDecimal(s).longValueExact();
      require(n > 0, "ID가 올바르지 않습니다.");
      return n;
    } catch (ArithmeticException | NumberFormatException e) {
      throw new IllegalArgumentException("ID가 올바르지 않습니다.");
    }
  }

  private void version(VersionedEntity entity, Object expected) {
    require(expected != null, "조회 당시 version이 필요합니다. 새로고침 후 다시 시도하세요.");
    if (!entity.getVersion().toString().equals(expected.toString()))
      throw error(HttpStatus.CONFLICT, "다른 사용자가 수정했습니다. 새로고침 후 다시 시도하세요.");
  }

  private void authorize(
      String module, VersionedEntity entity, Employee actor, boolean creating, boolean deleting) {
    boolean exec = AuthService.executive(actor);
    switch (module) {
      case "employees" -> permit(AuthService.admin(actor));
      case "common_codes", "equipments", "evaluations" -> permit(exec);
      case "projects" ->
          permit(
              deleting
                  ? exec
                  : creating ? AuthService.pm(actor) : projectEdit((Project) entity, actor));
      case "business_deals" ->
          permit(
              exec
                  || (!deleting
                      && AuthService.pm(actor)
                      && (creating
                          || Objects.equals(((BusinessDeal) entity).getOwnerId(), actor.getId()))));
      case "approvals" -> {
        Approval a = (Approval) entity;
        permit(AuthService.pm(actor));
        if (!creating)
          permit(
              exec
                  || Set.of("주간보고", "월간보고").contains(Objects.toString(a.getCategory(), ""))
                  || Objects.equals(a.getRequesterId(), actor.getId())
                  || (a.getProjectId() != null
                      && projectEdit(projects.findById(a.getProjectId()).orElseThrow(), actor)));
      }
      default -> throw new IllegalArgumentException("지원하지 않는 모듈입니다.");
    }
  }

  @Transactional
  public Map<String, Object> processMutation(Map<String, Object> payload) {
    String module = Objects.toString(payload.get("module"), "");
    String action = Objects.toString(payload.get("action"), "");
    require(payload.toString().length() <= 2000000, "문서 크기는 2MB 이하여야 합니다.");
    require(repositories.containsKey(module), "지원하지 않는 모듈입니다.");
    if ("convert_deal".equals(action)) return convertDeal(payload);
    require(
        Set.of(
                "create",
                "update",
                "delete",
                "submit",
                "approve",
                "reject",
                "revise",
                "save_contract")
            .contains(action),
        "지원하지 않는 작업입니다.");
    if ("save_contract".equals(action)) return saveContract(payload);
    boolean creating = "create".equals(action);
    Long recordId = id(payload.get("id"));
    require(creating || recordId != null, "대상 ID가 필요합니다.");
    Map<String, Object> data =
        payload.get("data") instanceof Map<?, ?>
            ? new HashMap<>((Map<String, Object>) payload.get("data"))
            : new HashMap<>();
    data.keySet().removeIf(key -> key.startsWith("_"));
    VersionedEntity entity = creating ? newEntity(module) : existing(module, recordId);
    Employee actor = auth.current();
    authorize(module, entity, actor, creating, "delete".equals(action));
    if (!creating) version(entity, payload.getOrDefault("version", data.get("version")));
    if (Set.of("submit", "approve", "reject", "revise").contains(action)) {
      require("approvals".equals(module), "결재 문서에서만 사용할 수 있습니다.");
      transition((Approval) entity, action, data, actor);
      repositories.get(module).flush();
      log(actor, module, action, recordId, entity);
      return response(module, entity);
    }
    if ("delete".equals(action)) {
      delete(module, entity, actor);
      return Map.of("ok", true);
    }
    require(!data.isEmpty(), "변경 데이터가 필요합니다.");
    if (entity instanceof Approval a && !creating)
      require(
          Set.of("작성중", "반려", "PM작성중", "이사취합보완중", "사장님보고완료")
              .contains(Objects.toString(a.getStatus(), "")),
          "상신·승인된 문서는 수정할 수 없습니다. 개정본을 먼저 만드세요.");
    if (entity instanceof Approval a && creating) {
      a.setRequesterId(actor.getId());
      a.setRequester(actor.getName());
      a.setRequesterPosition(actor.getPosition());
      a.setDepartment(actor.getDepartment());
      a.setCreatedAt(LocalDate.now(ZoneId.of("Asia/Seoul")).toString());
      a.setStatus("작성중");
      a.setApprovedBy("");
      a.setDocNo(number("DOC"));
    }
    if (entity instanceof Approval a
        && Set.of("주간보고", "월간보고").contains(Objects.toString(a.getCategory(), ""))
        && !creating) data.put("_previous_report", read(a.getItemsJson(), Map.class));
    if (entity instanceof Approval a && !creating) {
      if (data.containsKey("category"))
        require(Objects.equals(a.getCategory(), data.get("category")), "문서 종류를 변경할 수 없습니다.");
      if (!AuthService.executive(actor)
          && Set.of("주간보고", "월간보고").contains(Objects.toString(a.getCategory(), "")))
        require(
            Objects.equals(a.getApproverId(), id(data.get("approver_id"))),
            "최종 확인자는 임원만 지정할 수 있습니다.");
    }
    if (entity instanceof CommonCode cc && !creating)
      require(
          !Set.of("DEPARTMENT", "POSITION", "USER_ROLE")
              .contains(Objects.toString(cc.getGroupCode(), "")),
          "시스템 코드는 수정할 수 없습니다.");
    apply(module, entity, data);
    validate(module, entity, data, actor, creating);
    repositories.get(module).saveAndFlush(entity);
    if (entity instanceof Project p) syncProject(p);
    repositories.get(module).flush();
    log(actor, module, action, recordId(entity), entity);
    return response(module, entity);
  }

  private VersionedEntity newEntity(String module) {
    return switch (module) {
      case "employees" -> new Employee();
      case "projects" -> new Project();
      case "equipments" -> new Equipment();
      case "business_deals" -> new BusinessDeal();
      case "evaluations" -> new Evaluation();
      case "approvals" -> new Approval();
      case "common_codes" -> new CommonCode();
      default -> throw new IllegalArgumentException();
    };
  }

  private Long recordId(Object entity) {
    try {
      return (Long) entity.getClass().getMethod("getId").invoke(entity);
    } catch (Exception e) {
      throw new IllegalArgumentException("대상 ID 오류");
    }
  }

  private Map<String, Object> response(String module, Object e) {
    Object record = e;
    if (e instanceof Approval a
        && Set.of("주간보고", "월간보고").contains(Objects.toString(a.getCategory(), "")))
      record = reportView(a, auth.current());
    return Map.of("ok", true, "module", module, "record", record);
  }

  private void apply(String module, VersionedEntity entity, Map<String, Object> data) {
    var patch = new HashMap<String, Object>();
    for (var entry : data.entrySet())
      if (FIELDS.get(module).contains(entry.getKey())) patch.put(entry.getKey(), entry.getValue());
    // Integer input must never truncate fractions/overflow during Jackson binding.
    for (String key :
        List.of(
            "budget",
            "progress",
            "amount",
            "probability",
            "price",
            "kpi_score",
            "competency_score",
            "peer_score",
            "target_year",
            "sort_order",
            "recognized_career_years",
            "recognized_career_months"))
      if (patch.get(key) != null)
        try {
          new BigDecimal(patch.get(key).toString()).intValueExact();
        } catch (Exception e) {
          throw new IllegalArgumentException(key + "는 유효한 정수여야 합니다.");
        }
    try {
      json.readerForUpdating(entity).readValue(json.writeValueAsBytes(patch));
    } catch (Exception e) {
      throw new IllegalArgumentException("입력 데이터 형식이 올바르지 않습니다.");
    }
  }

  private String number(String prefix) {
    return prefix + "-" + Year.now(ZoneId.of("Asia/Seoul")) + "-" + UUID.randomUUID();
  }

  private void required(String value, String field) {
    require(value != null && !value.isBlank(), field + "을(를) 입력하세요.");
  }

  private void range(Number value, double min, double max, String field) {
    require(
        value != null
            && Double.isFinite(value.doubleValue())
            && value.doubleValue() >= min
            && value.doubleValue() <= max,
        field + " 범위를 확인하세요.");
  }

  private LocalDate date(String s) {
    try {
      return LocalDate.parse(s);
    } catch (Exception e) {
      throw new IllegalArgumentException("날짜는 YYYY-MM-DD 형식이어야 합니다.");
    }
  }

  private void period(String start, String end) {
    require(!date(start).isAfter(date(end)), "종료일은 시작일 이후여야 합니다.");
    require(ChronoUnitMonths(start, end) <= 120, "사업 기간은 120개월 이하여야 합니다.");
  }

  private long ChronoUnitMonths(String start, String end) {
    return java.time.temporal.ChronoUnit.MONTHS.between(
            YearMonth.from(date(start)), YearMonth.from(date(end)))
        + 1;
  }

  private Employee employee(Long key) {
    return employees
        .findById(key)
        .orElseThrow(() -> new IllegalArgumentException("등록된 직원을 선택하세요."));
  }

  private Employee employeeByName(String name) {
    var matches = employees.findAllByName(name);
    require(matches.size() == 1, "동명이인 또는 미등록 직원입니다. 직원 ID로 선택하세요: " + name);
    return matches.getFirst();
  }

  private void validate(
      String module,
      VersionedEntity entity,
      Map<String, Object> input,
      Employee actor,
      boolean creating) {
    switch (module) {
      case "employees" -> {
        Employee e = (Employee) entity;
        required(e.getName(), "성명");
        required(e.getEmail(), "이메일");
        String email = e.getEmail().trim().toLowerCase(Locale.ROOT);
        if (!email.contains("@")) email += "@spatialt.co.kr";
        require(email.matches("[a-z0-9._%+\\-]+@spatialt\\.co\\.kr"), "사내 이메일을 입력하세요.");
        e.setEmail(email);
        if (creating && (e.getEmpNo() == null || e.getEmpNo().isBlank())) e.setEmpNo(number("EMP"));
        required(e.getEmpNo(), "사번");
        date(e.getHireDate());
        var dep =
            DepartmentCode.fromCodeOrLabel(
                input.containsKey("department_code")
                    ? e.getDepartmentCode()
                    : input.containsKey("department") ? e.getDepartment() : e.getDepartmentCode());
        e.setDepartmentCode(dep.getCode());
        e.setDepartment(dep.getLabel());
        var pos =
            PositionCode.fromCodeOrLabel(
                input.containsKey("position_code")
                    ? e.getPositionCode()
                    : input.containsKey("position") ? e.getPosition() : e.getPositionCode());
        e.setPositionCode(pos.getCode());
        e.setPosition(pos.getLabel());
        var role =
            RoleCode.fromCodeOrLabel(
                input.containsKey("role_code")
                    ? Objects.toString(input.get("role_code"), e.getRoleCode())
                    : input.containsKey("role") ? Objects.toString(input.get("role"), e.getRole()) : e.getRoleCode());
        e.setRoleCode(role.getCode());
        e.setRole(role.getLabel());
        var status =
            StatusCode.fromCodeOrLabel(
                input.containsKey("status_code")
                    ? Objects.toString(input.get("status_code"), e.getStatusCode())
                    : input.containsKey("status") ? Objects.toString(input.get("status"), e.getStatus()) : e.getStatusCode());
        e.setStatusCode(status.getCode());
        e.setStatus(status.getLabel());
        range(e.getLeaveTotal(), 0, 366, "총 연차");
        range(e.getLeaveRemaining(), 0, e.getLeaveTotal(), "잔여 연차");
        range(e.getRecognizedCareerYears(), 0, 70, "인정 경력(년)");
        range(e.getRecognizedCareerMonths(), 0, 11, "인정 경력(개월)");
        Object pw = input.get("password");
        if (pw != null && !pw.toString().isEmpty()) {
          AuthService.validatePassword(pw.toString());
          e.setPassword(passwords.encode(pw.toString()));
          e.setPasswordChangeRequired(true);
          e.setAccountEnabled(true);
        }
        require(e.getPassword() != null, "신규 계정의 초기 비밀번호(12자 이상)를 입력하세요.");
        if (!creating
            && (input.containsKey("password")
                || input.containsKey("role")
                || input.containsKey("role_code")
                || input.containsKey("status")
                || input.containsKey("account_enabled")))
          e.setSessionVersion(e.getSessionVersion() + 1);
        if (!creating && e.getId().equals(actor.getId()))
          require(
              RoleCode.ROLE_ADMIN.getCode().equals(e.getRoleCode())
                  && "재직".equals(e.getStatus())
                  && Boolean.TRUE.equals(e.getAccountEnabled()),
              "본인의 관리자 권한·활성 상태는 제거할 수 없습니다.");
      }
      case "projects" -> {
        Project p = (Project) entity;
        required(p.getName(), "프로젝트명");
        if (creating && (p.getCode() == null || p.getCode().isBlank() || p.getCode().contains("UUID") || p.getCode().startsWith("temp"))) {
          int currentYear = Year.now(ZoneId.of("Asia/Seoul")).getValue();
          long maxSeq = projects.findAll().stream()
              .map(Project::getCode)
              .filter(c -> c != null && c.contains(String.valueOf(currentYear)))
              .mapToLong(c -> {
                try {
                  String[] parts = c.split("-");
                  return Long.parseLong(parts[parts.length - 1]);
                } catch (Exception ex) {
                  return 0L;
                }
              })
              .max()
              .orElse(0L);
          p.setCode(String.format("PRJ-%d-%02d", currentYear, maxSeq + 1));
        }
        period(p.getStartDate(), p.getEndDate());
        range(p.getBudget(), 0, Integer.MAX_VALUE / 10, "전체 계약금액");
        range(p.getProgress(), 0, 100, "진행률");
        range(p.getShareRate(), 0, 100, "지분율");
        // 클라이언트에서 progress를 전달하지 않은 경우 수행기간(착수일~완료일) 대비 현재 일자 기준 진행률 자동 산출
        if (p.getProgress() == null) {
          if (p.getStartDate() != null && p.getEndDate() != null) {
            try {
              LocalDate start = date(p.getStartDate());
              LocalDate end = date(p.getEndDate());
              LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
              if ("완료".equals(p.getStatus()) || !today.isBefore(end)) {
                p.setProgress(100);
              } else if (today.isBefore(start)) {
                p.setProgress(0);
              } else {
                long totalDays = java.time.temporal.ChronoUnit.DAYS.between(start, end);
                long elapsedDays = java.time.temporal.ChronoUnit.DAYS.between(start, today);
                int calcProgress = totalDays > 0 ? (int) Math.min(100, Math.max(0, (elapsedDays * 100) / totalDays)) : 0;
                p.setProgress(calcProgress);
              }
            } catch (Exception ignored) {
              p.setProgress(0);
            }
          } else {
            p.setProgress(0);
          }
        }
        require(
            BigDecimal.valueOf(p.getShareRate()).stripTrailingZeros().scale() <= 2,
            "지분율은 소수 둘째 자리까지 입력하세요.");
        var pdep =
            DepartmentCode.fromCodeOrLabel(
                input.containsKey("department_code")
                    ? p.getDepartmentCode()
                    : input.containsKey("department") ? p.getDepartment() : p.getDepartmentCode());
        p.setDepartmentCode(pdep.getCode());
        p.setDepartment(pdep.getLabel());
        var pstage =
            ProjectStageCode.fromCodeOrLabel(
                input.containsKey("status_code")
                    ? Objects.toString(input.get("status_code"), p.getStatusCode())
                    : input.containsKey("status") ? Objects.toString(input.get("status"), p.getStatus()) : p.getStatusCode());
        p.setStatusCode(pstage.getCode());
        p.setStatus(pstage.getLabel());
        Employee pm = null;
        if (input.containsKey("pm_id")) {
          Long pid = id(input.get("pm_id"));
          if (pid != null) pm = employee(pid);
        } else if (input.containsKey("pm_name")) {
          String pname = Objects.toString(input.get("pm_name"), "").trim();
          if (!pname.isBlank()) {
            try {
              pm = employeeByName(pname);
            } catch (Exception ignored) {}
          }
        } else if (p.getPmId() != null) {
          pm = employee(p.getPmId());
        }
        if (pm != null) {
          permit(AuthService.executive(actor) || pm.getId().equals(actor.getId()) || AuthService.pm(actor));
          require(AuthService.pm(pm) && "재직".equals(pm.getStatus()), "재직 중인 PM 권한자를 선택하세요.");
          p.setPmId(pm.getId());
          p.setPmName(pm.getName());
        } else {
          permit(AuthService.executive(actor) || AuthService.pm(actor) || (p.getPmId() != null && p.getPmId().equals(actor.getId())));
          p.setPmId(null);
          p.setPmName("");
        }
        Set<Long> members = new HashSet<>(p.getMemberIds());
        if (input.containsKey("members") && !input.containsKey("member_ids")) {
          members.clear();
          for (String n : Objects.toString(p.getMembers(), "").split(","))
            if (!n.isBlank()) members.add(employeeByName(n.trim()).getId());
        }
        for (Long key : members)
          require("재직".equals(employee(key).getStatus()), "재직 중인 직원만 편성할 수 있습니다.");
        p.setMemberIds(members);
        p.setMembers(
            members.stream()
                .sorted()
                .map(k -> employee(k).getName())
                .collect(java.util.stream.Collectors.joining(", ")));
        p.setOurBudget(
            BigDecimal.valueOf(p.getBudget())
                .multiply(BigDecimal.valueOf(p.getShareRate()))
                .divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP)
                .intValueExact());
        p.setIsConsortium(p.getShareRate() < 100);
        validateRevenue(p.getYearlyRevenueJson(), p.getBudget(), p.getStartDate(), p.getEndDate());
      }
      case "equipments" -> {
        Equipment e = (Equipment) entity;
        if (creating && (e.getAssetNo() == null || e.getAssetNo().isBlank()))
          e.setAssetNo(number("AST"));
        required(e.getModelName(), "모델명");
        required(e.getCategory(), "종류");
        date(e.getPurchaseDate());
        range(e.getPrice(), 0, Integer.MAX_VALUE, "취득금액");
        if (e.getEmpId() != null) {
          Employee owner = employee(e.getEmpId());
          require(StatusCode.STATUS_ACTIVE.getCode().equals(owner.getStatusCode()) || "재직".equals(owner.getStatus()), "재직 중인 직원을 선택하세요.");
          e.setEmpNo(owner.getEmpNo());
          e.setAssignedTo(owner.getName());
          e.setDepartment(owner.getDepartment());
          e.setDepartmentCode(owner.getDepartmentCode());
        } else {
          e.setEmpNo(null);
          e.setAssignedTo("미배정");
          var edep = DepartmentCode.fromCodeOrLabel(
              input.containsKey("department_code")
                  ? e.getDepartmentCode()
                  : input.containsKey("department") ? e.getDepartment() : e.getDepartmentCode());
          e.setDepartmentCode(edep.getCode());
          e.setDepartment(edep.getLabel());
          require(!"사용중".equals(e.getStatus()), "사용중 자산은 담당 직원을 지정하세요.");
        }
      }
      case "business_deals" -> {
        BusinessDeal d = (BusinessDeal) entity;
        required(d.getTitle(), "사업명");
        required(d.getClientName(), "고객사");
        date(d.getCloseDate());
        range(d.getAmount(), 0, Integer.MAX_VALUE, "사업금액");
        range(d.getProbability(), 0, 100, "수주 확률");
        Employee owner =
            input.containsKey("owner_id") && d.getOwnerId() != null
                ? employee(d.getOwnerId())
                : input.containsKey("owner_name")
                    ? employeeByName(d.getOwnerName())
                    : d.getOwnerId() != null ? employee(d.getOwnerId()) : actor;
        permit(AuthService.executive(actor) || owner.getId().equals(actor.getId()));
        d.setOwnerId(owner.getId());
        d.setOwnerName(owner.getName());
        if (d.getStartDate() == null) d.setStartDate(d.getCloseDate());
        if (d.getEndDate() == null) d.setEndDate(d.getCloseDate());
        period(d.getStartDate(), d.getEndDate());
        d.setTargetYear(date(d.getStartDate()).getYear());
        validateRevenue(d.getYearlyRevenueJson(), d.getAmount(), d.getStartDate(), d.getEndDate());
      }
      case "evaluations" -> {
        Evaluation e = (Evaluation) entity;
        Employee subject =
            e.getEmployeeId() != null
                ? employee(e.getEmployeeId())
                : employees
                    .findByEmpNo(e.getEmpNo())
                    .orElseThrow(() -> new IllegalArgumentException("평가 대상 직원을 선택하세요."));
        e.setEmployeeId(subject.getId());
        e.setEmpNo(subject.getEmpNo());
        e.setEmpName(subject.getName());
        e.setDepartmentCode(subject.getDepartmentCode());
        e.setDepartment(subject.getDepartment());
        e.setPositionCode(subject.getPositionCode());
        e.setPosition(subject.getPosition());
        e.setReviewerId(actor.getId());
        e.setReviewer(actor.getName());
        required(e.getPeriod(), "평가 기간");
        range(e.getKpiScore(), 0, 100, "KPI");
        range(e.getCompetencyScore(), 0, 100, "역량");
        range(e.getPeerScore(), 0, 100, "동료 평가");
        double total =
            Math.round(
                    (e.getKpiScore() * .5 + e.getCompetencyScore() * .3 + e.getPeerScore() * .2)
                        * 10)
                / 10.;
        e.setTotalScore(total);
        e.setGrade(
            total >= 93 ? "S" : total >= 87 ? "A" : total >= 78 ? "B" : total >= 68 ? "C" : "D");
      }
      case "approvals" -> validateApproval((Approval) entity, input, actor, creating);
      case "common_codes" -> {
        CommonCode c = (CommonCode) entity;
        required(c.getGroupCode(), "그룹 코드");
        required(c.getCode(), "코드");
        required(c.getCodeName(), "코드명");
        required(c.getGroupName(), "그룹명");
        require(
            !Set.of("DEPARTMENT", "POSITION", "USER_ROLE")
                .contains(Objects.toString(c.getGroupCode(), "")),
            "조직·직급·권한 코드는 시스템에서 관리합니다.");
        range(c.getSortOrder(), 0, 100000, "정렬 순서");
        if (c.getGroupCode().startsWith("MASTER_")) {
          Object value = read(Objects.toString(c.getExtraValue(), "{}"), Object.class);
          require(value instanceof Map, "기준정보는 객체여야 합니다.");
          validateMaster(c.getGroupCode(), (Map<String, Object>) value);
        }
      }
    }
  }

  private void validateRevenue(String value, int amount, String start, String end) {
    Map<String, Object> years = read(value == null ? "{}" : value, Map.class);
    if (years.isEmpty()) return;
    BigDecimal sum = BigDecimal.ZERO;
    for (var e : years.entrySet()) {
      int y;
      try {
        y = Integer.parseInt(e.getKey());
      } catch (Exception ex) {
        throw new IllegalArgumentException("매출 연도를 확인하세요.");
      }
      require(y >= date(start).getYear() && y <= date(end).getYear(), "사업 기간 안의 연도에만 매출을 배분하세요.");
      BigDecimal v = decimal(e.getValue());
      require(v.signum() >= 0 && v.stripTrailingZeros().scale() <= 0, "연도별 매출은 0 이상의 정수여야 합니다.");
      sum = sum.add(v);
    }
    require(sum.compareTo(BigDecimal.valueOf(amount)) == 0, "연도별 매출 합계가 전체 계약금액과 일치해야 합니다.");
  }

  private BigDecimal decimal(Object value) {
    try {
      return new BigDecimal(value.toString());
    } catch (Exception e) {
      throw new IllegalArgumentException("유효한 금액을 입력하세요.");
    }
  }

  private void validateMaster(String group, Map<String, Object> value) {
    for (var e : value.entrySet()) {
      require(e.getKey().matches("20[0-9]{2}"), "기준정보 연도를 확인하세요.");
      if ("MASTER_TARGETS".equals(group)) {
        Map item = (Map) e.getValue();
        range((Number) item.get("targetAmount"), 0, Integer.MAX_VALUE, "목표 매출");
      } else if ("MASTER_PRICES".equals(group)) {
        require(e.getValue() instanceof List, "노임단가 목록 형식 오류");
        for (Object raw : (List) e.getValue()) {
          Map item = (Map) raw;
          required(Objects.toString(item.get("position"), ""), "직급");
          range((Number) item.get("monthlyPrice"), 0, Integer.MAX_VALUE, "월 단가");
          range((Number) item.get("dailyPrice"), 0, Integer.MAX_VALUE, "일 단가");
        }
      } else throw new IllegalArgumentException("지원하지 않는 기준정보입니다.");
    }
  }

  private void validateApproval(
      Approval a, Map<String, Object> input, Employee actor, boolean creating) {
    required(a.getTitle(), "문서명");
    range(a.getAmount(), 0, Integer.MAX_VALUE, "문서금액");
    var adep = DepartmentCode.fromCodeOrLabel(
        input.containsKey("department_code")
            ? a.getDepartmentCode()
            : input.containsKey("department") ? a.getDepartment() : a.getDepartmentCode());
    a.setDepartmentCode(adep.getCode());
    a.setDepartment(adep.getLabel());
    if (a.getApproverId() != null)
      require(AuthService.executive(employee(a.getApproverId())), "최종 결재자는 임원 권한자여야 합니다.");
    if (a.getProjectId() != null)
      permit(
          projectEdit(
              projects
                  .findById(a.getProjectId())
                  .orElseThrow(() -> new IllegalArgumentException("연결 프로젝트가 없습니다.")),
              actor));
    if (a.getCategory().contains("계약품의")) {
      Map<String, Object> doc = read(a.getItemsJson(), Map.class);
      recalculateContract(doc);
      doc.put("docNo", a.getDocNo());
      Map<String, Object> line = new HashMap<>();
      line.put(
          "drafter",
          Map.of(
              "name",
              a.getRequester(),
              "position",
              a.getRequesterPosition(),
              "dept",
              a.getDepartment(),
              "status",
              "작성중",
              "date",
              a.getCreatedAt()));
      line.put("bizHead", Map.of("name", "", "position", "", "status", ""));
      line.put(
          "ceo",
          Map.of(
              "name",
              a.getApproverId() == null ? "" : employee(a.getApproverId()).getName(),
              "position",
              "",
              "status",
              ""));
      doc.put("approvalLine", line);
      if (doc.get("linkedProjectId") != null) {
        Long key = id(doc.get("linkedProjectId"));
        if (a.getProjectId() != null) require(a.getProjectId().equals(key), "연결 프로젝트가 일치하지 않습니다.");
        Project p =
            projects
                .findById(key)
                .orElseThrow(() -> new IllegalArgumentException("연결 프로젝트가 없습니다."));
        permit(projectEdit(p, actor));
        a.setProjectId(key);
      }
      a.setItemsJson(encode(doc));
      a.setAmount(
          decimal(doc.get("supplyAmount")).setScale(0, RoundingMode.HALF_UP).intValueExact());
      a.setProjectName(Objects.toString(doc.get("title"), a.getTitle()));
    } else if (Set.of("주간보고", "월간보고").contains(Objects.toString(a.getCategory(), ""))) {
      Map<String, Object> doc = read(a.getItemsJson(), Map.class);
      required(Objects.toString(doc.get("periodKey"), ""), "보고 기간");
      require(
          Objects.toString(doc.get("periodKey")).matches("20[0-9]{2}-(0[1-9]|1[0-2])-(W[1-6]|M)"),
          "보고 기간 형식 오류");
      a.setDocNo("RPT-" + a.getCategory() + "-" + doc.get("periodKey"));
      String stage = Objects.toString(doc.get("overallStage"), "PM작성중");
      require(Set.of("PM작성중", "이사취합보완중", "사장님보고완료", "사장님확인완료").contains(stage), "보고 상태 오류");
      Map<String, Object> previous =
          (Map<String, Object>) input.getOrDefault("_previous_report", Map.of());
      List<Map<String, Object>> requested =
          (List<Map<String, Object>>) doc.getOrDefault("items", List.of());
      require(!creating || "PM작성중".equals(stage), "새 보고서는 작성중 상태로 시작해야 합니다.");
      if ("사장님보고완료".equals(previous.get("overallStage"))) {
        require("사장님확인완료".equals(stage), "최종 확인 요청된 보고서는 최종 확인만 가능합니다.");
        require(
            encode(previous.get("items")).equals(encode(requested)), "확인 요청 후 보고 내용을 변경할 수 없습니다.");
      }
      if (!AuthService.executive(actor)) {
        require(Set.of("PM작성중", "이사취합보완중").contains(stage), "보고 취합·승인은 임원 권한이 필요합니다.");
        require(
            Objects.toString(doc.get("directorSummary"), "")
                    .equals(Objects.toString(previous.get("directorSummary"), ""))
                && Objects.toString(doc.get("ceoFeedback"), "")
                    .equals(Objects.toString(previous.get("ceoFeedback"), "")),
            "임원 의견을 변경할 수 없습니다.");
        require(
            Objects.equals(
                a.getApproverId(),
                input.get("approver_id") == null ? null : id(input.get("approver_id"))),
            "결재자 변경 권한이 없습니다.");
        Map<Long, Map<String, Object>> merged = new LinkedHashMap<>();
        for (var item : (List<Map<String, Object>>) previous.getOrDefault("items", List.of()))
          merged.put(id(item.get("projectId")), item);
        for (var item : requested) {
          Project p =
              projects
                  .findById(id(item.get("projectId")))
                  .orElseThrow(() -> new IllegalArgumentException("보고 프로젝트가 없습니다."));
          permit(projectEdit(p, actor));
          item.put("updatedAt", Instant.now().toString());
          merged.put(p.getId(), item);
        }
        doc.put("items", new ArrayList<>(merged.values()));
      }
      for (var item : requested) range((Number) item.get("progress"), 0, 100, "진행률");
      if ("사장님확인완료".equals(stage)) {
        permit(Objects.equals(a.getApproverId(), actor.getId()));
        doc.put("confirmedByCeoAt", Instant.now().toString());
        a.setApprovedBy(actor.getName());
        a.setApprovedAt(Instant.now().toString());
      }
      if ("사장님보고완료".equals(stage)) {
        require(a.getApproverId() != null, "최종 확인자를 지정하세요.");
        doc.put("submittedToCeoAt", Instant.now().toString());
      }
      a.setStatus(stage);
      a.setItemsJson(encode(doc));
    } else {
      read(a.getItemsJson(), Object.class);
    }
  }

  private List<Map<String, Object>> items(Map<String, Object> doc, String key) {
    Object raw = doc.get(key);
    require(raw instanceof List, "계약 시트 형식 오류: " + key);
    return (List<Map<String, Object>>) raw;
  }

  private BigDecimal nonnegative(Object value, String field) {
    BigDecimal n = decimal(value == null ? 0 : value);
    require(
        n.signum() >= 0 && n.compareTo(BigDecimal.valueOf(Integer.MAX_VALUE)) <= 0,
        field + " 범위를 확인하세요.");
    return n;
  }

  private BigDecimal sumCosts(
      Map<String, Object> doc, String key, String qty, String unit, String amount) {
    BigDecimal sum = BigDecimal.ZERO;
    for (var row : items(doc, key)) {
      BigDecimal n =
          nonnegative(row.get(qty), qty)
              .multiply(nonnegative(row.get(unit), unit))
              .setScale(2, RoundingMode.HALF_UP);
      row.put(amount, n);
      sum = sum.add(n);
    }
    return sum;
  }

  private void recalculateDirectExpenses(Map<String, Object> doc, BigDecimal supply, String start, String end) {
    BigDecimal totalMM = BigDecimal.ZERO, ourMM = BigDecimal.ZERO;
    Set<String> people = new HashSet<>();
    for (var plan : items(doc, "manpowerPlans")) {
      BigDecimal mm = decimal(plan.get("totalMM"));
      totalMM = totalMM.add(mm);
      if (!"외주".equals(plan.get("type"))) ourMM = ourMM.add(mm);
      if (mm.signum() > 0) people.add(plan.get("employeeId") != null ? "employee:" + plan.get("employeeId") : "row:" + plan.get("id"));
    }
    for (var row : items(doc, "directExpenses")) {
      if (row.get("calculation") == null) continue;
      require(row.get("calculation") instanceof Map, "직접경비 산출식 형식 오류");
      Map<String, Object> calc = (Map<String, Object>) row.get("calculation");
      require(calc.get("inputs") instanceof Map, "직접경비 입력값 형식 오류");
      Map<String, Object> inputs = (Map<String, Object>) calc.get("inputs");
      inputs.forEach((key, value) -> nonnegative(value, "직접경비 " + key));
      String source = Objects.toString(calc.get("source"), "");
      BigDecimal base = switch (source) {
        case "MANUAL" -> nonnegative(calc.get("base"), "직접경비 기준 수량");
        case "TOTAL_MM" -> totalMM;
        case "OUR_MM" -> ourMM;
        case "HEADCOUNT" -> BigDecimal.valueOf(people.size());
        case "MONTHS" -> BigDecimal.valueOf(ChronoUnitMonths(start, end));
        case "SUPPLY" -> supply;
        default -> throw new IllegalArgumentException("직접경비 산출 기준 오류");
      };
      calc.put("base", base);
      BigDecimal qty = base, unit;
      switch (Objects.toString(calc.get("method"), "")) {
        case "PRODUCT" -> {
          qty = base.multiply(nonnegative(inputs.getOrDefault("multiplier", 1), "직접경비 횟수"));
          unit = nonnegative(row.get("unitPrice"), "직접경비 단가");
        }
        case "RATE" -> {
          BigDecimal rate = nonnegative(inputs.get("rate"), "보험 요율");
          range(rate, 0, 100, "보험 요율");
          unit = rate.divide(BigDecimal.valueOf(100));
        }
        case "TRAVEL" -> {
          qty = base.multiply(nonnegative(inputs.getOrDefault("trips", 1), "출장 횟수"));
          unit = nonnegative(inputs.get("days"), "출장 일수").multiply(nonnegative(inputs.get("dailyCost"), "출장 일비"))
              .add(nonnegative(inputs.get("nights"), "숙박 일수").multiply(nonnegative(inputs.get("lodgingCost"), "숙박비")))
              .add(nonnegative(inputs.get("transportCost"), "교통비"));
        }
        default -> throw new IllegalArgumentException("직접경비 계산 방식 오류");
      }
      row.put("qty", qty);
      row.put("unitPrice", unit);
    }
  }

  private void recalculateContract(Map<String, Object> doc) {
    required(Objects.toString(doc.get("title"), ""), "계약명");
    required(Objects.toString(doc.get("clientName"), ""), "고객사");
    String start = Objects.toString(doc.get("startDate"), ""),
        end = Objects.toString(doc.get("endDate"), "");
    period(start, end);
    BigDecimal supply = nonnegative(doc.get("supplyAmount"), "공급가액");
    require(supply.stripTrailingZeros().scale() <= 0, "공급가액은 천원 단위의 정수로 입력하세요.");
    range(decimal(doc.getOrDefault("ourShareRate", 100)), 0, 100, "지분율");
    BigDecimal labor = BigDecimal.ZERO;
    for (var plan : items(doc, "manpowerPlans")) {
      String type = Objects.toString(plan.get("type"), "당사");
      require(Set.of("당사", "외주", "자사화").contains(type), "인력 유형 오류");
      if (!"외주".equals(type)) {
        Employee e =
            plan.get("employeeId") != null
                ? employee(id(plan.get("employeeId")))
                : employeeByName(Objects.toString(plan.get("name"), ""));
        require("재직".equals(e.getStatus()), "퇴사·휴직 직원은 편성할 수 없습니다.");
        plan.put("employeeId", e.getId());
        plan.put("name", e.getName());
        plan.put("position", e.getPosition());
      }
      Object raw = plan.get("months");
      require(raw instanceof List, "월별 공수가 필요합니다.");
      List<Object> months = (List<Object>) raw;
      require(months.size() == ChronoUnitMonths(start, end), "투입공수의 월 수가 계약기간과 일치해야 합니다.");
      BigDecimal mm = BigDecimal.ZERO;
      for (Object value : months) {
        BigDecimal n = decimal(value);
        range(n, 0, 1, "월별 M/M");
        mm = mm.add(n);
      }
      require(
          mm.signum() == 0 || nonnegative(plan.get("unitPrice"), "인력 단가").signum() > 0,
          "투입인력의 노임단가가 없습니다. 해당 연도 기준정보를 등록하거나 단가를 입력하세요.");
      BigDecimal cost =
          mm.multiply(nonnegative(plan.get("unitPrice"), "인력 단가"))
              .setScale(2, RoundingMode.HALF_UP);
      plan.put("totalMM", mm);
      plan.put("laborCost", cost);
      labor = labor.add(cost);
    }
    recalculateDirectExpenses(doc, supply, start, end);
    BigDecimal product = sumCosts(doc, "productCosts", "qty", "unitPrice", "amount"),
        out = sumCosts(doc, "outsourcings", "mm", "unitPrice", "contractAmount"),
        expense = sumCosts(doc, "directExpenses", "qty", "unitPrice", "amount");
    BigDecimal budget =
        product
            .add(out)
            .add(expense)
            .add(labor)
            .add(nonnegative(doc.get("estimatedAsTotal"), "AS비"))
            .add(nonnegative(doc.get("proposalCostTotal"), "제안비"));
    BigDecimal rate = nonnegative(doc.get("contingencyRate"), "예비비율");
    range(rate, 0, 100, "예비비율");
    BigDecimal
        contingency =
            budget.multiply(rate).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP),
        profit = supply.subtract(budget).subtract(contingency);
    doc.put("productCostTotal", product);
    doc.put("outsourcingTotal", out);
    doc.put("directExpenseTotal", expense);
    doc.put("laborCostTotal", labor);
    doc.put("totalBudget", budget);
    doc.put("salesProfit", supply.subtract(budget));
    doc.put("contingencyCost", contingency);
    doc.put("projectNetProfit", profit);
    doc.put(
        "profitRate",
        supply.signum() == 0
            ? BigDecimal.ZERO
            : profit.multiply(BigDecimal.valueOf(100)).divide(supply, 2, RoundingMode.HALF_UP));
    doc.put("vatAmount", supply.multiply(new BigDecimal("0.1")).setScale(0, RoundingMode.HALF_UP));
    List<Map<String, Object>> milestones = items(doc, "cashflowMilestones");
    if (!milestones.isEmpty()) {
      BigDecimal sum = BigDecimal.ZERO;
      for (var m : milestones) {
        BigDecimal r = nonnegative(m.get("ratePercent"), "입금 비율");
        sum = sum.add(r);
        BigDecimal s = supply.multiply(r).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        m.put("supplyAmount", s);
        m.put("vatAmount", s.multiply(new BigDecimal("0.1")).setScale(2, RoundingMode.HALF_UP));
        m.put("totalAmount", s.add((BigDecimal) m.get("vatAmount")));
      }
      require(sum.compareTo(BigDecimal.valueOf(100)) == 0, "입금계획 비율 합계는 100%여야 합니다.");
    }
  }

  private void transition(Approval a, String action, Map<String, Object> data, Employee actor) {
    switch (action) {
      case "submit" -> {
        require(
            Set.of("작성중", "반려").contains(Objects.toString(a.getStatus(), "")),
            "작성중·반려 문서만 상신할 수 있습니다.");
        require(a.getApproverId() != null, "최종 결재자를 지정하세요.");
        require(!a.getApproverId().equals(a.getRequesterId()), "작성자는 최종 결재자가 될 수 없습니다.");
        a.setStatus("결재대기");
      }
      case "approve", "reject" -> {
        permit(AuthService.executive(actor) && Objects.equals(a.getApproverId(), actor.getId()));
        require("결재대기".equals(a.getStatus()), "결재대기 문서만 처리할 수 있습니다.");
        a.setStatus("approve".equals(action) ? "승인완료" : "반려");
        String comment = Objects.toString(data.get("reviewer_comment"), "");
        if ("reject".equals(action)) required(comment, "반려 사유");
        a.setReviewerComment(comment);
        a.setApprovedBy(actor.getName());
        a.setApprovedAt(Instant.now().toString());
      }
      case "revise" -> {
        require("승인완료".equals(a.getStatus()), "승인 문서만 개정할 수 있습니다.");
        Approval revision = json.convertValue(map(a), Approval.class);
        revision.setId(null);
        revision.setVersion(null);
        revision.setDocNo(number("REV"));
        revision.setStatus("작성중");
        revision.setApprovedBy("");
        revision.setApprovedAt(null);
        revision.setRequesterId(actor.getId());
        revision.setRequester(actor.getName());
        revision.setCreatedAt(LocalDate.now(ZoneId.of("Asia/Seoul")).toString());
        approvals.saveAndFlush(revision);
        log(actor, "approvals", "revision_created", revision.getId(), revision);
      }
    }
    if (a.getCategory().contains("계약품의") && !"revise".equals(action)) {
      Map<String, Object> doc = read(a.getItemsJson(), Map.class);
      Map<String, Object> line =
          (Map<String, Object>) doc.getOrDefault("approvalLine", new HashMap<>());
      if ("approve".equals(action) || "reject".equals(action))
        line.put(
            "ceo",
            Map.of(
                "name",
                actor.getName(),
                "position",
                actor.getPosition(),
                "status",
                a.getStatus(),
                "date",
                a.getApprovedAt(),
                "comment",
                a.getReviewerComment()));
      doc.put("approvalLine", line);
      a.setItemsJson(encode(doc));
      if ("approve".equals(action) && a.getProjectId() != null) {
        projects.findById(a.getProjectId()).ifPresent(p -> {
          Set<Long> members = new HashSet<>();
          Long pmEmployeeId = null;
          String pmEmployeeName = null;
          for (var plan : items(doc, "manpowerPlans")) {
            Long empId = null;
            if (plan.get("employeeId") != null) {
              empId = id(plan.get("employeeId"));
            } else if (plan.get("name") != null && !Objects.toString(plan.get("name")).isBlank()) {
              try {
                Employee matched = employeeByName(Objects.toString(plan.get("name")).trim());
                if (matched != null) empId = matched.getId();
              } catch (Exception ignored) {}
            }
            if (empId != null) {
              members.add(empId);
              String role = Objects.toString(plan.get("role"), "");
              if ((role.contains("PM") || role.contains("총괄")) && pmEmployeeId == null) {
                pmEmployeeId = empId;
                pmEmployeeName = Objects.toString(plan.get("name"), employee(empId).getName());
              }
            }
          }
          if (pmEmployeeId != null) {
            p.setPmId(pmEmployeeId);
            p.setPmName(pmEmployeeName);
          }
          if (!members.isEmpty()) {
            p.setMemberIds(members);
            p.setMembers(
                members.stream()
                    .sorted()
                    .map(id -> employee(id).getName())
                    .collect(java.util.stream.Collectors.joining(", ")));
          }
          projects.saveAndFlush(p);
        });
      }
    }
  }

  private void syncProject(Project p) {
    // Never rewrite approved contract snapshots. Drafts remain the source of their own costs.
    for (Approval a : approvals.findAll())
      if (Objects.equals(a.getProjectId(), p.getId())
          && Set.of("작성중", "반려").contains(Objects.toString(a.getStatus(), ""))
          && a.getCategory().contains("계약품의")) {
        Map<String, Object> doc = read(a.getItemsJson(), Map.class);
        doc.put("title", p.getName());
        doc.put("clientName", p.getClientName());
        doc.put("startDate", p.getStartDate());
        doc.put("endDate", p.getEndDate());
        doc.put("contractPeriod", p.getStartDate().replace("-", ".") + " ~ " + p.getEndDate().replace("-", ".") + " (" + ChronoUnitMonths(p.getStartDate(), p.getEndDate()) + "개월)");
        doc.put("ourShareRate", p.getShareRate());
        doc.put("supplyAmount", p.getOurBudget() * 10L);
        a.setVendor(p.getClientName());
        // Anchor existing allocations to actual calendar months when the contract period changes.
        YearMonth
            oldStart =
                YearMonth.from(
                    date(
                        Objects.toString(
                            read(a.getItemsJson(), Map.class).get("startDate"), p.getStartDate()))),
            nextStart = YearMonth.from(date(p.getStartDate()));
        for (var plan : items(doc, "manpowerPlans")) {
          List<Object> old = (List<Object>) plan.get("months");
          List<Object> resized = new ArrayList<>();
          for (int i = 0; i < ChronoUnitMonths(p.getStartDate(), p.getEndDate()); i++) {
            int index =
                (int)
                    java.time.temporal.ChronoUnit.MONTHS.between(oldStart, nextStart.plusMonths(i));
            resized.add(index >= 0 && index < old.size() ? old.get(index) : 0);
          }
          plan.put("months", resized);
        }
        recalculateContract(doc);
        a.setItemsJson(encode(doc));
        a.setTitle(p.getName());
        a.setProjectName(p.getName());
        a.setAmount(decimal(doc.get("supplyAmount")).intValueExact());
      }
  }

  private Map<String, Object> saveContract(Map<String, Object> payload) {
    require("approvals".equals(payload.get("module")), "계약 문서 요청 오류");
    Employee actor = auth.current();
    permit(AuthService.pm(actor));
    Map<String, Object> data =
        payload.get("data") instanceof Map ? (Map<String, Object>) payload.get("data") : Map.of();
    Long key = id(payload.get("id"));
    Approval a =
        key == null
            ? new Approval()
            : approvals
                .findById(key)
                .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "계약 문서가 없습니다."));
    if (key != null) {
      authorize("approvals", a, actor, false, false);
      version(a, payload.get("version"));
    } else {
      a.setDocNo(number("CONTRACT"));
      a.setRequesterId(actor.getId());
      a.setRequester(actor.getName());
      a.setRequesterPosition(actor.getPosition());
      a.setDepartment(actor.getDepartment());
      a.setCreatedAt(LocalDate.now(ZoneId.of("Asia/Seoul")).toString());
      a.setStatus("작성중");
      a.setApprovedBy("");
    }
    apply("approvals", a, data);
    a.setCategory("계약품의서");
    validateApproval(a, data, actor, key == null);
    Map<String, Object> doc = read(a.getItemsJson(), Map.class);
    if (Boolean.TRUE.equals(payload.get("sync_project"))) {
      Long projectId = a.getProjectId();
      Project p =
          projectId == null
              ? new Project()
              : projects
                  .findById(projectId)
                  .orElseThrow(() -> new IllegalArgumentException("연결 프로젝트가 없습니다."));
      if (projectId != null) {
        permit(projectEdit(p, actor));
        version(p, payload.get("project_version"));
      }
      p.setName(a.getTitle());
      if (a.getVendor() != null && !a.getVendor().isBlank()) {
        p.setClientName(a.getVendor());
      } else if (doc.get("clientName") != null && !Objects.toString(doc.get("clientName")).isBlank()) {
        p.setClientName(Objects.toString(doc.get("clientName")));
      }
      p.setDepartment(a.getDepartment());
      p.setStartDate(Objects.toString(doc.get("startDate")));
      p.setEndDate(Objects.toString(doc.get("endDate")));
      require(
          decimal(doc.get("supplyAmount")).remainder(BigDecimal.TEN).signum() == 0,
          "프로젝트 연동 공급가액은 만원 단위(10천원)로 입력하세요.");
      double share = decimal(doc.getOrDefault("ourShareRate", 100)).doubleValue();
      BigDecimal our =
          decimal(doc.get("supplyAmount")).divide(BigDecimal.TEN, 0, RoundingMode.HALF_UP);
      require(share > 0 || our.signum() == 0, "지분율 0%인 계약의 당사 금액은 0이어야 합니다.");
      int total =
          share == 0
              ? 0
              : our.multiply(BigDecimal.valueOf(100))
                  .divide(BigDecimal.valueOf(share), 0, RoundingMode.HALF_UP)
                  .intValueExact();
      p.setBudget(total);
      p.setShareRate(share);
      p.setOurBudget(our.intValueExact());
      p.setIsConsortium(share < 100);
      if (projectId == null) {
        p.setCode(number("PRJ"));
        p.setPmId(actor.getId());
        p.setPmName(actor.getName());
        p.setStatus("제안준비중");
        p.setProgress(0);
        p.setYearlyRevenueJson("{}");
      }
      Set<Long> members = new HashSet<>();
      Long pmEmployeeId = null;
      String pmEmployeeName = null;
      for (var plan : items(doc, "manpowerPlans")) {
        Long empId = null;
        if (plan.get("employeeId") != null) {
          empId = id(plan.get("employeeId"));
        } else if (plan.get("name") != null && !Objects.toString(plan.get("name")).isBlank()) {
          try {
            Employee matched = employeeByName(Objects.toString(plan.get("name")).trim());
            if (matched != null) {
              empId = matched.getId();
              plan.put("employeeId", empId);
            }
          } catch (Exception ignored) {}
        }
        if (empId != null) {
          members.add(empId);
          String role = Objects.toString(plan.get("role"), "");
          if ((role.contains("PM") || role.contains("총괄")) && pmEmployeeId == null) {
            pmEmployeeId = empId;
            pmEmployeeName = Objects.toString(plan.get("name"), employee(empId).getName());
          }
        }
      }
      if (pmEmployeeId != null) {
        p.setPmId(pmEmployeeId);
        p.setPmName(pmEmployeeName);
      }
      p.setMemberIds(members);
      p.setMembers(
          members.stream()
              .sorted()
              .map(id -> employee(id).getName())
              .collect(java.util.stream.Collectors.joining(", ")));
      // Preserve custom allocations only when their total and period still match.
      try {
        validateRevenue(p.getYearlyRevenueJson(), total, p.getStartDate(), p.getEndDate());
      } catch (IllegalArgumentException ex) {
        p.setYearlyRevenueJson("{}");
      }
      projects.saveAndFlush(p);
      a.setProjectId(p.getId());
      a.setProjectName(p.getName());
      doc.put("linkedProjectId", p.getId());
      doc.put("linkedProjectCode", p.getCode());
      a.setItemsJson(encode(doc));
      log(actor, "projects", "contract_sync", p.getId(), p);
    }
    approvals.saveAndFlush(a);
    log(actor, "approvals", "save_contract", a.getId(), a);
    return response("approvals", a);
  }

  private Map<String, Object> convertDeal(Map<String, Object> payload) {
    require("business_deals".equals(payload.get("module")), "영업 전환 요청 오류");
    BusinessDeal deal =
        deals
            .findById(id(payload.get("id")))
            .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "사업이 없습니다."));
    Employee actor = auth.current();
    authorize("business_deals", deal, actor, false, false);
    version(deal, payload.get("version"));
    require(deal.getConvertedProjectId() == null, "이미 프로젝트로 전환된 사업입니다.");
    Project p = new Project();
    p.setCode(number("PRJ"));
    p.setName(deal.getTitle());
    p.setDepartment(actor.getDepartment());
    p.setPmId(deal.getOwnerId());
    p.setPmName(deal.getOwnerName());
    p.setStartDate(deal.getStartDate() == null ? deal.getCloseDate() : deal.getStartDate());
    p.setEndDate(deal.getEndDate() == null ? deal.getCloseDate() : deal.getEndDate());
    p.setStatus("제안준비중");
    p.setBudget(deal.getAmount());
    p.setYearlyRevenueJson(deal.getYearlyRevenueJson());
    validate("projects", p, Map.of("pm_id", p.getPmId()), actor, true);
    projects.saveAndFlush(p);
    deal.setStage("수주확정");
    deal.setConvertedProjectId(p.getId());
    deals.flush();
    log(actor, "business_deals", "convert_deal", deal.getId(), deal);
    log(actor, "projects", "converted_from_deal", p.getId(), p);
    return response("projects", p);
  }

  private void delete(String module, VersionedEntity entity, Employee actor) {
    if (entity instanceof Employee e) {
      permit(!e.getId().equals(actor.getId()));
      throw error(HttpStatus.CONFLICT, "직원 이력 보존을 위해 삭제 대신 퇴사·계정 비활성 처리를 사용하세요.");
    }
    if (entity instanceof Project p)
      require(
          approvals.findAll().stream().noneMatch(a -> Objects.equals(a.getProjectId(), p.getId())),
          "연결된 문서가 있는 프로젝트는 삭제할 수 없습니다. 완료 처리하세요.");
    if (entity instanceof Approval a)
      require(
          Set.of("작성중", "반려", "PM작성중").contains(Objects.toString(a.getStatus(), "")),
          "상신·승인 기록은 삭제할 수 없습니다.");
    if (entity instanceof CommonCode c)
      require(
          !Set.of("DEPARTMENT", "POSITION", "USER_ROLE")
              .contains(Objects.toString(c.getGroupCode(), "")),
          "시스템 코드는 삭제할 수 없습니다.");
    log(actor, module, "delete", recordId(entity), entity);
    repositories.get(module).delete(entity);
    repositories.get(module).flush();
  }

  private void log(Employee actor, String module, String action, Long id, Object value) {
    Map<String, Object> snapshot = map(value);
    snapshot.remove("password");
    snapshot.remove("session_version");
    audit.save(new AuditEvent(actor.getId(), module, action, id, encode(snapshot)));
  }
}
