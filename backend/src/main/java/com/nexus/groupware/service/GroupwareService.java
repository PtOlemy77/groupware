package com.nexus.groupware.service;

import com.nexus.groupware.code.DepartmentCode;
import com.nexus.groupware.code.PositionCode;
import com.nexus.groupware.entity.*;
import com.nexus.groupware.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class GroupwareService {

    public static final String COMPANY_EMAIL_DOMAIN = "@spatialt.co.kr";

    private final EmployeeRepository employeeRepository;
    private final ProjectRepository projectRepository;
    private final EquipmentRepository equipmentRepository;
    private final BusinessDealRepository businessDealRepository;
    private final EvaluationRepository evaluationRepository;
    private final ApprovalRepository approvalRepository;
    private final CommonCodeRepository commonCodeRepository;

    public GroupwareService(EmployeeRepository employeeRepository,
                            ProjectRepository projectRepository,
                            EquipmentRepository equipmentRepository,
                            BusinessDealRepository businessDealRepository,
                            EvaluationRepository evaluationRepository,
                            ApprovalRepository approvalRepository,
                            CommonCodeRepository commonCodeRepository) {
        this.employeeRepository = employeeRepository;
        this.projectRepository = projectRepository;
        this.equipmentRepository = equipmentRepository;
        this.businessDealRepository = businessDealRepository;
        this.evaluationRepository = evaluationRepository;
        this.approvalRepository = approvalRepository;
        this.commonCodeRepository = commonCodeRepository;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getAllData() {
        Map<String, Object> result = new HashMap<>();
        List<Employee> employees = employeeRepository.findAllByOrderByIdDesc();
        employees.forEach(e -> {
            if (e.getDepartment() != null && e.getDepartment().endsWith("ST")) {
                e.setDepartment(e.getDepartment().replace("ST", ""));
            }
        });
        result.put("employees", employees);

        List<Project> projects = projectRepository.findAllByOrderByIdDesc();
        projects.forEach(p -> {
            if (p.getDepartment() != null && p.getDepartment().endsWith("ST")) {
                p.setDepartment(p.getDepartment().replace("ST", ""));
            }
        });
        result.put("projects", projects);

        List<Equipment> equipments = equipmentRepository.findAllByOrderByIdDesc();
        equipments.forEach(eq -> {
            if (eq.getDepartment() != null && eq.getDepartment().endsWith("ST")) {
                eq.setDepartment(eq.getDepartment().replace("ST", ""));
            }
        });
        result.put("equipments", equipments);
        result.put("business_deals", businessDealRepository.findAllByOrderByIdDesc());
        result.put("evaluations", evaluationRepository.findAllByOrderByTotalScoreDescIdDesc());
        result.put("approvals", approvalRepository.findAllByOrderByIdDesc());
        result.put("common_codes", commonCodeRepository.findAllByOrderByGroupCodeAscSortOrderAsc());
        result.put("department_codes", DepartmentCode.toList());
        result.put("position_codes", PositionCode.toList());
        result.put("company_info", Map.of(
                "name_ko", "(주)스패셜티",
                "name_en", "SpatialT",
                "ceo", "권우석 사장",
                "domain", "spatialt.co.kr",
                "website", "http://www.spatialt.co.kr/"
        ));
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> authenticate(String identifier, String password) {
        String idClean = identifier != null ? identifier.trim() : "";
        if (idClean.isEmpty()) {
            return Map.of("ok", false, "message", "아이디를 입력해주세요.");
        }

        // 도메인 주소를 뺀 앞자리 아이디 추출 (예: 'kiwoo@spatialt.co.kr' -> 'kiwoo')
        String username = idClean.contains("@") ? idClean.substring(0, idClean.indexOf('@')).trim() : idClean;
        String fullEmail = username + COMPANY_EMAIL_DOMAIN;
        List<Employee> all = employeeRepository.findAll();

        Optional<Employee> matched = all.stream()
                .filter(e -> {
                    String empEmail = e.getEmail() != null ? e.getEmail().trim() : "";
                    String empPrefix = empEmail.contains("@") ? empEmail.substring(0, empEmail.indexOf('@')).trim() : empEmail;
                    return empPrefix.equalsIgnoreCase(username)
                            || empEmail.equalsIgnoreCase(fullEmail)
                            || empEmail.equalsIgnoreCase(idClean)
                            || (e.getEmpNo() != null && e.getEmpNo().equalsIgnoreCase(idClean))
                            || (e.getName() != null && e.getName().equalsIgnoreCase(idClean));
                })
                .findFirst();

        if (matched.isEmpty()) {
            return Map.of("ok", false, "message", "등록되지 않은 사용자 아이디입니다. (사내 이메일 도메인을 뺀 앞자리 아이디 입력)");
        }

        Employee emp = matched.get();
        String storedPw = emp.getPassword() != null && !emp.getPassword().isBlank() ? emp.getPassword().trim() : "1234";
        String inputPw = password != null ? password.trim() : "";

        // 초기 비밀번호 1234 및 저장된 비밀번호 일치 여부 검증
        boolean matches = "1234".equals(inputPw) || storedPw.equals(inputPw);
        if (!matches) {
            return Map.of("ok", false, "message", "비밀번호가 일치하지 않습니다. (초기 비밀번호: 1234)");
        }

        return Map.of(
            "ok", true,
            "user", emp,
            "role", emp.getRole() != null ? emp.getRole() : "일반직원"
        );
    }

    @Transactional
    @SuppressWarnings("unchecked")
    public void processMutation(Map<String, Object> payload) {
        String module = (String) payload.get("module");
        String action = (String) payload.get("action");
        Number idNum = (Number) payload.get("id");
        Long id = idNum != null ? idNum.longValue() : null;
        Map<String, Object> data = (Map<String, Object>) payload.get("data");

        if ("delete".equals(action) && id != null) {
            switch (module) {
                case "employees" -> employeeRepository.deleteById(id);
                case "projects" -> projectRepository.deleteById(id);
                case "equipments" -> equipmentRepository.deleteById(id);
                case "business_deals" -> businessDealRepository.deleteById(id);
                case "evaluations" -> evaluationRepository.deleteById(id);
                case "approvals" -> approvalRepository.deleteById(id);
                case "common_codes" -> commonCodeRepository.deleteById(id);
            }
            return;
        }

        if (data == null) return;

        switch (module) {
            case "common_codes" -> {
                CommonCode cc = ("update".equals(action) && id != null)
                        ? commonCodeRepository.findById(id).orElse(new CommonCode())
                        : new CommonCode();
                cc.setGroupCode(str(data, "group_code", ""));
                cc.setGroupName(str(data, "group_name", ""));
                cc.setCode(str(data, "code", ""));
                cc.setCodeName(str(data, "code_name", ""));
                cc.setSortOrder(integer(data, "sort_order", 0));
                cc.setIsActive(bool(data, "is_active", true));
                cc.setExtraValue(str(data, "extra_value", ""));
                commonCodeRepository.save(cc);
            }
            case "employees" -> {
                Employee emp = ("update".equals(action) && id != null)
                        ? employeeRepository.findById(id).orElse(new Employee())
                        : new Employee();
                if (emp.getId() == null) {
                    emp.setEmpNo(str(data, "emp_no", "ST-" + ThreadLocalRandom.current().nextInt(202610, 202999)));
                } else if (data.get("emp_no") != null) {
                    emp.setEmpNo(str(data, "emp_no", emp.getEmpNo()));
                }

                String deptInput = str(data, "department_code", str(data, "department", "DEPT_RND"));
                DepartmentCode deptCode = DepartmentCode.fromCodeOrLabel(deptInput);

                String posInput = str(data, "position_code", str(data, "position", "POS_STAFF"));
                PositionCode posCode = PositionCode.fromCodeOrLabel(posInput);

                emp.setName(str(data, "name", ""));
                emp.setDepartmentCode(deptCode.getCode());
                emp.setDepartment(deptCode.getLabel());
                emp.setPositionCode(posCode.getCode());
                emp.setPosition(posCode.getLabel());
                emp.setEmail(normalizeSpatialtEmail(str(data, "email", "user")));
                emp.setPhone(str(data, "phone", ""));
                emp.setHireDate(str(data, "hire_date", "2026-10-29"));
                emp.setStatus(str(data, "status", "재직"));
                emp.setLeaveRemaining(dbl(data, "leave_remaining", 15.0));
                emp.setLeaveTotal(dbl(data, "leave_total", 15.0));
                emp.setSkills(str(data, "skills", ""));
                emp.setAvatarColor(str(data, "avatar_color", "indigo"));
                emp.setRole(str(data, "role", emp.getRole() != null ? emp.getRole() : "일반직원"));
                if (data.get("password") != null && !data.get("password").toString().isBlank()) {
                    emp.setPassword(data.get("password").toString().trim());
                }
                employeeRepository.save(emp);
            }
            case "projects" -> {
                Project prj = ("update".equals(action) && id != null)
                        ? projectRepository.findById(id).orElse(new Project())
                        : new Project();
                if (prj.getId() == null) {
                    prj.setCode(str(data, "code", "PRJ-2026-" + ThreadLocalRandom.current().nextInt(10, 99)));
                }
                DepartmentCode deptCode = DepartmentCode.fromCodeOrLabel(str(data, "department", "기술연구소ST"));
                prj.setName(str(data, "name", ""));
                prj.setDepartment(deptCode.getLabel());
                prj.setPmName(str(data, "pm_name", ""));
                prj.setStartDate(str(data, "start_date", "2026-10-29"));
                prj.setEndDate(str(data, "end_date", "2027-03-31"));
                prj.setStatus(str(data, "status", "진행중"));
                prj.setProgress(integer(data, "progress", 0));
                prj.setBudget(integer(data, "budget", 0));
                double shareRate = dbl(data, "share_rate", 100.0);
                prj.setShareRate(shareRate);
                int calculatedOurBudget = (int) Math.round(prj.getBudget() * (shareRate / 100.0));
                prj.setOurBudget(integer(data, "our_budget", calculatedOurBudget));
                prj.setIsConsortium(bool(data, "is_consortium", shareRate < 100.0));
                prj.setConsortiumPartners(str(data, "consortium_partners", ""));
                prj.setMembers(str(data, "members", ""));
                prj.setPriority(str(data, "priority", "보통"));
                prj.setDescription(str(data, "description", ""));
                projectRepository.save(prj);
            }
            case "equipments" -> {
                Equipment eq = ("update".equals(action) && id != null)
                        ? equipmentRepository.findById(id).orElse(new Equipment())
                        : new Equipment();
                if (eq.getId() == null) {
                    eq.setAssetNo(str(data, "asset_no", "ST-AST-" + ThreadLocalRandom.current().nextInt(100, 999)));
                }
                eq.setCategory(str(data, "category", "노트북"));
                eq.setModelName(str(data, "model_name", ""));
                eq.setSerialNo(str(data, "serial_no", ""));
                eq.setStatus(str(data, "status", "사용중"));
                eq.setPurchaseDate(str(data, "purchase_date", "2026-10-29"));
                eq.setPrice(integer(data, "price", 0));
                eq.setNotes(str(data, "notes", ""));

                // 직원 PK / 사번 바탕의 엄격한 정합성 체크
                Long empIdInput = null;
                if (data.get("emp_id") instanceof Number n) {
                    empIdInput = n.longValue();
                }
                String empNoInput = str(data, "emp_no", "");
                String assignedInput = str(data, "assigned_to", "미배정").trim();

                Employee matchedEmp = null;
                if (empIdInput != null) {
                    matchedEmp = employeeRepository.findById(empIdInput).orElse(null);
                }
                if (matchedEmp == null && !empNoInput.isBlank()) {
                    matchedEmp = employeeRepository.findByEmpNo(empNoInput).orElse(null);
                }
                if (matchedEmp == null && !assignedInput.isBlank() && !"미배정".equals(assignedInput)) {
                    matchedEmp = employeeRepository.findByName(assignedInput).orElse(null);
                }

                if (matchedEmp != null) {
                    eq.setEmpId(matchedEmp.getId());
                    eq.setEmpNo(matchedEmp.getEmpNo());
                    eq.setAssignedTo(matchedEmp.getName());
                    eq.setDepartment(matchedEmp.getDepartment());
                } else {
                    eq.setEmpId(null);
                    eq.setEmpNo(null);
                    eq.setAssignedTo("미배정");
                    DepartmentCode deptCode = DepartmentCode.fromCodeOrLabel(str(data, "department", "경영지원팀"));
                    eq.setDepartment(deptCode.getLabel());
                }

                equipmentRepository.save(eq);
            }
            case "business_deals" -> {
                BusinessDeal deal = ("update".equals(action) && id != null)
                        ? businessDealRepository.findById(id).orElse(new BusinessDeal())
                        : new BusinessDeal();
                deal.setTitle(str(data, "title", ""));
                deal.setClientName(str(data, "client_name", ""));
                deal.setOwnerName(str(data, "owner_name", ""));
                deal.setStage(str(data, "stage", "제안"));
                deal.setAmount(integer(data, "amount", 0));
                deal.setProbability(integer(data, "probability", 50));
                deal.setCloseDate(str(data, "close_date", "2026-12-31"));
                deal.setDealType(str(data, "deal_type", "신규구축"));
                deal.setNotes(str(data, "notes", ""));
                businessDealRepository.save(deal);
            }
            case "evaluations" -> {
                Evaluation ev = ("update".equals(action) && id != null)
                        ? evaluationRepository.findById(id).orElse(new Evaluation())
                        : new Evaluation();
                int kpi = integer(data, "kpi_score", 85);
                int comp = integer(data, "competency_score", 85);
                int peer = integer(data, "peer_score", 85);
                double total = Math.round((kpi * 0.5 + comp * 0.3 + peer * 0.2) * 10.0) / 10.0;
                String autoGrade = total >= 93 ? "S" : total >= 87 ? "A" : total >= 78 ? "B" : total >= 68 ? "C" : "D";

                DepartmentCode deptCode = DepartmentCode.fromCodeOrLabel(
                        str(data, "department_code", str(data, "department", "DEPT_RND"))
                );
                PositionCode posCode = PositionCode.fromCodeOrLabel(
                        str(data, "position_code", str(data, "position", "POS_STAFF"))
                );

                ev.setEmpNo(str(data, "emp_no", "ST-202699"));
                ev.setEmpName(str(data, "emp_name", ""));
                ev.setDepartmentCode(deptCode.getCode());
                ev.setDepartment(deptCode.getLabel());
                ev.setPositionCode(posCode.getCode());
                ev.setPosition(posCode.getLabel());
                ev.setPeriod(str(data, "period", "2026 하반기"));
                ev.setKpiScore(kpi);
                ev.setCompetencyScore(comp);
                ev.setPeerScore(peer);
                ev.setTotalScore(total);
                ev.setGrade(autoGrade);
                ev.setReviewer(str(data, "reviewer", "권우석"));
                ev.setStatus(str(data, "status", "평가완료"));
                ev.setFeedback(str(data, "feedback", ""));
                evaluationRepository.save(ev);
            }
            case "approvals" -> {
                Approval ap = ("update".equals(action) && id != null)
                        ? approvalRepository.findById(id).orElse(new Approval())
                        : new Approval();
                if (ap.getId() == null) {
                    ap.setDocNo(str(data, "doc_no", "ST-품의-2026-" + ThreadLocalRandom.current().nextInt(100, 999)));
                } else if (data.get("doc_no") != null) {
                    ap.setDocNo(str(data, "doc_no", ap.getDocNo()));
                }
                DepartmentCode deptCode = DepartmentCode.fromCodeOrLabel(str(data, "department", ap.getDepartment() != null ? ap.getDepartment() : "기술연구소ST"));
                ap.setCategory(str(data, "category", ap.getCategory() != null ? ap.getCategory() : "구매품의서"));
                ap.setTitle(str(data, "title", ap.getTitle() != null ? ap.getTitle() : ""));
                ap.setRequester(str(data, "requester", ap.getRequester() != null ? ap.getRequester() : ""));
                ap.setRequesterPosition(str(data, "requester_position", ap.getRequesterPosition() != null ? ap.getRequesterPosition() : "담당"));
                ap.setDepartment(deptCode.getLabel());
                ap.setCreatedAt(str(data, "created_at", ap.getCreatedAt() != null ? ap.getCreatedAt() : "2026-10-29"));
                ap.setAmount(integer(data, "amount", ap.getAmount() != null ? ap.getAmount() : 0));
                ap.setProjectName(str(data, "project_name", ap.getProjectName() != null ? ap.getProjectName() : ""));
                ap.setVendor(str(data, "vendor", ap.getVendor() != null ? ap.getVendor() : ""));
                ap.setPaymentMethod(str(data, "payment_method", ap.getPaymentMethod() != null ? ap.getPaymentMethod() : "세금계산서(계좌이체)"));
                ap.setPurpose(str(data, "purpose", ap.getPurpose() != null ? ap.getPurpose() : ""));
                ap.setItemsJson(str(data, "items_json", ap.getItemsJson() != null ? ap.getItemsJson() : "[]"));
                ap.setReviewerComment(str(data, "reviewer_comment", ap.getReviewerComment() != null ? ap.getReviewerComment() : ""));
                ap.setApprovedBy(str(data, "approved_by", ap.getApprovedBy() != null ? ap.getApprovedBy() : ""));
                ap.setStatus(str(data, "status", ap.getStatus() != null ? ap.getStatus() : "결재대기"));
                approvalRepository.save(ap);
            }
        }
    }

    private String normalizeSpatialtEmail(String raw) {
        if (raw == null || raw.isBlank()) {
            return "user" + COMPANY_EMAIL_DOMAIN;
        }
        String trimmed = raw.trim();
        int atIdx = trimmed.indexOf('@');
        String localPart = atIdx >= 0 ? trimmed.substring(0, atIdx).trim() : trimmed;
        if (localPart.isEmpty()) {
            localPart = "user";
        }
        return localPart + COMPANY_EMAIL_DOMAIN;
    }

    private String str(Map<String, Object> map, String key, String defaultVal) {
        Object val = map.get(key);
        return val != null && !val.toString().isBlank() ? val.toString() : defaultVal;
    }

    private Integer integer(Map<String, Object> map, String key, Integer defaultVal) {
        Object val = map.get(key);
        if (val instanceof Number n) return n.intValue();
        if (val != null) {
            try { return Integer.parseInt(val.toString()); } catch (NumberFormatException ignored) {}
        }
        return defaultVal;
    }

    private Double dbl(Map<String, Object> map, String key, Double defaultVal) {
        Object val = map.get(key);
        if (val instanceof Number n) return n.doubleValue();
        if (val != null) {
            try { return Double.parseDouble(val.toString()); } catch (NumberFormatException ignored) {}
        }
        return defaultVal;
    }

    private Boolean bool(Map<String, Object> map, String key, Boolean defaultVal) {
        Object val = map.get(key);
        if (val instanceof Boolean b) return b;
        if (val != null) {
            return "true".equalsIgnoreCase(val.toString().trim());
        }
        return defaultVal;
    }
}
