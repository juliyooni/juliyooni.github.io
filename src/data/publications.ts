/**
 * Research 페이지의 논문·프로젝트 목록.
 * ✏️ 실제 항목으로 바꿔주세요. venue의 short는 뱃지로 표시됩니다.
 */

export interface Publication {
  title: string;
  authors: string; // 본인 이름은 **Jiyun Kim** 처럼 별표로 감싸면 강조됩니다
  venue: { full: string; short: string };
  year: number;
  links: { label: string; href: string }[];
}

export interface Project {
  title: { en: string; ko: string };
  description: { en: string; ko: string };
  href?: string;
}

export const publications: Publication[] = [
  // ✏️ 예시 항목 — 실제 논문으로 교체
  {
    title: 'Your first paper title goes here',
    authors: '**Jiyun Kim**, Coauthor Name',
    venue: { full: 'International Society for Music Information Retrieval Conference', short: 'ISMIR' },
    year: 2026,
    links: [
      { label: 'paper', href: '#' },
      { label: 'code', href: '#' },
    ],
  },
];

export const projects: Project[] = [
  {
    title: { en: 'Music Playground', ko: 'Music Playground' },
    description: {
      en: 'Browser instruments disguised as games — DDSP timbre transfer, a timpani rhythm game, scale practice.',
      ko: '게임인 척하는 브라우저 악기들 — DDSP 음색 변환, 팀파니 리듬 게임, 음계 연습.',
    },
    href: '/playground',
  },
];
