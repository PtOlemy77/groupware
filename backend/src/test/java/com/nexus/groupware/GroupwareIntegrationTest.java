package com.nexus.groupware;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.*;
import com.nexus.groupware.config.DataInitializer;
import com.nexus.groupware.entity.*;
import com.nexus.groupware.repository.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class GroupwareIntegrationTest {
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper mapper;
  @Autowired PasswordEncoder passwords;
  @Autowired EmployeeRepository employees;
  @Autowired ProjectRepository projects;
  @Autowired ApprovalRepository approvals;
  @Autowired EquipmentRepository equipment;
  @Autowired EvaluationRepository evaluations;
  @Autowired BusinessDealRepository deals;
  @Autowired CommonCodeRepository codes;
  @Autowired AuditEventRepository audit;
  @Autowired DataInitializer initializer;
  Employee admin, exec, pm, staff;
  static final String PW = "Review-password-2026!";

  @BeforeEach
  void setup() {
    audit.deleteAll();
    approvals.deleteAll();
    equipment.deleteAll();
    evaluations.deleteAll();
    deals.deleteAll();
    projects.deleteAll();
    codes.deleteAll();
    employees.deleteAll();
    admin = person("admin", "시스템 관리자");
    exec = person("exec", "임원 권한");
    pm = person("pm", "PM 권한");
    staff = person("staff", "일반직원");
  }

  Employee person(String name, String role) {
    Employee e = new Employee();
    e.setName(name);
    e.setEmpNo(UUID.randomUUID().toString());
    e.setEmail(name + "@spatialt.co.kr");
    e.setPhone("010-0000-0000");
    e.setHireDate("2026-01-01");
    e.setDepartment("사업본부");
    e.setDepartmentCode("DEPT_BIZ");
    e.setPosition("과장");
    e.setPositionCode("POS_MGR");
    e.setRole(role);
    e.setAccountEnabled(true);
    e.setPasswordChangeRequired(false);
    e.setPassword(passwords.encode(PW));
    return employees.saveAndFlush(e);
  }

  MockHttpSession login(Employee e) throws Exception {
    return (MockHttpSession)
        mvc.perform(
                post("/api/auth/login")
                    .with(csrf())
                    .contentType("application/json")
                    .content(
                        mapper.writeValueAsString(
                            Map.of("identifier", e.getEmail(), "password", PW))))
            .andExpect(status().isOk())
            .andReturn()
            .getRequest()
            .getSession(false);
  }

  ResultActions mutate(MockHttpSession session, Map<String, Object> payload) throws Exception {
    return mvc.perform(
        post("/api/groupware")
            .session(session)
            .with(csrf())
            .contentType("application/json")
            .content(mapper.writeValueAsString(payload)));
  }

  Map<String, Object> projectData() {
    return new HashMap<>(
        Map.of(
            "name",
            "Review project",
            "department",
            "DEPT_BIZ",
            "pm_id",
            pm.getId(),
            "start_date",
            "2027-01-01",
            "end_date",
            "2027-12-31",
            "budget",
            1000,
            "share_rate",
            50,
            "status",
            "프로젝트 수행",
            "progress",
            0));
  }

  JsonNode createProject(MockHttpSession session) throws Exception {
    return mapper
        .readTree(
            mutate(session, Map.of("module", "projects", "action", "create", "data", projectData()))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString())
        .get("record");
  }

  Map<String, Object> contractDoc() {
    return new HashMap<>(
        Map.ofEntries(
            Map.entry("title", "Review contract"),
            Map.entry("clientName", "Review client"),
            Map.entry("startDate", "2027-01-01"),
            Map.entry("endDate", "2027-12-31"),
            Map.entry("supplyAmount", 5000),
            Map.entry("ourShareRate", 50),
            Map.entry("productCosts", List.of()),
            Map.entry("manpowerPlans", List.of()),
            Map.entry("outsourcings", List.of()),
            Map.entry("directExpenses", List.of()),
            Map.entry("cashflowMilestones", List.of()),
            Map.entry("contingencyRate", 0)));
  }

  @Test
  void anonymousAndCsrfBoundaries() throws Exception {
    mvc.perform(get("/api/groupware")).andExpect(status().isUnauthorized());
    mvc.perform(post("/api/groupware").contentType("application/json").content("{}"))
        .andExpect(status().isForbidden());
    mvc.perform(
            post("/api/groupware")
                .session(login(admin))
                .contentType("application/json")
                .content("{}"))
        .andExpect(status().isForbidden());
    mvc.perform(get("/api/auth/csrf"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.token").isNotEmpty());
  }

  @Test
  void passwordBypassAndHashLoginAreRejected() throws Exception {
    for (String candidate : List.of("1234", pm.getPassword()))
      mvc.perform(
              post("/api/auth/login")
                  .with(csrf())
                  .contentType("application/json")
                  .content(
                      mapper.writeValueAsString(
                          Map.of("identifier", pm.getEmail(), "password", candidate))))
          .andExpect(status().isUnauthorized());
    mvc.perform(get("/api/auth/me").session(login(pm)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.user.password").doesNotExist())
        .andExpect(jsonPath("$.user.session_version").doesNotExist());
  }

  @Test
  void logoutAndDisabledAccountsInvalidateSession() throws Exception {
    var s = login(pm);
    pm.setStatus("퇴사");
    employees.saveAndFlush(pm);
    mvc.perform(get("/api/groupware").session(s)).andExpect(status().isUnauthorized());
    var other = login(admin);
    mvc.perform(post("/api/auth/logout").session(other).with(csrf())).andExpect(status().isOk());
    assertThat(other.isInvalid()).isTrue();
  }

  @Test
  void firstLoginRequiresPasswordChangeAndOldPasswordStopsWorking() throws Exception {
    pm.setPasswordChangeRequired(true);
    employees.saveAndFlush(pm);
    var s = login(pm);
    mvc.perform(get("/api/groupware").session(s)).andExpect(status().isForbidden());
    mvc.perform(
            post("/api/auth/password")
                .session(s)
                .with(csrf())
                .contentType("application/json")
                .content(
                    mapper.writeValueAsString(
                        Map.of("current_password", PW, "new_password", "Replacement-password!"))))
        .andExpect(status().isOk());
    mvc.perform(get("/api/groupware").session(s)).andExpect(status().isOk());
    mvc.perform(
            post("/api/auth/login")
                .with(csrf())
                .contentType("application/json")
                .content(
                    mapper.writeValueAsString(Map.of("identifier", pm.getEmail(), "password", PW))))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void roleChecksAndEmployeePrivacy() throws Exception {
    var s = login(staff);
    mutate(
            s,
            Map.of(
                "module",
                "employees",
                "action",
                "update",
                "id",
                staff.getId(),
                "version",
                staff.getVersion(),
                "data",
                Map.of("role", "시스템 관리자")))
        .andExpect(status().isForbidden());
    mutate(s, Map.of("module", "projects", "action", "create", "data", projectData()))
        .andExpect(status().isForbidden());
    String body =
        mvc.perform(get("/api/groupware").session(s))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    var tree = mapper.readTree(body);
    for (var e : tree.get("employees")) {
      assertThat(e.has("password")).isFalse();
      if (e.get("id").asLong() != staff.getId()) assertThat(e.has("phone")).isFalse();
    }
  }

  @Test
  void patchPreservesFieldsAndMissingIdIs404() throws Exception {
    var s = login(admin);
    mutate(
            s,
            Map.of(
                "module",
                "employees",
                "action",
                "update",
                "id",
                staff.getId(),
                "version",
                staff.getVersion(),
                "data",
                Map.of("phone", "010-1111-2222")))
        .andExpect(status().isOk());
    var e = employees.findById(staff.getId()).orElseThrow();
    assertThat(e.getName()).isEqualTo("staff");
    assertThat(e.getHireDate()).isEqualTo("2026-01-01");
    assertThat(e.getPhone()).isEqualTo("010-1111-2222");
    mutate(
            s,
            Map.of(
                "module",
                "projects",
                "action",
                "update",
                "id",
                999999,
                "version",
                0,
                "data",
                Map.of("name", "missing")))
        .andExpect(status().isNotFound());
    assertThat(projects.count()).isZero();
  }

  @Test
  void strictInputValidationAndVersions() throws Exception {
    var s = login(pm);
    var invalid = projectData();
    invalid.put("progress", 999);
    mutate(s, Map.of("module", "projects", "action", "create", "data", invalid))
        .andExpect(status().isBadRequest());
    invalid = projectData();
    invalid.put("budget", 1.5);
    mutate(s, Map.of("module", "projects", "action", "create", "data", invalid))
        .andExpect(status().isBadRequest());
    invalid = projectData();
    invalid.put("end_date", "2026-01-01");
    mutate(s, Map.of("module", "projects", "action", "create", "data", invalid))
        .andExpect(status().isBadRequest());
    var p = createProject(s);
    long id = p.get("id").asLong(), v = p.get("version").asLong();
    mutate(
            s,
            Map.of(
                "module",
                "projects",
                "action",
                "update",
                "id",
                id,
                "version",
                v,
                "data",
                Map.of("progress", 10)))
        .andExpect(status().isOk());
    mutate(
            s,
            Map.of(
                "module",
                "projects",
                "action",
                "update",
                "id",
                id,
                "version",
                v,
                "data",
                Map.of("progress", 20)))
        .andExpect(status().isConflict());
    assertThat(projects.findById(id).orElseThrow().getProgress()).isEqualTo(10);
  }

  @Test
  void annualRevenuePersistsAndTotalIsValidated() throws Exception {
    var s = login(pm);
    var data = projectData();
    data.put("yearly_revenue_json", "{\"2027\":1000}");
    var body =
        mutate(s, Map.of("module", "projects", "action", "create", "data", data))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    assertThat(mapper.readTree(body).at("/record/yearly_revenue_json").asText()).contains("2027");
    data.put("yearly_revenue_json", "{\"2027\":900}");
    mutate(s, Map.of("module", "projects", "action", "create", "data", data))
        .andExpect(status().isBadRequest());
  }

  @Test
  void contractKeepsTotalAndShareAndCannotForgeApproval() throws Exception {
    var s = login(pm);
    var p = createProject(s);
    var doc = contractDoc();
    doc.put("linkedProjectId", p.get("id").asLong());
    var response =
        mutate(
                s,
                Map.of(
                    "module",
                    "approvals",
                    "action",
                    "save_contract",
                    "sync_project",
                    true,
                    "project_version",
                    p.get("version").asLong(),
                    "data",
                    Map.of(
                        "title",
                        "Review contract",
                        "project_id",
                        p.get("id").asLong(),
                        "approver_id",
                        exec.getId(),
                        "status",
                        "승인완료",
                        "approved_by",
                        "forged",
                        "items_json",
                        mapper.writeValueAsString(doc))))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    JsonNode a = mapper.readTree(response).get("record");
    assertThat(a.get("status").asText()).isEqualTo("작성중");
    assertThat(a.get("approved_by").asText()).isEmpty();
    Project stored = projects.findById(p.get("id").asLong()).orElseThrow();
    assertThat(stored.getBudget()).isEqualTo(1000);
    assertThat(stored.getOurBudget()).isEqualTo(500);
    mutate(
            s,
            Map.of(
                "module",
                "approvals",
                "action",
                "submit",
                "id",
                a.get("id").asLong(),
                "version",
                a.get("version").asLong()))
        .andExpect(status().isOk());
    Approval submitted = approvals.findById(a.get("id").asLong()).orElseThrow();
    mutate(
            s,
            Map.of(
                "module",
                "approvals",
                "action",
                "approve",
                "id",
                submitted.getId(),
                "version",
                submitted.getVersion()))
        .andExpect(status().isForbidden());
    mutate(
            login(exec),
            Map.of(
                "module",
                "approvals",
                "action",
                "approve",
                "id",
                submitted.getId(),
                "version",
                submitted.getVersion()))
        .andExpect(status().isOk());
    var approved = approvals.findById(submitted.getId()).orElseThrow();
    mutate(
            s,
            Map.of(
                "module",
                "approvals",
                "action",
                "update",
                "id",
                approved.getId(),
                "version",
                approved.getVersion(),
                "data",
                Map.of("title", "tamper")))
        .andExpect(status().isBadRequest());
    assertThat(audit.count()).isGreaterThanOrEqualTo(4);
  }

  @Test
  void contractFailureRollsBackLinkedProject() throws Exception {
    var s = login(pm);
    var doc = contractDoc();
    doc.put("title", "x".repeat(300));
    mutate(
            s,
            Map.of(
                "module",
                "approvals",
                "action",
                "save_contract",
                "sync_project",
                true,
                "data",
                Map.of("title", "x".repeat(300), "items_json", mapper.writeValueAsString(doc))))
        .andExpect(status().isConflict());
    assertThat(projects.count()).isZero();
    assertThat(approvals.count()).isZero();
    assertThat(audit.count()).isZero();
  }

  @Test
  void initializerPreservesAllExistingCredentialsAndBusinessRows() throws Exception {
    var s = login(pm);
    createProject(s);
    staff.setPassword("1234");
    staff.setAccountEnabled(true);
    employees.saveAndFlush(staff);
    long count = employees.count();
    Long oldVersion = employees.findById(staff.getId()).orElseThrow().getVersion();
    initializer.run();
    initializer.run();
    assertThat(employees.count()).isEqualTo(count);
    assertThat(projects.count()).isEqualTo(1);
    var migrated = employees.findById(staff.getId()).orElseThrow();
    assertThat(migrated.getPassword()).isEqualTo("1234");
    assertThat(migrated.getAccountEnabled()).isTrue();
    assertThat(migrated.getVersion()).isEqualTo(oldVersion);
    assertThat(migrated.getRoleCode()).isEqualTo(staff.getRoleCode());
  }

  @Test
  void freshBootstrapRequiresPasswordChangeAndNeverResetsAnExistingAccount() {
    employees.deleteAll();
    var isolated = new DataInitializer(employees, passwords);
    org.springframework.test.util.ReflectionTestUtils.setField(isolated, "email", "fresh@spatialt.co.kr");
    org.springframework.test.util.ReflectionTestUtils.setField(isolated, "password", PW);
    isolated.run();
    var created = employees.findByEmailIgnoreCase("fresh@spatialt.co.kr").orElseThrow();
    assertThat(created.getPasswordChangeRequired()).isTrue();
    assertThat(created.getRoleCode()).isEqualTo("ROLE_ADMIN");
    assertThat(passwords.matches(PW, created.getPassword())).isTrue();
    String hash = created.getPassword();
    org.springframework.test.util.ReflectionTestUtils.setField(isolated, "password", "Different-password-2026!");
    isolated.run();
    assertThat(employees.count()).isEqualTo(1);
    assertThat(employees.findById(created.getId()).orElseThrow().getPassword()).isEqualTo(hash);
  }

  @Test
  void missingVersionsRejectUpdateAndDeleteWithoutChangingBusinessData() throws Exception {
    var session = login(admin);
    var project = createProject(session);
    Long id = project.get("id").asLong();
    mutate(session, Map.of("module", "projects", "action", "update", "id", id,
        "data", Map.of("name", "Must not overwrite"))).andExpect(status().isBadRequest());
    mutate(session, Map.of("module", "projects", "action", "delete", "id", id))
        .andExpect(status().isBadRequest());
    assertThat(projects.findById(id).orElseThrow().getName()).isEqualTo("Review project");
    assertThat(projects.findById(id).orElseThrow().getVersion()).isEqualTo(project.get("version").asLong());
  }

  @Test
  void sessionLimitAndCredentialVersionAreEnforced() throws Exception {
    var first = login(pm);
    login(pm);
    login(pm);
    login(pm);
    assertThat(first.isInvalid()).isTrue();
    var session = login(staff);
    var adminSession = login(admin);
    mutate(
            adminSession,
            Map.of(
                "module",
                "employees",
                "action",
                "update",
                "id",
                staff.getId(),
                "version",
                staff.getVersion(),
                "data",
                Map.of("role", "PM 권한")))
        .andExpect(status().isOk());
    mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isUnauthorized());
  }

  @Test
  void masterDataIsSharedAndVersioned() throws Exception {
    var s = login(admin);
    String prices =
        "{\"2027\":[{\"id\":\"rate-1\",\"position\":\"과장\",\"monthlyPrice\":12345,\"dailyPrice\":590670}]}";
    mutate(
            s,
            Map.of(
                "module",
                "common_codes",
                "action",
                "create",
                "data",
                Map.of(
                    "group_code",
                    "MASTER_PRICES",
                    "group_name",
                    "노임단가",
                    "code",
                    "DATA",
                    "code_name",
                    "기준정보",
                    "extra_value",
                    prices)))
        .andExpect(status().isOk());
    var response =
        mvc.perform(get("/api/groupware").param("scope", "master_data").session(login(pm)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    assertThat(mapper.readTree(response).at("/common_codes/0/extra_value").asText())
        .contains("12345");
    mutate(
            login(pm),
            Map.of(
                "module",
                "common_codes",
                "action",
                "create",
                "data",
                Map.of("group_code", "MASTER_TARGETS")))
        .andExpect(status().isForbidden());
  }

  @Test
  void reportCannotForgeExecutiveFeedbackOrOtherProjectUpdates() throws Exception {
    var session = login(pm);
    var p = createProject(session);
    var item =
        new HashMap<String, Object>(
            Map.of(
                "projectId",
                p.get("id").asLong(),
                "projectName",
                "Review project",
                "progress",
                10,
                "thisPeriodWork",
                "Real work",
                "nextPeriodPlan",
                "",
                "issueAndSupport",
                "",
                "pmSubmitted",
                true));
    var doc =
        new HashMap<String, Object>(
            Map.of(
                "periodKey",
                "2027-01-W1",
                "reportType",
                "주간보고",
                "overallStage",
                "PM작성중",
                "directorSummary",
                "",
                "ceoFeedback",
                "",
                "items",
                List.of(item)));
    var data =
        new HashMap<String, Object>(
            Map.of(
                "category",
                "주간보고",
                "title",
                "Review report",
                "project_name",
                "2027-01-W1",
                "items_json",
                mapper.writeValueAsString(doc)));
    var result =
        mapper
            .readTree(
                mutate(session, Map.of("module", "approvals", "action", "create", "data", data))
                    .andExpect(status().isOk())
                    .andReturn()
                    .getResponse()
                    .getContentAsString())
            .get("record");
    doc.put("ceoFeedback", "Forged feedback");
    data.put("items_json", mapper.writeValueAsString(doc));
    data.put("_previous_report", doc);
    mutate(
            session,
            Map.of(
                "module",
                "approvals",
                "action",
                "update",
                "id",
                result.get("id").asLong(),
                "version",
                result.get("version").asLong(),
                "data",
                data))
        .andExpect(status().isBadRequest());
    doc.put("ceoFeedback", "");
    doc.put("overallStage", "사장님확인완료");
    data.put("items_json", mapper.writeValueAsString(doc));
    mutate(
            session,
            Map.of(
                "module",
                "approvals",
                "action",
                "update",
                "id",
                result.get("id").asLong(),
                "version",
                result.get("version").asLong(),
                "data",
                data))
        .andExpect(status().isBadRequest());
    assertThat(approvals.findById(result.get("id").asLong()).orElseThrow().getItemsJson())
        .doesNotContain("Forged feedback");
  }

  @Test
  void contractListsOmitFinancialSheetsAndDetailRequiresPermission() throws Exception {
    var session = login(pm);
    var doc = contractDoc();
    doc.put(
        "manpowerPlans",
        List.of(
            Map.of(
                "employeeId", staff.getId(),
                "name", staff.getName(),
                "role", "Developer",
                "months", java.util.Collections.nCopies(12, 1),
                "totalMM", 12,
                "unitPrice", 5000,
                "laborCost", 60000)));
    var body =
        mutate(
                session,
                Map.of(
                    "module",
                    "approvals",
                    "action",
                    "save_contract",
                    "sync_project",
                    true,
                    "data",
                    Map.of(
                        "title", "Review contract", "items_json", mapper.writeValueAsString(doc))))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    long id = mapper.readTree(body).at("/record/id").asLong();
    var list =
        mvc.perform(get("/api/groupware").param("scope", "approvals").session(session))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    assertThat(mapper.readTree(list).at("/approvals/0").has("items_json")).isFalse();
    mvc.perform(get("/api/groupware/approvals/" + id).session(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items_json").isNotEmpty());
    mvc.perform(get("/api/groupware/approvals/" + id).session(login(staff)))
        .andExpect(status().isForbidden());

    var projectScopedList =
        mvc.perform(get("/api/groupware").param("scope", "projects").session(login(staff)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    var projectApprovals = mapper.readTree(projectScopedList).at("/approvals");
    assertThat(projectApprovals.isArray()).isTrue();
    assertThat(projectApprovals.size()).isGreaterThanOrEqualTo(1);
    var firstDoc = mapper.readTree(projectApprovals.get(0).at("/items_json").asText());
    assertThat(firstDoc.has("manpowerPlans")).isTrue();
    assertThat(firstDoc.has("supplyAmount")).isFalse();
    assertThat(firstDoc.at("/manpowerPlans/0").has("unitPrice")).isFalse();
  }

  @Test
  void scopedPaginationAndUnknownActionsAreExplicit() throws Exception {
    var session = login(admin);
    for (int n = 0; n < 51; n++) {
      var e = new Equipment();
      e.setAssetNo("TEST-" + n);
      e.setCategory("노트북");
      e.setModelName("Review");
      e.setSerialNo("SERIAL-" + n);
      e.setStatus("유휴");
      e.setPurchaseDate("2026-01-01");
      equipment.save(e);
    }
    equipment.flush();
    mvc.perform(
            get("/api/groupware")
                .param("scope", "equipments")
                .param("page", "0")
                .param("size", "50")
                .session(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.equipments.length()").value(50))
        .andExpect(jsonPath("$.page_total").value(51));
    mvc.perform(
            get("/api/groupware")
                .param("scope", "equipments")
                .param("page", "1")
                .param("size", "50")
                .session(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.equipments.length()").value(1));
    mvc.perform(get("/api/groupware").param("scope", "dashboard").session(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.equipments.length()").value(0));
    mutate(
            session,
            Map.of("module", "projects", "action", "unknown", "data", Map.of("name", "invalid")))
        .andExpect(status().isBadRequest());
  }

  @Test
  void accountRateLimitDoesNotLockEveryUserBehindTheProxy() throws Exception {
    for (int n = 0; n < 10; n++)
      mvc.perform(
              post("/api/auth/login")
                  .with(csrf())
                  .contentType("application/json")
                  .content("{\"identifier\":\"unknown-rate\",\"password\":\"incorrect-password\"}"))
          .andExpect(status().isUnauthorized());
    mvc.perform(
            post("/api/auth/login")
                .with(csrf())
                .contentType("application/json")
                .content("{\"identifier\":\"unknown-rate\",\"password\":\"incorrect-password\"}"))
        .andExpect(status().isTooManyRequests());
    assertThat(login(admin)).isNotNull();
  }
  private Map<String, Object> expenseRow(String method, String source, Map<String, Object> inputs, double base, double price) {
    return new HashMap<>(Map.of("id", "expense-review-" + method, "account", "합성 직접경비", "qty", 999, "unitPrice", price, "amount", 999999,
        "calculation", new HashMap<>(Map.of("categoryCode", "REVIEW", "method", method, "source", source, "base", base, "inputs", inputs))));
  }

  @Test
  void directExpenseFormulasRecalculateAndPreserveLegacyRows() throws Exception {
    var s = login(pm);
    var doc = contractDoc();
    doc.put("manpowerPlans", List.of(Map.of("id", "review-plan", "employeeId", pm.getId(), "type", "당사", "months", Collections.nCopies(12, 0.5), "unitPrice", 1000)));
    var product = expenseRow("PRODUCT", "OUR_MM", Map.of("multiplier", 2), 999, 10);
    var travel = expenseRow("TRAVEL", "MANUAL", Map.of("trips", 3, "days", 2, "dailyCost", 20, "nights", 1, "lodgingCost", 50, "transportCost", 30), 2, 999);
    var rate = expenseRow("RATE", "SUPPLY", Map.of("rate", 0.3), 999, 999);
    doc.put("directExpenses", List.of(product, travel, rate, Map.of("id", "legacy-review", "account", "기존 합성 내역", "qty", 2, "unitPrice", 7, "basis", "preserved", "note", "synthetic")));
    var response = mutate(s, Map.of("module", "approvals", "action", "save_contract", "sync_project", false, "data", Map.of("title", "Review expenses", "approver_id", exec.getId(), "items_json", mapper.writeValueAsString(doc))))
        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    var saved = mapper.readTree(mapper.readTree(response).at("/record/items_json").asText());
    assertThat(saved.at("/directExpenseTotal").decimalValue()).isEqualByComparingTo("869");
    assertThat(saved.at("/directExpenses/0/calculation/base").decimalValue()).isEqualByComparingTo("6");
    assertThat(saved.at("/directExpenses/1/amount").decimalValue()).isEqualByComparingTo("720");
    assertThat(saved.at("/directExpenses/2/amount").decimalValue()).isEqualByComparingTo("15");
    assertThat(saved.at("/directExpenses/3/basis").asText()).isEqualTo("preserved");
    assertThat(saved.at("/directExpenses/3/note").asText()).isEqualTo("synthetic");
    // 재저장 시 변경된 공수를 기준으로 다시 계산한다.
    var record = mapper.readTree(response).get("record");
    var zeroMonths = (com.fasterxml.jackson.databind.node.ArrayNode) saved.at("/manpowerPlans/0/months");
    zeroMonths.removeAll();
    for (int month = 0; month < 12; month++) zeroMonths.add(0);
    var updated = mutate(s, Map.of("module", "approvals", "action", "save_contract", "id", record.get("id").asLong(), "version", record.get("version").asLong(), "sync_project", false, "data", Map.of("title", "Review expenses", "items_json", mapper.writeValueAsString(saved))))
        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    assertThat(mapper.readTree(mapper.readTree(updated).at("/record/items_json").asText()).at("/directExpenseTotal").decimalValue()).isEqualByComparingTo("749");
  }

  @Test
  void invalidDirectExpenseInputsAreRejected() throws Exception {
    var s = login(pm);
    for (var row : List.of(
        expenseRow("PRODUCT", "MANUAL", Map.of("multiplier", -1), 1, 10),
        expenseRow("RATE", "SUPPLY", Map.of("rate", 101), 1, 0),
        expenseRow("TRAVEL", "MANUAL", Map.of("nights", -1), 1, 0),
        expenseRow("PRODUCT", "UNKNOWN", Map.of(), 1, 0))) {
      var doc = contractDoc();
      doc.put("directExpenses", List.of(row));
      mutate(s, Map.of("module", "approvals", "action", "save_contract", "sync_project", false, "data", Map.of("title", "Review invalid expense", "items_json", mapper.writeValueAsString(doc))))
          .andExpect(status().isBadRequest());
    }
  }

}
