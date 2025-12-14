# RAG 질의응답 가이드

인덱싱이 완료된 후 질문-응답 시스템을 사용하는 방법입니다.

## 빠른 시작

### 1. 서버 실행

```bash
pnpm run start:dev
```

서버가 시작되면 다음과 같이 표시됩니다:
```
[Nest] 12345  - 2024/12/14 오후 5:30:00     LOG [NestApplication] Nest application successfully started +2ms
```

### 2. 질문하기

#### 방법 1: curl 명령어

```bash
curl -X POST http://localhost:3000/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "케이뱅크의 개인정보 보호책임자는 누구인가요?"
  }'
```

#### 방법 2: 테스트 스크립트 실행

```bash
./test-query.sh
```

#### 방법 3: HTTP 클라이언트 (Thunder Client, Postman 등)

- **URL**: `http://localhost:3000/rag/query`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`
- **Body**:
```json
{
  "question": "질문 내용"
}
```

## 예제 질문들

### 개인정보 관련

```bash
# 1. 보호책임자 확인
curl -X POST http://localhost:3000/rag/query \
  -H "Content-Type: application/json" \
  -d '{"question": "개인정보 보호책임자는 누구인가요?"}'

# 2. 고객센터 정보
curl -X POST http://localhost:3000/rag/query \
  -H "Content-Type: application/json" \
  -d '{"question": "고객센터 연락처를 알려주세요"}'

# 3. 비밀번호 정책
curl -X POST http://localhost:3000/rag/query \
  -H "Content-Type: application/json" \
  -d '{"question": "비밀번호 정책은 어떻게 되나요?"}'

# 4. 개인정보 수집 항목
curl -X POST http://localhost:3000/rag/query \
  -H "Content-Type: application/json" \
  -d '{"question": "어떤 개인정보를 수집하나요?"}'

# 5. 데이터 보관 기간
curl -X POST http://localhost:3000/rag/query \
  -H "Content-Type: application/json" \
  -d '{"question": "개인정보는 얼마나 보관하나요?"}'
```

### 회사 비교

```bash
# 여러 회사의 정보 비교
curl -X POST http://localhost:3000/rag/query \
  -H "Content-Type: application/json" \
  -d '{"question": "케이뱅크와 토스의 개인정보 처리 방침 차이는 무엇인가요?"}'
```

## 응답 형식

```json
{
  "answer": "케이뱅크의 개인정보 보호책임자는 이정민입니다. 연락처는...",
  "sources": [
    {
      "content": "개인정보보호책임자: 이정민 부서: 개인정보보호팀...",
      "metadata": {
        "fileName": "kbank-privacy-policy.json",
        "fileType": ".json",
        "loadedAt": "2024-12-14T08:30:00.000Z"
      }
    }
  ]
}
```

## 다른 API 엔드포인트

### 1. 유사 문서 검색 (벡터 검색만)

```bash
curl "http://localhost:3000/rag/search?q=개인정보보호&k=3"
```

### 2. 텍스트 직접 추가

```bash
curl -X POST http://localhost:3000/rag/documents \
  -H "Content-Type: application/json" \
  -d '{
    "texts": ["새로운 문서 내용"]
  }'
```

### 3. 파일 업로드

```bash
curl -X POST http://localhost:3000/rag/upload \
  -F "file=@/path/to/document.txt"
```

## 문제 해결

### 서버가 응답하지 않을 때

```bash
# 서버 상태 확인
curl http://localhost:3000

# 로그 확인
# 서버가 실행 중인 터미널에서 확인
```

### Qdrant 연결 오류

```bash
# Qdrant 상태 확인
curl http://localhost:6333/collections

# Qdrant 재시작
docker restart qdrant
```

### OpenAI API 오류

```bash
# .env 파일 확인
cat .env | grep OPENAI_API_KEY

# 환경 변수가 제대로 로드되었는지 확인
```

## 성능 최적화

### 1. 검색 결과 개수 조정

더 많은 컨텍스트가 필요하면 `k` 값을 조정할 수 있습니다:

```typescript
// src/rag/services/rag.service.ts
const relevantDocs = await this.vectorStoreService.similaritySearch(
  question,
  4, // 이 값을 늘리면 더 많은 문서 검색 (예: 8)
);
```

### 2. 청크 크기 조정

더 작은/큰 청크가 필요하면:

```typescript
// src/rag/services/chunking.service.ts
this.textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1500,    // 더 큰 청크
  chunkOverlap: 300,  // 더 많은 오버랩
});
```

재인덱싱 필요:
```bash
curl -X DELETE http://localhost:6333/collections/rag-documents
pnpm run index-docs
```

## 프로그래밍 방식 사용

### Node.js / TypeScript

```typescript
import axios from 'axios';

async function askQuestion(question: string) {
  const response = await axios.post('http://localhost:3000/rag/query', {
    question
  });
  
  console.log('답변:', response.data.answer);
  console.log('출처:', response.data.sources);
}

askQuestion('케이뱅크의 고객센터는?');
```

### Python

```python
import requests

def ask_question(question):
    response = requests.post(
        'http://localhost:3000/rag/query',
        json={'question': question}
    )
    data = response.json()
    print('답변:', data['answer'])
    print('출처:', data['sources'])

ask_question('케이뱅크의 고객센터는?')
```

## 다음 단계

- 웹 UI 추가하기
- 스트리밍 응답 구현하기
- 대화 히스토리 저장하기
- 멀티턴 대화 지원하기

자세한 내용은 [README.md](./README.md)를 참고하세요.

