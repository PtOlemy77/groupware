import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ArrowRight, ChevronDown, Menu, X, ScanLine, Sprout, Zap, Layers3, MoveUpRight, Check } from 'lucide-react';
import './portal.css';

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
    document.title = 'SPATIAL T | 도메인을 이해하는 기술, 스패셜티';
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
  const nav = [{ href: '#about', label: '회사소개' }, { href: '#expertise', label: '전문분야' }, { href: '#services', label: 'SI / SM 서비스' }];
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
            <h1 id="hero-title">현장을 이해하는 기술,<br />산업의 <span>다음</span>을 만듭니다.</h1>
            <p className="hero-description">측량, 농업, 전기안전.<br />깊이 있는 도메인 이해에 IT 기술을 더하는<br className="mobile-break" /> SI · SM 전문기업, 스패셜티입니다.</p>
            <a href="#expertise" className="portal-primary">우리의 전문분야 <ArrowUpRight size={19} /></a>
          </div>
          <div className="hero-bottom"><a href="#about"><span className="scroll-line" /> SCROLL TO EXPLORE <ChevronDown size={14} /></a><span>DOMAIN KNOWLEDGE. REAL IMPACT.</span><span className="hero-index">01 <i /> 03</span></div>
          <div className="hero-stamp"><span className="stamp-cross">+</span><span>SPATIAL INSIGHT<br /><b>BETTER TOMORROW</b></span></div>
        </section>
        <section id="about" className="portal-intro portal-container">
          <div className="section-label"><span>01 — WHO WE ARE</span><span className="tiny-cross">+</span></div>
          <div className="intro-body"><h2>기술의 시작은,<br /><span>산업에 대한 이해입니다.</span></h2><div><p>좋은 시스템은 현장을 아는 것에서 시작합니다.</p><p>스패셜티는 측량·농업·전기안전의 업무와 사람을 이해하고,<br className="desktop-break" /> 그 이해를 시스템의 설계, 구축, 운영으로 이어갑니다.<br className="desktop-break" /> 복잡한 업무는 명확하게, 중요한 서비스는 안정적으로.</p><a href="#services" className="portal-text-link">스패셜티가 일하는 방식 <ArrowUpRight size={17} /></a></div></div>
        </section>
        <section id="expertise" className="portal-expertise">
          <div className="portal-container"><div className="section-label"><span>02 — OUR EXPERTISE</span><span>THREE DOMAINS. ONE PARTNER.</span></div>
            <div className="expertise-heading"><h2>세 가지 전문성.<br />더 깊이 있는 솔루션.</h2><p>산업마다 다른 언어와 과제.<br />우리는 그 차이를 이해하고, 필요한 답을 만듭니다.</p></div>
            <div className="domain-grid">{domains.map(item => <button className={`domain-card domain-${item.id}`} key={item.id} onClick={() => setSelected(item.id)} aria-haspopup="dialog"><img src={item.image} alt="" loading="lazy" /><div className="domain-shade" /><div className="domain-top"><span>{item.no} / DOMAIN</span><item.icon size={26} strokeWidth={1.3} /></div><div className="domain-content"><span className="domain-en">{item.en}</span><h3>{item.name}<span className="domain-arrow"><ArrowUpRight size={22} /></span></h3><p>{item.description}</p><div className="domain-tags">{item.tags.map(tag => <span key={tag}>{tag}</span>)}</div></div></button>)}</div>
          </div>
        </section>
        <section id="services" className="portal-services portal-container">
          <div className="section-label"><span>03 — WHAT WE DO</span><span className="tiny-cross">+</span></div>
          <div className="services-layout"><div className="services-intro"><h2>구축의 시작부터<br />운영의 내일까지.</h2><p>산업의 이해를 바탕으로 설계하고,<br />서비스의 다음을 함께 고민합니다.</p><div className="service-mark"><Layers3 size={36} strokeWidth={1} /><span>END-TO-END<br /><b>IT PARTNERSHIP</b></span></div></div><div className="service-list"><article><span className="service-number">01</span><div><span className="service-en">SYSTEM INTEGRATION</span><h3>업무에 맞는 시스템을 구축합니다.</h3><p>업무 분석과 설계부터 개발, 통합, 서비스 전환까지.<br />도메인의 특성을 담아 실제로 쓰이는 시스템을 만듭니다.</p><div className="service-steps"><span>분석 · 설계</span><ArrowRight size={13} /><span>개발 · 통합</span><ArrowRight size={13} /><span>검증 · 전환</span></div></div><span className="service-monogram">SI</span></article><article><span className="service-number">02</span><div><span className="service-en">SYSTEM MANAGEMENT</span><h3>안정적인 오늘, 더 나은 내일을 운영합니다.</h3><p>유지관리와 장애 대응, 지속적인 기능 개선까지.<br />변화하는 업무 환경에 맞춰 시스템의 가치를 이어갑니다.</p><div className="service-steps"><span>운영 · 모니터링</span><ArrowRight size={13} /><span>유지관리</span><ArrowRight size={13} /><span>개선 · 고도화</span></div></div><span className="service-monogram">SM</span></article></div></div>
        </section>
        <section id="contact" className="portal-contact"><div className="contact-grid" /><div className="portal-container"><div><p className="portal-eyebrow"><span /> LET’S BUILD WHAT’S NEXT</p><h2>다음 프로젝트,<br />산업을 아는 파트너와 함께.</h2><p>새로운 시스템 구축부터 기존 서비스의 개선까지.<br />스패셜티와 가능성을 이야기해 보세요.</p></div><a href="http://www.spatialt.co.kr/" target="_blank" rel="noopener noreferrer" className="contact-link"><span>기존 홈페이지에서<br /><b>연락처 확인하기</b></span><MoveUpRight size={32} strokeWidth={1.3} /><small>SPATIALT.CO.KR</small></a></div></section>
      </main>
      <footer className="portal-footer portal-container"><div className="footer-main"><a href="#top" className="footer-brand">SPATIAL<span>T</span><small>(주)스패셜티</small></a><p>도메인을 이해하는 기술.<br />측량 · 농업 · 전기안전 SI / SM 전문기업</p><a href="#groupware">임직원 그룹웨어 <ArrowUpRight size={15} /></a></div><div className="footer-bottom"><span>© {new Date().getFullYear()} SPATIAL T. All rights reserved.</span><span>DOMAIN EXPERT. TECHNOLOGY PARTNER.</span><a href="#top">BACK TO TOP ↑</a></div></footer>
      {domain && <div className="domain-modal-backdrop" onClick={() => setSelected(null)}><section className="domain-modal" role="dialog" aria-modal="true" aria-labelledby="domain-title" aria-describedby="domain-description" onClick={event => event.stopPropagation()}><button ref={closeButton} className="domain-modal-close" aria-label="상세 내용 닫기" onClick={() => setSelected(null)}><X /></button><img src={domain.image} alt="" /><div className="domain-modal-body"><p className="domain-en">{domain.en}</p><h2 id="domain-title">{domain.name}</h2><h3>{domain.headline}</h3><p id="domain-description">{domain.description}</p><ul>{domain.details.map(detail => <li key={detail}><Check size={17} />{detail}</li>)}</ul><p className="domain-note">프로젝트의 세부 범위와 제공 기능은 업무 분석을 통해 협의합니다.</p></div></section></div>}
    </div>
  );
}
