package com.nexus.groupware.repository;

import com.nexus.groupware.entity.CommonCode;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CommonCodeRepository extends JpaRepository<CommonCode, Long> {
  List<CommonCode> findAllByOrderByGroupCodeAscSortOrderAsc();

  List<CommonCode> findByGroupCodeOrderBySortOrderAsc(String groupCode);

  List<CommonCode> findByGroupCodeAndIsActiveTrueOrderBySortOrderAsc(String groupCode);
}
