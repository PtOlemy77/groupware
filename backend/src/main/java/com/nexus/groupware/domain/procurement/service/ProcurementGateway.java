package com.nexus.groupware.domain.procurement.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.groupware.domain.procurement.db.ProcurementNotice;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * 공공데이터포털 나라장터 입찰공고 및 사전규격 OpenAPI 연동 게이트웨이
 */
@Component
public class ProcurementGateway {

    /**
     * 공공데이터포털 실제 호출 시 1000 요청 시 10건으로 폴백되는 버그가 있으므로 최대 허용치 999 사용
     */
    public static final int PAGE_SIZE = 999;

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmm");
    private static final Map<String, String> SERVICE_SUFFIX = Map.of(
            "SERVC", "Servc",
            "THNG", "Thng",
            "CNSTWK", "Cnstwk",
            "FRGCPT", "Frgcpt"
    );

    public record FeedPage(List<ProcurementNotice> items, int total, int page, int size) {}

    private final ProcurementSettings settings;
    private final ObjectMapper objectMapper;

    public ProcurementGateway(ProcurementSettings settings, ObjectMapper objectMapper) {
        this.settings = settings;
        this.objectMapper = objectMapper;
    }

    public FeedPage getPage(
            String kind,
            String business,
            String division,
            LocalDateTime from,
            LocalDateTime until,
            int page
    ) {
        return getPage(kind, business, division, from, until, page, ProcurementSearch.ALL);
    }

    public FeedPage getPage(
            String kind,
            String business,
            String division,
            LocalDateTime from,
            LocalDateTime until,
            int page,
            ProcurementSearch.Filter filter
    ) {
        String suffix = SERVICE_SUFFIX.get(business);
        boolean isInstitutionSearch = !filter.field().isEmpty();

        if (isInstitutionSearch && !"1".equals(division)) {
            throw new IllegalArgumentException("기관별 검색은 등록일시(1) 기준 조회만 지원합니다.");
        }

        String endpoint = "BID".equals(kind)
                ? "https://apis.data.go.kr/1230000/ad/BidPublicInfoService02/getBidPblancListInfo" + suffix + (isInstitutionSearch ? "PPSSrch02" : "02")
                : "https://apis.data.go.kr/1230000/ao/HrcspSsstndrdInfoService/getPublicPrcureThngInfo" + suffix + (isInstitutionSearch ? "PPSSrch" : "");

        StringBuilder query = new StringBuilder("?")
                .append("serviceKey=").append(URLEncoder.encode(settings.serviceKey, StandardCharsets.UTF_8))
                .append("&type=json")
                .append("&numOfRows=").append(PAGE_SIZE)
                .append("&pageNo=").append(page)
                .append("&inqryDiv=").append(division)
                .append("&inqryBgnDt=").append(from.format(DATE_FORMAT))
                .append("&inqryEndDt=").append(until.format(DATE_FORMAT));

        if (isInstitutionSearch) {
            query.append("&").append(filter.field()).append("=").append(URLEncoder.encode(filter.value(), StandardCharsets.UTF_8));
        }

        try {
            String responseBody = get(URI.create(endpoint + query));
            return parse(responseBody, kind, business, page);
        } catch (Exception e) {
            throw new IllegalStateException("나라장터 조회 실패: API 승인·호출 한도·네트워크 상태를 확인하세요.", e);
        }
    }

    protected String get(URI uri) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) uri.toURL().openConnection();
        connection.setConnectTimeout(5000);
        connection.setReadTimeout(20000);
        connection.setInstanceFollowRedirects(false);

        try {
            if (connection.getResponseCode() != 200) {
                throw new IllegalStateException("나라장터 API 응답 오류 (HTTP " + connection.getResponseCode() + ")");
            }

            try (var bodyStream = connection.getInputStream()) {
                byte[] bytes = bodyStream.readNBytes(8_000_001);
                if (bytes.length > 8_000_000) {
                    throw new IllegalStateException("API 응답 크기가 너무 큽니다 (최대 8MB 초과)");
                }
                return new String(bytes, StandardCharsets.UTF_8);
            }
        } finally {
            connection.disconnect();
        }
    }

    public FeedPage parse(String payload, String kind, String business, int page) throws Exception {
        JsonNode root = objectMapper.readTree(payload).path("response");
        String resultCode = root.path("header").path("resultCode").asText();

        if (!Set.of("00", "0").contains(resultCode)) {
            throw new IllegalArgumentException("API 오류 코드 반환: " + resultCode);
        }

        JsonNode body = root.path("body");
        if (!body.has("totalCount") || !body.has("items")) {
            throw new IllegalArgumentException("응답 본문에 필수 필드(totalCount, items)가 누락되었습니다.");
        }

        int totalCount = Integer.parseInt(body.path("totalCount").asText());
        int pageSize = body.path("numOfRows").asInt(1000);

        if (totalCount < 0 || pageSize < 1 || body.path("pageNo").asInt(page) != page) {
            throw new IllegalArgumentException("올바르지 않은 페이지 정보입니다.");
        }

        JsonNode itemsNode = body.path("items");
        if (itemsNode.isObject() && itemsNode.has("item")) {
            itemsNode = itemsNode.path("item");
        }

        List<JsonNode> itemNodes = new ArrayList<>();
        if (itemsNode.isArray()) {
            itemsNode.forEach(itemNodes::add);
        } else if (itemsNode.isObject() && itemsNode.size() > 0) {
            itemNodes.add(itemsNode);
        } else if (totalCount > 0) {
            throw new IllegalArgumentException("공고 항목 데이터가 누락되었습니다.");
        }

        boolean isBid = "BID".equals(kind);
        List<ProcurementNotice> noticeList = new ArrayList<>();

        for (JsonNode item : itemNodes) {
            ProcurementNotice notice = new ProcurementNotice();
            notice.kind = kind;
            notice.businessType = business;

            notice.externalId = text(item, isBid ? "bidNtceNo" : "bfSpecRgstNo", 100);
            notice.title = text(item, isBid ? "bidNtceNm" : "prdctClsfcNoNm", 2000);

            if (notice.externalId.isBlank() || notice.title.isBlank()) {
                throw new IllegalArgumentException("공고 식별자 또는 제목이 비어있습니다.");
            }

            notice.revision = isBid ? text(item, "bidNtceOrd", 100) : "";
            notice.agency = text(item, isBid ? "ntceInsttNm" : "orderInsttNm", 500);
            notice.demandAgency = text(item, isBid ? "dminsttNm" : "rlDminsttNm", 500);
            notice.agencyCode = text(item, "ntceInsttCd", 100);
            notice.demandAgencyCode = text(item, "dminsttCd", 100);
            notice.publishedAt = text(item, isBid ? "bidNtceDt" : "rgstDt", 50);
            notice.changedAt = text(item, "chgDt", 50);
            notice.deadline = text(item, isBid ? "bidClseDt" : "opninRgstClseDt", 50);

            notice.budget = text(item, "asignBdgtAmt", 100);
            if (notice.budget.isBlank()) {
                notice.budget = text(item, "presmptPrce", 100);
            }

            notice.noticeStatus = isBid ? text(item, "ntceKindNm", 100) : "사전규격";
            notice.sourceUrl = isBid ? safeUrl(text(item, "bidNtceDtlUrl", 2000)) : "";

            // 사전규격은 별도 고유 상세 링크가 제공되지 않으므로 공식 나라장터 홈 링크로 연결
            if (notice.sourceUrl.isBlank()) {
                notice.sourceUrl = "https://www.g2b.go.kr/";
            }

            // 고유성 판정용 핑거프린트 생성
            byte[] identityBytes = objectMapper.writeValueAsBytes(List.of(
                    notice.externalId,
                    notice.revision,
                    notice.title,
                    notice.agency,
                    notice.demandAgency,
                    notice.publishedAt,
                    notice.changedAt,
                    notice.deadline,
                    notice.budget,
                    notice.noticeStatus,
                    notice.sourceUrl
            ));
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            notice.fingerprint = HexFormat.of().formatHex(digest.digest(identityBytes));

            noticeList.add(notice);
        }

        long remaining = (long) totalCount - (long) (page - 1) * pageSize;
        if (noticeList.size() != Math.min(pageSize, Math.max(0, remaining))) {
            throw new IllegalArgumentException("수신된 항목 수와 계산된 잔여 수가 일치하지 않습니다.");
        }

        return new FeedPage(noticeList, totalCount, page, pageSize);
    }

    private static String text(JsonNode row, String name, int limit) {
        String value = row.path(name).asText("").strip();
        if (value.length() > limit) {
            throw new IllegalArgumentException("필드 값 길이가 제한을 초과했습니다: " + name);
        }
        return value;
    }

    /**
     * 공식 나라장터(g2b.go.kr) HTTPS URL인지 검증 (안전하지 않은 URL 및 인증정보 포함 URL 배제)
     */
    public static String safeUrl(String value) {
        try {
            URI uri = URI.create(value);
            String host = Objects.toString(uri.getHost(), "").toLowerCase(Locale.ROOT);
            boolean isG2bHost = host.equals("g2b.go.kr") || host.endsWith(".g2b.go.kr");
            boolean isHttps = "https".equals(uri.getScheme());
            boolean noUserInfo = uri.getUserInfo() == null;

            return (isHttps && isG2bHost && noUserInfo) ? value : "";
        } catch (Exception e) {
            return "";
        }
    }
}
