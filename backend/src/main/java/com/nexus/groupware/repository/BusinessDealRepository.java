package com.nexus.groupware.repository;

import com.nexus.groupware.entity.BusinessDeal;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BusinessDealRepository
    extends JpaRepository<BusinessDeal, Long>,
        org.springframework.data.jpa.repository.JpaSpecificationExecutor<BusinessDeal> {
  Long countByOwnerId(Long ownerId);

  List<BusinessDeal> findAllByOrderByIdDesc();
}
