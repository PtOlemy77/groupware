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
import com.nexus.groupware.domain.evaluation.dto.EvaluationDtos.AssignmentVo;
import com.nexus.groupware.domain.evaluation.dto.EvaluationDtos.EvaluationActionRequest;
import com.nexus.groupware.domain.evaluation.dto.EvaluationDtos.EvaluationConfigResponse;
import com.nexus.groupware.domain.evaluation.dto.EvaluationDtos.EvaluationCreateRequest;
import com.nexus.groupware.domain.evaluation.dto.EvaluationDtos.EvaluationDeleteResponse;
import com.nexus.groupware.domain.evaluation.dto.EvaluationDtos.EvaluationListResponse;
import com.nexus.groupware.domain.evaluation.dto.EvaluationDtos.EvaluationPlanVo;
import com.nexus.groupware.domain.evaluation.dto.EvaluationDtos.EvaluationSummaryVo;
import com.nexus.groupware.domain.evaluation.dto.EvaluationDtos.GoalVo;
import com.nexus.groupware.domain.evaluation.dto.EvaluationDtos.ResultVo;
import com.nexus.groupware.domain.evaluation.dto.EvaluationDtos.ReviewerVo;
import com.nexus.groupware.domain.evaluation.dto.EvaluationDtos.ScoreInputVo;
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
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;
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

    public EvaluationConfigResponse config() {
        return new EvaluationConfigResponse(enabled, "2026-08", 35);
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

    private List<GoalVo> goals(EvaluationPlan p) {
        return read(p.getGoalsJson(), new TypeReference<>() {});
    }

    private List<ResultVo> results(EvaluationPlan p) {
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

    private List<GoalVo> parseGoals(List<GoalVo> rawGoals, boolean complete, String kind) {
        check(rawGoals != null, "목표 항목을 확인하세요.");
        check(!rawGoals.isEmpty() && rawGoals.size() <= 30, "목표는 1~30개로 작성하세요.");

        var out = new ArrayList<GoalVo>();
        Set<String> ids = new HashSet<>();
        BigDecimal weightSum = BigDecimal.ZERO;

        for (GoalVo goal : rawGoals) {
            check(goal != null, "목표 형식 오류");
            String key = text(goal.id(), 80, "목표 ID", true);
            check(ids.add(key), "목표 ID가 중복됩니다.");

            String category = text(goal.category(), 50, "지표 구분", true);
            String title = text(goal.title(), 250, "지표명", true);
            String criterion = text(goal.criterion(), 3000, "개인 목표·달성기준", complete);

            String direction = Objects.toString(goal.direction(), "HIGHER");
            check(Set.of("HIGHER", "LOWER", "MANUAL").contains(direction), "달성 방식 오류");

            BigDecimal target = number(goal.target(), "목표값");
            BigDecimal weight = number(goal.weight(), "배점");
            check(weight.compareTo(BigDecimal.valueOf(100)) <= 0, "항목 배점은 100점 이하여야 합니다.");

            if (complete) {
                check(weight.signum() > 0, "항목 배점을 입력하세요.");
                if ("HIGHER".equals(direction)) {
                    check(target.signum() > 0, "높을수록 좋은 지표의 목표값은 0보다 커야 합니다.");
                }
            }

            String unit = text(goal.unit(), 30, "단위", complete && !"MANUAL".equals(direction));
            weightSum = weightSum.add(weight);
            out.add(new GoalVo(key, category, title, criterion, direction, target, weight, unit));
        }

        check(weightSum.compareTo(BigDecimal.valueOf(100)) <= 0, "배점 합계는 100점 이하여야 합니다.");
        if (complete && "PROJECT".equals(kind)) {
            check(weightSum.compareTo(BigDecimal.valueOf(100)) == 0, "프로젝트 목표 배점 합계를 100점으로 맞추세요.");
        }
        return out;
    }

    private Map<String, BigDecimal> parseMm(Map<String, BigDecimal> raw, LocalDate start, LocalDate end, boolean complete) {
        check(raw != null, "월별 공수를 입력하세요.");
        var out = new TreeMap<String, BigDecimal>();

        for (var e : raw.entrySet()) {
            YearMonth month;
            try {
                month = YearMonth.parse(e.getKey());
            } catch (Exception ex) {
                throw new IllegalArgumentException("월별 공수의 연월을 확인하세요.");
            }
            check(month.getYear() == start.getYear(), "평가 연도와 다른 연도의 공수는 입력할 수 없습니다.");
            BigDecimal n = number(e.getValue(), "월별 공수");
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

    private EvaluationPlanVo toPlanVo(EvaluationPlan p, Employee actor, boolean detail) {
        Employee subject = employee(p.getEmployeeId());
        String projectName = p.getProjectId() == null ? "인재풀" : project(p.getProjectId()).getName();
        String reviewerName = employee(p.getReviewerId()).getName();
        EvaluationState state = EvaluationState.valueOf(p.getState());
        boolean isOwner = p.getEmployeeId().equals(actor.getId());

        Map<String, BigDecimal> plannedMm = mm(p.getPlannedMmJson());
        Map<String, BigDecimal> actualMm = mm(p.getActualMmJson());
        BigDecimal plannedMmTotal = plannedMm.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal actualMmTotal = actualMm.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        Double performancePoints = p.getScore() == null ? null : Math.round(p.getScore() * 35) / 100.0;

        return new EvaluationPlanVo(
                p.getId(),
                p.getVersion(),
                p.getCreatedOn(),
                p.getUpdatedOn(),
                p.getEmployeeId(),
                subject.getName(),
                subject.getEmpNo(),
                p.getProjectId(),
                projectName,
                p.getAssignmentId(),
                p.getReviewerId(),
                reviewerName,
                p.getApprovedBy(),
                p.getKind(),
                p.getState(),
                p.getTitle(),
                p.getStartDate(),
                p.getEndDate(),
                p.getReviewComment(),
                p.getResultComment(),
                p.getApprovedOn(),
                p.getEvaluatedOn(),
                p.getGoalsHash(),
                p.getScore(),
                canReview(p, actor),
                isOwner && state.goalsEditable(),
                isOwner && state.resultsEditable(),
                plannedMmTotal,
                actualMmTotal,
                performancePoints,
                detail ? goals(p) : null,
                detail ? results(p) : null,
                detail ? plannedMm : null,
                detail ? actualMm : null
        );
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

    private AssignmentVo toAssignmentVo(EvaluationAssignment a, int year, List<EvaluationPlan> mine) {
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

        return new AssignmentVo(
                a.getId(),
                p.getId(),
                p.getName(),
                p.getCode() == null ? "" : p.getCode(),
                start.toString(),
                end.toString(),
                a.getEndedOn() != null,
                p.getPmId() == null ? 0L : p.getPmId(),
                p.getPmId() == null || Objects.equals(p.getPmId(), a.getEmployeeId()),
                mine.stream().noneMatch(plan -> Objects.equals(plan.getAssignmentId(), a.getId()) && plan.getStartDate().getYear() == year),
                docNo,
                contractMm,
                totalSyncedMm,
                p.getProgress() == null ? 0 : p.getProgress(),
                p.getStatusCode() == null ? "" : p.getStatusCode()
        );
    }

    // ==========================================
    // 수행평가 목록 및 상세 조회
    // ==========================================

    @Transactional(readOnly = true)
    public EvaluationListResponse list(int year, int page, int size) {
        return list(year, page, size, "", "");
    }

    @Transactional(readOnly = true)
    public EvaluationListResponse list(int year, int page, int size, String query, String state) {
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
        List<AssignmentVo> contexts = assignments.findByEmployeeIdOrderByAssignedOnDescIdDesc(actor.getId()).stream()
                .map(a -> toAssignmentVo(a, year, mine))
                .filter(Objects::nonNull)
                .toList();

        boolean pool = DepartmentCode.DEPT_BIZ.getCode().equals(actor.getDepartmentCode())
                && projects.findAll().stream().noneMatch(p -> active(p) && member(p, actor.getId())
                        && !LocalDate.parse(p.getStartDate()).isAfter(today())
                        && !LocalDate.parse(p.getEndDate()).isBefore(today()));

        List<ReviewerVo> reviewers = employees.findAll().stream()
                .filter(e -> !e.getId().equals(actor.getId()) && pm(e) && StatusCode.fromCodeOrLabel(e.getStatusCode()) == StatusCode.STATUS_ACTIVE)
                .map(e -> new ReviewerVo(e.getId(), e.getName(), executive(e)))
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
                .map(AssignmentVo::syncedTotalMm)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 연간 12 MM 기준 50점 만점 성과점수 산출
        BigDecimal capacityPoints = totalSyncedMm.multiply(BigDecimal.valueOf(50))
                .divide(BigDecimal.valueOf(12), 2, RoundingMode.HALF_UP)
                .min(BigDecimal.valueOf(50));

        EvaluationSummaryVo summary = new EvaluationSummaryVo(
                effort,
                effort.signum() == 0 ? null : weighted.divide(effort, 2, RoundingMode.HALF_UP),
                effort.signum() == 0 ? null : weighted.divide(effort, 6, RoundingMode.HALF_UP).multiply(new BigDecimal("0.35")).setScale(2, RoundingMode.HALF_UP),
                totalSyncedMm,
                capacityPoints
        );

        return new EvaluationListResponse(
                true,
                rows.getContent().stream().map(p -> toPlanVo(p, actor, false)).toList(),
                rows.getTotalElements(),
                contexts,
                pool,
                reviewers,
                summary
        );
    }

    @Transactional(readOnly = true)
    public EvaluationPlanVo detail(Long id) {
        available();
        var p = plans.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "수행평가가 없습니다."));
        Employee actor = auth.current();
        permit(canRead(p, actor));
        return toPlanVo(p, actor, true);
    }

    private void version(EvaluationPlan p, Long expectedVersion) {
        check(expectedVersion != null, "조회 당시 version이 필요합니다.");
        conflict(Objects.equals(p.getVersion(), expectedVersion), "다른 사용자가 변경했습니다. 다시 조회하세요.");
    }

    private void log(EvaluationPlan p, String action, Employee actor) {
        audit.save(new AuditEvent(actor.getId(), "evaluation_plans", action, p.getId(), encode(toPlanVo(p, actor, true))));
    }

    private void applyDraft(
            EvaluationPlan p,
            String title,
            String startDateRaw,
            String endDateRaw,
            List<GoalVo> goalInputs,
            Map<String, BigDecimal> plannedMmInputs,
            boolean complete) {
        p.setTitle(text(title, 250, "제목", true));
        LocalDate start;
        LocalDate end;
        try {
            start = LocalDate.parse(Objects.toString(startDateRaw, ""));
            end = LocalDate.parse(Objects.toString(endDateRaw, ""));
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
        p.setGoalsJson(encode(parseGoals(goalInputs, complete, p.getKind())));
        p.setPlannedMmJson(encode(parseMm(plannedMmInputs, start, end, complete)));
    }

    // ==========================================
    // 수행평가 생성 및 상태 전이 액션
    // ==========================================

    public EvaluationPlanVo create(EvaluationCreateRequest request) {
        available();
        check(request != null, "요청 본문이 필요합니다.");
        Employee actor = auth.current();
        em.lock(actor, LockModeType.PESSIMISTIC_WRITE);

        String kind = Objects.toString(request.kind(), "");
        check(Set.of("PROJECT", "POOL").contains(kind), "작성 종류를 선택하세요.");

        var p = new EvaluationPlan();
        p.setEmployeeId(actor.getId());
        p.setKind(kind);
        p.setState(EvaluationState.DRAFT.name());

        if ("PROJECT".equals(kind)) {
            Long assignmentId = request.assignmentId();
            check(assignmentId != null, "프로젝트 배정을 선택하세요.");
            var a = assignments.findById(assignmentId).orElseThrow(() -> new IllegalArgumentException("배정 이력을 확인하세요."));
            permit(a.getEmployeeId().equals(actor.getId()));
            p.setAssignmentId(a.getId());
            p.setProjectId(a.getProjectId());
        } else {
            check(request.assignmentId() == null, "인재풀은 프로젝트 배정을 선택하지 않습니다.");
            check(list(today().getYear(), 0, 1).poolAvailable(), "인재풀 대기 상태에서 월별 평가를 작성할 수 있습니다.");
        }

        p.setReviewerId(reviewer(p.getProjectId(), actor.getId(), request.reviewerId()));
        applyDraft(p, request.title(), request.startDate(), request.endDate(), request.goals(), request.plannedMm(), false);
        plans.saveAndFlush(p);
        log(p, "create", actor);
        return toPlanVo(p, actor, true);
    }

    private void rejectUnexpectedActionFields(String action, EvaluationActionRequest request) {
        boolean hasGoalFields = request.title() != null || request.startDate() != null
                || request.endDate() != null || request.goals() != null
                || request.plannedMm() != null || request.reviewerId() != null;
        boolean hasResultFields = request.results() != null || request.actualMm() != null;
        boolean hasScoreFields = request.scores() != null;
        boolean hasComment = request.comment() != null;

        boolean allowed = switch (action) {
            case "save_goals" -> !hasResultFields && !hasScoreFields && !hasComment;
            case "submit", "submit_results", "delete_draft" ->
                    !hasGoalFields && !hasResultFields && !hasScoreFields && !hasComment;
            case "request_revision", "approve", "request_result_revision" ->
                    !hasGoalFields && !hasResultFields && !hasScoreFields;
            case "save_results" -> !hasGoalFields && !hasScoreFields && !hasComment;
            case "evaluate" -> !hasGoalFields && !hasResultFields;
            default -> true;
        };
        check(allowed, "이 작업에서 변경할 수 없는 항목이 포함되어 있습니다.");
    }

    public Object action(Long id, String action, EvaluationActionRequest request) {
        available();
        check(request != null, "요청 본문이 필요합니다.");
        var p = plans.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "수행평가가 없습니다."));
        Employee actor = auth.current();
        permit(canRead(p, actor));
        em.lock(employee(p.getEmployeeId()), LockModeType.PESSIMISTIC_WRITE);
        version(p, request.version());
        rejectUnexpectedActionFields(action, request);

        EvaluationState state = EvaluationState.valueOf(p.getState());
        boolean owner = p.getEmployeeId().equals(actor.getId());

        switch (action) {
            case "save_goals" -> {
                permit(owner);
                conflict(state.goalsEditable(), "제출·승인된 목표는 수정할 수 없습니다.");
                Long nextReviewerId = request.reviewerId() != null ? request.reviewerId() : p.getReviewerId();
                p.setReviewerId(reviewer(p.getProjectId(), p.getEmployeeId(), nextReviewerId));
                applyDraft(p, request.title(), request.startDate(), request.endDate(), request.goals(), request.plannedMm(), false);
            }
            case "submit" -> {
                permit(owner);
                conflict(state.goalsEditable(), "제출 가능한 상태가 아닙니다.");
                parseGoals(goals(p), true, p.getKind());
                parseMm(mm(p.getPlannedMmJson()), p.getStartDate(), p.getEndDate(), true);
                p.setReviewerId(reviewer(p.getProjectId(), p.getEmployeeId(), p.getReviewerId()));
                p.setState(EvaluationState.SUBMITTED.name());
            }
            case "request_revision" -> {
                permit(canReview(p, actor));
                conflict(state == EvaluationState.SUBMITTED, "목표 검토 중에만 보완 요청할 수 있습니다.");
                p.setReviewComment(text(request.comment(), 5000, "보완 의견", true));
                p.setState(EvaluationState.REVISION_REQUIRED.name());
            }
            case "approve" -> {
                permit(canReview(p, actor));
                conflict(state == EvaluationState.SUBMITTED, "제출된 목표만 승인할 수 있습니다.");
                p.setReviewComment(text(request.comment(), 5000, "검토 의견", false));
                p.setApprovedBy(actor.getId());
                p.setApprovedOn(Instant.now());
                p.setGoalsHash(hash(p));
                p.setState(EvaluationState.APPROVED.name());
            }
            case "save_results" -> {
                permit(owner);
                conflict(state.resultsEditable(), "승인 후 결과 작성 상태에서만 실적을 수정할 수 있습니다.");
                saveResults(p, request.results(), request.actualMm(), false);
            }
            case "submit_results" -> {
                permit(owner);
                conflict(state.resultsEditable(), "결과 제출 가능한 상태가 아닙니다.");
                saveResults(p, results(p), mm(p.getActualMmJson()), true);
                capacity(p);
                p.setState(EvaluationState.RESULT_SUBMITTED.name());
            }
            case "request_result_revision" -> {
                permit(canReview(p, actor));
                conflict(state == EvaluationState.RESULT_SUBMITTED, "제출된 결과만 보완 요청할 수 있습니다.");
                p.setResultComment(text(request.comment(), 5000, "실적 보완 의견", true));
                p.setState(EvaluationState.RESULT_REVISION_REQUIRED.name());
            }
            case "evaluate" -> {
                permit(canReview(p, actor));
                conflict(state == EvaluationState.RESULT_SUBMITTED, "실적 제출 후 평가를 확정하세요.");
                evaluate(p, request);
                p.setState(EvaluationState.EVALUATED.name());
                p.setEvaluatedOn(Instant.now());
            }
            case "delete_draft" -> {
                permit(owner);
                conflict(state == EvaluationState.DRAFT || state == EvaluationState.REVISION_REQUIRED, "초안만 삭제할 수 있습니다.");
                log(p, "delete_draft", actor);
                plans.delete(p);
                plans.flush();
                return new EvaluationDeleteResponse(true);
            }
            default -> throw new IllegalArgumentException("지원하지 않는 수행평가 작업입니다.");
        }

        if (p.getGoalsHash() != null) {
            conflict(p.getGoalsHash().equals(hash(p)), "승인된 목표의 변경이 감지되었습니다.");
        }

        plans.saveAndFlush(p);
        log(p, action, actor);
        return toPlanVo(p, actor, true);
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

    private void saveResults(
            EvaluationPlan p,
            List<ResultVo> resultInputs,
            Map<String, BigDecimal> actualMmInputs,
            boolean complete) {
        check(resultInputs != null, "실적 항목을 확인하세요.");
        List<GoalVo> planGoals = goals(p);
        Set<String> goalIds = planGoals.stream().map(GoalVo::id).collect(Collectors.toSet());

        var out = new ArrayList<ResultVo>();
        Set<String> seenIds = new HashSet<>();

        for (ResultVo input : resultInputs) {
            check(input != null, "실적 형식 오류");
            String goalId = text(input.goalId(), 80, "목표 ID", true);
            check(goalIds.contains(goalId) && seenIds.add(goalId), "실적의 목표 ID를 확인하세요.");

            GoalVo goal = planGoals.stream().filter(g -> g.id().equals(goalId)).findFirst().orElseThrow();
            if (complete && !"MANUAL".equals(goal.direction())) {
                check(input.actual() != null, "모든 정량 지표의 실적값을 입력하세요.");
            }
            BigDecimal actualValue = input.actual() == null ? null : number(input.actual(), "실적값");
            String evidence = text(input.evidence(), 5000, "실적·증빙 설명", complete);
            out.add(new ResultVo(goalId, actualValue, evidence, null, null));
        }

        if (complete) {
            check(seenIds.equals(goalIds), "모든 목표의 실적과 증빙 설명을 작성하세요.");
        }
        p.setResultsJson(encode(out));
        p.setActualMmJson(encode(parseMm(actualMmInputs, p.getStartDate(), p.getEndDate(), complete)));
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

    private void evaluate(EvaluationPlan p, EvaluationActionRequest request) {
        check(request.scores() != null, "항목별 평가를 입력하세요.");
        Map<String, ScoreInputVo> scoreMap = new HashMap<>();

        for (ScoreInputVo item : request.scores()) {
            check(item != null, "평가점수 형식 오류");
            String goalId = text(item.goalId(), 80, "목표 ID", true);
            check(scoreMap.put(goalId, item) == null, "평가 항목이 중복됩니다.");
        }

        List<ResultVo> currentResults = results(p);
        List<ResultVo> evaluatedResults = new ArrayList<>(currentResults.size());
        BigDecimal sum = BigDecimal.ZERO;
        Set<String> expected = new HashSet<>();

        for (GoalVo goal : goals(p)) {
            String goalId = goal.id();
            expected.add(goalId);
            ScoreInputVo scoreInput = scoreMap.get(goalId);
            check(scoreInput != null, "모든 항목의 평가를 입력하세요.");
            check(scoreInput.score() != null, "평가점수에 숫자를 입력하세요.");

            BigDecimal n = number(scoreInput.score(), "평가점수");
            check(n.compareTo(BigDecimal.valueOf(100)) <= 0, "평가점수는 100점 이하여야 합니다.");

            ResultVo row = currentResults.stream()
                    .filter(r -> r.goalId().equals(goalId))
                    .findFirst()
                    .orElseThrow();
            BigDecimal auto = achievement(goal, number(row.actual(), "실적값"));
            String reason = text(scoreInput.reason(), 3000, "평가 근거", false);

            if (auto == null || auto.subtract(n).abs().compareTo(new BigDecimal("0.01")) > 0) {
                check(!reason.isBlank(), "수동 점수 또는 달성률과 다른 점수에는 평가 근거가 필요합니다.");
            }

            evaluatedResults.add(row.withEvaluation(n, reason));
            sum = sum.add(n.multiply(number(goal.weight(), "배점")).divide(BigDecimal.valueOf(100)));
        }

        check(scoreMap.keySet().equals(expected), "평가 항목 ID를 확인하세요.");
        p.setScore(sum.setScale(2, RoundingMode.HALF_UP).doubleValue());
        p.setResultsJson(encode(evaluatedResults));
        p.setResultComment(text(request.comment(), 5000, "종합 평가 의견", true));
    }

    private BigDecimal achievement(GoalVo goal, BigDecimal actual) {
        BigDecimal target = number(goal.target(), "목표값");
        String direction = goal.direction();
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
