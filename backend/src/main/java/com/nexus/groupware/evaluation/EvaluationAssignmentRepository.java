package com.nexus.groupware.evaluation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface EvaluationAssignmentRepository extends JpaRepository<EvaluationAssignment,Long> {
  long countByProjectId(Long projectId);
  List<EvaluationAssignment> findByProjectIdAndEndedOnIsNull(Long id);
  List<EvaluationAssignment> findByEmployeeIdOrderByAssignedOnDescIdDesc(Long id);
}
