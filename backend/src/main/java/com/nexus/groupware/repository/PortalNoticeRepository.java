package com.nexus.groupware.repository;

import com.nexus.groupware.entity.PortalNotice;
import java.util.Optional;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PortalNoticeRepository extends JpaRepository<PortalNotice, Long> {
  Page<PortalNotice> findByPublishedTrueAndTitleContainingIgnoreCase(String title, Pageable page);
  Page<PortalNotice> findByTitleContainingIgnoreCase(String title, Pageable page);
  Optional<PortalNotice> findByIdAndPublishedTrue(Long id);
}
