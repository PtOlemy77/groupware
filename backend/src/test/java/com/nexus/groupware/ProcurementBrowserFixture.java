package com.nexus.groupware;

import com.nexus.groupware.core.security.AuthService;
import com.nexus.groupware.domain.procurement.service.*;
import java.util.*;
import javax.sql.DataSource;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/** Test classpath only. Refuses every database except an isolated H2 memory DB. */
@RestController
@Profile("test")
@RequestMapping("/api/test/procurement-feed")
public class ProcurementBrowserFixture {
  private final DataSource db;
  private final AuthService auth;
  private final ProcurementStore store;
  private final ProcurementGateway feed;
  public ProcurementBrowserFixture(DataSource d,AuthService a,ProcurementStore s,ProcurementGateway g){db=d;auth=a;store=s;feed=g;}
  @PostMapping public Map<String,Object> importSynthetic(@RequestBody Map<String,String> body)throws Exception {
    if(!AuthService.executive(auth.current()))throw new ResponseStatusException(HttpStatus.FORBIDDEN);
    try(var c=db.getConnection()){if(!c.getMetaData().getURL().startsWith("jdbc:h2:mem:"))throw new ResponseStatusException(HttpStatus.FORBIDDEN);}
    String kind=body.get("kind");if(!Set.of("BID","SPEC").contains(kind))throw new IllegalArgumentException("Invalid synthetic kind");
    String id=kind+"_SERVC_1",token=UUID.randomUUID().toString();
    if(!store.claim(token))throw new ResponseStatusException(HttpStatus.CONFLICT);
    try{var w=store.window(id,token);var page=feed.parse(body.get("payload"),kind,"SERVC",w.page());store.apply(id,token,w,page);return Map.of("ok",true);}
    finally{store.release(token);}
  }
}
