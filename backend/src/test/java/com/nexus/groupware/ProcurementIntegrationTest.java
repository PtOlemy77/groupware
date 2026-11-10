package com.nexus.groupware;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.*;
import com.nexus.groupware.domain.employee.db.*;
import com.nexus.groupware.domain.procurement.db.*;
import com.nexus.groupware.domain.procurement.service.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.*;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(properties={"app.procurement.enabled=false"})
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ProcurementIntegrationTest {
  @Autowired org.springframework.test.web.servlet.MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired EmployeeRepository employees;
  @Autowired PasswordEncoder passwords;
  @Autowired ProcurementStore store;
  @Autowired ProcurementRuleRepository rules;
  @Autowired ProcurementAlertRepository alerts;
  @Autowired ProcurementNoticeRepository notices;
  @Autowired ProcurementSyncStateRepository states;
  @Autowired ProcurementSettings settings;
  @Autowired ProcurementSync sync;
  @Autowired StubGateway gateway;
  @TestConfiguration static class OfflineFeedConfiguration {
    @Bean @Primary StubGateway offlineFeed(ProcurementSettings settings,ObjectMapper json) {return new StubGateway(settings,json);}
  }
  static class StubGateway extends ProcurementGateway {
    record Request(String kind,String business,String division,int page,LocalDateTime from,LocalDateTime until,ProcurementSearch.Filter filter) {}
    java.util.function.Function<Request,FeedPage> response;
    int calls;
    StubGateway(ProcurementSettings settings,ObjectMapper json){super(settings,json);}
    @Override public FeedPage getPage(String kind,String business,String division,LocalDateTime from,LocalDateTime until,int page,ProcurementSearch.Filter filter) {
      calls++;if(response==null)throw new IllegalStateException("Unexpected offline feed call");return response.apply(new Request(kind,business,division,page,from,until,filter));
    }
  }
  @BeforeEach void resetFeed(){gateway.calls=0;gateway.response=null;}
  static final String PASSWORD="Synthetic-procurement-password!";
  MockHttpSession login(String role) throws Exception {
    var e=new Employee();String key=UUID.randomUUID().toString();
    e.setName("조달 합성 사용자");e.setEmpNo(key);e.setEmail(key+"@spatialt.co.kr");
    e.setDepartmentCode("DEPT_BIZ");e.setDepartment("사업본부");e.setPositionCode("POS_STAFF");e.setPosition("담당");
    e.setPhone("");e.setHireDate("2026-01-01");e.setStatusCode("STATUS_ACTIVE");e.setStatus("재직");
    e.setRoleCode(role);e.setAccountEnabled(true);e.setPasswordChangeRequired(false);e.setPassword(passwords.encode(PASSWORD));employees.saveAndFlush(e);
    return (MockHttpSession)mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json").content(json.writeValueAsString(Map.of("identifier",e.getEmail(),"password",PASSWORD))))
      .andExpect(status().isOk()).andReturn().getRequest().getSession(false);
  }
  Map<String,Object> input(){return new HashMap<>(Map.of("name","합성 공간정보","keywords","GIS, 공간정보","institutions","합성기관","excluded_keywords","소모품","match_mode","AND","notice_kind","ALL","business_type","SERVC","enabled",true));}
  JsonNode create(MockHttpSession s)throws Exception{return json.readTree(mvc.perform(post("/api/procurement/rules").session(s).with(csrf()).contentType("application/json").content(json.writeValueAsString(input()))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());}
  @Test void personalRulesEnforceOwnershipCsrfAndClientVersion()throws Exception {
    var owner=login("ROLE_STAFF");var other=login("ROLE_PM");
    mvc.perform(get("/api/procurement/rules")).andExpect(status().isUnauthorized());
    mvc.perform(post("/api/procurement/rules").session(owner).contentType("application/json").content(json.writeValueAsString(input()))).andExpect(status().isForbidden());
    var rule=create(owner);long id=rule.path("id").asLong();
    mvc.perform(get("/api/procurement/rules").session(other)).andExpect(jsonPath("$.length()").value(0));
    mvc.perform(post("/api/procurement/rules/"+id).session(other).with(csrf()).contentType("application/json").content(json.writeValueAsString(input()))).andExpect(status().isNotFound());
    mvc.perform(post("/api/procurement/rules/"+id).session(owner).with(csrf()).contentType("application/json").content(json.writeValueAsString(input()))).andExpect(status().isBadRequest());
    var body=input();body.put("version",rule.path("version").asLong());body.put("name","수정된 조건");
    mvc.perform(post("/api/procurement/rules/"+id).session(owner).with(csrf()).contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().isOk());
    mvc.perform(post("/api/procurement/rules/"+id+"/delete").session(owner).with(csrf()).contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().isConflict());
    body.remove("version");body.put("keywords","");body.put("institutions","");
    mvc.perform(post("/api/procurement/rules").session(owner).with(csrf()).contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().isBadRequest());
    mvc.perform(post("/api/procurement/sync").session(owner).with(csrf())).andExpect(status().isForbidden());
  }
  ProcurementNotice notice(String external,String title,String fingerprint){
    var n=new ProcurementNotice();n.kind="BID";n.businessType="SERVC";n.externalId=external;n.revision="001";n.fingerprint=fingerprint;
    n.title=title;n.agency="합성기관";n.demandAgency="합성수요기관";n.agencyCode="SYNTHETIC";n.demandAgencyCode="";
    n.publishedAt="2026-11-09 09:00:00";n.changedAt="";n.deadline="2026-11-30 18:00:00";n.budget="1000000";n.noticeStatus="등록공고";n.sourceUrl="https://www.g2b.go.kr/";return n;
  }
  @Test void matchingDuplicatesRevisionsReadVersionsAndIsolation()throws Exception {
    var owner=login("ROLE_STAFF");var other=login("ROLE_STAFF");create(owner);create(owner);
    assertThat(store.claim("test-owner")).isTrue();assertThat(store.claim("other-worker")).isFalse();
    var n=notice("SYNTH-1","GIS 합성 사업","a".repeat(64));
    var w=store.window("BID_SERVC_1","test-owner");
    store.apply("BID_SERVC_1","test-owner",w,new ProcurementGateway.FeedPage(List.of(n),2,1,1));
    var next=store.window("BID_SERVC_1","test-owner");assertThat(next.page()).isEqualTo(2);
    store.apply("BID_SERVC_1","test-owner",next,new ProcurementGateway.FeedPage(List.of(notice("SYNTH-1","GIS 합성 사업","a".repeat(64))),2,2,1));
    assertThat(alerts.count()).isEqualTo(1);assertThat(notices.count()).isEqualTo(1);
    var result=json.readTree(mvc.perform(get("/api/procurement/alerts").session(owner)).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1)).andReturn().getResponse().getContentAsString());
    long id=result.path("items").get(0).path("id").asLong(), version=result.path("items").get(0).path("version").asLong();
    mvc.perform(get("/api/procurement/alerts/"+id).session(other)).andExpect(status().isNotFound());
    mvc.perform(get("/api/procurement/alerts").session(other)).andExpect(jsonPath("$.total").value(0));
    mvc.perform(post("/api/procurement/alerts/"+id+"/read").session(owner).with(csrf()).contentType("application/json").content("{}")).andExpect(status().isBadRequest());
    mvc.perform(post("/api/procurement/alerts/"+id+"/read").session(owner).with(csrf()).contentType("application/json").content("{\"version\":"+version+"}")).andExpect(status().isOk());
    mvc.perform(post("/api/procurement/alerts/"+id+"/read").session(owner).with(csrf()).contentType("application/json").content("{\"version\":"+version+"}")).andExpect(status().isConflict());
    mvc.perform(get("/api/procurement/status").session(owner)).andExpect(jsonPath("$.unread").value(0));
    var again=store.window("BID_SERVC_1","test-owner");
    store.apply("BID_SERVC_1","test-owner",again,new ProcurementGateway.FeedPage(List.of(notice("SYNTH-1","GIS 합성 사업 (정정)","b".repeat(64))),1,1,1000));
    assertThat(alerts.count()).isEqualTo(2);
    var pending=store.window("SPEC_SERVC_1","test-owner");store.failed("SPEC_SERVC_1","test-owner");
    assertThat(store.window("SPEC_SERVC_1","test-owner")).isEqualTo(pending);
    store.release("test-owner");
    assertThat(store.claim("second-worker")).isTrue();store.release("second-worker");
  }
  @Test void workerRetriesFailedInstitutionPageAndReadsTheEntireWeekBeyondOneThousand()throws Exception {
    var user=login("ROLE_STAFF");create(user);
    boolean old=settings.enabled;String oldKey=settings.serviceKey,oldTypes=settings.businessTypes;
    var requests=new ArrayList<StubGateway.Request>();
    try {
      settings.enabled=true;settings.serviceKey="synthetic-test-key";settings.businessTypes="SERVC";
      gateway.response=request->{
        requests.add(request);
        if(!request.division().equals("1")||!request.kind().equals("BID"))return new ProcurementGateway.FeedPage(List.of(),0,request.page(),999);
        if(request.page()==2)throw new IllegalStateException("synthetic outage");
        return new ProcurementGateway.FeedPage(List.of(notice("NONMATCH","다른 사업","d".repeat(64))),2005,request.page(),999);
      };
      sync.runOnce();
      var relevant=rules.findActiveRules();
      String id=ProcurementSearch.source("BID","SERVC","1",new ProcurementSearch.Filter("ntceInsttNm","합성기관"),relevant);
      var failed=states.findById(id).orElseThrow();
      assertThat(failed.nextPage).isEqualTo(2);assertThat(failed.lastError).isNotBlank();
      var frozenFrom=failed.fromTime;var frozenUntil=failed.untilTime;
      assertThat(Duration.between(frozenFrom,frozenUntil)).isEqualTo(Duration.ofDays(7));
      requests.clear();
      gateway.response=request->{
        requests.add(request);
        if(!request.division().equals("1")||!request.kind().equals("BID"))return new ProcurementGateway.FeedPage(List.of(),0,request.page(),999);
        // The Friday notice is beyond the first 1,998 rows of the institution's week.
        var row=notice("FRIDAY-LATE-PAGE",request.page()==3?"GIS 금요일 합성 사업":"다른 사업","f".repeat(64));
        row.publishedAt=request.until().minusDays(3).toString();
        return new ProcurementGateway.FeedPage(List.of(row),2005,request.page(),999);
      };
      sync.runOnce();
      var resumed=requests.stream().filter(r->r.kind().equals("BID")&&r.filter().field().equals("ntceInsttNm")).toList();
      assertThat(resumed).extracting(StubGateway.Request::page).containsExactly(2,3);
      assertThat(resumed).allSatisfy(r->{assertThat(r.from()).isEqualTo(frozenFrom);assertThat(r.until()).isEqualTo(frozenUntil);});
      assertThat(states.findById(id).orElseThrow().untilTime).isNull();
      assertThat(alerts.count()).isEqualTo(1);assertThat(notices.count()).isEqualTo(1);
      requests.clear();sync.runOnce();
      var repeat=requests.stream().filter(r->r.kind().equals("BID")&&r.filter().field().equals("ntceInsttNm")).toList();
      assertThat(repeat).extracting(StubGateway.Request::page).containsExactly(1,2,3);
      assertThat(Duration.between(repeat.get(0).from(),repeat.get(0).until())).isEqualTo(Duration.ofDays(7));
      assertThat(alerts.count()).isEqualTo(1); // full-week overlap and demand-agency search deduplicate
      assertThat(requests.stream().filter(r->r.division().equals("3"))).allSatisfy(r->assertThat(r.filter()).isEqualTo(ProcurementSearch.ALL));
    }finally{settings.enabled=old;settings.serviceKey=oldKey;settings.businessTypes=oldTypes;}
  }
  @Test void weeklyWindowsPreserveOlderBacklogAndNewRuleVersionsStartFresh()throws Exception {
    var user=login("ROLE_STAFF");create(user);var active=rules.findActiveRules();
    var filter=new ProcurementSearch.Filter("ntceInsttNm","합성기관");
    String first=ProcurementSearch.source("BID","SERVC","1",filter,active);
    assertThat(store.claim("weekly-window")).isTrue();
    var now=LocalDateTime.now(ZoneId.of("Asia/Seoul")).withSecond(0).withNano(0);
    var state=new ProcurementSyncState();state.id=first;state.fromTime=now.minusDays(16);states.saveAndFlush(state);
    var window=store.window(first,"weekly-window");
    assertThat(window.from()).isEqualTo(now.minusDays(16));assertThat(window.until()).isEqualTo(now.minusDays(9));
    store.apply(first,"weekly-window",window,new ProcurementGateway.FeedPage(List.of(),0,1,999));
    assertThat(store.window(first,"weekly-window").from()).isEqualTo(now.minusDays(9).minusMinutes(1));
    active.get(0).keywords="새 합성 키워드";rules.flush();
    String changed=ProcurementSearch.source("BID","SERVC","1",filter,active);
    assertThat(changed).isNotEqualTo(first);assertThat(changed.length()).isLessThanOrEqualTo(50);
    var fresh=store.window(changed,"weekly-window");
    assertThat(fresh.from()).isEqualTo(now.minusDays(7));assertThat(fresh.page()).isEqualTo(1);
    store.release("weekly-window");
  }
  @Test void missingKeyStatusIsHonestAndNoGetInitializesData()throws Exception {
    var admin=login("ROLE_ADMIN");
    mvc.perform(get("/api/procurement/status").session(admin)).andExpect(status().isOk()).andExpect(jsonPath("$.configured").value(false));
    assertThat(states.count()).isZero();assertThat(notices.count()).isZero();
    mvc.perform(post("/api/procurement/sync").session(admin).with(csrf())).andExpect(status().isServiceUnavailable());
    assertThat(gateway.calls).isZero();
  }
  @Test void unreadCategoryCountsAndBusinessFiltersArePersonalAndExcludeReadAlerts()throws Exception {
    var owner=login("ROLE_STAFF");var other=login("ROLE_STAFF");
    var rule=input();rule.put("business_type","ALL");
    mvc.perform(post("/api/procurement/rules").session(owner).with(csrf()).contentType("application/json").content(json.writeValueAsString(rule))).andExpect(status().isOk());
    assertThat(store.claim("category-test")).isTrue();
    for(String source:List.of("BID_SERVC_1","BID_THNG_1","SPEC_SERVC_1")) {
      String[] parts=source.split("_");var n=notice("SYNTH-"+source,"GIS category synthetic notice","c".repeat(64));n.kind=parts[0];n.businessType=parts[1];
      var w=store.window(source,"category-test");store.apply(source,"category-test",w,new ProcurementGateway.FeedPage(List.of(n),1,1,999));
    }
    store.release("category-test");
    var counts=json.readTree(mvc.perform(get("/api/procurement/status").session(owner)).andExpect(status().isOk()).andExpect(jsonPath("$.unread").value(3)).andReturn().getResponse().getContentAsString()).path("unread_categories");
    assertThat(counts.size()).isEqualTo(8);
    var totals=new HashMap<String,Integer>();counts.forEach(n->totals.put(n.path("kind").asText()+":"+n.path("business_type").asText(),n.path("count").asInt()));
    assertThat(totals).containsEntry("BID:SERVC",1).containsEntry("BID:THNG",1).containsEntry("SPEC:SERVC",1).containsEntry("SPEC:CNSTWK",0);
    var selected=json.readTree(mvc.perform(get("/api/procurement/alerts").session(owner).param("kind","BID").param("business","THNG").param("unread","true"))
      .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1)).andExpect(jsonPath("$.items[0].notice.business_type").value("THNG")).andReturn().getResponse().getContentAsString()).path("items").get(0);
    mvc.perform(get("/api/procurement/alerts").session(owner).param("kind","SPEC").param("business","THNG")).andExpect(jsonPath("$.total").value(0));
    mvc.perform(get("/api/procurement/alerts").session(owner).param("business","INVALID")).andExpect(status().isBadRequest());
    mvc.perform(get("/api/procurement/status").session(other)).andExpect(jsonPath("$.unread").value(0));
    mvc.perform(get("/api/procurement/alerts").session(other).param("business","THNG")).andExpect(jsonPath("$.total").value(0));
    mvc.perform(post("/api/procurement/alerts/"+selected.path("id").asLong()+"/read").session(owner).with(csrf()).contentType("application/json").content(json.writeValueAsString(Map.of("version",selected.path("version").asLong())))).andExpect(status().isOk());
    mvc.perform(get("/api/procurement/status").session(owner)).andExpect(jsonPath("$.unread").value(2));
    mvc.perform(get("/api/procurement/alerts").session(owner).param("business","THNG").param("unread","true")).andExpect(jsonPath("$.total").value(0));
  }
}
