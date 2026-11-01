package com.nexus.groupware.repository;

import com.nexus.groupware.entity.BusinessDeal;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BusinessDealRepository extends JpaRepository<BusinessDeal, Long> {
    List<BusinessDeal> findAllByOrderByIdDesc();
}

