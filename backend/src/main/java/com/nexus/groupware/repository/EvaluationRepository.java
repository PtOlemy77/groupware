package com.nexus.groupware.repository;

import com.nexus.groupware.entity.Evaluation;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EvaluationRepository
    extends JpaRepository<Evaluation, Long>,
        org.springframework.data.jpa.repository.JpaSpecificationExecutor<Evaluation> {
  Long countByEmployeeId(Long employeeId);

  List<Evaluation> findAllByOrderByTotalScoreDescIdDesc();
}
