package com.nexus.groupware;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.*;
import com.nexus.groupware.entity.Employee;
import com.nexus.groupware.repository.EmployeeRepository;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class PortalNoticeIntegrationTest {
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper mapper;
  @Autowired EmployeeRepository employees;
  @Autowired PasswordEncoder passwords;
  static final String PW = "Notice-test-password!";

  MockHttpSession login(String role) throws Exception {
    var e = new Employee();
    String key = UUID.randomUUID().toString();
    e.setName("Notice test"); e.setEmpNo(key); e.setEmail(key + "@spatialt.co.kr");
    e.setDepartment("연구소"); e.setPosition("담당"); e.setPhone(""); e.setHireDate("2026-01-01");
    e.setRoleCode(role); e.setAccountEnabled(true); e.setPasswordChangeRequired(false);
    e.setPassword(passwords.encode(PW));
    employees.saveAndFlush(e);
    return (MockHttpSession) mvc.perform(post("/api/auth/login").with(csrf())
        .contentType("application/json").content(mapper.writeValueAsString(Map.of("identifier", e.getEmail(), "password", PW))))
        .andExpect(status().isOk()).andReturn().getRequest().getSession(false);
  }
  String payload(String title, String content, boolean published, Long version) throws Exception {
    var body = new HashMap<String, Object>();
    body.put("title", title); body.put("content", content); body.put("published", published);
    body.put("pinned", true); body.put("version", version);
    return mapper.writeValueAsString(body);
  }
  JsonNode create(MockHttpSession session, String title, boolean published) throws Exception {
    return mapper.readTree(mvc.perform(post("/api/portal/admin/notices").session(session).with(csrf())
        .contentType("application/json").content(payload(title, "Plain text <script>alert('x')</script>", published, null)))
        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
  }
  @Test void publicEndpointsNeverExposeDraftsOrEmployeeData() throws Exception {
    var admin = login("ROLE_ADMIN");
    var draft = create(admin, "Private notice", false);
    var live = create(admin, "Published notice", true);
    var response = mvc.perform(get("/api/portal/notices")).andExpect(status().isOk())
        .andExpect(header().string("Cache-Control", "no-store")).andExpect(jsonPath("$.total").value(1))
        .andExpect(jsonPath("$.items[0].title").value("Published notice"))
        .andExpect(jsonPath("$.items[0].created_on").exists()).andReturn().getResponse().getContentAsString();
    assertThat(response).doesNotContain("Private notice", "content", "created_by", "password", "email");
    mvc.perform(get("/api/portal/notices/" + draft.get("id").asLong())).andExpect(status().isNotFound());
    mvc.perform(get("/api/portal/notices/" + live.get("id").asLong())).andExpect(status().isOk()).andExpect(jsonPath("$.content").exists());
    mvc.perform(get("/api/portal/notices/access")).andExpect(jsonPath("$.can_manage").value(false));
    mvc.perform(get("/api/portal/notices/access").session(admin)).andExpect(jsonPath("$.can_manage").value(true));
    mvc.perform(get("/api/portal/admin/notices").session(admin)).andExpect(jsonPath("$.total").value(2));
    mvc.perform(get("/api/portal/notices").param("q", "Published")).andExpect(jsonPath("$.total").value(1));
    mvc.perform(get("/api/portal/notices").param("q", "no match")).andExpect(jsonPath("$.total").value(0));
  }
  @Test void onlyAdminsWithCsrfMayManageAndInputsAreValidated() throws Exception {
    var staff = login("ROLE_STAFF");
    var admin = login("ROLE_ADMIN");
    String input = payload("Title", "Content", true, null);
    mvc.perform(get("/api/portal/admin/notices")).andExpect(status().isUnauthorized());
    mvc.perform(post("/api/portal/admin/notices").with(csrf()).contentType("application/json").content(input)).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/portal/admin/notices").session(staff)).andExpect(status().isForbidden());
    mvc.perform(post("/api/portal/admin/notices").session(staff).with(csrf()).contentType("application/json").content(input)).andExpect(status().isForbidden());
    mvc.perform(post("/api/portal/admin/notices").session(admin).contentType("application/json").content(input)).andExpect(status().isForbidden());
    mvc.perform(post("/api/portal/admin/notices").session(admin).with(csrf()).contentType("application/json").content(payload("  ", "Content", true, null))).andExpect(status().isBadRequest());
    mvc.perform(post("/api/portal/admin/notices").session(admin).with(csrf()).contentType("application/json").content(payload("Title", "x".repeat(20001), true, null))).andExpect(status().isBadRequest());
    mvc.perform(get("/api/portal/notices").param("page", "-1")).andExpect(status().isBadRequest());
  }
  @Test void editUnpublishAndDeleteRequireCurrentVersion() throws Exception {
    var admin = login("ROLE_ADMIN");
    var created = create(admin, "Original", true);
    long id = created.get("id").asLong();
    long version = created.get("version").asLong();
    var edited = mapper.readTree(mvc.perform(put("/api/portal/admin/notices/" + id).session(admin).with(csrf())
        .contentType("application/json").content(payload("Edited", "Changed", false, version)))
        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    mvc.perform(get("/api/portal/notices/" + id)).andExpect(status().isNotFound());
    mvc.perform(get("/api/portal/notices")).andExpect(jsonPath("$.total").value(0));
    mvc.perform(put("/api/portal/admin/notices/" + id).session(admin).with(csrf()).contentType("application/json")
        .content(payload("Overwrite", "Old", true, version))).andExpect(status().isConflict());
    mvc.perform(delete("/api/portal/admin/notices/" + id).session(admin).with(csrf()).param("version", Long.toString(version))).andExpect(status().isConflict());
    mvc.perform(delete("/api/portal/admin/notices/" + id).session(admin).with(csrf()).param("version", edited.get("version").asText())).andExpect(status().isOk());
    mvc.perform(get("/api/portal/admin/notices/" + id).session(admin)).andExpect(status().isNotFound());
  }
}
