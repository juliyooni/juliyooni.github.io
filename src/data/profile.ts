import type { Locale } from '../i18n/ui';

/**
 * 사이트 전체에서 쓰는 프로필 정보.
 * ✏️ 표시된 곳은 실제 내용으로 바꿔주세요.
 * 초상 사진: public/portrait.jpg 로 넣고 아래 portrait 경로를 바꾸면 됩니다.
 */

type Bilingual = Record<Locale, string>;

export const profile = {
  name: { en: 'Jiyun Kim', ko: '김지윤' } satisfies Bilingual,
  tagline: {
    en: 'Music Information Retrieval · German Letters',
    ko: 'Music Information Retrieval · German Letters',
  } satisfies Bilingual,
  affiliation: {
    en: 'M.S. student · MALerLab, Sogang University',
    ko: '서강대학교 MALerLab 석사과정',
  } satisfies Bilingual,
  // ✏️ 소개문
  bio: {
    en: 'I study music information retrieval — how machines listen to music. Having studied German literature, I also write about the places where music and literature overlap. This site is a lab, a feuilleton, and a playground.',
    ko: '음악 정보 검색(MIR)을 연구합니다. 기계가 음악을 어떻게 듣는지 궁리하고, 독문학을 공부했던 사람으로서 음악과 문학이 겹치는 자리에 대해 씁니다. 이 사이트는 연구실이자 문예란이자 놀이터입니다.',
  } satisfies Bilingual,
  // ✏️ 관심사
  interests: {
    en: ['symbolic music', 'music generation', 'orchestral music', 'Lied and poetry'],
    ko: ['symbolic music', '음악 생성', '오케스트라', 'Lied와 시'],
  } satisfies Record<Locale, string[]>,
  // ✏️ 뉴스 — 최신이 위로. 오래된 항목은 지우지 말고 아래로.
  news: [
    {
      date: '2026. 7.',
      en: 'Started the FMP Korean commentary series.',
      ko: 'FMP 한국어 해설 연재를 시작했습니다.',
      href: '/mir',
    },
  ],
  portrait: '/portrait.svg', // ✏️ public/portrait.jpg 넣고 '/portrait.jpg'로 변경
  links: {
    github: 'https://github.com/juliyooni',
    scholar: '', // ✏️ Google Scholar 프로필 URL
    email: 'mailto:jiyunjulik@gmail.com',
    cv: '', // ✏️ CV PDF를 public/cv.pdf 로 넣고 '/cv.pdf'
  },
};
