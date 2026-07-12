# juliyooni.github.io

김지윤(Jiyun Kim)의 개인 사이트. 우어텍스트 악보집 무드의 연구자 홈 + 블로그 + 음악 게임.

설계 배경과 결정사항: [docs/specs/2026-07-12-site-design.md](docs/specs/2026-07-12-site-design.md)

## 구조

| URL | 내용 |
|---|---|
| `/` | 연구자 소개 + 최근 글 + 섹션 입구 |
| `/research` | 논문·프로젝트 (`src/data/publications.ts` 수정) |
| `/mir` | MIR 한국어 블로그. `series: fmp`인 글은 FMP 해설 연재 목차로 묶임 |
| `/essays` | 음악×문학 에세이 |
| `/playground` | 게임 3종 (음성 변환기 · 팀파니 · 음계 연습) |
| `/about` | 소개 긴 버전 |
| `/ko/...` | 한국어 UI (기본은 영어, 헤더의 EN·한 토글) |

## 글 쓰기

`src/content/mir/` 또는 `src/content/essays/`에 `.md` 파일 추가:

```yaml
---
title: '제목'
description: '한 줄 요약 (목록과 SEO에 쓰임)'
date: 2026-07-12
lang: ko          # ko | en
series: fmp       # FMP 연재일 때만
seriesOrder: 2    # 연재 순서
draft: true       # 쓰는 중이면 true — 빌드에서 제외
---
```

수식은 `$...$`(인라인), `$$...$$`(블록) — KaTeX로 렌더링됩니다.

## 내용 채우기 체크리스트

- [ ] `src/data/profile.ts` — 소개문·관심사·뉴스·Scholar/CV 링크 (✏️ 표시)
- [ ] `src/data/publications.ts` — 논문·프로젝트 목록
- [ ] `src/components/AboutPage.astro` — About 본문
- [ ] `public/portrait.jpg` 추가 후 `profile.ts`의 `portrait` 경로 변경
- [ ] `public/cv.pdf` 추가 (선택)

## 개발

```bash
npm install     # 의존성 + @magenta/music 패치(patch-package) 자동 적용
npm run dev     # http://localhost:4321
npm run build   # 정적 빌드 → dist/
```

main에 push하면 GitHub Actions가 GitHub Pages로 자동 배포합니다
(저장소 Settings → Pages → Source를 **GitHub Actions**로 설정해야 함).

## Playground 게임

원본은 `4_Playground/Music Playground`에서 이식, 로직은 그대로 두고
`src/styles/spielplatz.css`로만 리스타일했습니다. 팀파니 곡 추가나 게임 추가 방법은
원본 저장소 README 참고 — 차트 추출 스크립트(`extract-timpani`)는 원본에 있습니다.
