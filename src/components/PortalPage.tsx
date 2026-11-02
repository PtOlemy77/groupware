import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ArrowRight, ChevronDown, Menu, X, ScanLine, Sprout, Zap, Layers3, Phone, Mail, MapPin, Printer, Check } from 'lucide-react';
import './portal.css';
import PortalNotices from './PortalNotices';

type DomainId = 'survey' | 'agriculture' | 'safety';
const domains = [
  { id: 'survey' as DomainId, no: '01', en: 'GEOSPATIAL & SURVEYING', name: '측량 · 공간정보', headline: '공간을 읽고, 가능성을 넓히다.', description: '현장의 정밀한 데이터가 더 나은 의사결정으로 이어지도록. 측량과 공간정보 업무를 이해하는 시스템을 설계합니다.', image: '/portal/earth.jpg', icon: ScanLine, tags: ['GIS · 공간정보', '측량 데이터', '업무 시스템'], details: ['공간 데이터 수집·관리 업무의 디지털 전환', '지도 기반 정보 조회와 분석 환경 설계', '현장과 사무실을 연결하는 업무 프로세스'] },
  { id: 'agriculture' as DomainId, no: '02', en: 'AGRICULTURE & RURAL', name: '농업 · 농촌', headline: '농업의 내일을 데이터로 연결하다.', description: '농업 현장의 복잡한 흐름을 명확한 정보로. 농업과 농촌의 업무 특성을 반영한 지속 가능한 디지털 환경을 만듭니다.', image: '/portal/agriculture.jpg', icon: Sprout, tags: ['농업 정보화', '데이터 통합', '현장 업무'], details: ['농업·농촌 행정 업무의 정보화 설계', '분산된 현장 데이터의 통합과 활용', '사용자 중심의 업무 서비스 구축·운영'] },
  { id: 'safety' as DomainId, no: '03', en: 'ELECTRICAL SAFETY', name: '전기안전', headline: '보이지 않는 위험까지, 빈틈없이.', description: '안전한 일상을 지키는 기술의 역할. 점검부터 이력 관리까지, 전기안전 업무의 연속성을 뒷받침합니다.', image: '/portal/energy.jpg', icon: Zap, tags: ['안전 점검', '설비·이력 관리', '운영 안정화'], details: ['점검·검사 프로세스의 체계적인 디지털화', '설비 정보와 점검 이력의 연결', '안전 업무 시스템의 안정적인 유지관리'] },
];

export default function PortalPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [selected, setSelected] = useState<DomainId | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const domain = domains.find(item => item.id === selected);
  useEffect(() => {
    document.title = 'SPATIAL T | AI 시대의 경쟁력, 도메인 이해';
  }, []);
  useEffect(() => {
    if (!selected) return;
    trigger.current = document.activeElement as HTMLElement;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null);
      if (event.key === 'Tab') { event.preventDefault(); closeButton.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKey); trigger.current?.focus(); };
  }, [selected]);
  const nav = [{ href: '#about', label: '회사소개' }, { href: '#expertise', label: '전문분야' }, { href: '#services', label: 'SI / SM 서비스' }, { href: '#notices', label: '공지사항' }];
  return (
    <div className="spatial-portal" id="top">
      <a className="portal-skip" href="#main-content">본문 바로가기</a>
      <header className="portal-header">
        <a href="#top" className="portal-brand" aria-label="스패셜티 홈"><span className="brand-symbol"><i /><i /><i /></span><span>SPATIAL<span className="brand-t">T</span><small>스패셜티</small></span></a>
        <nav aria-label="주 메뉴" className={menuOpen ? 'portal-nav is-open' : 'portal-nav'}>
          {nav.map(item => <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>{item.label}</a>)}
          <a href="#contact" className="nav-contact" onClick={() => setMenuOpen(false)}>프로젝트 문의 <ArrowUpRight size={16} /></a>
        </nav>
        <a className="portal-login" href="#groupware">임직원 로그인 <ArrowUpRight size={14} /></a>
        <button className="portal-menu-toggle" aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
      </header>
      <main id="main-content">
        <section className="portal-hero" aria-labelledby="hero-title">
          <div className="hero-image" /><div className="hero-grid" />
          <div className="hero-coordinate">37° N &nbsp; / &nbsp; 127° E <span>CONNECTED BY EXPERTISE</span></div>
          <div className="hero-content">
            <p className="portal-eyebrow"><span /> DOMAIN EXPERT. TECHNOLOGY PARTNER.</p>
            <h1 id="hero-title">AI 시대, 좋은 시스템은<br /><span>도메인 이해</span>에서 시작됩니다.</h1>
            <p className="hero-description">AI가 코드 작성을 가속할수록, 무엇을 만들고 어떻게 검증할지가 중요해집니다.<br />측량·농업·전기안전의 업무를 이해하고 시스템으로 구현하는<br className="mobile-break" /> SI · SM 파트너, 스패셜티입니다.</p>
            <a href="#expertise" className="portal-primary">우리의 전문분야 <ArrowUpRight size={19} /></a>
          </div>
          <div className="hero-bottom"><a href="#about"><span className="scroll-line" /> SCROLL TO EXPLORE <ChevronDown size={14} /></a><span>DOMAIN KNOWLEDGE. REAL IMPACT.</span><span className="hero-index">01 <i /> 03</span></div>
          <div className="hero-stamp"><span className="stamp-cross">+</span><span>SPATIAL INSIGHT<br /><b>BETTER TOMORROW</b></span></div>
        </section>
        <section id="about" className="portal-intro portal-container">
          <div className="section-label"><span>01 — WHO WE ARE</span><span className="tiny-cross">+</span></div>
          <div className="intro-body"><h2>코딩이 빨라질수록,<br /><span>업무 이해는 더 깊어야 합니다.</span></h2><div><p>시스템의 완성도는 현장의 문제를 얼마나 정확히 이해하느냐에 달려 있습니다.</p><p>AI로 구현 속도를 높여도, 업무의 규칙과 예외, 데이터의 의미,<br className="desktop-break" /> 현장에서 통하는 판단 기준은 도메인 이해에서 나옵니다.<br className="desktop-break" /> 스패셜티는 그 이해를 요구사항과 설계에 담고,<br className="desktop-break" /> 실제 업무를 기준으로 검증하며 구축과 운영을 이어갑니다.</p><a href="#services" className="portal-text-link">스패셜티가 일하는 방식 <ArrowUpRight size={17} /></a></div></div>
        </section>
        <section id="expertise" className="portal-expertise">
          <div className="portal-container"><div className="section-label"><span>02 — OUR EXPERTISE</span><span>THREE DOMAINS. ONE PARTNER.</span></div>
            <div className="expertise-heading"><h2>세 가지 전문성.<br />더 깊이 있는 솔루션.</h2><p>같은 기술도 산업의 규칙과 현장에 따라 답이 달라집니다.<br />우리는 그 차이를 요구사항과 설계에 담습니다.</p></div>
            <div className="domain-grid">{domains.map(item => <button className={`domain-card domain-${item.id}`} key={item.id} onClick={() => setSelected(item.id)} aria-haspopup="dialog"><img src={item.image} alt="" loading="lazy" /><div className="domain-shade" /><div className="domain-top"><span>{item.no} / DOMAIN</span><item.icon size={26} strokeWidth={1.3} /></div><div className="domain-content"><span className="domain-en">{item.en}</span><h3>{item.name}<span className="domain-arrow"><ArrowUpRight size={22} /></span></h3><p>{item.description}</p><div className="domain-tags">{item.tags.map(tag => <span key={tag}>{tag}</span>)}</div></div></button>)}</div>
          </div>
        </section>
        <section id="services" className="portal-services portal-container">
          <div className="section-label"><span>03 — WHAT WE DO</span><span className="tiny-cross">+</span></div>
          <div className="services-layout"><div className="services-intro"><h2>구축의 시작부터<br />운영의 내일까지.</h2><p>무엇을 만들어야 하는지 정확히 정의하고,<br />현장에서 제대로 작동하는지 끝까지 살핍니다.</p><div className="service-mark"><Layers3 size={36} strokeWidth={1} /><span>END-TO-END<br /><b>IT PARTNERSHIP</b></span></div></div><div className="service-list"><article><span className="service-number">01</span><div><span className="service-en">SYSTEM INTEGRATION</span><h3>업무의 규칙과 예외까지 설계합니다.</h3><p>현장의 용어, 데이터의 관계, 처리 절차와 예외를 요구사항으로 구체화합니다.<br />개발과 통합을 거쳐, 실제 업무 시나리오로 시스템의 완성도를 검증합니다.</p><div className="service-steps"><span>분석 · 설계</span><ArrowRight size={13} /><span>개발 · 통합</span><ArrowRight size={13} /><span>검증 · 전환</span></div></div><span className="service-monogram">SI</span></article><article><span className="service-number">02</span><div><span className="service-en">SYSTEM MANAGEMENT</span><h3>업무의 변화를 이해하고 운영합니다.</h3><p>장애가 업무에 미치는 영향과 변경이 필요한 이유를 함께 살핍니다.<br />업무 규칙과 현장의 변화에 맞춰 유지관리와 개선의 우선순위를 정합니다.</p><div className="service-steps"><span>운영 · 모니터링</span><ArrowRight size={13} /><span>유지관리</span><ArrowRight size={13} /><span>개선 · 고도화</span></div></div><span className="service-monogram">SM</span></article></div></div>
        </section>
        <PortalNotices />
        <section id="contact" className="portal-contact"><div className="contact-grid" /><div className="portal-container"><div><p className="portal-eyebrow"><span /> LET’S BUILD WHAT’S NEXT</p><h2>AI 시대의 시스템 파트너,<br />기술과 도메인을 함께 보세요.</h2><p>어떤 업무를 바꾸고, 어떤 문제를 해결해야 할까요?<br />스패셜티와 현장의 과제부터 이야기해 보세요.</p></div><address className="portal-contact-info"><p className="contact-info-label">CONTACT US</p><a href="tel:0632119651" className="contact-phone"><Phone size={18} />063-211-9651</a><a href="mailto:pym@spatialt.co.kr"><Mail size={16} />pym@spatialt.co.kr</a><p><Printer size={16} /><span>FAX &nbsp;063-211-9653</span></p><p><MapPin size={17} /><span>전북 전주시 덕진구 만성북로 51-25<br />3015호 스패셜티<br /><small>(스페이스온 지식산업센터)</small></span></p></address></div></section>
      </main>
      <footer className="portal-footer portal-container"><div className="footer-main"><a href="#top" className="footer-brand">SPATIAL<span>T</span><small>(주)스패셜티</small></a><p>AI 시대의 경쟁력, 도메인에 대한 깊은 이해.<br />측량 · 농업 · 전기안전 SI / SM 전문기업<br /><span className="footer-company-info">대표이사 권우석 · 사업자등록번호 538-86-01435</span></p><a href="#groupware">임직원 그룹웨어 <ArrowUpRight size={15} /></a></div><div className="footer-bottom"><span>© {new Date().getFullYear()} SPATIAL T. All rights reserved.</span><span>DOMAIN EXPERT. TECHNOLOGY PARTNER.</span><a className="portal-privacy-link" href="#privacy">개인정보 처리방침</a><a href="#top">BACK TO TOP ↑</a></div></footer>
      {domain && <div className="domain-modal-backdrop" onClick={() => setSelected(null)}><section className="domain-modal" role="dialog" aria-modal="true" aria-labelledby="domain-title" aria-describedby="domain-description" onClick={event => event.stopPropagation()}><button ref={closeButton} className="domain-modal-close" aria-label="상세 내용 닫기" onClick={() => setSelected(null)}><X /></button><img src={domain.image} alt="" /><div className="domain-modal-body"><p className="domain-en">{domain.en}</p><h2 id="domain-title">{domain.name}</h2><h3>{domain.headline}</h3><p id="domain-description">{domain.description}</p><ul>{domain.details.map(detail => <li key={detail}><Check size={17} />{detail}</li>)}</ul><p className="domain-note">프로젝트의 세부 범위와 제공 기능은 업무 분석을 통해 협의합니다.</p></div></section></div>}
    </div>
  );
}
