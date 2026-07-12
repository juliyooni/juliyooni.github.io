---
title: 'FMP Ch.1 — 음악을 숫자로 읽는 법'
description: '악보, MIDI, 오디오. 같은 음악의 세 가지 표현과 그 사이의 간극에 대하여. (샘플 글 — 내용을 채워주세요)'
date: 2026-07-12
lang: ko
series: fmp
seriesOrder: 1
draft: true
---

> ✏️ 이 파일은 연재 구조를 보여주기 위한 샘플입니다. `draft: true`라서 빌드에는 포함되지 않습니다. 내용을 채운 뒤 `draft`를 지우면 공개됩니다.

같은 "음악"이라도 컴퓨터에게 건네는 방법은 하나가 아닙니다. FMP 1장은 세 가지 표현을 다룹니다.

## 악보 (Sheet Music)

기보법은 인간을 위한 압축 포맷입니다...

## MIDI / 심볼릭 표현

$$
\text{pitch} = 69 + 12 \log_2\left(\frac{f}{440\,\text{Hz}}\right)
$$

MIDI 노트 번호와 주파수의 관계처럼, 심볼릭 표현은 음악을 이산적인 사건의 목록으로 봅니다...

## 오디오

연속적인 압력 변화의 기록. 표본화(sampling)와 양자화(quantization)를 거쳐...
