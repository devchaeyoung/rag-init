# API 문서

## 기본 정보

- **Base URL**: `http://localhost:3000`
- **Content-Type**: `application/json` (파일 업로드 제외)

## 엔드포인트 목록

1. [문서 추가](#1-문서-추가)
2. [파일 업로드](#2-파일-업로드)
3. [질의응답](#3-질의응답)
4. [유사 문서 검색](#4-유사-문서-검색)

---

## 1. 문서 추가

텍스트 배열을 벡터 스토어에 추가합니다.

### 요청

```http
POST /rag/documents
Content-Type: application/json
```

**요청 본문:**

```json
{
  "texts": [
    "첫 번째 문서 내용입니다.",
    "두 번째 문서 내용입니다."
  ]
}
```

**파라미터:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `texts` | `string[]` | 예 | 추가할 텍스트 배열 |

### 응답

**성공 (200 OK):**

```json
{
  "message": "문서가 성공적으로 추가되었습니다."
}
```

**에러 (500 Internal Server Error):**

```json
{
  "error": "에러 메시지"
}
```

### 예제

**cURL:**

```bash
curl -X POST http://localhost:3000/rag/documents \
  -H "Content-Type: application/json" \
  -d '{
    "texts": [
      "LangChain은 LLM 애플리케이션 개발을 위한 프레임워크입니다.",
      "RAG는 Retrieval-Augmented Generation의 약자입니다."
    ]
  }'
```

**JavaScript (fetch):**

```javascript
const response = await fetch('http://localhost:3000/rag/documents', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    texts: [
      '문서 내용 1',
      '문서 내용 2'
    ]
  })
});

const result = await response.json();
console.log(result);
```

---

## 2. 파일 업로드

파일을 업로드하여 문서로 추가합니다.

### 요청

```http
POST /rag/upload
Content-Type: multipart/form-data
```

**요청 본문:**

- `file`: 업로드할 파일 (텍스트 파일, PDF 등)

### 응답

**성공 (200 OK):**

```json
{
  "message": "파일이 성공적으로 처리되었습니다.",
  "filename": "file-1234567890-123456789.txt"
}
```

**에러 (400 Bad Request):**

```json
{
  "error": "파일이 업로드되지 않았습니다."
}
```

**에러 (500 Internal Server Error):**

```json
{
  "error": "파일 로드 실패: 에러 메시지"
}
```

### 예제

**cURL:**

```bash
curl -X POST http://localhost:3000/rag/upload \
  -F "file=@/path/to/document.txt"
```

**JavaScript (FormData):**

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('http://localhost:3000/rag/upload', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(result);
```

**주의사항:**

- 업로드된 파일은 `./uploads` 디렉토리에 저장됩니다.
- 파일은 고유한 이름으로 저장됩니다.
- 텍스트 파일만 지원됩니다 (PDF 파싱은 향후 지원 예정).

---

## 3. 질의응답

질문에 대한 답변을 생성합니다.

### 요청

```http
POST /rag/query
Content-Type: application/json
```

**요청 본문:**

```json
{
  "question": "RAG가 무엇인가요?"
}
```

**파라미터:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `question` | `string` | 예 | 질문 내용 |

### 응답

**성공 (200 OK):**

```json
{
  "answer": "RAG는 Retrieval-Augmented Generation의 약자로...",
  "sources": [
    {
      "content": "RAG는 Retrieval-Augmented Generation의 약자입니다. 이는...",
      "metadata": {}
    },
    {
      "content": "RAG 시스템은 벡터 데이터베이스에서 관련 문서를 검색하여...",
      "metadata": {}
    }
  ]
}
```

**응답 필드:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `answer` | `string` | LLM이 생성한 답변 |
| `sources` | `array` | 참조된 소스 문서 배열 |
| `sources[].content` | `string` | 문서 내용 (최대 200자 미리보기) |
| `sources[].metadata` | `object` | 문서 메타데이터 |

**에러 (500 Internal Server Error):**

```json
{
  "error": "벡터 스토어가 초기화되지 않았습니다. 먼저 문서를 추가해주세요."
}
```

### 예제

**cURL:**

```bash
curl -X POST http://localhost:3000/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "LangChain은 무엇인가요?"
  }'
```

**JavaScript (fetch):**

```javascript
const response = await fetch('http://localhost:3000/rag/query', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    question: 'LangChain은 무엇인가요?'
  })
});

const result = await response.json();
console.log('답변:', result.answer);
console.log('소스:', result.sources);
```

**동작 방식:**

1. 질문을 벡터로 변환
2. Qdrant에서 유사한 문서 4개 검색
3. 검색된 문서를 컨텍스트로 사용하여 LLM 호출
4. 답변과 소스 문서 반환

---

## 4. 유사 문서 검색

질문과 유사한 문서를 검색합니다.

### 요청

```http
GET /rag/search?q={query}&k={k}
```

**쿼리 파라미터:**

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `q` | `string` | 예 | - | 검색어 |
| `k` | `number` | 아니오 | `4` | 반환할 문서 개수 |

### 응답

**성공 (200 OK):**

```json
{
  "documents": [
    {
      "content": "전체 문서 내용...",
      "metadata": {}
    },
    {
      "content": "전체 문서 내용...",
      "metadata": {}
    }
  ]
}
```

**응답 필드:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `documents` | `array` | 검색된 문서 배열 |
| `documents[].content` | `string` | 문서 전체 내용 |
| `documents[].metadata` | `object` | 문서 메타데이터 |

**에러 (500 Internal Server Error):**

```json
{
  "error": "벡터 스토어가 초기화되지 않았습니다. 먼저 문서를 추가해주세요."
}
```

### 예제

**cURL:**

```bash
# 기본 검색 (k=4)
curl "http://localhost:3000/rag/search?q=LangChain"

# 문서 개수 지정
curl "http://localhost:3000/rag/search?q=LangChain&k=10"
```

**JavaScript (fetch):**

```javascript
const query = 'LangChain';
const k = 5;

const response = await fetch(
  `http://localhost:3000/rag/search?q=${encodeURIComponent(query)}&k=${k}`
);

const result = await response.json();
console.log('검색 결과:', result.documents);
```

**동작 방식:**

1. 검색어를 벡터로 변환
2. Qdrant에서 Cosine Similarity를 사용하여 유사한 문서 검색
3. 상위 K개 문서 반환

---

## 에러 처리

### 공통 에러 응답

모든 에러는 다음 형식을 따릅니다:

```json
{
  "error": "에러 메시지"
}
```

### 주요 에러 코드

| HTTP 상태 코드 | 설명 |
|---------------|------|
| `200` | 성공 |
| `400` | 잘못된 요청 (파라미터 누락 등) |
| `500` | 서버 내부 오류 |

### 일반적인 에러 상황

1. **벡터 스토어 미초기화**
   - 원인: 문서가 추가되지 않음
   - 해결: 먼저 `/rag/documents` 또는 `/rag/upload`로 문서 추가

2. **Qdrant 연결 실패**
   - 원인: Qdrant 서버가 실행되지 않음
   - 해결: Qdrant 서버 실행 확인

3. **OpenAI API 오류**
   - 원인: API 키 오류 또는 할당량 초과
   - 해결: API 키 확인 및 할당량 확인

---

## 사용 예제 시나리오

### 시나리오 1: 문서 추가 및 질의응답

```bash
# 1. 문서 추가
curl -X POST http://localhost:3000/rag/documents \
  -H "Content-Type: application/json" \
  -d '{
    "texts": [
      "LangChain은 LLM 애플리케이션 개발을 위한 프레임워크입니다.",
      "RAG는 Retrieval-Augmented Generation의 약자입니다.",
      "벡터 데이터베이스는 유사도 검색에 사용됩니다."
    ]
  }'

# 2. 질문하기
curl -X POST http://localhost:3000/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "RAG가 무엇인가요?"
  }'
```

### 시나리오 2: 파일 업로드 및 검색

```bash
# 1. 파일 업로드
curl -X POST http://localhost:3000/rag/upload \
  -F "file=@document.txt"

# 2. 유사 문서 검색
curl "http://localhost:3000/rag/search?q=검색어&k=5"
```

---

## 성능 고려사항

1. **문서 추가**: 
   - 대량 문서 추가 시 시간이 소요될 수 있음
   - 비동기 처리 고려 필요

2. **질의응답**:
   - LLM 호출로 인해 응답 시간이 2-5초 소요될 수 있음
   - 타임아웃 설정 권장

3. **검색**:
   - 일반적으로 빠른 응답 (100-500ms)
   - 문서 수가 많을수록 검색 시간 증가

---

## 제한사항

- **파일 크기**: 현재 제한 없음 (서버 리소스에 따라 조정 필요)
- **문서 길이**: 텍스트 분할로 자동 처리 (청크 크기: 1000자)
- **검색 개수**: 기본값 4개, 최대 개수는 Qdrant 설정에 따름
- **동시 요청**: NestJS 기본 설정 사용

