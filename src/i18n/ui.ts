export const locales = ['en', 'ko'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

const strings = {
  en: {
    'site.title': 'Jiyun Kim',
    'site.description':
      'MIR researcher writing about music information retrieval, and essays between music and literature.',
    'site.tagline': 'Music Information Retrieval · German Letters',
    'nav.research': 'Research',
    'nav.mir': 'MIR',
    'nav.essays': 'Essays',
    'nav.playground': 'Playground',
    'nav.about': 'About',
    'home.recent': 'Recent',
    'home.news': 'News',
    'home.interests': 'Interessen',
    'card.mir.desc': 'FMP commentary series and notes on MIR, in Korean',
    'card.essays.desc': 'Essays between music and literature',
    'card.playground.desc': 'Bow a violin with your voice, play the timpani',
    'card.research.desc': 'Publications, projects, CV',
    'mir.subtitle': 'Études',
    'mir.desc': 'Notes on music information retrieval — including a Korean commentary series on Müller’s Fundamentals of Music Processing.',
    'mir.series.fmp': 'FMP Commentary',
    'mir.series.fmp.desc': 'A chapter-by-chapter Korean companion to Fundamentals of Music Processing (Meinard Müller).',
    'mir.standalone': 'Notes',
    'essays.subtitle': 'Feuilleton',
    'essays.desc': 'Essays between music and literature.',
    'playground.subtitle': 'Spielplatz',
    'playground.desc': 'Small musical instruments disguised as games. Headphones recommended.',
    'research.desc': 'Publications and projects.',
    'post.koreanOnly': 'Korean',
    'post.englishOnly': 'English',
    'post.series.part': 'No.',
    'footer.fine': 'Fine.',
    'date.locale': 'en-US',
  },
  ko: {
    'site.title': '김지윤 — Jiyun Kim',
    'site.description':
      'MIR을 연구하고, 음악과 문학 사이에 대해 씁니다.',
    'site.tagline': 'Music Information Retrieval · German Letters',
    'nav.research': 'Research',
    'nav.mir': 'MIR',
    'nav.essays': 'Essays',
    'nav.playground': 'Playground',
    'nav.about': 'About',
    'home.recent': '최근 글',
    'home.news': 'News',
    'home.interests': '관심사',
    'card.mir.desc': 'FMP 한국어 해설 연재와 MIR 이야기',
    'card.essays.desc': '음악과 문학 사이의 에세이',
    'card.playground.desc': '목소리로 바이올린 켜고, 팀파니 두드리는 곳',
    'card.research.desc': '논문, 프로젝트, CV',
    'mir.subtitle': 'Études',
    'mir.desc': 'MIR(음악 정보 검색) 이야기 — Müller의 Fundamentals of Music Processing 교재를 챕터별로 해설하는 연재를 포함합니다.',
    'mir.series.fmp': 'FMP 해설 연재',
    'mir.series.fmp.desc': 'Fundamentals of Music Processing(Meinard Müller)을 처음부터 끝까지, 한국어로 풀어 읽는 연재입니다.',
    'mir.standalone': '단발 노트',
    'essays.subtitle': 'Feuilleton',
    'essays.desc': '음악과 문학 사이의 에세이.',
    'playground.subtitle': 'Spielplatz',
    'playground.desc': '게임인 척하는 작은 악기들. 헤드폰을 권장합니다.',
    'research.desc': '논문과 프로젝트.',
    'post.koreanOnly': '한국어',
    'post.englishOnly': 'English',
    'post.series.part': '제',
    'footer.fine': 'Fine.',
    'date.locale': 'ko-KR',
  },
} as const;

type UiKey = keyof (typeof strings)['en'];

export function t(locale: Locale, key: UiKey): string {
  return strings[locale][key] ?? strings[defaultLocale][key];
}

/** '/mir' + ko -> '/ko/mir', en -> '/mir' */
export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return locale === defaultLocale ? clean : `/${locale}${clean === '/' ? '' : clean}`;
}

export function getLocaleFromUrl(url: URL): Locale {
  const [, first] = url.pathname.split('/');
  return (locales as readonly string[]).includes(first) && first !== defaultLocale
    ? (first as Locale)
    : defaultLocale;
}

/** current pathname -> same page in the other locale */
export function switchLocalePath(pathname: string): { locale: Locale; path: string } {
  const current = getLocaleFromUrl(new URL(pathname, 'https://x'));
  if (current === 'ko') {
    const stripped = pathname.replace(/^\/ko(\/|$)/, '/');
    return { locale: 'en', path: stripped === '' ? '/' : stripped };
  }
  return { locale: 'ko', path: pathname === '/' ? '/ko/' : `/ko${pathname}` };
}

export function formatDate(locale: Locale, date: Date): string {
  return date.toLocaleDateString(t(locale, 'date.locale'), {
    year: 'numeric',
    month: locale === 'ko' ? 'long' : 'short',
    ...(locale === 'ko' ? {} : {}),
  });
}
