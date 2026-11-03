package com.nexus.groupware.evaluation;
import org.springframework.data.jpa.repository.*;
import java.util.List;
public interface EvaluationPlanRepository extends JpaRepository<EvaluationPlan,Long>, JpaSpecificationExecutor<EvaluationPlan> {
  List<EvaluationPlan> findByEmployeeIdOrderByIdDesc(Long id);
}
