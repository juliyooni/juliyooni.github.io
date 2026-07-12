# juliyooni.github.io — 개인 사이트 설계 스펙

2026-07-12, 브레인스토밍 세션에서 확정된 결정사항.

## 목적

MIR 연구자 Jiyun Kim(김지윤, MALerLab 석사과정)의 개인 사이트.
연구 소개 + MIR 한국어 블로그(트래픽 유도, 본인 공부) + 음악·문학 에세이(독문학 배경) + 인터랙티브 음악 게임.
외관에서 클래식 애호가임이 드러나야 함.

## 확정된 결정

| 항목 | 결정 |
|---|---|
| 호스팅 | GitHub Pages (`juliyooni` 계정, `juliyooni.github.io`) |
| 스택 | Astro (Content Collections, MDX 없이 md + KaTeX), 정적 출력 |
| 언어 | **영어 기본 + 한국어 토글**, 토글 버튼은 헤더에 눈에 띄게. UI·Research·About은 완전 이중 언어, 글 본문은 쓴 언어로만 (EN 모드에서 한국어 전용 글엔 "Korean only" 뱃지) |
| 디자인 | **A. 우어텍스트 에디션** — 헨레/베렌라이터 악보집 감성. 크림 종이(#F7F2E5), Cormorant Garamond(세리프 디스플레이) + IBM Plex Sans KR(본문), 헨레 블루(#1F3A5F) 악센트, 오선 모티프 |
| B안 재활용 | 콘서트 프로그램북 요소는 디테일로: 에세이 목록 악장 번호(I. II. III.), 푸터 "Fine." 등 |
| 섹션 구조 | 별개 섹션. 네비게이션·URL은 직관적 이름, 장식 이름은 페이지 헤더 부제로만 |
| Playground | 기존 Music Playground 3종 게임을 **우어텍스트 테마로 리스타일**해서 통합 (별개 아케이드 세계 아님) |

## 섹션과 이름

| URL | 네비 이름 | 장식 부제 | 내용 |
|---|---|---|---|
| `/` | Home | — | 타이틀 히어로(오선+𝄞) → 연구자 소개 블록(사진·소속·소개문·INTERESSEN·NEWS) → 최근 글 통합 → 4개 섹션 카드 → "Fine." 푸터 |
| `/research` | Research | — | 논문·프로젝트 목록(데이터 파일 기반), CV |
| `/mir` | MIR | *Études* | MIR 전반 한국어 블로그. FMP(Müller) 교재 해설 연재는 `series: fmp`로 묶여 교재 챕터 순서 목차 제공 |
| `/essays` | Essays | *Feuilleton* | 음악×문학 에세이, 목록에 악장 번호 스타일 |
| `/playground` | Playground | *Spielplatz* | 게임 3종: 음성 변환기(DDSP), 팀파니 리듬, 음계 연습 |
| `/about` | About | — | 학력·배경 긴 버전 |

- RSS: `/rss.xml` (통합) + 섹션별
- 한국어 페이지는 `/ko/...` 접두사 (글 상세는 locale 무관 단일 URL)

## 콘텐츠 시스템

- `src/content/mir/`, `src/content/essays/` — 파일 하나 = 글 하나
- frontmatter: `title, description, date, lang(ko|en), series?, seriesOrder?, draft?`
- 수식: remark-math + rehype-katex. 코드: Shiki 기본
- Research 목록: `src/data/publications.ts` 데이터 파일

## Playground 이식

원본: `/Users/yuli/Documents/GitHub/4_Playground/Music Playground` (Vite+TS, Tone.js, @magenta/music DDSP)
- lib(metronome, recorder)과 게임 로직(judge, musicxml, songs, pitch, scales 등)은 그대로 가져오고 UI/CSS만 우어텍스트 테마로 재작성
- `patches/`의 @magenta/music 패키징 픽스(patch-package) 함께 이전
- 팀파니 차트 JSON·반주 mp3는 `public/songs/`로 복사

## 하지 않기로 한 것

- Next.js/Hugo (Astro로 확정)
- 아케이드 룩 유지 (전체 우어텍스트 통일)
- 전면 이중 언어 글 작성 (글은 쓴 언어로만)
