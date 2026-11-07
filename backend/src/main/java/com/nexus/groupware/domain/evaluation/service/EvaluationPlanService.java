package com.nexus.groupware.domain.evaluation.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.groupware.core.code.DepartmentCode;
import com.nexus.groupware.core.code.ProjectStageCode;
import com.nexus.groupware.core.code.RoleCode;
import com.nexus.groupware.core.code.StatusCode;
import com.nexus.groupware.core.security.AuthService;
import com.nexus.groupware.domain.approval.db.Approval;
import com.nexus.groupware.domain.approval.db.ApprovalRepository;
import com.nexus.groupware.domain.employee.db.Employee;
import com.nexus.groupware.domain.employee.db.EmployeeRepository;
import com.nexus.groupware.domain.evaluation.db.EvaluationAssignment;
import com.nexus.groupware.domain.evaluation.db.EvaluationAssignmentRepository;
import com.nexus.groupware.domain.evaluation.db.EvaluationPlan;
import com.nexus.groupware.domain.evaluation.db.EvaluationPlanRepository;
import com.nexus.groupware.domain.evaluation.db.EvaluationState;
import com.nexus.groupware.domain.project.db.Project;
import com.nexus.groupware.domain.project.db.ProjectRepository;
import com.nexus.groupware.domain.system.db.AuditEvent;
import com.nexus.groupware.domain.system.db.AuditEventRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class EvaluationPlanService {

    private final EvaluationPlanRepository plans;
    private final EvaluationAssignmentRepository assignments;
    private final EmployeeRepository employees;
    private final ProjectRepository projects;
    private final ApprovalRepository approvals;
    private final AuditEventRepository audit;
    private final AuthService auth;
    private final ObjectMapper json;
    private final EntityManager em;

    @Value("${app.evaluation-plans.enabled:true}")
    private boolean enabled;

    private static final ZoneId ZONE = ZoneId.of("Asia/Seoul");
    private static final Set<String> RESULT_STATES = Set.of("RESULT_SUBMITTED", "EVALUATED");

    public EvaluationPlanService(
            EvaluationPlanRepository plans,
            EvaluationAssignmentRepository assignments,
            EmployeeRepository employees,
            ProjectRepository projects,
            ApprovalRepository approvals,
            AuditEventRepository audit,
            AuthService auth,
            ObjectMapper json,
            EntityManager em) {
        this.plans = plans;
        this.assignments = assignments;
        this.employees = employees;
        this.projects = projects;
        this.approvals = approvals;
        this.audit = audit;
        this.auth = auth;
        this.json = json;
        this.em = em;
    }

    // ==========================================
    // 검증 및 권한 보조 메서드
    // ==========================================

    private void check(boolean condition, String message) {
        if (!condition) {
            throw new IllegalArgumentException(message);
        }
    }

    private void permit(boolean condition) {
        if (!condition) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "이 수행평가에 대한 권한이 없습니다.");
        }
    }

    private void conflict(boolean condition, String message) {
        if (!condition) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, message);
        }
    }

    private void available() {
        if (!enabled) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "수행평가 기능이 비활성화되어 있습니다.");
        }
    }

    public Map<String, Object> config() {
        return Map.of(
                "enabled", enabled,
                "policy_version", "2026-08",
                "performance_weight", 35
        );
    }

    private Employee employee(Long id) {
        return employees.findById(id).orElseThrow(() -> new IllegalArgumentException("직원을 확인하세요."));
    }

    private Project project(Long id) {
        return projects.findById(id).orElseThrow(() -> new IllegalArgumentException("프로젝트를 확인하세요."));
    }

    private RoleCode role(Employee e) {
        return RoleCode.fromCodeOrLabel(e.getRoleCode());
    }

    private boolean executive(Employee e) {
        return role(e).isExecutiveOrAbove();
    }

    private boolean pm(Employee e) {
        return role(e).isPmOrAbove();
    }

    private LocalDate today() {
        return LocalDate.now(ZONE);
    }

    private boolean active(Project p) {
        var code = ProjectStageCode.fromCodeOrLabel(p.getStatusCode());
        return code == ProjectStageCode.STAGE_EXEC || code == ProjectStageCode.STAGE_PROPOSAL;
    }

    private boolean member(Project p, Long id) {
        return Objects.equals(p.getPmId(), id) || p.getMemberIds().contains(id);
    }

    private Set<Long> memberProjectIds(Employee actor) {
        Set<Long> ids = new HashSet<>();
        if (pm(actor)) {
            projects.findAll().stream()
                    .filter(p -> member(p, actor.getId()))
                    .forEach(p -> ids.add(p.getId()));
        }
        return ids;
    }

    public Specification<EvaluationPlan> visible(Employee actor) {
        var ids = memberProjectIds(actor);
        return (root, q, b) -> {
            if (executive(actor)) {
                return b.conjunction();
            }
            return b.or(
                    b.equal(root.get("employeeId"), actor.getId()),
                    pm(actor) ? b.and(root.get("projectId").in(ids.isEmpty() ? Set.of(-1L) : ids)) : b.disjunction(),
                    pm(actor) ? b.and(b.equal(root.get("kind"), "POOL"), b.equal(root.get("reviewerId"), actor.getId())) : b.disjunction()
            );
        };
    }

    @Transactional(readOnly = true)
    public long visibleCount(Employee actor) {
        return enabled ? plans.count(visible(actor)) : 0;
    }

    private boolean canRead(EvaluationPlan p, Employee actor) {
        if (executive(actor) || Objects.equals(p.getEmployeeId(), actor.getId())) {
            return true;
        }
        if (pm(actor)) {
            if (p.getProjectId() != null) {
                return member(project(p.getProjectId()), actor.getId());
            }
            return Objects.equals(p.getReviewerId(), actor.getId());
        }
        return false;
    }

    private boolean canReview(EvaluationPlan p, Employee actor) {
        if (Objects.equals(p.getEmployeeId(), actor.getId())) {
            return false;
        }
        if (executive(actor)) {
            return true;
        }
        if (!pm(actor)) {
            return false;
        }
        if (p.getProjectId() != null) {
            return Objects.equals(project(p.getProjectId()).getPmId(), actor.getId());
        }
        return Objects.equals(p.getReviewerId(), actor.getId());
    }

    private Long reviewer(Long projectId, Long subject, Long requested) {
        if (projectId != null) {
            Long owner = project(projectId).getPmId();
            if (owner != null && !owner.equals(subject)) {
                check(pm(employee(owner)), "담당 PM 권한을 확인하세요.");
                return owner;
            }
        }
        check(requested != null && !requested.equals(subject), "본인을 제외한 검토자를 지정하세요.");
        Employee r = employee(requested);
        if (projectId != null) {
            check(executive(r), "PM 본인 목표나 담당 PM이 없는 프로젝트는 임원 검토자를 지정하세요.");
        } else {
            check(pm(r), "인재풀 검토자는 PM급 이상이어야 합니다.");
        }
        check(StatusCode.fromCodeOrLabel(r.getStatusCode()) == StatusCode.STATUS_ACTIVE, "재직 중인 검토자를 선택하세요.");
        return r.getId();
    }

    /**
     * 프로젝트 구성원 변경 시 수행평가 배정(EvaluationAssignment) 동기화
     */
    public void syncProjectAssignments(Project p) {
        Set<Long> current = new HashSet<>();
        if (active(p)) {
            current.addAll(p.getMemberIds());
            if (p.getPmId() != null) {
                current.add(p.getPmId());
            }
        }
        var existing = assignments.findByProjectIdAndEndedOnIsNull(p.getId());
        for (var a : existing) {
            if (!current.contains(a.getEmployeeId())) {
                a.setEndedOn(today().isBefore(a.getAssignedOn()) ? a.getAssignedOn() : today());
                assignments.save(a);
            }
        }
        for (Long id : current) {
            if (existing.stream().noneMatch(a -> a.getEmployeeId().equals(id))) {
                var a = new EvaluationAssignment();
                a.setEmployeeId(id);
                a.setProjectId(p.getId());
                LocalDate start = LocalDate.parse(p.getStartDate());
                a.setAssignedOn(start.isAfter(today()) ? start : today());
                assignments.save(a);
            }
        }
    }

    public void assertProjectDeletable(Long projectId) {
        boolean canDelete = assignments.countByProjectId(projectId) == 0
                && plans.count((root, q, b) -> b.equal(root.get("projectId"), projectId)) == 0;
        conflict(canDelete, "수행평가·배정 이력 보존을 위해 프로젝트를 삭제할 수 없습니다. 완료 처리하세요.");
    }

    // ==========================================
    // JSON 직렬화 및 파싱 헬퍼
    // ==========================================

    private String encode(Object value) {
        try {
            return json.writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalArgumentException("문서 형식을 확인하세요.");
        }
    }

    private <T> T read(String value, TypeReference<T> type) {
        try {
            return json.readValue(value, type);
        } catch (Exception e) {
            throw new IllegalArgumentException("저장된 수행평가 문서 형식을 확인하세요.");
        }
    }

    private List<Map<String, Object>> goals(EvaluationPlan p) {
        return read(p.getGoalsJson(), new TypeReference<>() {});
    }

    private List<Map<String, Object>> results(EvaluationPlan p) {
        return read(p.getResultsJson(), new TypeReference<>() {});
    }

    private Map<String, BigDecimal> mm(String body) {
        return read(body, new TypeReference<>() {});
    }

    private BigDecimal number(Object v, String name) {
        try {
            var n = new BigDecimal(Objects.toString(v, "0"));
            check(n.signum() >= 0 && n.compareTo(new BigDecimal("1000000000")) <= 0, name + " 범위를 확인하세요.");
            return n;
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(name + "에 숫자를 입력하세요.");
        }
    }

    private Long id(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return new BigDecimal(value.toString()).longValueExact();
        } catch (Exception e) {
            throw new IllegalArgumentException("ID 형식을 확인하세요.");
        }
    }

    private String text(Object value, int length, String name, boolean required) {
        String t = Objects.toString(value, "").trim();
        check(t.length() <= length && (!required || !t.isBlank()), name + "을 확인하세요.");
        return t;
    }

    private void keys(Map<String, Object> data, String... allowed) {
        var set = Set.of(allowed);
        check(set.containsAll(data.keySet()), "이 작업에서 변경할 수 없는 항목이 포함되어 있습니다.");
    }

    private List<Map<String, Object>> parseGoals(Object raw, boolean complete, String kind) {
        check(raw instanceof List, "목표 항목을 확인하세요.");
        var list = (List<?>) raw;
        check(!list.isEmpty() && list.size() <= 30, "목표는 1~30개로 작성하세요.");

        var out = new ArrayList<Map<String, Object>>();
        Set<String> ids = new HashSet<>();
        BigDecimal weight = BigDecimal.ZERO;

        for (Object o : list) {
            check(o instanceof Map, "목표 형식 오류");
            var g = (Map<String, Object>) o;
            keys(g, "id", "category", "title", "criterion", "direction", "target", "unit", "weight");

            var row = new LinkedHashMap<String, Object>();
            String key = text(g.get("id"), 80, "목표 ID", true);
            check(ids.add(key), "목표 ID가 중복됩니다.");
            row.put("id", key);
            row.put("category", text(g.get("category"), 50, "지표 구분", true));
            row.put("title", text(g.get("title"), 250, "지표명", true));
            row.put("criterion", text(g.get("criterion"), 3000, "개인 목표·달성기준", complete));

            String direction = Objects.toString(g.get("direction"), "HIGHER");
            check(Set.of("HIGHER", "LOWER", "MANUAL").contains(direction), "달성 방식 오류");
            row.put("direction", direction);

            BigDecimal target = number(g.get("target"), "목표값");
            BigDecimal w = number(g.get("weight"), "배점");
            check(w.compareTo(BigDecimal.valueOf(100)) <= 0, "항목 배점은 100점 이하여야 합니다.");

            if (complete) {
                check(w.signum() > 0, "항목 배점을 입력하세요.");
                if ("HIGHER".equals(direction)) {
                    check(target.signum() > 0, "높을수록 좋은 지표의 목표값은 0보다 커야 합니다.");
                }
            }

            row.put("target", target);
            row.put("weight", w);
            row.put("unit", text(g.get("unit"), 30, "단위", complete && !"MANUAL".equals(direction)));
            weight = weight.add(w);
            out.add(row);
        }

        check(weight.compareTo(BigDecimal.valueOf(100)) <= 0, "배점 합계는 100점 이하여야 합니다.");
        if (complete && "PROJECT".equals(kind)) {
            check(weight.compareTo(BigDecimal.valueOf(100)) == 0, "프로젝트 목표 배점 합계를 100점으로 맞추세요.");
        }
        return out;
    }

    private Map<String, BigDecimal> parseMm(Object raw, LocalDate start, LocalDate end, boolean complete) {
        check(raw instanceof Map, "월별 공수를 입력하세요.");
        var out = new TreeMap<String, BigDecimal>();

        for (var e : ((Map<?, ?>) raw).entrySet()) {
            YearMonth month;
            try {
                month = YearMonth.parse(e.getKey().toString());
            } catch (Exception ex) {
                throw new IllegalArgumentException("월별 공수의 연월을 확인하세요.");
            }
            check(month.getYear() == start.getYear(), "평가 연도와 다른 연도의 공수는 입력할 수 없습니다.");
            var n = number(e.getValue(), "월별 공수");
            check(n.compareTo(BigDecimal.ONE) <= 0 && n.scale() <= 2, "월별 공수는 0~1 MM, 소수 둘째 자리까지 입력하세요.");

            // 평가기간(프로젝트 배정 기간) 밖의 월인데 0보다 큰 공수를 입력하려 한 경우 방지
            boolean outsidePeriod = month.isBefore(YearMonth.from(start)) || month.isAfter(YearMonth.from(end));
            if (outsidePeriod && n.signum() > 0) {
                throw new IllegalArgumentException("평가기간 밖의 공수는 입력할 수 없습니다.");
            }

            out.put(month.toString(), n);
        }

        if (complete) {
            check(out.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add).signum() > 0, "평가에 반영할 공수를 입력하세요.");
        }
        return out;
    }

    private Map<String, Object> dto(EvaluationPlan p, Employee actor, boolean detail) {
        Map<String, Object> out = json.convertValue(p, new TypeReference<Map<String, Object>>() {});
        out.remove("goals_json");
        out.remove("results_json");
        out.remove("planned_mm_json");
        out.remove("actual_mm_json");

        Employee subject = employee(p.getEmployeeId());
        out.put("employee_name", subject.getName());
        out.put("emp_no", subject.getEmpNo());
        out.put("project_name", p.getProjectId() == null ? "인재풀" : project(p.getProjectId()).getName());
        out.put("reviewer_name", employee(p.getReviewerId()).getName());
        out.put("can_review", canReview(p, actor));
        out.put("can_edit_goals", p.getEmployeeId().equals(actor.getId()) && EvaluationState.valueOf(p.getState()).goalsEditable());
        out.put("can_edit_results", p.getEmployeeId().equals(actor.getId()) && EvaluationState.valueOf(p.getState()).resultsEditable());
        out.put("planned_mm_total", mm(p.getPlannedMmJson()).values().stream().reduce(BigDecimal.ZERO, BigDecimal::add));
        out.put("actual_mm_total", mm(p.getActualMmJson()).values().stream().reduce(BigDecimal.ZERO, BigDecimal::add));
        out.put("performance_points", p.getScore() == null ? null : Math.round(p.getScore() * 35) / 100.0);

        if (detail) {
            out.put("goals", goals(p));
            out.put("results", results(p));
            out.put("planned_mm", mm(p.getPlannedMmJson()));
            out.put("actual_mm", mm(p.getActualMmJson()));
        }
        return out;
    }

    // ==========================================
    // 계약품의서 연동: 승인된 인력투입계획(M/M) 추출
    // ==========================================

    private Map<String, BigDecimal> findContractAllocations(Long projectId, Long employeeId, Project p, int year) {
        Map<String, BigDecimal> result = new TreeMap<>();
        for (int m = 1; m <= 12; m++) {
            result.put(String.format("%04d-%02d", year, m), BigDecimal.ZERO);
        }
        if (projectId == null || employeeId == null) {
            return result;
        }
        try {
            var contracts = approvals.findAll().stream()
                    .filter(a -> Set.of("계약품의", "계약품의서").contains(a.getCategory()))
                    .filter(a -> Objects.equals(a.getProjectId(), projectId))
                    .toList();

            for (var a : contracts) {
                if (a.getItemsJson() == null || a.getItemsJson().isBlank()) {
                    continue;
                }
                Map<String, Object> doc = read(a.getItemsJson(), new TypeReference<>() {});
                Object plansObj = doc.get("manpowerPlans");
                if (plansObj instanceof List<?> list) {
                    for (Object itemObj : list) {
                        if (itemObj instanceof Map<?, ?> item) {
                            Long empId = id(item.get("employeeId"));
                            String name = Objects.toString(item.get("name"), "");
                            Employee emp = employees.findById(employeeId).orElse(null);
                            boolean matches = (empId != null && empId.equals(employeeId))
                                    || (emp != null && emp.getName().equals(name));
                            if (matches) {
                                Object monthsObj = item.get("months");
                                if (monthsObj instanceof List<?> monthList) {
                                    return mapMonthsToCalendar(year, monthList, p.getStartDate(), p.getEndDate());
                                }
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            // 연동 데이터 파싱 실패 시 기본값 빈 맵 반환
        }
        return result;
    }

    private Map<String, BigDecimal> mapMonthsToCalendar(int year, List<?> monthList, String startDateStr, String endDateStr) {
        Map<String, BigDecimal> result = new TreeMap<>();
        for (int m = 1; m <= 12; m++) {
            result.put(String.format("%04d-%02d", year, m), BigDecimal.ZERO);
        }
        try {
            LocalDate start = LocalDate.parse(startDateStr);
            LocalDate end = LocalDate.parse(endDateStr);
            YearMonth cur = YearMonth.from(start);
            YearMonth endYm = YearMonth.from(end);
            int idx = 0;
            while (!cur.isAfter(endYm) && idx < monthList.size()) {
                Object val = monthList.get(idx);
                BigDecimal valMm = number(val, "M/M");
                if (cur.getYear() == year) {
                    result.put(cur.toString(), valMm.max(BigDecimal.ZERO).min(BigDecimal.ONE));
                }
                cur = cur.plusMonths(1);
                idx++;
            }
        } catch (Exception e) {
            // ignore
        }
        return result;
    }

    private String findContractDocNo(Long projectId) {
        if (projectId == null) {
            return null;
        }
        return approvals.findAll().stream()
                .filter(a -> Set.of("계약품의", "계약품의서").contains(a.getCategory()))
                .filter(a -> Objects.equals(a.getProjectId(), projectId))
                .map(Approval::getDocNo)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);
    }

    private Map<String, Object> assignmentDto(EvaluationAssignment a, int year, List<EvaluationPlan> mine) {
        Project p = project(a.getProjectId());
        LocalDate start = a.getAssignedOn().isAfter(LocalDate.of(year, 1, 1))
                ? a.getAssignedOn()
                : LocalDate.of(year, 1, 1);
        LocalDate projectEnd = LocalDate.parse(p.getEndDate());
        LocalDate end = projectEnd.isBefore(LocalDate.of(year, 12, 31))
                ? projectEnd
                : LocalDate.of(year, 12, 31);
        if (a.getEndedOn() != null && a.getEndedOn().isBefore(end)) {
            end = a.getEndedOn();
        }
        if (start.isAfter(end)) {
            return null;
        }

        Map<String, BigDecimal> contractMm = findContractAllocations(p.getId(), a.getEmployeeId(), p, year);
        String docNo = findContractDocNo(p.getId());
        BigDecimal totalSyncedMm = contractMm.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> res = new HashMap<>();
        res.put("id", a.getId());
        res.put("project_id", p.getId());
        res.put("project_name", p.getName());
        res.put("project_code", p.getCode() == null ? "" : p.getCode());
        res.put("start_date", start.toString());
        res.put("end_date", end.toString());
        res.put("ended", a.getEndedOn() != null);
        res.put("pm_id", p.getPmId() == null ? 0L : p.getPmId());
        res.put("requires_executive", p.getPmId() == null || Objects.equals(p.getPmId(), a.getEmployeeId()));
        res.put("needs_plan", mine.stream().noneMatch(plan -> Objects.equals(plan.getAssignmentId(), a.getId()) && plan.getStartDate().getYear() == year));
        res.put("contract_doc_no", docNo);
        res.put("synced_mm", contractMm);
        res.put("synced_total_mm", totalSyncedMm);
        res.put("progress", p.getProgress() == null ? 0 : p.getProgress());
        res.put("stage_code", p.getStatusCode() == null ? "" : p.getStatusCode());
        return res;
    }

    // ==========================================
    // 수행평가 목록 및 상세 조회
    // ==========================================

    @Transactional(readOnly = true)
    public Map<String, Object> list(int year, int page, int size) {
        return list(year, page, size, "", "");
    }

    @Transactional(readOnly = true)
    public Map<String, Object> list(int year, int page, int size, String query, String state) {
        available();
        check(year >= 2020 && year <= 2100 && page >= 0 && size > 0 && size <= 100, "조회 범위를 확인하세요.");
        Employee actor = auth.current();
        check(query.length() <= 100, "검색어는 100자 이내로 입력하세요.");
        check(state.isBlank() || Arrays.stream(EvaluationState.values()).anyMatch(s -> s.name().equals(state)), "평가 상태를 확인하세요.");

        String search = query.toLowerCase(Locale.ROOT).trim();
        Set<Long> subjects = new HashSet<>();
        Set<Long> projectMatches = new HashSet<>();

        if (!search.isBlank()) {
            employees.findAll().stream()
                    .filter(e -> e.getName().toLowerCase(Locale.ROOT).contains(search) || e.getEmpNo().toLowerCase(Locale.ROOT).contains(search))
                    .forEach(e -> subjects.add(e.getId()));
            projects.findAll().stream()
                    .filter(p -> p.getName().toLowerCase(Locale.ROOT).contains(search))
                    .forEach(p -> projectMatches.add(p.getId()));
        }

        var pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "id"));
        var rows = plans.findAll(visible(actor).and((root, q, b) -> b.and(
                b.between(root.get("startDate"), LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31)),
                state.isBlank() ? b.conjunction() : b.equal(root.get("state"), state),
                search.isBlank() ? b.conjunction() : b.or(
                        b.like(b.lower(root.get("title")), "%" + search + "%"),
                        root.get("employeeId").in(subjects.isEmpty() ? Set.of(-1L) : subjects),
                        root.get("projectId").in(projectMatches.isEmpty() ? Set.of(-1L) : projectMatches)
                )
        )), pageRequest);

        var mine = plans.findByEmployeeIdOrderByIdDesc(actor.getId());
        var contexts = assignments.findByEmployeeIdOrderByAssignedOnDescIdDesc(actor.getId()).stream()
                .map(a -> assignmentDto(a, year, mine))
                .filter(Objects::nonNull)
                .toList();

        boolean pool = DepartmentCode.DEPT_BIZ.getCode().equals(actor.getDepartmentCode())
                && projects.findAll().stream().noneMatch(p -> active(p) && member(p, actor.getId())
                        && !LocalDate.parse(p.getStartDate()).isAfter(today())
                        && !LocalDate.parse(p.getEndDate()).isBefore(today()));

        var reviewers = employees.findAll().stream()
                .filter(e -> !e.getId().equals(actor.getId()) && pm(e) && StatusCode.fromCodeOrLabel(e.getStatusCode()) == StatusCode.STATUS_ACTIVE)
                .map(e -> Map.of("id", e.getId(), "name", e.getName(), "executive", executive(e)))
                .toList();

        BigDecimal effort = BigDecimal.ZERO;
        BigDecimal weighted = BigDecimal.ZERO;

        for (var p : mine) {
            if (p.getStartDate().getYear() == year && "EVALUATED".equals(p.getState())) {
                BigDecimal n = mm(p.getActualMmJson()).values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
                effort = effort.add(n);
                weighted = weighted.add(n.multiply(BigDecimal.valueOf(p.getScore())));
            }
        }

        BigDecimal totalSyncedMm = contexts.stream()
                .map(c -> (BigDecimal) c.getOrDefault("synced_total_mm", BigDecimal.ZERO))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 연간 12 MM 기준 50점 만점 성과점수 산출
        BigDecimal capacityPoints = totalSyncedMm.multiply(BigDecimal.valueOf(50))
                .divide(BigDecimal.valueOf(12), 2, RoundingMode.HALF_UP)
                .min(BigDecimal.valueOf(50));

        Map<String, Object> summary = new HashMap<>();
        summary.put("actual_mm", effort);
        summary.put("score", effort.signum() == 0 ? null : weighted.divide(effort, 2, RoundingMode.HALF_UP));
        summary.put("performance_points", effort.signum() == 0 ? null : weighted.divide(effort, 6, RoundingMode.HALF_UP).multiply(new BigDecimal("0.35")).setScale(2, RoundingMode.HALF_UP));
        summary.put("contract_total_mm", totalSyncedMm);
        summary.put("capacity_points", capacityPoints);

        return Map.of(
                "enabled", true,
                "plans", rows.getContent().stream().map(p -> dto(p, actor, false)).toList(),
                "total", rows.getTotalElements(),
                "assignments", contexts,
                "pool_available", pool,
                "reviewers", reviewers,
                "summary", summary
        );
    }

    @Transactional(readOnly = true)
    public Map<String, Object> detail(Long id) {
        available();
        var p = plans.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "수행평가가 없습니다."));
        Employee actor = auth.current();
        permit(canRead(p, actor));
        return dto(p, actor, true);
    }

    private void version(EvaluationPlan p, Object v) {
        check(v != null, "조회 당시 version이 필요합니다.");
        conflict(Objects.equals(p.getVersion(), id(v)), "다른 사용자가 변경했습니다. 다시 조회하세요.");
    }

    private void log(EvaluationPlan p, String action, Employee actor) {
        audit.save(new AuditEvent(actor.getId(), "evaluation_plans", action, p.getId(), encode(dto(p, actor, true))));
    }

    private void draft(EvaluationPlan p, Map<String, Object> data, boolean complete) {
        p.setTitle(text(data.get("title"), 250, "제목", true));
        LocalDate start;
        LocalDate end;
        try {
            start = LocalDate.parse(Objects.toString(data.get("start_date"), ""));
            end = LocalDate.parse(Objects.toString(data.get("end_date"), ""));
        } catch (Exception e) {
            throw new IllegalArgumentException("평가기간을 확인하세요.");
        }

        check(!end.isBefore(start) && start.getYear() == end.getYear(), "평가기간은 같은 연도 안에서 설정하세요.");

        if ("POOL".equals(p.getKind())) {
            check(YearMonth.from(start).equals(YearMonth.from(end)), "인재풀 평가는 월별로 작성하세요.");
        } else {
            var a = assignments.findById(p.getAssignmentId()).orElseThrow();
            check(!start.isBefore(a.getAssignedOn()), "배정 이전 기간은 선택할 수 없습니다.");
            check(!end.isAfter(LocalDate.parse(project(p.getProjectId()).getEndDate())), "프로젝트 종료일을 확인하세요.");
            if (a.getEndedOn() != null) {
                check(!end.isAfter(a.getEndedOn()), "해당 배정의 종료일을 확인하세요.");
            }
        }

        for (var other : plans.findByEmployeeIdOrderByIdDesc(p.getEmployeeId())) {
            if (!Objects.equals(other.getId(), p.getId())
                    && Objects.equals(other.getAssignmentId(), p.getAssignmentId())
                    && Objects.equals(other.getKind(), p.getKind())) {
                check(end.isBefore(other.getStartDate()) || start.isAfter(other.getEndDate()),
                        "같은 배정·인재풀 기간의 목표가 이미 있습니다. 기존 문서를 확인하세요.");
            }
        }

        p.setStartDate(start);
        p.setEndDate(end);
        p.setGoalsJson(encode(parseGoals(data.get("goals"), complete, p.getKind())));
        p.setPlannedMmJson(encode(parseMm(data.get("planned_mm"), start, end, complete)));
    }

    // ==========================================
    // 수행평가 생성 및 상태 전이 액션
    // ==========================================

    public Map<String, Object> create(Map<String, Object> data) {
        available();
        keys(data, "kind", "assignment_id", "reviewer_id", "title", "start_date", "end_date", "goals", "planned_mm");
        Employee actor = auth.current();
        em.lock(actor, LockModeType.PESSIMISTIC_WRITE);

        String kind = Objects.toString(data.get("kind"), "");
        check(Set.of("PROJECT", "POOL").contains(kind), "작성 종류를 선택하세요.");

        var p = new EvaluationPlan();
        p.setEmployeeId(actor.getId());
        p.setKind(kind);
        p.setState(EvaluationState.DRAFT.name());

        if ("PROJECT".equals(kind)) {
            Long assignmentId = id(data.get("assignment_id"));
            check(assignmentId != null, "프로젝트 배정을 선택하세요.");
            var a = assignments.findById(assignmentId).orElseThrow(() -> new IllegalArgumentException("배정 이력을 확인하세요."));
            permit(a.getEmployeeId().equals(actor.getId()));
            p.setAssignmentId(a.getId());
            p.setProjectId(a.getProjectId());
        } else {
            check(data.get("assignment_id") == null, "인재풀은 프로젝트 배정을 선택하지 않습니다.");
            check((Boolean) list(today().getYear(), 0, 1).get("pool_available"), "인재풀 대기 상태에서 월별 평가를 작성할 수 있습니다.");
        }

        p.setReviewerId(reviewer(p.getProjectId(), actor.getId(), id(data.get("reviewer_id"))));
        draft(p, data, false);
        plans.saveAndFlush(p);
        log(p, "create", actor);
        return dto(p, actor, true);
    }

    public Map<String, Object> action(Long id, String action, Map<String, Object> data) {
        available();
        var p = plans.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "수행평가가 없습니다."));
        Employee actor = auth.current();
        permit(canRead(p, actor));
        em.lock(employee(p.getEmployeeId()), LockModeType.PESSIMISTIC_WRITE);
        version(p, data.get("version"));

        EvaluationState state = EvaluationState.valueOf(p.getState());
        boolean owner = p.getEmployeeId().equals(actor.getId());

        switch (action) {
            case "save_goals" -> {
                permit(owner);
                conflict(state.goalsEditable(), "제출·승인된 목표는 수정할 수 없습니다.");
                keys(data, "version", "title", "start_date", "end_date", "goals", "planned_mm", "reviewer_id");
                p.setReviewerId(reviewer(p.getProjectId(), p.getEmployeeId(), id(data.getOrDefault("reviewer_id", p.getReviewerId()))));
                draft(p, data, false);
            }
            case "submit" -> {
                permit(owner);
                conflict(state.goalsEditable(), "제출 가능한 상태가 아닙니다.");
                keys(data, "version");
                parseGoals(goals(p), true, p.getKind());
                parseMm(mm(p.getPlannedMmJson()), p.getStartDate(), p.getEndDate(), true);
                p.setReviewerId(reviewer(p.getProjectId(), p.getEmployeeId(), p.getReviewerId()));
                p.setState(EvaluationState.SUBMITTED.name());
            }
            case "request_revision" -> {
                permit(canReview(p, actor));
                conflict(state == EvaluationState.SUBMITTED, "목표 검토 중에만 보완 요청할 수 있습니다.");
                keys(data, "version", "comment");
                p.setReviewComment(text(data.get("comment"), 5000, "보완 의견", true));
                p.setState(EvaluationState.REVISION_REQUIRED.name());
            }
            case "approve" -> {
                permit(canReview(p, actor));
                conflict(state == EvaluationState.SUBMITTED, "제출된 목표만 승인할 수 있습니다.");
                keys(data, "version", "comment");
                p.setReviewComment(text(data.get("comment"), 5000, "검토 의견", false));
                p.setApprovedBy(actor.getId());
                p.setApprovedOn(Instant.now());
                p.setGoalsHash(hash(p));
                p.setState(EvaluationState.APPROVED.name());
            }
            case "save_results" -> {
                permit(owner);
                conflict(state.resultsEditable(), "승인 후 결과 작성 상태에서만 실적을 수정할 수 있습니다.");
                keys(data, "version", "results", "actual_mm");
                saveResults(p, data, false);
            }
            case "submit_results" -> {
                permit(owner);
                conflict(state.resultsEditable(), "결과 제출 가능한 상태가 아닙니다.");
                keys(data, "version");
                saveResults(p, Map.of("results", results(p), "actual_mm", mm(p.getActualMmJson())), true);
                capacity(p);
                p.setState(EvaluationState.RESULT_SUBMITTED.name());
            }
            case "request_result_revision" -> {
                permit(canReview(p, actor));
                conflict(state == EvaluationState.RESULT_SUBMITTED, "제출된 결과만 보완 요청할 수 있습니다.");
                keys(data, "version", "comment");
                p.setResultComment(text(data.get("comment"), 5000, "실적 보완 의견", true));
                p.setState(EvaluationState.RESULT_REVISION_REQUIRED.name());
            }
            case "evaluate" -> {
                permit(canReview(p, actor));
                conflict(state == EvaluationState.RESULT_SUBMITTED, "실적 제출 후 평가를 확정하세요.");
                keys(data, "version", "scores", "comment");
                evaluate(p, data);
                p.setState(EvaluationState.EVALUATED.name());
                p.setEvaluatedOn(Instant.now());
            }
            case "delete_draft" -> {
                permit(owner);
                conflict(state == EvaluationState.DRAFT || state == EvaluationState.REVISION_REQUIRED, "초안만 삭제할 수 있습니다.");
                keys(data, "version");
                log(p, "delete_draft", actor);
                plans.delete(p);
                plans.flush();
                return Map.of("deleted", true);
            }
            default -> throw new IllegalArgumentException("지원하지 않는 수행평가 작업입니다.");
        }

        if (p.getGoalsHash() != null) {
            conflict(p.getGoalsHash().equals(hash(p)), "승인된 목표의 변경이 감지되었습니다.");
        }

        plans.saveAndFlush(p);
        log(p, action, actor);
        return dto(p, actor, true);
    }

    private String hash(EvaluationPlan p) {
        try {
            var payload = List.of(
                    p.getKind(),
                    p.getTitle(),
                    p.getStartDate().toString(),
                    p.getEndDate().toString(),
                    Objects.toString(p.getAssignmentId(), ""),
                    p.getReviewerId(),
                    p.getGoalsJson(),
                    p.getPlannedMmJson()
            );
            byte[] bytes = encode(payload).getBytes(StandardCharsets.UTF_8);
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private void saveResults(EvaluationPlan p, Map<String, Object> data, boolean complete) {
        check(data.get("results") instanceof List, "실적 항목을 확인하세요.");
        var out = new ArrayList<Map<String, Object>>();
        Set<String> ids = new HashSet<>();
        var goalIds = goals(p).stream()
                .map(g -> g.get("id").toString())
                .collect(java.util.stream.Collectors.toSet());

        for (Object o : (List<?>) data.get("results")) {
            check(o instanceof Map, "실적 형식 오류");
            var r = (Map<String, Object>) o;
            keys(r, "goal_id", "actual", "evidence");
            String id = text(r.get("goal_id"), 80, "목표 ID", true);
            check(goalIds.contains(id) && ids.add(id), "실적의 목표 ID를 확인하세요.");

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("goal_id", id);
            var g = goals(p).stream().filter(item -> item.get("id").equals(id)).findFirst().orElseThrow();
            if (complete && !"MANUAL".equals(g.get("direction"))) {
                check(r.get("actual") != null, "모든 정량 지표의 실적값을 입력하세요.");
            }
            row.put("actual", r.get("actual") == null ? null : number(r.get("actual"), "실적값"));
            row.put("evidence", text(r.get("evidence"), 5000, "실적·증빙 설명", complete));
            out.add(row);
        }

        if (complete) {
            check(ids.equals(goalIds), "모든 목표의 실적과 증빙 설명을 작성하세요.");
        }
        p.setResultsJson(encode(out));
        p.setActualMmJson(encode(parseMm(data.get("actual_mm"), p.getStartDate(), p.getEndDate(), complete)));
    }

    private void capacity(EvaluationPlan p) {
        var total = new HashMap<>(mm(p.getActualMmJson()));
        for (var other : plans.findByEmployeeIdOrderByIdDesc(p.getEmployeeId())) {
            if (!other.getId().equals(p.getId()) && RESULT_STATES.contains(other.getState())) {
                mm(other.getActualMmJson()).forEach((month, n) -> total.merge(month, n, BigDecimal::add));
            }
        }
        total.forEach((month, n) -> check(n.compareTo(BigDecimal.ONE) <= 0, month + "의 실적 공수 합계가 1 MM를 초과합니다."));
    }

    private void evaluate(EvaluationPlan p, Map<String, Object> data) {
        check(data.get("scores") instanceof List, "항목별 평가를 입력하세요.");
        Map<String, Map<String, Object>> scores = new HashMap<>();

        for (Object o : (List<?>) data.get("scores")) {
            check(o instanceof Map, "평가점수 형식 오류");
            var s = (Map<String, Object>) o;
            keys(s, "goal_id", "score", "reason");
            String id = text(s.get("goal_id"), 80, "목표 ID", true);
            check(scores.put(id, s) == null, "평가 항목이 중복됩니다.");
        }

        var result = results(p);
        BigDecimal sum = BigDecimal.ZERO;
        Set<String> expected = new HashSet<>();

        for (var goal : goals(p)) {
            String id = goal.get("id").toString();
            expected.add(id);
            var score = scores.get(id);
            check(score != null, "모든 항목의 평가를 입력하세요.");

            BigDecimal n = number(score.get("score"), "평가점수");
            check(n.compareTo(BigDecimal.valueOf(100)) <= 0, "평가점수는 100점 이하여야 합니다.");

            var row = result.stream().filter(r -> r.get("goal_id").equals(id)).findFirst().orElseThrow();
            BigDecimal auto = achievement(goal, number(row.get("actual"), "실적값"));
            String reason = text(score.get("reason"), 3000, "평가 근거", false);

            if (auto == null || auto.subtract(n).abs().compareTo(new BigDecimal("0.01")) > 0) {
                check(!reason.isBlank(), "수동 점수 또는 달성률과 다른 점수에는 평가 근거가 필요합니다.");
            }

            row.put("score", n);
            row.put("reason", reason);
            sum = sum.add(n.multiply(number(goal.get("weight"), "배점")).divide(BigDecimal.valueOf(100)));
        }

        check(scores.keySet().equals(expected), "평가 항목 ID를 확인하세요.");
        p.setScore(sum.setScale(2, RoundingMode.HALF_UP).doubleValue());
        p.setResultsJson(encode(result));
        p.setResultComment(text(data.get("comment"), 5000, "종합 평가 의견", true));
    }

    private BigDecimal achievement(Map<String, Object> goal, BigDecimal actual) {
        BigDecimal target = number(goal.get("target"), "목표값");
        String direction = goal.get("direction").toString();
        if ("MANUAL".equals(direction)) {
            return null;
        }
        if ("LOWER".equals(direction)) {
            if (actual.compareTo(target) <= 0) {
                return BigDecimal.valueOf(100);
            }
            if (target.signum() == 0) {
                return BigDecimal.ZERO;
            }
            return target.multiply(BigDecimal.valueOf(100)).divide(actual, 2, RoundingMode.HALF_UP);
        }
        return actual.multiply(BigDecimal.valueOf(100))
                .divide(target, 2, RoundingMode.HALF_UP)
                .min(BigDecimal.valueOf(100));
    }
}
