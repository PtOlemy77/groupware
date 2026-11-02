package com.nexus.groupware.service;

import com.nexus.groupware.entity.PortalNotice;
import com.nexus.groupware.repository.PortalNoticeRepository;
import com.nexus.groupware.security.AuthService;
import java.time.Instant;
import java.util.Objects;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class PortalNoticeService {
  private final PortalNoticeRepository notices;
  private final AuthService auth;
  public PortalNoticeService(PortalNoticeRepository notices, AuthService auth) {
    this.notices = notices;
    this.auth = auth;
  }
  public record NoticeInput(String title, String content, Boolean published, Boolean pinned, Long version) {}
  public record NoticeView(Long id, String title, String content, boolean published, boolean pinned,
                           Long version, Instant createdOn, Instant updatedOn) {}
  public record NoticeSummary(Long id, String title, boolean published, boolean pinned,
                              Long version, Instant createdOn, Instant updatedOn) {}
  public record NoticePage(java.util.List<NoticeSummary> items, long total, int page, int pages) {}
  private NoticeView view(PortalNotice n) {
    return new NoticeView(n.getId(), n.getTitle(), n.getContent(), n.isPublished(), n.isPinned(),
        n.getVersion(), n.getCreatedOn(), n.getUpdatedOn());
  }
  private void requireAdmin() {
    if (!AuthService.admin(auth.current()))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "시스템 관리자만 공지사항을 관리할 수 있습니다.");
  }
  public NoticePage list(String query, int page, int size, boolean management) {
    if (management) requireAdmin();
    String search = query == null ? "" : query.trim();
    if (page < 0 || size < 1 || size > 50 || search.length() > 100)
      throw new IllegalArgumentException("검색어와 페이지 범위를 확인하세요.");
    var pageable = PageRequest.of(page, size, Sort.by(Sort.Order.desc("pinned"),
        Sort.Order.desc("createdOn"), Sort.Order.desc("id")));
    var result = management ? notices.findByTitleContainingIgnoreCase(search, pageable)
        : notices.findByPublishedTrueAndTitleContainingIgnoreCase(search, pageable);
    return new NoticePage(result.getContent().stream().map(n -> new NoticeSummary(n.getId(), n.getTitle(),
        n.isPublished(), n.isPinned(), n.getVersion(), n.getCreatedOn(), n.getUpdatedOn())).toList(),
        result.getTotalElements(), page, result.getTotalPages());
  }
  public NoticeView detail(Long id, boolean management) {
    if (management) requireAdmin();
    return view((management ? notices.findById(id) : notices.findByIdAndPublishedTrue(id))
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "공지사항을 찾을 수 없습니다.")));
  }
  private void apply(PortalNotice notice, NoticeInput input) {
    if (input.title() == null || input.title().isBlank() || input.title().trim().length() > 200
        || input.content() == null || input.content().isBlank() || input.content().length() > 20000
        || input.published() == null || input.pinned() == null)
      throw new IllegalArgumentException("제목(200자 이내)과 내용(20,000자 이내), 게시 설정을 확인하세요.");
    notice.setTitle(input.title().trim());
    notice.setContent(input.content().trim());
    notice.setPublished(input.published());
    notice.setPinned(input.pinned());
  }
  private PortalNotice editable(Long id, Long version) {
    requireAdmin();
    var notice = notices.findById(id).orElseThrow(() ->
        new ResponseStatusException(HttpStatus.NOT_FOUND, "공지사항을 찾을 수 없습니다."));
    if (version == null || !Objects.equals(notice.getVersion(), version))
      throw new ResponseStatusException(HttpStatus.CONFLICT, "다른 관리자가 변경했습니다. 최신 공지를 확인한 후 다시 시도하세요.");
    return notice;
  }
  @Transactional
  public NoticeView create(NoticeInput input) {
    requireAdmin();
    var notice = new PortalNotice();
    notice.setCreatedBy(auth.current());
    apply(notice, input);
    return view(notices.saveAndFlush(notice));
  }
  @Transactional
  public NoticeView update(Long id, NoticeInput input) {
    var notice = editable(id, input.version());
    apply(notice, input);
    return view(notices.saveAndFlush(notice));
  }
  @Transactional
  public void delete(Long id, Long version) {
    notices.delete(editable(id, version));
    notices.flush();
  }
}
