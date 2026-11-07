package com.nexus.groupware.domain.master.db;
import com.nexus.groupware.core.base.IsoDateConverter;

import jakarta.persistence.*;

@Entity
@Table(name = "holidays")
public class Holiday {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Convert(converter = IsoDateConverter.class)
  @Column(name = "holiday_date", nullable = false)
  private String holidayDate;

  @Column(name = "holiday_name", nullable = false, length = 100)
  private String holidayName;

  @Column(name = "is_statutory", nullable = false)
  private boolean isStatutory = true;

  @Column(length = 255)
  private String description;

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public String getHolidayDate() {
    return holidayDate;
  }

  public void setHolidayDate(String holidayDate) {
    this.holidayDate = holidayDate;
  }

  public String getHolidayName() {
    return holidayName;
  }

  public void setHolidayName(String holidayName) {
    this.holidayName = holidayName;
  }

  public boolean isStatutory() {
    return isStatutory;
  }

  public void setStatutory(boolean statutory) {
    isStatutory = statutory;
  }

  public String getDescription() {
    return description;
  }

  public void setDescription(String description) {
    this.description = description;
  }
}

