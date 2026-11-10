package com.nexus.groupware;
import static org.assertj.core.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.groupware.domain.procurement.db.*;
import com.nexus.groupware.domain.procurement.service.*;
import org.junit.jupiter.api.Test;

class ProcurementGatewayTest {
  final ProcurementGateway gateway=new ProcurementGateway(new ProcurementSettings(),new ObjectMapper());
  String response(String items,int total){return "{\"response\":{\"header\":{\"resultCode\":\"00\"},\"body\":{\"pageNo\":1,\"numOfRows\":1000,\"totalCount\":"+total+",\"items\":"+items+"}}}";}
  @Test void requestsPageSizeAcceptedByLiveGatewayAndEncodesCredentialOnlyOnce() {
    var settings=new ProcurementSettings();settings.serviceKey="synthetic+key==";
    var uri=new java.util.concurrent.atomic.AtomicReference<java.net.URI>();
    var client=new ProcurementGateway(settings,new ObjectMapper()) {
      @Override protected String get(java.net.URI request){uri.set(request);return response("[]",0);}
    };
    var until=java.time.LocalDateTime.of(2026,11,9,12,0);
    client.getPage("BID","SERVC","1",until.minusDays(1),until,1);
    assertThat(uri.get().getRawQuery()).contains("numOfRows=999", "serviceKey=synthetic%2Bkey%3D%3D").doesNotContain("%253D");
  }
  @Test void institutionSearchUsesOfficialParametersForBothKindsAndAllBusinesses() {
    var settings=new ProcurementSettings();settings.serviceKey="synthetic-key";
    var uri=new java.util.concurrent.atomic.AtomicReference<java.net.URI>();
    var client=new ProcurementGateway(settings,new ObjectMapper()) {
      @Override protected String get(java.net.URI request){uri.set(request);return response("[]",0).replace("\"pageNo\":1", "\"pageNo\":3");}
    };
    var until=java.time.LocalDateTime.of(2026,11,9,12,0);
    for(String kind:java.util.List.of("BID","SPEC")) for(String business:java.util.List.of("SERVC","THNG","CNSTWK","FRGCPT")) {
      client.getPage(kind,business,"1",until.minusDays(7),until,3,new ProcurementSearch.Filter("dminsttNm","합성 기관"));
      assertThat(uri.get().getPath()).endsWith(kind.equals("BID")?"PPSSrch02":"PPSSrch");
      assertThat(java.net.URLDecoder.decode(uri.get().getRawQuery(),java.nio.charset.StandardCharsets.UTF_8))
        .contains("dminsttNm=합성 기관","inqryBgnDt=202611021200","inqryEndDt=202611091200","pageNo=3","numOfRows=999")
        .doesNotContain("bidNtceNm=","prdctClsfcNoNm=");
    }
    assertThatThrownBy(()->client.getPage("BID","SERVC","3",until.minusDays(7),until,1,new ProcurementSearch.Filter("ntceInsttNm","합성"))).isInstanceOf(IllegalArgumentException.class);
  }
  @Test void institutionPlansPreserveBothAgencyRolesCodesAndKeywordOnlyOrRules() {
    var rule=new ProcurementRule();rule.institutions="합성기관, SYNTH001";rule.keywords="GIS";rule.matchMode="AND";
    var filters=ProcurementSearch.filters(java.util.List.of(rule));
    assertThat(filters).hasSize(6).contains(new ProcurementSearch.Filter("ntceInsttNm","합성기관"),new ProcurementSearch.Filter("dminsttNm","합성기관"),new ProcurementSearch.Filter("ntceInsttCd","SYNTH001"),new ProcurementSearch.Filter("dminsttCd","SYNTH001")).doesNotContain(ProcurementSearch.ALL);
    rule.matchMode="OR";assertThat(ProcurementSearch.filters(java.util.List.of(rule))).contains(ProcurementSearch.ALL);
    rule.institutions="";assertThat(ProcurementSearch.filters(java.util.List.of(rule))).containsExactly(ProcurementSearch.ALL);
    assertThat(ProcurementSearch.filters(java.util.List.of())).isEmpty();
  }
  @Test void officialBidAndSpecShapesAreParsedWithoutUnsafeUrls()throws Exception {
    String bid="{\"bidNtceNo\":\"SYNTH-BID\",\"bidNtceOrd\":\"001\",\"bidNtceNm\":\"GIS 합성 용역\",\"ntceInsttNm\":\"합성기관\",\"bidNtceDtlUrl\":\"javascript:bad\"}";
    var n=gateway.parse(response("["+bid+"]",1),"BID","SERVC",1).items().get(0);
    assertThat(n.externalId).isEqualTo("SYNTH-BID");assertThat(n.revision).isEqualTo("001");assertThat(n.sourceUrl).isEqualTo("https://www.g2b.go.kr/");
    var spec=gateway.parse(response("{\"item\":{\"bfSpecRgstNo\":\"SYNTH-SPEC\",\"prdctClsfcNoNm\":\"공간정보 합성 사업\",\"orderInsttNm\":\"합성발주기관\",\"rlDminsttNm\":\"합성수요기관\",\"opninRgstClseDt\":\"2026-11-30\"}}",1),"SPEC","SERVC",1).items().get(0);
    assertThat(spec.agency).isEqualTo("합성발주기관");assertThat(spec.deadline).isEqualTo("2026-11-30");
    assertThat(gateway.parse(response("\"\"",0),"BID","SERVC",1).items()).isEmpty();
    assertThat(ProcurementGateway.safeUrl("https://www.g2b.go.kr.evil.invalid/test")).isEmpty();
    assertThat(ProcurementGateway.safeUrl("https://www.g2b.go.kr/test")).isNotBlank();
  }
  @Test void failuresAndMalformedNonemptyPagesMustNotAdvanceCheckpoint(){
    assertThatThrownBy(()->gateway.parse(response("[{\"bidNtceNo\":\"SYNTH\",\"bidNtceNm\":\"합성\"}]",1500),"BID","SERVC",1)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(()->gateway.parse(response("[]",1),"BID","SERVC",1)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(()->gateway.parse(response("[{}]",1),"BID","SERVC",1)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(()->gateway.parse("{\"response\":{\"header\":{\"resultCode\":\"22\"}}}","BID","SERVC",1)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(()->gateway.parse(response("[]",0),"BID","SERVC",2)).isInstanceOf(IllegalArgumentException.class);
  }
  @Test void keywordInstitutionAndExclusionSemanticsAreExplicit()throws Exception {
    var r=new ProcurementRule();r.enabled=true;r.noticeKind="ALL";r.businessType="ALL";r.keywords="GIS\n공간정보";r.institutions="합성기관";r.excludedKeywords="소모품";r.matchMode="AND";
    var n=new ProcurementNotice();n.kind="BID";n.businessType="SERVC";n.title="g i s 구축";n.agency="합성기관 지역본부";n.demandAgency="";
    assertThat(ProcurementMatcher.matches(r,n)).isTrue();n.agency="다른 기관";assertThat(ProcurementMatcher.matches(r,n)).isFalse();
    r.matchMode="OR";assertThat(ProcurementMatcher.matches(r,n)).isTrue();n.title="GIS 소모품";assertThat(ProcurementMatcher.matches(r,n)).isFalse();
    n.title="일반 사업";n.agency="합성기관";r.keywords="";assertThat(ProcurementMatcher.matches(r,n)).isTrue();r.enabled=false;assertThat(ProcurementMatcher.matches(r,n)).isFalse();
  }
}
