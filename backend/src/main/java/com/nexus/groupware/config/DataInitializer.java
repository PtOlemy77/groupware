package com.nexus.groupware.config;

import com.nexus.groupware.entity.*;
import com.nexus.groupware.repository.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import java.util.stream.Collectors;

@Component
public class DataInitializer implements CommandLineRunner {

    private final EmployeeRepository employeeRepository;
    private final ProjectRepository projectRepository;
    private final EquipmentRepository equipmentRepository;
    private final BusinessDealRepository businessDealRepository;
    private final EvaluationRepository evaluationRepository;
    private final ApprovalRepository approvalRepository;
    private final CommonCodeRepository commonCodeRepository;

    public DataInitializer(EmployeeRepository employeeRepository,
                           ProjectRepository projectRepository,
                           EquipmentRepository equipmentRepository,
                           BusinessDealRepository businessDealRepository,
                           EvaluationRepository evaluationRepository,
                           ApprovalRepository approvalRepository,
                           CommonCodeRepository commonCodeRepository) {
        this.employeeRepository = employeeRepository;
        this.projectRepository = projectRepository;
        this.equipmentRepository = equipmentRepository;
        this.businessDealRepository = businessDealRepository;
        this.evaluationRepository = evaluationRepository;
        this.approvalRepository = approvalRepository;
        this.commonCodeRepository = commonCodeRepository;
    }

    @Override
    @Transactional
    public void run(String... args) {
        // 1. 공통 코드 테이블 (common_codes)이 비어있거나 4단계 권한 코드(ROLE_SYS_ADMIN 등)가 없으면 동기화
        boolean hasFourTierRoleCodes = commonCodeRepository.findByGroupCodeOrderBySortOrderAsc("USER_ROLE")
                .stream()
                .anyMatch(c -> "ROLE_SYS_ADMIN".equals(c.getCode()));
        if (commonCodeRepository.count() == 0 || !hasFourTierRoleCodes) {
            syncCommonCodes();
        }

        // 2. 직원 수가 30명 미만이면 실제 스패셜티 38명(+대표이사) 명단으로 동기화, 이미 존재하면 4단계 권한 체계로 마이그레이션
        if (employeeRepository.count() < 30) {
            syncEmployees();
        } else {
            migrateEmployeeRolesToFourTier();
        }

        // 3. 프로젝트 테이블에 지분율 정보가 없거나 실제 사업본부 프로젝트가 구버전 상태이면 DB 동기화
        boolean needsProjectSync = projectRepository.findAll().stream()
                .anyMatch(p -> p.getShareRate() == null || p.getOurBudget() == null || p.getOurBudget() == 0)
                || projectRepository.findAll().stream()
                .noneMatch(p -> "LX주요 업무시스템 유지관리 Pjt".equals(p.getName()))
                || projectRepository.findAll().stream()
                .anyMatch(p -> "진행중".equals(p.getStatus()) || (p.getMembers() != null && p.getMembers().contains("이지은")));
        if (needsProjectSync) {
            syncProjects();
        }

        // 4. 결재(계약품의서) 및 인사평가 데이터에 실제 JSON(manpowerPlans)이 없거나 지분율 미반영 구버전이면 DB 동기화
        boolean needsApprovalSync = approvalRepository.findAll().stream()
                .filter(a -> "계약품의".equals(a.getCategory()) || "계약품의서".equals(a.getCategory()))
                .anyMatch(a -> a.getItemsJson() == null || "[]".equals(a.getItemsJson().trim()) || (a.getDocNo() != null && a.getDocNo().equals("APP-2026-003") && a.getAmount() > 400000));
        if (needsApprovalSync || approvalRepository.count() == 0) {
            syncApprovalsAndEvaluations();
        }

        // 5. 자산(IT 장비) 테이블에 현재 재직 직원 목록에 없는 구버전 이름이 있거나 emp_id 정합성이 비어있으면 실제 직원 PK 기반으로 동기화
        List<String> realEmpNames = employeeRepository.findAll().stream().map(Employee::getName).toList();
        boolean needsEquipmentSync = equipmentRepository.count() == 0 || equipmentRepository.findAll().stream()
                .anyMatch(eq -> (!"미배정".equals(eq.getAssignedTo()) && !realEmpNames.contains(eq.getAssignedTo()))
                        || ("사용중".equals(eq.getStatus()) && eq.getEmpId() == null));
        if (needsEquipmentSync) {
            syncEquipments();
        }
    }

    private String buildContractJson(
            String docNo,
            String title,
            String clientName,
            String startDate,
            String endDate,
            int supplyAmount,
            String drafterName,
            String drafterPos,
            String manpowerPlansJson
    ) {
        return buildContractJson(docNo, title, clientName, startDate, endDate, supplyAmount, 100.0, drafterName, drafterPos, manpowerPlansJson);
    }

    private String buildContractJson(
            String docNo,
            String title,
            String clientName,
            String startDate,
            String endDate,
            int supplyAmount,
            double ourShareRate,
            String drafterName,
            String drafterPos,
            String manpowerPlansJson
    ) {
        int vatAmount = (int) Math.round(supplyAmount * 0.1);
        int laborCostTotal = (int) Math.round(supplyAmount * 0.72);
        int directExpenseTotal = 14200;
        int totalBudget = laborCostTotal + directExpenseTotal;
        int salesProfit = supplyAmount - totalBudget;
        double contingencyCost = Math.round(totalBudget * 0.02 * 10.0) / 10.0;
        double projectNetProfit = salesProfit - contingencyCost;
        double profitRate = Math.round((projectNetProfit / supplyAmount) * 10000.0) / 100.0;

        return "{"
                + "\"docNo\":\"" + docNo + "\","
                + "\"version\":\"1.0\","
                + "\"title\":\"" + title + "\","
                + "\"clientName\":\"" + clientName + "\","
                + "\"contractPeriod\":\"" + startDate.replace("-", ".") + " ~ " + endDate.replace("-", ".") + "\","
                + "\"startDate\":\"" + startDate + "\","
                + "\"endDate\":\"" + endDate + "\","
                + "\"contractType\":\"용역구축\","
                + "\"paymentTerms\":\"계좌이체(기성/잔금)\","
                + "\"warrantyPeriod\":\"12개월\","
                + "\"delayPenaltyRate\":0.15,"
                + "\"ourShareRate\":" + ourShareRate + ","
                + "\"supplyAmount\":" + supplyAmount + ","
                + "\"vatAmount\":" + vatAmount + ","
                + "\"productCostTotal\":0,"
                + "\"outsourcingTotal\":0,"
                + "\"laborCostTotal\":" + laborCostTotal + ","
                + "\"directExpenseTotal\":" + directExpenseTotal + ","
                + "\"estimatedAsTotal\":0,"
                + "\"proposalCostTotal\":0,"
                + "\"totalBudget\":" + totalBudget + ","
                + "\"salesProfit\":" + salesProfit + ","
                + "\"contingencyRate\":2.0,"
                + "\"contingencyCost\":" + contingencyCost + ","
                + "\"projectNetProfit\":" + projectNetProfit + ","
                + "\"profitRate\":" + profitRate + ","
                + "\"productCosts\":[{\"id\":\"p1\",\"category\":\"H/W 장비\",\"itemName\":\"공간정보 DB 서버\",\"spec\":\"64Core / 256GB RAM\",\"qty\":0,\"unitPrice\":0,\"amount\":0,\"note\":\"사내 서버 활용\"}],"
                + "\"manpowerPlans\":" + manpowerPlansJson + ","
                + "\"outsourcings\":[],"
                + "\"directExpenses\":["
                + "{\"id\":\"e1\",\"account\":\"복리/특근식대\",\"qty\":400,\"unitPrice\":10,\"basis\":\"투입인력 특근식대\",\"amount\":4000,\"note\":\"야근식대\"},"
                + "{\"id\":\"e2\",\"account\":\"복리/회의비\",\"qty\":30,\"unitPrice\":70,\"basis\":\"착수/중간/완료보고\",\"amount\":2100,\"note\":\"회의비\"},"
                + "{\"id\":\"e3\",\"account\":\"국내출장비\",\"qty\":15,\"unitPrice\":400,\"basis\":\"발주처 기술협의 출장\",\"amount\":6000,\"note\":\"출장여비\"},"
                + "{\"id\":\"e4\",\"account\":\"인쇄도서비\",\"qty\":1,\"unitPrice\":2100,\"basis\":\"산출물 인쇄 1식\",\"amount\":2100,\"note\":\"보고서 인쇄\"}"
                + "],"
                + "\"riskEvaluations\":["
                + "{\"id\":\"r1\",\"category\":\"고객성향\",\"question\":\"고객 커뮤니케이션 채널 및 요구조건 명확성\",\"selectedLevel\":\"하\",\"score\":1,\"exposureWeight\":2,\"calculatedExposure\":2},"
                + "{\"id\":\"r2\",\"category\":\"기술력\",\"question\":\"유사 GIS/디지털트윈 플랫폼 구축 경험\",\"selectedLevel\":\"하\",\"score\":1,\"exposureWeight\":3,\"calculatedExposure\":3}"
                + "],"
                + "\"cashflowMilestones\":[],"
                + "\"approvalLine\":{"
                + "\"drafter\":{\"name\":\"" + drafterName + "\",\"position\":\"" + drafterPos + "\",\"dept\":\"사업본부\",\"status\":\"작성완료\",\"date\":\"2026-01-10\"},"
                + "\"bizHead\":{\"name\":\"박용묵\",\"position\":\"이사\",\"status\":\"검토완료\"},"
                + "\"ceo\":{\"name\":\"권우석\",\"position\":\"사장\",\"status\":\"승인완료\"}"
                + "},"
                + "\"consensusLine\":{"
                + "\"qm\":{\"name\":\"홍지형\",\"position\":\"대리\",\"dept\":\"품질경영팀\",\"status\":\"합의완료\"},"
                + "\"mgmt\":{\"name\":\"조선영\",\"position\":\"과장\",\"dept\":\"경영지원팀\",\"status\":\"합의완료\"},"
                + "\"pm\":{\"name\":\"" + drafterName + "\",\"position\":\"" + drafterPos + "\",\"dept\":\"사업본부\",\"status\":\"합의완료\"}"
                + "}"
                + "}";
    }

    private void syncApprovalsAndEvaluations() {
        evaluationRepository.deleteAll();
        evaluationRepository.flush();

        List<Evaluation> defaultEvaluations = List.of(
            new Evaluation("20110801", "우광일", "DEPT_BIZ", "사업본부", "POS_DGM", "차장",
                "2026년 상반기", 96, 94, 95, 95.2, "S", "권우석 사장", "확정",
                "디지털트윈 지적공간정보 고도화 사업 기획 및 주요 프로젝트 총괄 우수 수행"),
            new Evaluation("20210817-3", "최영진", "DEPT_BIZ", "사업본부", "POS_AM", "대리",
                "2026년 상반기", 94, 92, 93, 93.2, "S", "박용묵 이사", "확정",
                "LX 주요 업무시스템 유지관리 핵심 모듈 안정적 운영 및 고객사 만족도 우수"),
            new Evaluation("20170101", "조경연", "DEPT_BIZ", "사업본부", "POS_MGR", "과장",
                "2026년 상반기", 88, 87, 89, 87.9, "A", "김성철 부장", "확정",
                "공간데이터 파이프라인 아키텍처 재설계 및 쿼리 성능 대폭 개선"),
            new Evaluation("20210101-2", "조예나", "DEPT_BIZ", "사업본부", "POS_AM", "대리",
                "2026년 상반기", 89, 86, 88, 87.9, "A", "김성철 부장", "확정",
                "WebGIS 반응형 컴포넌트 구축 및 사용자 UI 사용성 대폭 향상"),
            new Evaluation("20230101", "김진수", "DEPT_BIZ", "사업본부", "POS_STAFF", "담당",
                "2026년 상반기", 86, 85, 87, 85.9, "A", "김성철 부장", "확정",
                "공공 OpenAPI 연계 인터페이스 구축 및 주도적 개발 지원"),
            new Evaluation("20210817-1", "조선영", "DEPT_MGMT", "경영지원팀", "POS_MGR", "과장",
                "2026년 상반기", 90, 88, 91, 89.6, "A", "권우석 사장", "확정",
                "전사 인사평가/계약품의서 행정 프로세스 체계화 및 복리후생 지원 우수"),
            new Evaluation("20251201-1", "홍지형", "DEPT_QM", "품질경영팀", "POS_AM", "대리",
                "2026년 상반기", 88, 87, 88, 87.7, "A", "권우석 사장", "확정",
                "전자정부 프레임워크 표준 검수 및 GS 인증 시험 적기 통과")
        );
        evaluationRepository.saveAll(defaultEvaluations);

        approvalRepository.deleteAll();
        approvalRepository.flush();

        // 1) PRJ-2026-01: LX주요 업무시스템 유지관리 Pjt (9명: 김성철, 최영진, 조예나, 엄창민, 이영호, 이기승, 최진우, 김진수, 구종석)
        String prj1Manpower = "["
            + "{\"id\":\"m1\",\"type\":\"당사\",\"grade\":\"특급\",\"role\":\"총괄 PM\",\"name\":\"김성철\",\"position\":\"부장\",\"months\":[1,1,1,1,1,1,1,1],\"totalMM\":8,\"unitPrice\":13100,\"laborCost\":104800},"
            + "{\"id\":\"m2\",\"type\":\"당사\",\"grade\":\"중급\",\"role\":\"응용시스템 운영PL\",\"name\":\"최영진\",\"position\":\"대리\",\"months\":[1,1,1,1,1,1,1,1],\"totalMM\":8,\"unitPrice\":7800,\"laborCost\":62400},"
            + "{\"id\":\"m3\",\"type\":\"당사\",\"grade\":\"중급\",\"role\":\"공간정보 서비스 운영\",\"name\":\"조예나\",\"position\":\"대리\",\"months\":[1,1,1,1,1,1,1,1],\"totalMM\":8,\"unitPrice\":7800,\"laborCost\":62400},"
            + "{\"id\":\"m4\",\"type\":\"당사\",\"grade\":\"중급\",\"role\":\"백엔드 API 유지관리\",\"name\":\"엄창민\",\"position\":\"대리\",\"months\":[1,1,1,1,1,1,1,1],\"totalMM\":8,\"unitPrice\":7800,\"laborCost\":62400},"
            + "{\"id\":\"m5\",\"type\":\"당사\",\"grade\":\"중급\",\"role\":\"데이터 연계 모듈 관리\",\"name\":\"이영호\",\"position\":\"대리\",\"months\":[1,1,1,1,1,1,1,1],\"totalMM\":8,\"unitPrice\":7800,\"laborCost\":62400},"
            + "{\"id\":\"m6\",\"type\":\"당사\",\"grade\":\"중급\",\"role\":\"공간솔루션 기술지원\",\"name\":\"이기승\",\"position\":\"대리\",\"months\":[1,1,1,1,1,1,1,1],\"totalMM\":8,\"unitPrice\":7800,\"laborCost\":62400},"
            + "{\"id\":\"m7\",\"type\":\"당사\",\"grade\":\"중급\",\"role\":\"DB 및 인프라 운영\",\"name\":\"최진우\",\"position\":\"대리\",\"months\":[1,1,1,1,1,1,1,1],\"totalMM\":8,\"unitPrice\":7800,\"laborCost\":62400},"
            + "{\"id\":\"m8\",\"type\":\"당사\",\"grade\":\"초급\",\"role\":\"시스템 상시 모니터링\",\"name\":\"김진수\",\"position\":\"담당\",\"months\":[1,1,1,1,1,1,1,1],\"totalMM\":8,\"unitPrice\":6600,\"laborCost\":52800},"
            + "{\"id\":\"m9\",\"type\":\"당사\",\"grade\":\"초급\",\"role\":\"헬프데스크 및 운영지원\",\"name\":\"구종석\",\"position\":\"담당\",\"months\":[1,1,1,1,1,1,1,1],\"totalMM\":8,\"unitPrice\":6600,\"laborCost\":52800}"
            + "]";

        // 2) PRJ-2026-02: 2026년 스마트 충북 공간정보 플랫폼 유지관리 (3명: 박용묵, 임서현, 최광현)
        String prj2Manpower = "["
            + "{\"id\":\"m1\",\"type\":\"당사\",\"grade\":\"특급\",\"role\":\"총괄 PM\",\"name\":\"박용묵\",\"position\":\"이사\",\"months\":[1,1,1,1,1,1,1,1],\"totalMM\":8,\"unitPrice\":13100,\"laborCost\":104800},"
            + "{\"id\":\"m2\",\"type\":\"당사\",\"grade\":\"중급\",\"role\":\"공간정보 플랫폼 유지관리\",\"name\":\"최광현\",\"position\":\"대리\",\"months\":[1,1,1,1,1,1,1,1],\"totalMM\":8,\"unitPrice\":7800,\"laborCost\":62400},"
            + "{\"id\":\"m3\",\"type\":\"당사\",\"grade\":\"초급\",\"role\":\"충북 플랫폼 운영지원\",\"name\":\"임서현\",\"position\":\"담당\",\"months\":[1,1,1,1,1,1,1,1],\"totalMM\":8,\"unitPrice\":6600,\"laborCost\":52800}"
            + "]";

        // 3) PRJ-2026-03: 한국국토정보공사(LX) 디지털트윈 기반 지적공간정보 고도화 (5명: 우광일, 조경연, 최석진, 강건우, 정다현)
        String prj3Manpower = "["
            + "{\"id\":\"m1\",\"type\":\"당사\",\"grade\":\"특급\",\"role\":\"총괄 PM\",\"name\":\"우광일\",\"position\":\"차장\",\"months\":[1,1,1,1,1,1,0,0],\"totalMM\":6,\"unitPrice\":13100,\"laborCost\":78600},"
            + "{\"id\":\"m2\",\"type\":\"당사\",\"grade\":\"고급\",\"role\":\"GIS 엔진 아키텍트\",\"name\":\"조경연\",\"position\":\"과장\",\"months\":[1,1,1,1,1,1,0,0],\"totalMM\":6,\"unitPrice\":9600,\"laborCost\":57600},"
            + "{\"id\":\"m3\",\"type\":\"당사\",\"grade\":\"중급\",\"role\":\"3D 지적공간 모델링\",\"name\":\"최석진\",\"position\":\"대리\",\"months\":[1,1,1,1,1,1,0,0],\"totalMM\":6,\"unitPrice\":7800,\"laborCost\":46800},"
            + "{\"id\":\"m4\",\"type\":\"당사\",\"grade\":\"초급\",\"role\":\"디지털트윈 시각화 개발\",\"name\":\"강건우\",\"position\":\"담당\",\"months\":[1,1,1,1,1,1,0,0],\"totalMM\":6,\"unitPrice\":6600,\"laborCost\":39600},"
            + "{\"id\":\"m5\",\"type\":\"당사\",\"grade\":\"초급\",\"role\":\"공간데이터 정합성 검증\",\"name\":\"정다현\",\"position\":\"담당\",\"months\":[1,1,1,1,1,1,0,0],\"totalMM\":6,\"unitPrice\":6600,\"laborCost\":39600}"
            + "]";

        // 4) PRJ-2026-04: 행정안전부 차세대 주소기반 공간정보 DB 구축 및 연계 (4명: 박용묵, 조근형, 송호석, 최진규)
        String prj4Manpower = "["
            + "{\"id\":\"m1\",\"type\":\"당사\",\"grade\":\"특급\",\"role\":\"제안/수행 PM\",\"name\":\"박용묵\",\"position\":\"이사\",\"months\":[1,1,1,1,1,0,0,0],\"totalMM\":5,\"unitPrice\":13100,\"laborCost\":65500},"
            + "{\"id\":\"m2\",\"type\":\"당사\",\"grade\":\"중급\",\"role\":\"주소DB 구축 PL\",\"name\":\"조근형\",\"position\":\"대리\",\"months\":[1,1,1,1,1,1,0,0],\"totalMM\":6,\"unitPrice\":7800,\"laborCost\":46800},"
            + "{\"id\":\"m3\",\"type\":\"당사\",\"grade\":\"초급\",\"role\":\"공간데이터 변환/연계\",\"name\":\"송호석\",\"position\":\"담당\",\"months\":[1,1,1,1,1,1,0,0],\"totalMM\":6,\"unitPrice\":6600,\"laborCost\":39600},"
            + "{\"id\":\"m4\",\"type\":\"당사\",\"grade\":\"초급\",\"role\":\"표준 API 개발\",\"name\":\"최진규\",\"position\":\"담당\",\"months\":[1,1,1,1,1,1,0,0],\"totalMM\":6,\"unitPrice\":6600,\"laborCost\":39600}"
            + "]";

        List<Approval> defaultApprovals = List.of(
            new Approval(
                "APP-2026-001",
                "계약품의서",
                "LX주요 업무시스템 유지관리 Pjt",
                "김성철",
                "부장",
                "사업본부",
                "2026-01-05",
                "승인완료",
                680000,
                "LX주요 업무시스템 유지관리 Pjt",
                "한국국토정보공사",
                "계좌이체(기성금)",
                "W-Q-S-12-6 표준 계약품의서 기반 계약 이행 및 연간 유지관리 용역 수행",
                buildContractJson(
                    "APP-2026-001",
                    "LX주요 업무시스템 유지관리 Pjt",
                    "한국국토정보공사",
                    "2026-01-01",
                    "2026-12-31",
                    680000,
                    "김성철",
                    "부장",
                    prj1Manpower
                ),
                "원안대로 최종 승인합니다.",
                "권우석 사장"
            ),
            new Approval(
                "APP-2026-002",
                "계약품의서",
                "2026년 스마트 충북 공간정보 플랫폼 유지관리",
                "박용묵",
                "이사",
                "사업본부",
                "2026-01-20",
                "승인완료",
                420000,
                "2026년 스마트 충북 공간정보 플랫폼 유지관리",
                "충청북도청",
                "계좌이체(분기별)",
                "충북 스마트 공간정보 플랫폼 연간 안정적 운영 및 데이터 정합성 유지",
                buildContractJson(
                    "APP-2026-002",
                    "2026년 스마트 충북 공간정보 플랫폼 유지관리",
                    "충청북도청",
                    "2026-02-01",
                    "2026-12-31",
                    420000,
                    "박용묵",
                    "이사",
                    prj2Manpower
                ),
                "충북 사업 승인 처리 완료.",
                "권우석 사장"
            ),
            new Approval(
                "APP-2026-003",
                "계약품의서",
                "한국국토정보공사(LX) 디지털트윈 기반 지적공간정보 고도화",
                "우광일",
                "차장",
                "사업본부",
                "2026-06-25",
                "승인완료",
                330000,
                "한국국토정보공사(LX) 디지털트윈 기반 지적공간정보 고도화",
                "한국국토정보공사",
                "계좌이체(착수/중도/잔금)",
                "3차원 지적공간정보 및 국토데이터 모델링 고도화 착수에 따른 예산 집행 승인 (컨소시엄 지분 60% 당사 수주)",
                buildContractJson(
                    "APP-2026-003",
                    "한국국토정보공사(LX) 디지털트윈 기반 지적공간정보 고도화",
                    "한국국토정보공사",
                    "2026-07-01",
                    "2026-12-31",
                    330000,
                    60.0,
                    "우광일",
                    "차장",
                    prj3Manpower
                ),
                "디지털트윈 사업 계약품의 승인 완료.",
                "권우석 사장"
            ),
            new Approval(
                "APP-2026-004",
                "계약품의서",
                "행정안전부 차세대 주소기반 공간정보 DB 구축 및 연계",
                "박용묵",
                "이사",
                "사업본부",
                "2026-07-15",
                "결재대기",
                312000,
                "행정안전부 차세대 주소기반 공간정보 DB 구축 및 연계",
                "행정안전부",
                "계좌이체(선금/중도/잔금)",
                "제안준비 단계 사전 원가산정 및 투입인력 계획 계약품의서 (컨소시엄 지분 40% 당사 수주)",
                buildContractJson(
                    "APP-2026-004",
                    "행정안전부 차세대 주소기반 공간정보 DB 구축 및 연계",
                    "행정안전부",
                    "2026-08-01",
                    "2027-02-28",
                    312000,
                    40.0,
                    "박용묵",
                    "이사",
                    prj4Manpower
                ),
                "",
                ""
            )
        );
        approvalRepository.saveAll(defaultApprovals);
    }

    private void syncCommonCodes() {
        commonCodeRepository.deleteAll();
        commonCodeRepository.flush();

        List<CommonCode> defaultCodes = List.of(
            // 1. 부서 코드 (DEPARTMENT)
            new CommonCode("DEPARTMENT", "부서", "DEPT_CEO", "대표이사", 1, true, "경영총괄"),
            new CommonCode("DEPARTMENT", "부서", "DEPT_BIZ", "사업본부", 2, true, "프로젝트 전담"),
            new CommonCode("DEPARTMENT", "부서", "DEPT_RND", "기술연구소", 3, true, "연구개발/솔루션"),
            new CommonCode("DEPARTMENT", "부서", "DEPT_QM", "품질경영팀", 4, true, "품질관리/GS인증"),
            new CommonCode("DEPARTMENT", "부서", "DEPT_MGMT", "경영지원팀", 5, true, "인사총무/회계"),

            // 2. 직급 코드 (POSITION)
            new CommonCode("POSITION", "직급", "POS_CEO", "사장", 1, true, "7"),
            new CommonCode("POSITION", "직급", "POS_DIR", "이사", 2, true, "6"),
            new CommonCode("POSITION", "직급", "POS_GM", "부장", 3, true, "5"),
            new CommonCode("POSITION", "직급", "POS_DGM", "차장", 4, true, "4"),
            new CommonCode("POSITION", "직급", "POS_MGR", "과장", 5, true, "3"),
            new CommonCode("POSITION", "직급", "POS_AM", "대리", 6, true, "2"),
            new CommonCode("POSITION", "직급", "POS_STAFF", "담당", 7, true, "1"),

            // 3. 사업·프로젝트 단계 코드 (PROJECT_STAGE)
            new CommonCode("PROJECT_STAGE", "사업단계", "STAGE_ORDER", "발주예상", 1, true, "amber"),
            new CommonCode("PROJECT_STAGE", "사업단계", "STAGE_PROPOSAL", "제안준비중", 2, true, "blue"),
            new CommonCode("PROJECT_STAGE", "사업단계", "STAGE_EXEC", "프로젝트 수행", 3, true, "indigo"),
            new CommonCode("PROJECT_STAGE", "사업단계", "STAGE_DONE", "완료", 4, true, "emerald"),

            // 4. 직원 재직상태 코드 (EMP_STATUS)
            new CommonCode("EMP_STATUS", "재직상태", "STATUS_ACTIVE", "재직", 1, true, "emerald"),
            new CommonCode("EMP_STATUS", "재직상태", "STATUS_LEAVE", "휴직", 2, true, "amber"),
            new CommonCode("EMP_STATUS", "재직상태", "STATUS_RETIRED", "퇴사", 3, true, "slate"),

            // 5. 계약 유형 코드 (CONTRACT_TYPE)
            new CommonCode("CONTRACT_TYPE", "계약유형", "TYPE_SINGLE", "단년도 사업", 1, true, "single"),
            new CommonCode("CONTRACT_TYPE", "계약유형", "TYPE_MULTI", "다년도 사업", 2, true, "multi"),
            new CommonCode("CONTRACT_TYPE", "계약유형", "TYPE_MAINT", "유지관리 사업", 3, true, "maint"),
            new CommonCode("CONTRACT_TYPE", "계약유형", "TYPE_SERVICE", "일반용역 사업", 4, true, "service"),

            // 6. 사용자 권한 코드 (USER_ROLE - 4단계 권한 체계)
            new CommonCode("USER_ROLE", "사용자권한", "ROLE_SYS_ADMIN", "시스템 관리자", 1, true, "sys_admin"),
            new CommonCode("USER_ROLE", "사용자권한", "ROLE_EXEC", "임원 권한", 2, true, "executive"),
            new CommonCode("USER_ROLE", "사용자권한", "ROLE_PM", "PM 권한", 3, true, "pm"),
            new CommonCode("USER_ROLE", "사용자권한", "ROLE_STAFF", "일반직원", 4, true, "staff")
        );

        commonCodeRepository.saveAll(defaultCodes);
    }

    private void migrateEmployeeRolesToFourTier() {
        List<Employee> allEmployees = employeeRepository.findAll();
        boolean needsMigration = allEmployees.stream().anyMatch(e ->
                "관리자 권한".equals(e.getRole())
                || "경영팀 권한".equals(e.getRole())
                || e.getRole() == null
                || e.getRole().isBlank()
        );
        if (!needsMigration) {
            return;
        }
        // 직급과 권한은 완전히 별개: 직급에 따른 권한 강제 덮어쓰기를 일체 하지 않음
        for (Employee emp : allEmployees) {
            String role = emp.getRole();
            if ("관리자 권한".equals(role) || "경영팀 권한".equals(role)) {
                emp.setRole("시스템 관리자");
            } else if (role == null || role.isBlank()) {
                emp.setRole("일반직원");
            }
        }
        employeeRepository.saveAll(allEmployees);
    }

    private void syncEmployees() {
        employeeRepository.deleteAll();
        employeeRepository.flush();

        // 38명 실제 스패셜티 임직원 명단 + 대표이사 (4단계 권한 체계: 시스템 관리자 / 임원 권한 / PM 권한 / 일반직원)
        List<Employee> realEmployees = List.of(
            new Employee("20050101", "권우석", "DEPT_CEO", "대표이사", "POS_CEO", "사장", "wskwon@spatialt.co.kr", "010-9001-0621", "2005-01-01", "재직", 20.0, 20.0, "공간정보(GIS) 경영총괄", "indigo", "임원 권한"),
            new Employee("20060201", "박용묵", "DEPT_BIZ", "사업본부", "POS_DIR", "이사", "ympark@spatialt.co.kr", "010-3621-2006", "2006-02-01", "재직", 19.0, 20.0, "공공SI 사업총괄, PM", "blue", "임원 권한"),
            new Employee("20110801", "우광일", "DEPT_RND", "기술연구소", "POS_DGM", "차장", "kiwoo@spatialt.co.kr", "010-7788-1234", "2011-08-01", "재직", 18.0, 20.0, "GIS 시스템 아키텍처, PM", "indigo", "PM 권한"),
            new Employee("20130201", "김성철", "DEPT_BIZ", "사업본부", "POS_GM", "부장", "sckim@spatialt.co.kr", "010-4123-2013", "2013-02-01", "재직", 17.5, 20.0, "LI 그룹 리딩, 총괄 PM", "emerald", "PM 권한"),
            new Employee("20170101", "조경연", "DEPT_RND", "기술연구소", "POS_MGR", "과장", "gycho@spatialt.co.kr", "010-5321-2017", "2017-01-01", "재직", 16.0, 19.0, "GIS 엔진 및 공간분석", "violet", "PM 권한"),
            new Employee("20180103", "이승은", "DEPT_QM", "품질경영팀", "POS_MGR", "과장", "selee@spatialt.co.kr", "010-6712-2018", "2018-01-03", "재직", 16.0, 19.0, "공간DB 품질검수, GS인증", "emerald", "PM 권한"),
            new Employee("20210101-1", "최진우", "DEPT_BIZ", "사업본부", "POS_AM", "대리", "jwchoi@spatialt.co.kr", "010-8219-2021", "2021-01-01", "재직", 15.0, 18.0, "공공SI 시스템 구축", "blue", "일반직원"),
            new Employee("20210101-2", "조예나", "DEPT_BIZ", "사업본부", "POS_AM", "대리", "yncho@spatialt.co.kr", "010-8220-2021", "2021-01-01", "재직", 15.0, 18.0, "LX 업무시스템 개발", "pink", "일반직원"),
            new Employee("20210412-1", "최광현", "DEPT_BIZ", "사업본부", "POS_AM", "대리", "ghchoi@spatialt.co.kr", "010-9311-2021", "2021-04-12", "재직", 14.5, 18.0, "공간정보 플랫폼 유지관리", "cyan", "일반직원"),
            new Employee("20210412-2", "문도희", "DEPT_RND", "기술연구소", "POS_AM", "대리", "dhmoon@spatialt.co.kr", "010-9312-2021", "2021-04-12", "재직", 14.5, 18.0, "웹GIS 프론트엔드", "violet", "일반직원"),
            new Employee("20210817-1", "조선영", "DEPT_MGMT", "경영지원팀", "POS_MGR", "과장", "sycho@spatialt.co.kr", "010-9411-2021", "2021-08-17", "재직", 14.0, 18.0, "인사총무, 계약행정, 시스템관리", "amber", "시스템 관리자"),
            new Employee("20210817-2", "김상협", "DEPT_RND", "기술연구소", "POS_AM", "대리", "shkim@spatialt.co.kr", "010-9412-2021", "2021-08-17", "재직", 14.0, 18.0, "PostGIS 공간DB 설계", "indigo", "일반직원"),
            new Employee("20210817-3", "최영진", "DEPT_BIZ", "사업본부", "POS_AM", "대리", "yjchoi@spatialt.co.kr", "010-9413-2021", "2021-08-17", "재직", 14.0, 18.0, "LX 업무시스템 개발/운영", "rose", "일반직원"),
            new Employee("20220614", "엄창민", "DEPT_BIZ", "사업본부", "POS_AM", "대리", "cmeom@spatialt.co.kr", "010-2134-2022", "2022-06-14", "재직", 13.0, 17.0, "공간정보 백엔드 API", "blue", "일반직원"),
            new Employee("20220616", "이영호", "DEPT_BIZ", "사업본부", "POS_AM", "대리", "yhlee@spatialt.co.kr", "010-2135-2022", "2022-06-16", "재직", 13.0, 17.0, "공간데이터 연계모듈", "emerald", "일반직원"),
            new Employee("20230101", "김진수", "DEPT_BIZ", "사업본부", "POS_STAFF", "담당", "jskim@spatialt.co.kr", "010-3321-2023", "2023-01-01", "재직", 12.0, 16.0, "시스템 운영 및 유지관리", "slate", "일반직원"),
            new Employee("20230206-1", "이윤지", "DEPT_QM", "품질경영팀", "POS_AM", "대리", "yjlee@spatialt.co.kr", "010-3322-2023", "2023-02-06", "재직", 12.0, 16.0, "웹 접근성 및 표준화", "pink", "일반직원"),
            new Employee("20230206-2", "장민관", "DEPT_RND", "기술연구소", "POS_STAFF", "담당", "mgjang@spatialt.co.kr", "010-3323-2023", "2023-02-06", "재직", 12.0, 16.0, "디지털트윈 3D 데이터", "cyan", "일반직원"),
            new Employee("20230724-1", "송호석", "DEPT_BIZ", "사업본부", "POS_STAFF", "담당", "hssong@spatialt.co.kr", "010-3511-2023", "2023-07-24", "재직", 11.5, 16.0, "공공SI 과제 개발지원", "blue", "일반직원"),
            new Employee("20230724-2", "최진규", "DEPT_BIZ", "사업본부", "POS_STAFF", "담당", "jkchoi@spatialt.co.kr", "010-3512-2023", "2023-07-24", "재직", 11.5, 16.0, "시스템 모니터링", "indigo", "일반직원"),
            new Employee("20230821", "정승연", "DEPT_RND", "기술연구소", "POS_AM", "대리", "syjung@spatialt.co.kr", "010-3811-2023", "2023-08-21", "재직", 11.0, 16.0, "GeoServer 레이어 연동", "violet", "일반직원"),
            new Employee("20240122", "전슬지", "DEPT_QM", "품질경영팀", "POS_AM", "대리", "sjjeon@spatialt.co.kr", "010-4111-2024", "2024-01-22", "재직", 10.0, 15.0, "품질테스트 자동화", "emerald", "일반직원"),
            new Employee("20240501", "우서윤", "DEPT_BIZ", "사업본부", "POS_AM", "대리", "sywoo@spatialt.co.kr", "010-4511-2024", "2024-05-01", "재직", 10.0, 15.0, "지자체 플랫폼 사업관리", "rose", "일반직원"),
            new Employee("20240601", "최승연", "DEPT_MGMT", "경영지원팀", "POS_AM", "대리", "sychoi@spatialt.co.kr", "010-4611-2024", "2024-06-01", "재직", 10.0, 15.0, "재무회계 및 세무", "amber", "일반직원"),
            new Employee("20240901-1", "최석진", "DEPT_BIZ", "사업본부", "POS_AM", "대리", "sjchoi@spatialt.co.kr", "010-4911-2024", "2024-09-01", "재직", 9.0, 15.0, "LI 그룹 시스템 유지관리", "blue", "일반직원"),
            new Employee("20240901-2", "이기승", "DEPT_BIZ", "사업본부", "POS_AM", "대리", "kslee@spatialt.co.kr", "010-4912-2024", "2024-09-01", "재직", 9.0, 15.0, "공간정보 솔루션 개발", "indigo", "일반직원"),
            new Employee("20241028", "구종석", "DEPT_BIZ", "사업본부", "POS_STAFF", "담당", "jsku@spatialt.co.kr", "010-4921-2024", "2024-10-28", "재직", 9.0, 15.0, "LX 업무시스템 운영지원", "slate", "일반직원"),
            new Employee("20241216", "양정현", "DEPT_RND", "기술연구소", "POS_STAFF", "담당", "jhyang@spatialt.co.kr", "010-4931-2024", "2024-12-16", "재직", 8.5, 15.0, "AI 공간분석 알고리즘", "cyan", "일반직원"),
            new Employee("20250908", "정다현", "DEPT_BIZ", "사업본부", "POS_STAFF", "담당", "dhjung@spatialt.co.kr", "010-5911-2025", "2025-09-08", "재직", 15.0, 15.0, "공공사업 기술지원", "pink", "일반직원"),
            new Employee("20251101", "강건우", "DEPT_BIZ", "사업본부", "POS_STAFF", "담당", "gwkang@spatialt.co.kr", "010-5921-2025", "2025-11-01", "재직", 15.0, 15.0, "플랫폼 운영 및 배포", "blue", "일반직원"),
            new Employee("20251105", "임서현", "DEPT_BIZ", "사업본부", "POS_STAFF", "담당", "shlim@spatialt.co.kr", "010-5931-2025", "2025-11-05", "재직", 15.0, 15.0, "스마트 충북 플랫폼 유지관리", "rose", "일반직원"),
            new Employee("20251110", "신광백", "DEPT_RND", "기술연구소", "POS_DGM", "차장", "gbshin@spatialt.co.kr", "010-5941-2025", "2025-11-10", "재직", 15.0, 15.0, "대용량 공간데이터 파이프라인", "indigo", "PM 권한"),
            new Employee("20251201-1", "홍지형", "DEPT_QM", "품질경영팀", "POS_AM", "대리", "jhhong@spatialt.co.kr", "010-5951-2025", "2025-12-01", "재직", 15.0, 15.0, "전자정부 프레임워크 검수", "emerald", "일반직원"),
            new Employee("20251201-2", "최종민", "DEPT_RND", "기술연구소", "POS_STAFF", "담당", "jmchoi@spatialt.co.kr", "010-5952-2025", "2025-12-01", "재직", 15.0, 15.0, "GIS 백엔드 서비스", "violet", "일반직원"),
            new Employee("20251215", "송하나", "DEPT_MGMT", "경영지원팀", "POS_DGM", "차장", "hnsong@spatialt.co.kr", "010-5961-2025", "2025-12-15", "재직", 15.0, 15.0, "경영기획, 인사총무 총괄", "amber", "시스템 관리자"),
            new Employee("20251222", "조근형", "DEPT_BIZ", "사업본부", "POS_AM", "대리", "ghcho@spatialt.co.kr", "010-5971-2025", "2025-12-22", "재직", 15.0, 15.0, "공공SI 사업 기술영업", "blue", "일반직원"),
            new Employee("20260615-1", "김상우", "DEPT_RND", "기술연구소", "POS_MGR", "과장", "swkim@spatialt.co.kr", "010-6611-2026", "2026-06-15", "재직", 15.0, 15.0, "클라우드 GIS 인프라 구축", "violet", "PM 권한"),
            new Employee("20260615-2", "박시은", "DEPT_QM", "품질경영팀", "POS_STAFF", "담당", "separk@spatialt.co.kr", "010-6612-2026", "2026-06-15", "재직", 15.0, 15.0, "공간DB 품질모니터링", "emerald", "일반직원"),
            new Employee("20260615-3", "강현구", "DEPT_BIZ", "사업본부", "POS_STAFF", "담당", "hgkang@spatialt.co.kr", "010-6613-2026", "2026-06-15", "재직", 15.0, 15.0, "공공SI 프로젝트 개발지원", "cyan", "일반직원")
        );

        employeeRepository.saveAll(realEmployees);
    }

    private void syncProjects() {
        // 프로젝트 데이터도 실제 사업본부 및 주요 프로젝트로 업데이트
        projectRepository.deleteAll();
        projectRepository.flush();

        List<Project> defaultProjects = List.of(
            new Project(
                "PRJ-2026-01",
                "LX주요 업무시스템 유지관리 Pjt",
                "사업본부",
                "김성철",
                "2026-01-01",
                "2026-12-31",
                "프로젝트 수행",
                82,
                68000,
                100.0,
                "",
                "김성철, 최영진, 조예나, 엄창민, 이영호, 이기승, 최진우, 김진수, 구종석",
                "높음",
                "LX 주요 공간정보 및 국토정보 업무시스템 상시 유지관리 및 기능고도화 (9명 투입, 단독수행 100%)"
            ),
            new Project(
                "PRJ-2026-02",
                "2026년 스마트 충북 공간정보 플랫폼 유지관리",
                "사업본부",
                "박용묵",
                "2026-02-01",
                "2026-12-31",
                "프로젝트 수행",
                75,
                42000,
                100.0,
                "",
                "박용묵, 임서현, 최광현",
                "높음",
                "충청북도 스마트 공간정보 플랫폼 상시 유지보수 및 데이터 연계 (3명 투입, 단독수행 100%)"
            ),
            new Project(
                "PRJ-2026-03",
                "한국국토정보공사(LX) 디지털트윈 기반 지적공간정보 고도화",
                "사업본부",
                "우광일",
                "2026-07-01",
                "2026-12-31",
                "프로젝트 수행",
                60,
                55000,
                60.0,
                "주관:(주)당사(60%), 참여:(주)한국공간정밀(40%)",
                "우광일, 조경연, 최석진, 강건우, 정다현",
                "높음",
                "디지털트윈 기반 3차원 입체지적 공간정보 모델링 및 분석 고도화 (5명 투입, 컨소시엄 주관 지분율 60% / 당사 수주 3.3억원)"
            ),
            new Project(
                "PRJ-2026-04",
                "행정안전부 차세대 주소기반 공간정보 DB 구축 및 연계",
                "사업본부",
                "박용묵",
                "2026-08-01",
                "2027-02-28",
                "제안준비중",
                30,
                78000,
                40.0,
                "주관:(주)대한공간정보(60%), 참여:(주)당사(40%)",
                "박용묵, 조근형, 송호석, 최진규",
                "높음",
                "전국 사물주소·입체주소 공간데이터 정합성 검수 및 연계체계 구축 (컨소시엄 참여 지분율 40% / 당사 수주 3.12억원)"
            ),
            new Project(
                "PRJ-2026-05",
                "전북특별자치도 스마트 공간정보 포털 3단계 확장 사업",
                "사업본부",
                "김성철",
                "2026-10-01",
                "2027-05-31",
                "발주예상",
                10,
                45000,
                100.0,
                "",
                "김성철, 우서윤, 강현구",
                "보통",
                "지자체 맞춤형 공간정보 서비스 클라우드 전환 및 대민포털 고도화 (단독수행 100%)"
            )
        );

        projectRepository.saveAll(defaultProjects);
    }

    private void syncEquipments() {
        equipmentRepository.deleteAll();
        equipmentRepository.flush();

        Map<String, Employee> empMap = employeeRepository.findAll().stream()
                .collect(Collectors.toMap(Employee::getName, e -> e, (a, b) -> a));

        List<Equipment> defaultEquipments = new ArrayList<>();

        // 1. 대표이사 권우석
        Employee ceo = empMap.get("권우석");
        defaultEquipments.add(new Equipment(
                "ST-NB-001", "노트북", "LG Gram Pro 17 (Ultra 7, 32GB, 1TB)", "SN-2026-1001",
                "사용중", ceo != null ? ceo.getId() : null, ceo != null ? ceo.getEmpNo() : null,
                ceo != null ? ceo.getName() : "권우석", ceo != null ? ceo.getDepartment() : "대표이사",
                "2026-01-15", 260, "대표이사 업무용 고성능 노트북"
        ));

        // 2. 기술연구소 우광일 차장
        Employee kiwoo = empMap.get("우광일");
        defaultEquipments.add(new Equipment(
                "ST-NB-002", "노트북", "MacBook Pro 16 (M4 Max, 64GB, 1TB)", "SN-2026-1002",
                "사용중", kiwoo != null ? kiwoo.getId() : null, kiwoo != null ? kiwoo.getEmpNo() : null,
                kiwoo != null ? kiwoo.getName() : "우광일", kiwoo != null ? kiwoo.getDepartment() : "기술연구소",
                "2026-01-20", 420, "GIS 시스템 아키텍처 및 3D 렌더링 개발용"
        ));

        // 3. 사업본부 박용묵 이사
        Employee ympark = empMap.get("박용묵");
        defaultEquipments.add(new Equipment(
                "ST-NB-003", "워크스테이션", "ThinkPad P16v Gen2 (i9, 64GB, RTX 4000)", "SN-2026-1003",
                "사용중", ympark != null ? ympark.getId() : null, ympark != null ? ympark.getEmpNo() : null,
                ympark != null ? ympark.getName() : "박용묵", ympark != null ? ympark.getDepartment() : "사업본부",
                "2026-02-01", 380, "공공SI 사업총괄 및 기술제안 발표용 모바일 워크스테이션"
        ));

        // 4. 사업본부 김성철 부장
        Employee sckim = empMap.get("김성철");
        defaultEquipments.add(new Equipment(
                "ST-NB-004", "노트북", "MacBook Pro 14 (M4 Pro, 48GB, 1TB)", "SN-2026-1004",
                "사용중", sckim != null ? sckim.getId() : null, sckim != null ? sckim.getEmpNo() : null,
                sckim != null ? sckim.getName() : "김성철", sckim != null ? sckim.getDepartment() : "사업본부",
                "2026-02-10", 350, "LX 주요 업무시스템 총괄 PM 수행용"
        ));

        // 5. 기술연구소 조경연 과장
        Employee gycho = empMap.get("조경연");
        defaultEquipments.add(new Equipment(
                "ST-NB-005", "워크스테이션", "Dell Precision 5690 (Ultra 9, 64GB, Ada 3500)", "SN-2026-1005",
                "사용중", gycho != null ? gycho.getId() : null, gycho != null ? gycho.getEmpNo() : null,
                gycho != null ? gycho.getName() : "조경연", gycho != null ? gycho.getDepartment() : "기술연구소",
                "2026-02-15", 390, "3D 입체지적 및 공간분석 알고리즘 개발용"
        ));

        // 6. 사업본부 최영진 대리
        Employee yjchoi = empMap.get("최영진");
        defaultEquipments.add(new Equipment(
                "ST-NB-006", "노트북", "LG Gram Pro 16 (Ultra 7, 32GB, 1TB)", "SN-2026-1006",
                "사용중", yjchoi != null ? yjchoi.getId() : null, yjchoi != null ? yjchoi.getEmpNo() : null,
                yjchoi != null ? yjchoi.getName() : "최영진", yjchoi != null ? yjchoi.getDepartment() : "사업본부",
                "2026-03-01", 240, "LX 공간정보 유지관리 PL 개발용"
        ));

        // 7. 사업본부 조예나 대리
        Employee yncho = empMap.get("조예나");
        defaultEquipments.add(new Equipment(
                "ST-NB-007", "노트북", "ThinkPad T14s Gen5 (Ultra 7, 32GB, 512GB)", "SN-2026-1007",
                "사용중", yncho != null ? yncho.getId() : null, yncho != null ? yncho.getEmpNo() : null,
                yncho != null ? yncho.getName() : "조예나", yncho != null ? yncho.getDepartment() : "사업본부",
                "2026-03-10", 220, "WebGIS 반응형 컴포넌트 개발용"
        ));

        // 8. 경영지원팀 조선영 과장
        Employee sycho = empMap.get("조선영");
        defaultEquipments.add(new Equipment(
                "ST-NB-008", "노트북", "LG Gram Pro 16 (Ultra 7, 32GB, 512GB)", "SN-2026-1008",
                "사용중", sycho != null ? sycho.getId() : null, sycho != null ? sycho.getEmpNo() : null,
                sycho != null ? sycho.getName() : "조선영", sycho != null ? sycho.getDepartment() : "경영지원팀",
                "2026-03-15", 210, "인사총무/계약행정 및 그룹웨어 관리용"
        ));

        // 9. 품질경영팀 홍지형 대리
        Employee jhhong = empMap.get("홍지형");
        defaultEquipments.add(new Equipment(
                "ST-NB-009", "노트북", "Samsung Galaxy Book4 Pro 16 (Ultra 7, 32GB)", "SN-2026-1009",
                "사용중", jhhong != null ? jhhong.getId() : null, jhhong != null ? jhhong.getEmpNo() : null,
                jhhong != null ? jhhong.getName() : "홍지형", jhhong != null ? jhhong.getDepartment() : "품질경영팀",
                "2026-04-01", 210, "전자정부 프레임워크 검수 및 GS인증 시험용"
        ));

        // 10. 미배정 예비 장비
        defaultEquipments.add(new Equipment(
                "ST-NB-010", "노트북", "LG Gram 15 (i5, 16GB, 512GB)", "SN-2026-1010",
                "유휴", null, null, "미배정", "경영지원팀",
                "2026-04-10", 170, "신규 입사자 지급 대기 예비 노트북"
        ));

        // 11. SpatialT 대용량 공간DB 서버 (우광일 관리)
        defaultEquipments.add(new Equipment(
                "ST-SV-001", "서버장비", "SpatialT GIS 공간DB 서버 (Dell R760, 64Core, 256GB)", "SN-2026-SV01",
                "사용중", kiwoo != null ? kiwoo.getId() : null, kiwoo != null ? kiwoo.getEmpNo() : null,
                kiwoo != null ? kiwoo.getName() : "우광일", "기술연구소",
                "2026-01-10", 1250, "사내 PostGIS 및 지적공간정보 분석 메인 DB 서버"
        ));

        // 12. 고해상도 4K 모니터 (우광일)
        defaultEquipments.add(new Equipment(
                "ST-MN-001", "워크스테이션", "Dell UltraSharp 32 4K (U3223QE)", "SN-2026-MN01",
                "사용중", kiwoo != null ? kiwoo.getId() : null, kiwoo != null ? kiwoo.getEmpNo() : null,
                kiwoo != null ? kiwoo.getName() : "우광일", "기술연구소",
                "2026-01-20", 95, "3D 공간객체 렌더링 고해상도 듀얼 모니터"
        ));

        equipmentRepository.saveAll(defaultEquipments);
    }
}
