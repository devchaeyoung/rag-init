# 문서 인덱싱 가이드

이 가이드는 `rag-docs` 폴더의 모든 문서를 벡터 DB에 저장하는 방법을 설명합니다.

## 빠른 시작

### 1. Qdrant 서버 실행

```bash
docker run -d -p 6333:6333 -p 6334:6334 --name qdrant qdrant/qdrant
```

### 2. 환경 변수 설정

`.env` 파일에 다음 내용을 추가하세요:

```env
OPENAI_API_KEY=your_openai_api_key_here
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION_NAME=rag-documents
```

### 3. 문서 인덱싱 실행

```bash
pnpm run index-docs
```

완료! 이제 RAG 시스템이 `rag-docs`의 모든 문서를 학습했습니다.

## 사용 방법

### 방법 1: CLI 스크립트 (권장)

가장 간단하고 빠른 방법입니다.

```bash
pnpm run index-docs
```

**출력 예시:**
```
🚀 RAG 문서 인덱싱 시작...

📁 디렉토리: /Users/chaeyoung/Desktop/rag-study/rag-docs
📄 문서 로딩 중...

파일 로드 중: kbank-privacy-policy.json (.json)
파일 로드 완료: kbank-privacy-policy.json (15234 문자)
파일 로드 중: lg-privacy-policy.json (.json)
파일 로드 완료: lg-privacy-policy.json (12456 문자)
...

✅ 인덱싱 완료!
📊 처리된 파일 수: 11개
💾 벡터 DB에 저장되었습니다.
```

### 방법 2: REST API

서버가 실행 중일 때 API로 인덱싱할 수 있습니다.

```bash
# 1. 서버 시작
pnpm run start:dev

# 2. API 호출
curl -X POST http://localhost:3000/rag/index-directory \
  -H "Content-Type: application/json" \
  -d '{
    "dirPath": "rag-docs",
    "recursive": true
  }'
```

**응답:**
```json
{
  "success": true,
  "filesProcessed": 11,
  "message": "11개 파일이 성공적으로 인덱싱되었습니다."
}
```

## 지원 파일 형식

현재 다음 형식을 지원합니다:

- **JSON** (`.json`) - JSON 구조를 텍스트로 변환
- **PDF** (`.pdf`) - PDF에서 텍스트 추출
- **텍스트** (`.txt`) - 일반 텍스트 파일
- **마크다운** (`.md`, `.markdown`) - 마크다운 파일

## 문서 확인

인덱싱이 완료되면 질문을 통해 확인할 수 있습니다:

```bash
# 서버 시작
pnpm run start:dev

# 질문하기
curl -X POST http://localhost:3000/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "케이뱅크의 개인정보보호 책임자는 누구인가요?"
  }'
```

## 문제 해결

### Qdrant 서버가 실행 중인지 확인

```bash
# 서버 상태 확인
curl http://localhost:6333/collections

# 컬렉션 확인
curl http://localhost:6333/collections/rag-documents
```

### OpenAI API 키 확인

```bash
# .env 파일 확인
cat .env | grep OPENAI_API_KEY
```

### 로그 확인

인덱싱 중 오류가 발생하면 로그를 확인하세요:

```bash
# CLI 스크립트 실행 시 자동으로 출력됨
pnpm run index-docs

# 서버 로그 확인
pnpm run start:dev
```

## 추가 옵션

### 특정 디렉토리 인덱싱

```typescript
// scripts/index-rag-docs.ts 수정
const ragDocsPath = path.join(process.cwd(), 'my-custom-docs');
```

### 청킹 설정 변경

```typescript
// src/rag/services/chunking.service.ts
this.textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1500,    // 기본값: 1000
  chunkOverlap: 300,  // 기본값: 200
});
```

### 재인덱싱

문서를 다시 인덱싱하려면:

```bash
# 1. 컬렉션 삭제 (선택)
curl -X DELETE http://localhost:6333/collections/rag-documents

# 2. 재인덱싱
pnpm run index-docs
```

## 비용 고려사항

- OpenAI 임베딩 API 사용 시 비용이 발생합니다
- 텍스트 1,000자당 약 $0.0001 (text-embedding-ada-002)
- 예상 비용: 11개 파일 (약 150,000자) ≈ $0.015

## 다음 단계

인덱싱이 완료되면:

1. 질문을 통해 답변 확인
2. 유사 문서 검색 테스트
3. 프로덕션 환경에 배포

자세한 내용은 [README.md](./README.md)를 참고하세요.

