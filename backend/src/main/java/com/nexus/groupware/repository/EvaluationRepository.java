package com.nexus.groupware.repository;

import com.nexus.groupware.entity.Evaluation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EvaluationRepository extends JpaRepository<Evaluation, Long> {
    List<Evaluation> findAllByOrderByTotalScoreDescIdDesc();
}

