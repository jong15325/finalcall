import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { bidCtaLabelFor, formatVerbose, phaseOf } from '@/lib/countdown';
import { CountdownChip } from './Countdown';

/**
 * Countdown — FC-049 부채 10("임박 3구간은 색만 바꾸지 않는다") + FC-038 이월 minor 검증.
 *
 * ★ 색은 스냅샷으로 굳히지 않는다(토큰이 바뀌면 거짓 실패한다). 대신 **색이 아닌 축**을 고정한다 —
 *   표현 단위 · CTA 문구 · 스크린리더 문장. 색만 바뀌는 회귀는 이 축들이 살아 있으면 치명적이지 않다.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;

describe('구간 판정([5.9] 임계값 — T-5분 / T-30초)', () => {
  it.each([
    [10 * MINUTE, 'calm'],
    [5 * MINUTE, 'soon'],
    [31 * SECOND, 'soon'],
    [30 * SECOND, 'urgent'],
    [1 * SECOND, 'urgent'],
    [0, 'ended'],
    [-1000, 'ended'],
  ])('%i ms → %s', (remaining, expected) => {
    expect(phaseOf(remaining)).toBe(expected);
  });
});

describe('★ CTA 문구가 구간과 함께 움직인다(색만 바꾸지 않는다)', () => {
  it('임박에서만 "지금 입찰"로 바뀐다', () => {
    expect(bidCtaLabelFor('calm')).toBe('입찰하기');
    expect(bidCtaLabelFor('soon')).toBe('입찰하기');
    expect(bidCtaLabelFor('urgent')).toBe('지금 입찰');
  });
});

describe('★ 스크린리더 문장 — FC-038 이월 "0분 남음"', () => {
  it('1분 미만은 초로 읽는다 — 임박 구간 내내 "0분 남음"이 되지 않는다', () => {
    expect(formatVerbose(28 * SECOND)).toBe('마감까지 28초 남음');
    expect(formatVerbose(1 * SECOND)).toBe('마감까지 1초 남음');
  });

  it('1분 이상은 큰 단위부터 읽고 0인 단위는 생략한다', () => {
    expect(formatVerbose(3 * MINUTE)).toBe('마감까지 3분 남음');
    expect(formatVerbose(2 * 3600 * SECOND)).toBe('마감까지 2시간 남음');
    expect(formatVerbose(26 * 3600 * SECOND)).toBe('마감까지 1일 2시간 남음');
  });
});

describe('CountdownChip — 표현 단위가 구간마다 다르다', () => {
  it('평시는 분까지만 적는다(초당 갱신·초 표기 없음)', () => {
    render(<CountdownChip endAt={new Date(Date.now() + 2 * 3600 * SECOND).toISOString()} />);

    // HH:MM (초 자리가 없다)
    expect(screen.getByText(/^\d{2}:\d{2}$/)).toBeInTheDocument();
  });

  it('임박은 MM:SS 로 초까지 적는다', () => {
    render(<CountdownChip endAt={new Date(Date.now() + 28 * SECOND).toISOString()} />);

    // 렌더까지 수 ms가 흐르므로 정확한 초를 못 박지 않는다(테스트가 시계와 경주하지 않게).
    expect(screen.getByText(/^00:2\d$/)).toBeInTheDocument();
    expect(screen.getByText(/^마감까지 2\d초 남음$/)).toBeInTheDocument();
  });

  it('하루 이상 남으면 일수를 앞세운다', () => {
    // 렌더 지연으로 2일이 1일 23:59로 내려앉을 수 있어 여유를 준다(테스트가 시계와 경주하지 않게).
    render(
      <CountdownChip endAt={new Date(Date.now() + (2 * 86400 + 3600) * SECOND).toISOString()} />,
    );

    expect(screen.getByText(/^2일 \d{2}:\d{2}$/)).toBeInTheDocument();
  });

  it('마감된 경매는 "마감" 정적 표시다(타이머를 남기지 않는다)', () => {
    render(<CountdownChip endAt={new Date(Date.now() - SECOND).toISOString()} />);

    expect(screen.getByText('마감')).toBeInTheDocument();
  });

  it('시각 값은 aria-hidden 이고 스크린리더에는 전체 문장이 간다(초당 스팸 방지)', () => {
    render(<CountdownChip endAt={new Date(Date.now() + 3 * MINUTE).toISOString()} />);

    expect(screen.getByText(/^\d{2}:\d{2}$/)).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText(/마감까지 .*남음/)).toBeInTheDocument();
  });
});
