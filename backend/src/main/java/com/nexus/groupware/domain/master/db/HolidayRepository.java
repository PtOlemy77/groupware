package com.nexus.groupware.domain.master.db;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HolidayRepository extends JpaRepository<Holiday, Long> {
  List<Holiday> findAllByOrderByHolidayDateAsc();
}

