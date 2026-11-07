package com.nexus.groupware.core.base;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.time.LocalDate;

/** Preserve the API's ISO date string while storing a native SQL DATE. */
@Converter
public class IsoDateConverter implements AttributeConverter<String, LocalDate> {
  public LocalDate convertToDatabaseColumn(String value) {
    return value == null ? null : LocalDate.parse(value);
  }

  public String convertToEntityAttribute(LocalDate value) {
    return value == null ? null : value.toString();
  }
}
