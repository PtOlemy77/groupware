package com.nexus.groupware.domain.equipment.db;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EquipmentRepository
    extends JpaRepository<Equipment, Long>,
        org.springframework.data.jpa.repository.JpaSpecificationExecutor<Equipment> {
  Long countByEmpId(Long empId);

  List<Equipment> findAllByOrderByIdDesc();
}
