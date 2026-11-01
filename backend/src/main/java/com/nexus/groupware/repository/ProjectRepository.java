package com.nexus.groupware.repository;

import com.nexus.groupware.entity.Project;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectRepository extends JpaRepository<Project, Long> {
  List<Project> findAllByOrderByIdDesc();
}
