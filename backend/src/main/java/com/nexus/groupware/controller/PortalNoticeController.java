package com.nexus.groupware.controller;

import com.nexus.groupware.security.AuthService;
import com.nexus.groupware.service.PortalNoticeService;
import com.nexus.groupware.service.PortalNoticeService.*;
import java.util.Map;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/portal")
public class PortalNoticeController {
  private final PortalNoticeService notices;
  private final AuthService auth;
  public PortalNoticeController(PortalNoticeService notices, AuthService auth) {
    this.notices = notices;
    this.auth = auth;
  }
  @GetMapping("/notices/access")
  public ResponseEntity<Map<String, Boolean>> access(Authentication authentication) {
    boolean admin = authentication != null && authentication.isAuthenticated()
        && !"anonymousUser".equals(authentication.getName()) && AuthService.admin(auth.current());
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(Map.of("can_manage", admin));
  }
  @GetMapping("/notices")
  public ResponseEntity<NoticePage> list(@RequestParam(defaultValue = "") String q,
      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "5") int size) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(notices.list(q, page, size, false));
  }
  @GetMapping("/notices/{id}")
  public ResponseEntity<NoticeView> detail(@PathVariable Long id) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(notices.detail(id, false));
  }
  @GetMapping("/admin/notices")
  public ResponseEntity<NoticePage> adminList(@RequestParam(defaultValue = "") String q,
      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "5") int size) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(notices.list(q, page, size, true));
  }
  @GetMapping("/admin/notices/{id}")
  public ResponseEntity<NoticeView> adminDetail(@PathVariable Long id) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(notices.detail(id, true));
  }
  @PostMapping("/admin/notices")
  public NoticeView create(@RequestBody NoticeInput input) { return notices.create(input); }
  @PutMapping("/admin/notices/{id}")
  public NoticeView update(@PathVariable Long id, @RequestBody NoticeInput input) { return notices.update(id, input); }
  @DeleteMapping("/admin/notices/{id}")
  public Map<String, Boolean> delete(@PathVariable Long id, @RequestParam Long version) {
    notices.delete(id, version);
    return Map.of("ok", true);
  }
}
