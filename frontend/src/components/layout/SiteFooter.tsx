import { Link } from 'react-router-dom';
import { Wordmark } from '@/components/layout/Wordmark';
import { ROUTES } from '@/routes/paths';

/**
 * SiteFooter — 공통 셸 하단(FC-041 집행).
 *
 * 종전 셸에는 푸터가 아예 없었다. 국내 커머스에서 신뢰의 상당 부분은 **사업자 고지**에서 오므로
 * 자리를 비워 두면 "만들다 만 사이트"로 읽힌다.
 *
 * 3단 구성: (a) 브랜드 + 링크 열 — `surface-band` · (b) 법적 고지 — `surface-sunken`(면 전환 자체가
 * 구분선이다. 밴드 위에서 `border` 는 1.06 이라 사실상 안 읽힌다, [2.5]) · (c) 저작권.
 *
 * ★ **없는 것을 만들지 않는다.** 목업의 "안내" 링크 열·고객센터 전화번호·정책 문서 링크는 대응 라우트가
 * 없어 **전부 죽은 링크**가 된다 — 열 자체를 뺐다. 사업자 정보는 목업 방침대로 **자리표시자임을 문장으로
 * 명시**한다(가짜 등록번호를 창작하지 않는다).
 */
const TRADE_LINKS = [
  { to: ROUTES.auctions, label: '경매' },
  { to: ROUTES.shops, label: '고정가' },
  { to: ROUTES.marketPrices, label: '시세' },
  { to: ROUTES.sell, label: '판매하기' },
];

const ACCOUNT_LINKS = [
  { to: ROUTES.inventory, label: '인벤토리' },
  { to: ROUTES.orders, label: '거래 내역' },
  { to: ROUTES.wallet, label: '지갑' },
  { to: ROUTES.profile, label: '프로필' },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface-band">
      <div className="mx-auto w-full max-w-[1200px] px-4 md:px-6">
        <div className="grid grid-cols-2 gap-8 py-12 md:grid-cols-[1.6fr_1fr_1fr] md:py-16">
          <div className="col-span-2 md:col-span-1">
            <Wordmark />
            <p className="mt-3 max-w-[30ch] text-micro leading-relaxed text-text-muted">
              마감 직전에도 최고가와 남은 시간이 흔들리지 않는 게임 아이템 경매.
            </p>
          </div>
          <FooterColumn title="거래" links={TRADE_LINKS} />
          <FooterColumn title="내 계정" links={ACCOUNT_LINKS} />
        </div>
      </div>

      {/* 법적 고지 — 함몰면. 면 전환이 구분선을 대신한다 */}
      <div className="bg-surface-sunken py-6">
        <div className="mx-auto w-full max-w-[1200px] px-4 md:px-6">
          <dl className="flex flex-wrap gap-x-5 gap-y-1 text-micro text-text-muted">
            <LegalItem term="상호" value="(주)파이널콜" />
            <LegalItem term="대표" value="미정" />
            <LegalItem term="사업자등록번호" value="000-00-00000" />
            <LegalItem term="통신판매업신고" value="제0000-서울0000-0000호" />
            <LegalItem term="개인정보보호책임자" value="미정" />
          </dl>
          <p className="mt-4 max-w-[78ch] text-micro leading-relaxed text-text-muted">
            FinalCall은 이용자 간 게임 아이템 거래를 중개하는 통신판매중개자이며, 개별 거래의
            당사자가 아닙니다. 게임머니·캐시는 서비스 내에서만 사용되며 현금으로 역환전되지
            않습니다.{' '}
            <strong className="font-bold text-text">위 사업자 정보는 자리표시자입니다.</strong> 실제
            사업자 등록 후 확정값으로 교체합니다.
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1200px] px-4 md:px-6">
        <p className="py-5 text-micro text-text-subtle">© 2026 FinalCall. All rights reserved.</p>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <div>
      <h2 className="mb-3 text-body font-bold text-text">{title}</h2>
      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.to}>
            <Link
              to={link.to}
              className="text-micro text-text-muted no-underline hover:text-primary hover:underline"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LegalItem({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-text-subtle">{term}</dt>
      <dd className="m-0 font-num">{value}</dd>
    </div>
  );
}
