package com.nexus.groupware;
import com.nexus.groupware.domain.employee.db.Employee;
import com.nexus.groupware.domain.employee.db.EmployeeRepository;
import com.nexus.groupware.domain.evaluation.db.EvaluationAssignmentRepository;
import com.nexus.groupware.domain.evaluation.db.EvaluationPlanRepository;
import com.nexus.groupware.domain.evaluation.service.EvaluationPlanService;
import com.nexus.groupware.domain.project.db.Project;
import com.nexus.groupware.domain.project.db.ProjectRepository;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fasterxml.jackson.databind.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import org.springframework.test.util.ReflectionTestUtils;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")
class EvaluationPlanIntegrationTest {
 @Autowired MockMvc mvc; @Autowired ObjectMapper json; @Autowired PasswordEncoder passwords;
 @Autowired EmployeeRepository employees; @Autowired ProjectRepository projects;
 @Autowired EvaluationAssignmentRepository assignments; @Autowired EvaluationPlanRepository plans;
 @Autowired EvaluationPlanService service;
 Employee staff,other,pm,otherPm,exec,pool; Project project;
 MockHttpSession ss,ps,os,es,ops,pools;
 final int year=LocalDate.now(ZoneId.of("Asia/Seoul")).getYear();
 final String date=LocalDate.now(ZoneId.of("Asia/Seoul")).toString();
 final String month=date.substring(0,7);
 static final String PW="Synthetic-evaluation-password!";
 @BeforeEach void setup() throws Exception {
  plans.deleteAll(); assignments.deleteAll();
  staff=person("staff","ROLE_STAFF"); other=person("other","ROLE_STAFF"); pm=person("pm","ROLE_PM"); otherPm=person("other-pm","ROLE_PM"); exec=person("exec","ROLE_EXEC"); pool=person("pool","ROLE_STAFF");
  project=project("Synthetic evaluation",pm,List.of(staff.getId(),otherPm.getId()));
  ss=login(staff); ps=login(pm); os=login(other); es=login(exec); ops=login(otherPm); pools=login(pool);
 }
 Employee person(String key,String role) {
  Employee e=new Employee();String suffix=UUID.randomUUID().toString(); e.setName("Synthetic "+key);e.setEmpNo("HR-"+suffix);e.setEmail(suffix+"@example.invalid");e.setPhone("");e.setHireDate("2020-01-01");e.setDepartment("사업본부");e.setDepartmentCode("DEPT_BIZ");e.setPosition("담당");e.setPositionCode("POS_STAFF");e.setRoleCode(role);e.setStatusCode("STATUS_ACTIVE");e.setAccountEnabled(true);e.setPasswordChangeRequired(false);e.setPassword(passwords.encode(PW));return employees.saveAndFlush(e);
 }
 Project project(String name,Employee manager,List<Long> members) {
  Project p=new Project();p.setCode("HR-"+UUID.randomUUID());p.setName(name);p.setPmId(manager.getId());p.setPmName(manager.getName());p.setStartDate(year+"-01-01");p.setEndDate(year+"-12-31");p.setStatusCode("STAGE_EXEC");p.setMemberIds(new HashSet<>(members));p=projects.saveAndFlush(p);service.syncProjectAssignments(p);return p;
 }
 MockHttpSession login(Employee e)throws Exception {return (MockHttpSession)mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json").content(json.writeValueAsString(Map.of("identifier",e.getEmail(),"password",PW)))).andExpect(status().isOk()).andReturn().getRequest().getSession(false);}
 ResultActions postAs(MockHttpSession s,String url,Object data)throws Exception{return mvc.perform(post(url).session(s).with(csrf()).contentType("application/json").content(json.writeValueAsString(data)));}
 JsonNode ok(ResultActions r)throws Exception{return json.readTree(r.andExpect(status().isOk()).andReturn().getResponse().getContentAsString());}
 JsonNode list(MockHttpSession s)throws Exception{return ok(mvc.perform(get("/api/evaluation-plans?year="+year).session(s)));}
 JsonNode detail(MockHttpSession s,long id)throws Exception{return ok(mvc.perform(get("/api/evaluation-plans/"+id).session(s)));}
 List<Map<String,Object>> goals(){return List.of(Map.of("id","g1","category","WORK","title","Synthetic metric","criterion","Deliver ten synthetic cases","direction","HIGHER","target",10,"unit","cases","weight",100));}
 Map<String,Object> body(MockHttpSession s)throws Exception {long a=list(s).path("assignments").get(0).path("id").asLong();return new HashMap<>(Map.of("kind","PROJECT","assignment_id",a,"reviewer_id",exec.getId(),"title","Synthetic goal","start_date",date,"end_date",date,"goals",goals(),"planned_mm",Map.of(month,.5)));}
 JsonNode create()throws Exception{return ok(postAs(ss,"/api/evaluation-plans",body(ss)));}
 JsonNode act(MockHttpSession s,JsonNode p,String action,Map<String,Object> extra)throws Exception {var b=new HashMap<>(extra);b.put("version",p.path("version").asLong());return ok(postAs(s,"/api/evaluation-plans/"+p.path("id").asLong()+"/"+action,b));}
 JsonNode approved()throws Exception{return act(ps,act(ss,create(),"submit",Map.of()),"approve",Map.of("comment","Synthetic approval"));}
 Map<String,Object> results(double mm){return Map.of("results",List.of(Map.of("goal_id","g1","actual",10,"evidence","Synthetic evidence location")),"actual_mm",Map.of(month,mm));}
 @Test void workflowLocksGoalsAndResultsAndChecksVersions()throws Exception {
  JsonNode p=create();long id=p.path("id").asLong();String url="/api/evaluation-plans/"+id+"/";
  postAs(ss,url+"submit",Map.of()).andExpect(status().isBadRequest());
  JsonNode submitted=act(ss,p,"submit",Map.of());
  postAs(ss,url+"submit",Map.of("version",p.path("version").asLong())).andExpect(status().isConflict());
  postAs(ss,url+"save_goals",Map.of("version",submitted.path("version").asLong())).andExpect(status().isConflict());
  JsonNode returned=act(ps,submitted,"request_revision",Map.of("comment","Clarify synthetic criterion"));
  var b=body(ss);b.remove("kind");b.remove("assignment_id");
  JsonNode revised=act(ss,returned,"save_goals",b); p=act(ps,act(ss,revised,"submit",Map.of()),"approve",Map.of());
  String hash=p.path("goals_hash").asText();assertThat(hash).hasSize(64);
  postAs(ss,url+"save_goals",Map.of("version",p.path("version").asLong(),"title","tampered")).andExpect(status().isConflict());
  postAs(es,url+"save_goals",Map.of("version",p.path("version").asLong())).andExpect(status().isForbidden());
  postAs(ss,url+"delete_draft",Map.of("version",p.path("version").asLong())).andExpect(status().isConflict());
  p=act(ss,p,"save_results",results(.5));p=act(ss,p,"submit_results",Map.of());
  p=act(ps,p,"request_result_revision",Map.of("comment","Clarify evidence"));assertThat(p.path("can_edit_goals").asBoolean()).isFalse();
  p=act(ss,p,"save_results",results(.5));p=act(ss,p,"submit_results",Map.of());
  var wrong=Map.<String,Object>of("scores",List.of(Map.of("goal_id","g1","score",80)),"comment","Synthetic feedback");
  var payload=new HashMap<>(wrong);payload.put("version",p.path("version").asLong());postAs(ps,url+"evaluate",payload).andExpect(status().isBadRequest());
  p=act(ps,p,"evaluate",Map.of("scores",List.of(Map.of("goal_id","g1","score",80,"reason","Synthetic quality adjustment")),"comment","Synthetic feedback"));
  assertThat(p.path("score").asDouble()).isEqualTo(80);assertThat(p.path("performance_points").asDouble()).isEqualTo(28);assertThat(p.path("goals_hash").asText()).isEqualTo(hash);
  JsonNode owner=detail(ss,id);assertThat(owner.path("can_edit_results").asBoolean()).isFalse();assertThat(owner.path("goals")).isEqualTo(p.path("goals"));assertThat(list(ss).path("summary").path("score").asDouble()).isEqualTo(80);
  postAs(ss,url+"save_results",Map.of("version",p.path("version").asLong(),"results",List.of(),"actual_mm",Map.of())).andExpect(status().isConflict());
 }
 @Test void authorizationAppliesToSearchDetailAndReview()throws Exception {
  JsonNode p=act(ss,create(),"submit",Map.of());long id=p.path("id").asLong();assertThat(list(os).path("total").asInt()).isZero();
  mvc.perform(get("/api/evaluation-plans/"+id).session(os)).andExpect(status().isForbidden());
  assertThat(list(ops).path("total").asInt()).isEqualTo(1);assertThat(list(es).path("total").asInt()).isEqualTo(1);
  postAs(ops,"/api/evaluation-plans/"+id+"/approve",Map.of("version",p.path("version").asLong())).andExpect(status().isForbidden());
  postAs(ss,"/api/evaluation-plans/"+id+"/approve",Map.of("version",p.path("version").asLong())).andExpect(status().isForbidden());
  postAs(os,"/api/evaluation-plans",body(ss)).andExpect(status().isForbidden());
  Project unrelated=project("Unrelated synthetic",exec,List.of(other.getId()));JsonNode otherPlan=ok(postAs(os,"/api/evaluation-plans",body(os)));
  assertThat(list(ps).path("total").asInt()).isEqualTo(1);assertThat(list(es).path("total").asInt()).isEqualTo(2);
  assertThat(ok(mvc.perform(get("/api/evaluation-plans?year="+year+"&q=Unrelated").session(ps))).path("total").asInt()).isZero();
  mvc.perform(get("/api/evaluation-plans/"+otherPlan.path("id").asLong()).session(ps)).andExpect(status().isForbidden());
  var spoof=body(ss);spoof.put("employee_id",other.getId());postAs(ss,"/api/evaluation-plans",spoof).andExpect(status().isBadRequest());
 }
 @Test void resultValidationAndMonthlyCapacityAreAtomic()throws Exception {
  JsonNode p=approved();String url="/api/evaluation-plans/"+p.path("id").asLong()+"/save_results";
  var tooMuch=new HashMap<>(results(1.01));tooMuch.put("version",p.path("version").asLong());postAs(ss,url,tooMuch).andExpect(status().isBadRequest());
  var forged=new HashMap<>(results(.5));forged.put("goals",goals());forged.put("version",p.path("version").asLong());postAs(ss,url,forged).andExpect(status().isBadRequest());
  var missing=new HashMap<String,Object>();missing.put("goal_id","g1");missing.put("actual",null);missing.put("evidence","Synthetic");
  p=act(ss,p,"save_results",Map.of("results",List.of(missing),"actual_mm",Map.of(month,.7)));
  postAs(ss,"/api/evaluation-plans/"+p.path("id").asLong()+"/submit_results",Map.of("version",p.path("version").asLong())).andExpect(status().isBadRequest());
  p=act(ss,p,"save_results",results(.7));p=act(ss,p,"submit_results",Map.of());
  Project second=project("Second synthetic",pm,List.of(staff.getId()));
  var b=body(ss);b.put("assignment_id",assignments.findByProjectIdAndEndedOnIsNull(second.getId()).stream().filter(a->a.getEmployeeId().equals(staff.getId())).findFirst().orElseThrow().getId());
  JsonNode secondPlan=ok(postAs(ss,"/api/evaluation-plans",b));secondPlan=act(ps,act(ss,secondPlan,"submit",Map.of()),"approve",Map.of());secondPlan=act(ss,secondPlan,"save_results",results(.4));
  postAs(ss,"/api/evaluation-plans/"+secondPlan.path("id").asLong()+"/submit_results",Map.of("version",secondPlan.path("version").asLong())).andExpect(status().isBadRequest());
  assertThat(detail(ss,secondPlan.path("id").asLong()).path("state").asText()).isEqualTo("APPROVED");
  assertThat(detail(ss,secondPlan.path("id").asLong()).path("version")).isEqualTo(secondPlan.path("version"));
 }
 @Test void poolMonthlyAndAssignmentChangesPreserveExistingGoals()throws Exception {
  var b=new HashMap<String,Object>(Map.of("kind","POOL","reviewer_id",pm.getId(),"title","Synthetic pool","start_date",date,"end_date",date,"goals",goals(),"planned_mm",Map.of(month,.5)));
  postAs(ss,"/api/evaluation-plans",b).andExpect(status().isBadRequest());
  JsonNode p=ok(postAs(pools,"/api/evaluation-plans",b));p=act(ps,act(pools,p,"submit",Map.of()),"approve",Map.of());
  long oldAssignment=list(ss).path("assignments").get(0).path("id").asLong();JsonNode prior=create();
  project.setMemberIds(Set.of(pool.getId()));project=projects.saveAndFlush(project);service.syncProjectAssignments(project);
  assertThat(assignments.findById(oldAssignment).orElseThrow().getEndedOn()).isNotNull();assertThat(detail(ss,prior.path("id").asLong()).path("state").asText()).isEqualTo("DRAFT");
  assertThat(detail(pools,p.path("id").asLong()).path("can_edit_results").asBoolean()).isTrue();assertThat(list(pools).path("pool_available").asBoolean()).isFalse();
  project.setMemberIds(Set.of(staff.getId(),pool.getId()));project=projects.saveAndFlush(project);service.syncProjectAssignments(project);
  assertThat(assignments.findByProjectIdAndEndedOnIsNull(project.getId()).stream().filter(a->a.getEmployeeId().equals(staff.getId())).findFirst().orElseThrow().getId()).isNotEqualTo(oldAssignment);
  assertThat(list(ss).path("assignments").findValues("needs_plan").stream().anyMatch(JsonNode::asBoolean)).isTrue();
 }
 @Test void pmOwnGoalRequiresExecutiveAndFeatureSwitchIsReversible()throws Exception {
  var b=body(ps);b.put("reviewer_id",otherPm.getId());postAs(ps,"/api/evaluation-plans",b).andExpect(status().isBadRequest());b.put("reviewer_id",exec.getId());JsonNode p=ok(postAs(ps,"/api/evaluation-plans",b));p=act(ps,p,"submit",Map.of());
  postAs(ps,"/api/evaluation-plans/"+p.path("id").asLong()+"/approve",Map.of("version",p.path("version").asLong())).andExpect(status().isForbidden());act(es,p,"approve",Map.of());
  long count=plans.count();ReflectionTestUtils.setField(service,"enabled",false);
  try {assertThat(ok(mvc.perform(get("/api/evaluation-plans/config").session(ss))).path("enabled").asBoolean()).isFalse();mvc.perform(get("/api/evaluation-plans?year="+year).session(ss)).andExpect(status().isServiceUnavailable());assertThat(plans.count()).isEqualTo(count);}finally{ReflectionTestUtils.setField(service,"enabled",true);}
  assertThat(list(ps).path("total").asInt()).isEqualTo(1);
 }
 @Test void simultaneousApprovalsHaveOneWinner()throws Exception {
  JsonNode p=act(ss,create(),"submit",Map.of());
  var start=new java.util.concurrent.CountDownLatch(1);
  var workers=java.util.concurrent.Executors.newFixedThreadPool(2);
  try {
   var task=(java.util.concurrent.Callable<Integer>)()->{start.await();return postAs(ps,"/api/evaluation-plans/"+p.path("id").asLong()+"/approve",Map.of("version",p.path("version").asLong())).andReturn().getResponse().getStatus();};
   var first=workers.submit(task);var second=workers.submit(task);start.countDown();
   assertThat(List.of(first.get(10,java.util.concurrent.TimeUnit.SECONDS),second.get(10,java.util.concurrent.TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,409);
   assertThat(detail(ss,p.path("id").asLong()).path("state").asText()).isEqualTo("APPROVED");
  }finally{workers.shutdownNow();}
 }
 @Test void paginatedSearchNeverExpandsRoleScopeAndProjectDeletionPreservesHistory()throws Exception {
  JsonNode first=create();Project second=project("Synthetic second page",pm,List.of(staff.getId()));
  var b=body(ss);b.put("assignment_id",assignments.findByProjectIdAndEndedOnIsNull(second.getId()).stream().filter(a->a.getEmployeeId().equals(staff.getId())).findFirst().orElseThrow().getId());b.put("title","Synthetic second page");
  JsonNode last=ok(postAs(ss,"/api/evaluation-plans",b));
  JsonNode page0=ok(mvc.perform(get("/api/evaluation-plans?year="+year+"&size=1&page=0").session(ps)));
  JsonNode page1=ok(mvc.perform(get("/api/evaluation-plans?year="+year+"&size=1&page=1").session(ps)));
  assertThat(page0.path("total").asInt()).isEqualTo(2);assertThat(page0.path("plans").get(0).path("id")).isEqualTo(last.path("id"));assertThat(page1.path("plans").get(0).path("id")).isEqualTo(first.path("id"));
  assertThat(ok(mvc.perform(get("/api/evaluation-plans?year="+year+"&q=second&page=0&size=1").session(os))).path("total").asInt()).isZero();
  postAs(es,"/api/groupware",Map.of("module","projects","action","delete","id",project.getId(),"version",project.getVersion())).andExpect(status().isConflict());
  assertThat(projects.existsById(project.getId())).isTrue();
 }

}
