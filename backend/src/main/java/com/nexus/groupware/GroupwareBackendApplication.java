package com.nexus.groupware;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;

@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
public class GroupwareBackendApplication {
  public static void main(String[] args) {
    SpringApplication.run(GroupwareBackendApplication.class, args);
  }
}
