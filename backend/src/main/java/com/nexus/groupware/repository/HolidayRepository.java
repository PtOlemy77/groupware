package com.nexus.groupware.repository;

import com.nexus.groupware.entity.Holiday;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HolidayRepository extends JpaRepository<Holiday, Long> {
  List<Holiday> findAllByOrderByHolidayDateAsc();
}

