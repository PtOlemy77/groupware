import { useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  FileCheck2,
  ShieldCheck,
} from 'lucide-react';
import './portal.css';
import './privacy-policy.css';

const SECTIONS = [
  ['scope', '적용 범위'],
  ['processing', '처리 목적·항목·보유기간'],
  ['sharing', '제3자 제공'],
  ['outsourcing', '처리위탁·국외 이전'],
  ['destruction', '파기 절차와 방법'],
  ['rights', '이용자의 권리와 행사 방법'],
  ['cookies', '쿠키·자동 수집 장치'],
  ['security', '안전성 확보 조치'],
  ['contact', '개인정보 문의'],
  ['remedy', '권익침해 구제'],
  ['changes', '변경 및 시행 안내'],
] as const;

export default function PrivacyPolicyPage() {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    document.title = '개인정보 처리방침 (검토용 초안) | SPATIAL T';
    heading.current?.focus({ preventScroll: true });

    const target = document.getElementById(window.location.hash.slice(1));
    if (target) {
      target.scrollIntoView();
    } else {
      window.scrollTo(0, 0);
    }
  }, []);

  return (
    <div className="spatial-portal privacy-page" id="privacy-top">
      <a className="portal-skip" href="#privacy-content">
        본문 바로가기
      </a>

      <header className="privacy-header portal-container">
        <a href="#top" className="footer-brand" aria-label="스패셜티 포털 홈">
          SPATIAL<span>T</span>
          <small>(주)스패셜티</small>
        </a>
        <a href="#top" className="privacy-home">
          <ArrowLeft size={16} /> 포털로 돌아가기
        </a>
      </header>

      <main id="privacy-content" className="portal-container">
        <div className="privacy-title">
          <p className="portal-eyebrow">
            <ShieldCheck size={17} /> PRIVACY & TRUST
          </p>
          <h1 ref={heading} tabIndex={-1}>
            개인정보 처리방침
          </h1>
          <p>스패셜티 포털의 개인정보 처리에 관한 안내입니다.</p>
          <div className="privacy-meta">
            <span>검토용 초안 v0.1</span>
            <span>
              작성일 <time dateTime="2026-11-02">2026년 11월 2일</time>
            </span>
            <span>시행일 미정</span>
          </div>
        </div>

        <aside className="privacy-draft" aria-labelledby="privacy-draft-title">
          <FileCheck2 size={23} aria-hidden="true" />
          <div>
            <h2 id="privacy-draft-title">
              운영정보 확정 전의 검토용 초안입니다.
            </h2>
            <p>
              개인정보 문의 담당 부서·연락처, 호스팅·서버 운영 업체와 소재
              국가, 접속 로그의 항목·목적·처리 근거·보유기간은 아직 정해지지
              않았습니다. 아래의 ‘미정’ 항목을 실제 운영 내용으로 확정하고
              검토한 후 정식 처리방침과 시행일을 공개해야 합니다.
            </p>
          </div>
        </aside>

        <div className="privacy-layout">
          <nav className="privacy-toc" aria-label="개인정보 처리방침 목차">
            <p>CONTENTS</p>
            <ol>
              {SECTIONS.map(([id, label], index) => (
                <li key={id}>
                  <a href={`#privacy-${id}`}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    {label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <article className="privacy-article">
            <p className="privacy-preamble">
              (주)스패셜티(이하 ‘회사’)는 이용자가 개인정보 처리 내용을 쉽게
              확인할 수 있도록 이 문서를 작성했습니다. 현재 구현된 공개 포털에서
              확인되는 사항과 추가 확인이 필요한 운영정보를 구분하여 안내합니다.
            </p>

            {/* 01. 적용 범위 */}
            <section id="privacy-scope">
              <h2>
                <span>01</span>적용 범위
              </h2>
              <p>
                이 문서는 회사소개, 측량·공간정보·농업·농촌·전기안전 전문분야,
                SI·SM 서비스 안내를 제공하는 공개 포털에 적용됩니다.
              </p>
              <p>
                관리자 공지 작성·관리, 임직원 그룹웨어의 계정·인사·프로젝트·평가
                정보 처리와 이메일·전화 등 별도 채널에서 이루어지는 상담은 이
                공개 포털의 열람과 구분됩니다. 해당 업무의 처리 목적, 항목,
                근거, 보유기간과 권리 행사 창구는 실제 운영 내용을 확인하여
                별도로 안내해야 합니다.
              </p>
            </section>

            {/* 02. 처리 목적·항목·보유기간 */}
            <section id="privacy-processing">
              <h2>
                <span>02</span>처리 목적·항목·보유기간
              </h2>
              <p>
                현재 공개 포털에는 회원가입, 문의 접수, 뉴스레터 신청, 파일
                업로드 등 방문자의 개인정보를 수집하기 위한 기능이 없습니다.
                공지사항은 로그인 없이 열람·검색할 수 있으며,
                이름·이메일·전화번호 입력을 요청하지 않습니다. 공지
                작성·수정·삭제는 인증된 시스템 관리자만 할 수 있습니다.
              </p>
              <div
                className="privacy-table-wrap"
                role="region"
                aria-label="개인정보 처리 현황"
                tabIndex={0}
              >
                <table>
                  <caption>공개 포털의 처리 현황 및 확인 필요 사항</caption>
                  <thead>
                    <tr>
                      <th scope="col">구분</th>
                      <th scope="col">항목·목적</th>
                      <th scope="col">처리 근거·보유기간</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">방문자의 이름·연락처</th>
                      <td>현재 입력·접수 기능 없음</td>
                      <td>해당 기능을 통한 수집·보관 없음</td>
                    </tr>
                    <tr>
                      <th scope="row">공지 제목 검색어</th>
                      <td>
                        공지사항 제목 검색에 사용
                        <br />
                        <small>개인정보 입력을 요청하지 않음</small>
                      </td>
                      <td>
                        포털 코드에서 검색 이력을 별도 저장하지 않음
                        <br />
                        <small>
                          운영 로그 포함 여부·처리 근거·보유기간은 확인 필요
                        </small>
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">서버·호스팅 접속 로그</th>
                      <td>
                        실제 기록 여부 및 항목·목적 미정
                        <br />
                        <small>
                          확인 대상 예: IP 주소, 접속 시각, 요청 경로, 브라우저
                          정보
                        </small>
                      </td>
                      <td>
                        처리 근거 및 보유기간 미정
                        <br />
                        <small>운영 설정·필요성 확인 후 확정</small>
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">분석·광고 식별 정보</th>
                      <td>현재 포털 코드에 분석·광고 추적 기능 없음</td>
                      <td>해당 기능을 통한 수집·보관 없음</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>
                검색창에는 이름·연락처 등 개인정보를 입력하지 마세요. 검색어가
                포함된 요청 URL이 운영 환경의 로그에 기록되는지 확인한 후 정식
                방침에 반영합니다. 접속 로그의 예시는 수집 확정을 의미하지
                않습니다. 서버·호스팅 환경에서 실제 처리하는 내용을 확인한 후
                구체적인 항목, 목적, 법적 근거와 보유기간을 기재합니다. 법령에
                따른 별도 보관이 필요한 경우에는 해당 법령, 항목과 기간도
                명시합니다.
              </p>
            </section>

            {/* 03. 제3자 제공 */}
            <section id="privacy-sharing">
              <h2>
                <span>03</span>제3자 제공
              </h2>
              <p>
                현재 공개 포털 코드에는 방문자 정보를 제3자에게 제공하는 기능이
                없습니다. 호스팅 등 운영 환경의 처리 현황은 다음 항목과 함께
                확인해야 합니다.
              </p>
              <p>
                제3자 제공이 발생하는 경우에는 제공받는 자, 제공 목적, 항목,
                보유·이용기간 및 적용되는 법적 근거를 실제 제공 전에 안내하고
                필요한 절차를 이행합니다.
              </p>
            </section>

            {/* 04. 처리위탁·국외 이전 */}
            <section id="privacy-outsourcing">
              <h2>
                <span>04</span>처리위탁·국외 이전
              </h2>
              <dl className="privacy-facts">
                <div>
                  <dt>호스팅·서버 운영 업체</dt>
                  <dd>미정</dd>
                </div>
                <div>
                  <dt>위탁 업무 및 처리 항목</dt>
                  <dd>미정</dd>
                </div>
                <div>
                  <dt>서버·백업 소재 국가</dt>
                  <dd>미정</dd>
                </div>
                <div>
                  <dt>국외 이전 여부 및 관련 세부사항</dt>
                  <dd>미정</dd>
                </div>
              </dl>
              <p>
                업체가 확정되면 수탁자와 위탁 업무, 재위탁 여부를 확인하여
                안내합니다. 국외 이전이 있는 경우 이전받는 자와 연락처, 국가,
                항목, 목적, 시기·방법, 보유기간, 이전 근거 및 거부 방법과 영향을
                구체적으로 안내합니다. 확인 전에는 위탁이나 국외 이전이 없다고
                단정하지 않습니다.
              </p>
            </section>

            {/* 05. 파기 절차와 방법 */}
            <section id="privacy-destruction">
              <h2>
                <span>05</span>파기 절차와 방법
              </h2>
              <p>
                개인정보를 처리하는 경우에는 처리 목적 달성이나 보유기간 경과
                등으로 정보가 불필요해지면 지체 없이 파기합니다. 법령에 따라
                보존해야 하는 정보는 근거와 기간을 정하여 다른 정보와 분리해
                보관합니다.
              </p>
              <p>
                전자파일은 복구·재생할 수 없는 방법으로 삭제하고, 종이 문서는
                분쇄 또는 소각합니다. 로그와 백업의 구체적인 삭제 주기·방법은
                운영 환경 확정 시 함께 정합니다.
              </p>
            </section>

            {/* 06. 이용자의 권리와 행사 방법 */}
            <section id="privacy-rights">
              <h2>
                <span>06</span>이용자의 권리와 행사 방법
              </h2>
              <p>
                이용자는 관계 법령에 따라 본인 개인정보의 열람, 정정·삭제,
                처리정지 및 동의 철회를 요청할 수 있으며, 법정대리인이나
                위임받은 대리인을 통해서도 행사할 수 있습니다. 요청 처리 시 본인
                또는 적법한 대리인인지 필요한 범위에서 확인합니다.
              </p>
              <p>
                회사는 요청을 검토하여 법령에 따라 조치하고 결과를 안내합니다.
                법령상 보존 의무 등으로 요청을 제한하는 경우에는 그 사유를
                안내합니다.
              </p>
              <p>
                회사 내 접수 부서와 이메일·전화번호는 미정입니다. 정식 공개 전
                접수 창구를 확정하여 아래 ‘개인정보 문의’ 항목에 기재해야
                합니다. 요청 시에는 확인에 필요한 최소 정보만 제공하고
                비밀번호나 주민등록번호를 보내지 마세요.
              </p>
              <p>
                현재 공개 포털에는 아동을 포함한 방문자의 개인정보를 입력받는
                기능이 없습니다. 아동 개인정보를 수집하는 서비스를 추가하는 경우
                적용 법령에 따른 별도의 안내와 절차를 마련합니다.
              </p>
            </section>

            {/* 07. 쿠키·자동 수집 장치 */}
            <section id="privacy-cookies">
              <h2>
                <span>07</span>쿠키·자동 수집 장치
              </h2>
              <p>
                현재 공개 포털 코드에는 분석·광고 목적의 쿠키, 방문 이력 추적
                스크립트 또는 브라우저 저장소에 개인정보를 기록하는 기능이
                없습니다. 화면 이미지는 포털과 같은 서버의 파일로 제공합니다.
              </p>
              <p>
                ‘임직원 로그인’을 통해 그룹웨어에 진입하면 로그인 상태 유지와
                요청 위조 방지를 위해 세션 쿠키를 사용할 수 있습니다. 서버의
                비활성 세션 만료 설정은 30분이며, 로그아웃·브라우저의 쿠키
                삭제·서버의 세션 종료에 따라 인증 상태가 종료될 수 있습니다.
                세션 쿠키의 브라우저 보관 방식과 서버 세션의 만료 시간은 서로
                다를 수 있습니다.
              </p>
              <p>
                쿠키 저장은 사용하는 브라우저의 개인정보 또는 사이트 설정에서
                허용·차단하거나 삭제할 수 있습니다. 쿠키를 차단하면 그룹웨어
                로그인 등 인증이 필요한 기능의 이용이 제한될 수 있습니다. 호스팅
                환경에서 추가 설정되는 쿠키의 유무는 운영 환경 확정 시
                확인합니다.
              </p>
            </section>

            {/* 08. 안전성 확보 조치 */}
            <section id="privacy-security">
              <h2>
                <span>08</span>안전성 확보 조치
              </h2>
              <p>
                공개 포털의 안내 화면과 인증이 필요한 업무 기능은 구분되어
                있습니다. 그룹웨어에는 세션 기반 인증, 권한에 따른 접근 제한,
                비밀번호의 단방향 해시 저장 및 요청 위조 방지 기능이 구현되어
                있습니다.
              </p>
              <p>
                관리 담당자 지정, 취급자 교육, 접속기록 점검, 백업 관리,
                전송구간 보호와 서버 접근통제 등 실제 운영 환경의
                관리적·기술적·물리적 조치 및 이행 여부는 정식 공개 전에 확인하여
                반영합니다.
              </p>
            </section>

            {/* 09. 개인정보 문의 */}
            <section id="privacy-contact">
              <h2>
                <span>09</span>개인정보 문의
              </h2>
              <p>
                개인정보 관련 문의와 권리 행사 요청을 접수할 담당 부서 및
                연락처는 다음과 같이 확정이 필요합니다.
              </p>
              <dl className="privacy-facts">
                <div>
                  <dt>개인정보처리자</dt>
                  <dd>(주)스패셜티</dd>
                </div>
                <div>
                  <dt>개인정보 보호책임자 또는 담당 부서</dt>
                  <dd>미정</dd>
                </div>
                <div>
                  <dt>문의 이메일</dt>
                  <dd>미정</dd>
                </div>
                <div>
                  <dt>문의 전화번호</dt>
                  <dd>미정</dd>
                </div>
              </dl>
              <p>
                이 초안에는 실제로 지정·운영되지 않은 담당자나 연락처를 임의로
                기재하지 않았습니다. 정식 처리방침 공개 전 회사가 해당 정보를
                확정해야 합니다.
              </p>
            </section>

            {/* 10. 권익침해 구제 */}
            <section id="privacy-remedy">
              <h2>
                <span>10</span>권익침해 구제
              </h2>
              <p>
                개인정보 침해에 관한 상담·신고 또는 분쟁조정은 아래 기관을 통해
                안내받을 수 있습니다.
              </p>
              <ul className="privacy-agencies">
                <li>
                  <a
                    href="https://privacy.kisa.or.kr/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    개인정보침해신고센터{' '}
                    <span>
                      국번 없이 118 <ArrowUpRight size={14} />
                    </span>
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.kopico.go.kr/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    개인정보분쟁조정위원회{' '}
                    <span>
                      1833-6972 <ArrowUpRight size={14} />
                    </span>
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.privacy.go.kr/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    개인정보 포털{' '}
                    <span>
                      권리 보호 안내 <ArrowUpRight size={14} />
                    </span>
                  </a>
                </li>
              </ul>
              <p>
                외부 사이트로 이동하면 해당 사이트의 개인정보 처리방침이
                적용됩니다.
              </p>
            </section>

            {/* 11. 변경 및 시행 안내 */}
            <section id="privacy-changes">
              <h2>
                <span>11</span>변경 및 시행 안내
              </h2>
              <p>
                이 문서는 2026년 11월 2일 작성한 검토용 초안(v0.1)이며 아직
                시행일이 확정되지 않았습니다. 운영정보를 확정한 후 정식 버전과
                시행일을 공개합니다.
              </p>
              <p>
                처리 내용이 변경되면 변경 사항과 적용 시점을 이용자가 쉽게
                확인할 수 있도록 안내하고, 이전 버전도 확인할 수 있도록
                관리합니다. 새로운 개인정보 수집 기능은 실제 처리 내용과 필요한
                안내·동의 절차를 먼저 검토한 후 도입합니다.
              </p>
              <div className="privacy-references">
                <p>작성 시 확인한 공식 자료</p>
                <a
                  href="https://www.law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1034292763"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  개인정보 보호법 제30조 <ArrowUpRight size={13} />
                </a>
                <a
                  href="https://pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS217&mCode=D010000000&nttId=12018"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  개인정보보호위원회 처리방침 작성지침 안내 (2026.4.){' '}
                  <ArrowUpRight size={13} />
                </a>
              </div>
            </section>
          </article>
        </div>
      </main>

      <footer className="privacy-footer portal-container">
        <span>© 2026 SPATIAL T.</span>
        <a href="#top">포털 홈</a>
        <a href="#privacy-top">처음으로 ↑</a>
      </footer>
    </div>
  );
}
