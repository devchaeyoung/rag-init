# RAG Study Project

NestJS 기반 RAG (Retrieval-Augmented Generation) 시스템

## 주요 기능

- 📄 **다양한 문서 형식 지원**: JSON, PDF, TXT, MD, DOCX
- 🔍 **벡터 검색**: Qdrant를 사용한 고성능 벡터 검색
- 🤖 **LLM 답변 생성**: OpenAI GPT를 활용한 구조화된 답변
- 🎯 **Re-ranking**: 회사별 필터링으로 정확한 검색 결과
- ⚡ **증분 업데이트**: 변경된 파일만 재인덱싱하여 비용 절감

## 빠른 시작

### 1. 설치

```bash
pnpm install
```

### 2. 환경 변수 설정

`.env` 파일 생성:

```env
OPENAI_API_KEY=your_openai_api_key_here
QDRANT_URL=http://localhost:6333
```

### 3. Qdrant 실행

```bash
docker run -p 6333:6333 qdrant/qdrant
```

### 4. 문서 인덱싱

```bash
# 첫 인덱싱 (전체)
pnpm run index-docs

# 또는 증분 인덱싱 (변경된 파일만)
pnpm run index-incremental
```

### 5. 서버 실행

```bash
pnpm run start:dev
```

### 6. 쿼리 테스트

```bash
curl -X POST http://localhost:3000/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "쿠팡의 개인정보 보호책임자는 누구인가요?"
  }'
```

## 사용 가이드

- [인덱싱 가이드](./INDEXING_GUIDE.md) - 문서 인덱싱 방법
- [증분 인덱싱 가이드](./INCREMENTAL_INDEXING_GUIDE.md) - 증분 업데이트
- [쿼리 가이드](./QUERY_GUIDE.md) - RAG 쿼리 사용법

## API 엔드포인트

### POST /rag/query

질문에 답변

```bash
curl -X POST http://localhost:3000/rag/query \
  -H "Content-Type: application/json" \
  -d '{"question": "비밀번호 정책은?"}'
```

### POST /rag/incremental-index

증분 인덱싱

```bash
curl -X POST http://localhost:3000/rag/incremental-index \
  -H "Content-Type: application/json" \
  -d '{"dirPath": "rag-docs", "recursive": true}'
```

### GET /rag/stats

인덱싱 통계 조회

```bash
curl http://localhost:3000/rag/stats
```

## 프로젝트 구조

```
src/
├── rag/
│   ├── controllers/       # API 컨트롤러
│   ├── services/          # 비즈니스 로직
│   │   ├── rag.service.ts           # RAG 파이프라인
│   │   ├── embedding.service.ts     # 임베딩 생성
│   │   ├── chunking.service.ts      # 텍스트 분할
│   │   ├── vector-store.service.ts  # 벡터 스토어 관리
│   │   ├── document-loader.service.ts # 문서 로드
│   │   ├── llm.service.ts           # LLM 답변 생성
│   │   └── indexing-history.service.ts # 인덱싱 히스토리
│   ├── stores/            # 벡터 스토어 구현
│   │   └── qdrant-vector-store.ts
│   ├── utils/             # 유틸리티
│   │   └── file-hash.util.ts
│   └── rag.module.ts
├── app.module.ts
└── main.ts

scripts/
├── index-rag-docs.ts      # 전체 인덱싱 스크립트
└── incremental-index.ts   # 증분 인덱싱 스크립트

ai-logs/                   # 작업 로그 (학습용)
├── 1-필요한-LangChain-패키지-설치.md
├── 2-RAG-모듈-및-서비스-생성.md
├── ...
└── 12-증분-업데이트-구현.md
```

## 기술 스택

- **프레임워크**: NestJS
- **언어**: TypeScript
- **벡터 DB**: Qdrant
- **LLM**: OpenAI GPT-3.5/4
- **RAG 프레임워크**: LangChain

## 주요 개념

### RAG (Retrieval-Augmented Generation)

1. **문서 인덱싱**: 문서를 청크로 분할 → 임베딩 생성 → 벡터 DB 저장
2. **검색**: 질문을 임베딩 → 벡터 유사도 검색
3. **답변 생성**: 검색된 문서 + 질문 → LLM에 전달 → 답변 생성

### 증분 업데이트

- 파일 해시로 변경 감지
- 변경된 파일만 재인덱싱
- **비용 절감**: 최대 100% (변경 없을 때)
- **시간 절약**: 2초 vs 30초

### Re-ranking

- 벡터 검색 후 메타데이터 필터링
- 회사명으로 문서 필터링
- 정확도 향상

## 성능

| 지표                    | 값     |
| ----------------------- | ------ |
| 문서 수                 | 11개   |
| 청크 수                 | ~204개 |
| 평균 응답 시간          | ~3초   |
| 증분 인덱싱 (변경 없음) | ~2초   |
| 증분 인덱싱 (1개 변경)  | ~5초   |

## 비용

| 작업             | OpenAI API 호출            | 비용 (예상) |
| ---------------- | -------------------------- | ----------- |
| 전체 인덱싱      | ~204 embeddings            | $0.02       |
| 증분 (변경 없음) | 0                          | $0          |
| 증분 (1개 변경)  | ~18 embeddings             | $0.002      |
| 쿼리 1회         | 1 embedding + 1 completion | $0.001      |

## 작업 로그

모든 작업은 `ai-logs/` 폴더에 상세히 기록되어 있습니다:

1. [LangChain 패키지 설치](./ai-logs/1-필요한-LangChain-패키지-설치.md)
2. [RAG 모듈 및 서비스 생성](./ai-logs/2-RAG-모듈-및-서비스-생성.md)
3. [DocumentLoader 구성](./ai-logs/3-DocumentLoader-구성.md)
4. [TextSplitter 구성](./ai-logs/4-TextSplitter-구성.md)
5. [VectorStore 및 Embedding 설정](./ai-logs/5-VectorStore-및-Embedding-설정.md)
6. [LLM 및 RAG Chain 구성](./ai-logs/6-LLM-및-RAG-Chain-구성.md)
7. [빌드 오류 수정](./ai-logs/7-빌드-오류-수정.md)
8. [FAISS에서 Qdrant로 벡터 DB 변경](./ai-logs/8-FAISS에서-Qdrant로-벡터-DB-변경.md)
9. [문서 인덱싱 시스템 구축](./ai-logs/9-문서-인덱싱-시스템-구축.md)
10. [프롬프트 엔지니어링 개선](./ai-logs/10-프롬프트-엔지니어링-개선.md)
11. [Re-ranking 회사별 필터링 구현](./ai-logs/11-Re-ranking-회사별-필터링-구현.md)
12. [증분 업데이트 구현](./ai-logs/12-증분-업데이트-구현.md)

## 개발

```bash
# 개발 서버
pnpm run start:dev

# 빌드
pnpm run build

# 프로덕션 실행
pnpm run start:prod

# 테스트
pnpm run test
```

## 테스트 스크립트

```bash
# 쿼리 테스트
./test-query.sh

# Re-ranking 테스트
./test-rerank.sh

# 증분 인덱싱 테스트
./test-incremental.sh
```

## 라이선스

MIT

## 문의

프로젝트에 대한 질문이나 제안사항이 있으시면 이슈를 등록해주세요.

---

**제작**: RAG Study Project  
**목적**: LangChain + NestJS + Qdrant를 활용한 프로덕션급 RAG 시스템 구축
