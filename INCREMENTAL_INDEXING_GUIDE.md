# 증분 인덱싱 가이드

## 개요

증분 인덱싱은 변경된 파일만 재인덱싱하여 시간과 비용을 절약하는 기능입니다.

## 빠른 시작

### 1. CLI 사용

```bash
# 증분 인덱싱 실행
pnpm run index-incremental

# 통계 확인
curl http://localhost:3000/rag/stats
```

### 2. API 사용

```bash
# 증분 인덱싱 (서버 실행 중이어야 함)
curl -X POST http://localhost:3000/rag/incremental-index \
  -H "Content-Type: application/json" \
  -d '{
    "dirPath": "rag-docs",
    "recursive": true
  }'
```

## 작동 원리

```
파일 변경 감지 → 해시 비교 → 변경된 파일만 재인덱싱
```

1. **첫 인덱싱**: 모든 파일 추가 + 히스토리 기록
2. **변경 없음**: 모든 파일 스킵 (초고속 ⚡)
3. **1개 수정**: 1개만 재인덱싱 (비용 절감 💰)

## 비용 절감 효과

| 시나리오 | 전체 재인덱싱 | 증분 업데이트 | 절감 |
|---------|-------------|-------------|------|
| 변경 없음 | $0.02, 30초 | $0, 2초 | **100%** |
| 1개 수정 | $0.02, 30초 | $0.002, 5초 | **91%** |

## API 엔드포인트

### POST /rag/incremental-index
증분 인덱싱 실행

**요청:**
```json
{
  "dirPath": "rag-docs",
  "recursive": true
}
```

**응답:**
```json
{
  "success": true,
  "added": 1,      // 새로 추가된 파일
  "updated": 2,    // 변경되어 재인덱싱된 파일
  "skipped": 8,    // 변경 없어서 스킵된 파일
  "deleted": 0,    // 삭제된 파일
  "total": 11,
  "message": "증분 인덱싱 완료: 추가 1개, 업데이트 2개, 스킵 8개"
}
```

### GET /rag/stats
인덱싱 통계 조회

**응답:**
```json
{
  "success": true,
  "totalFiles": 11,
  "totalChunks": 204,
  "lastIndexedAt": "2024-12-14T08:35:00.000Z"
}
```

### POST /rag/reset-history
히스토리 초기화 (다음 실행 시 전체 재인덱싱)

**응답:**
```json
{
  "success": true,
  "message": "인덱싱 히스토리가 초기화되었습니다."
}
```

## 테스트

```bash
# 증분 인덱싱 테스트 스크립트
./test-incremental.sh
```

**테스트 시나리오:**
1. 히스토리 초기화
2. 첫 인덱싱 (모든 파일 추가)
3. 두 번째 인덱싱 (모든 파일 스킵)
4. 파일 수정 후 인덱싱 (변경된 파일만 업데이트)

## 프로덕션 자동화

### Cron으로 주기적 인덱싱

```bash
# crontab -e
# 매일 새벽 2시 증분 인덱싱
0 2 * * * cd /path/to/project && pnpm run index-incremental

# 매주 일요일 새벽 3시 전체 재인덱싱
0 3 * * 0 cd /path/to/project && pnpm run index-docs
```

### Webhook 연동

```typescript
// 문서 업로드 시 자동 증분 인덱싱
app.post('/webhook/document-updated', async (req, res) => {
  const result = await fetch('http://localhost:3000/rag/incremental-index', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dirPath: 'rag-docs', recursive: true }),
  }).then(r => r.json());
  
  res.json(result);
});
```

## 주의사항

### 1. 삭제된 파일
- 히스토리에서는 자동 제거
- ⚠️ 벡터 DB에서는 수동 제거 필요
- 주기적으로 전체 재인덱싱 권장

### 2. 파일 이동
- 이동된 파일은 "삭제 + 추가"로 인식됨
- 중복 청크가 생성될 수 있음

### 3. 대용량 파일
- 해시 계산 시간이 오래 걸릴 수 있음
- 대부분의 문서는 문제없음 (<1MB)

## 히스토리 파일

**`.indexing-history.json`**

```json
{
  "/absolute/path/to/file1.json": {
    "hash": "a1b2c3d4e5f6...",
    "modifiedTime": "2024-12-14T08:30:00.000Z",
    "chunkCount": 18,
    "indexedAt": "2024-12-14T08:35:00.000Z"
  },
  "/absolute/path/to/file2.pdf": {
    "hash": "f6e5d4c3b2a1...",
    "modifiedTime": "2024-12-10T10:20:00.000Z",
    "chunkCount": 25,
    "indexedAt": "2024-12-14T08:35:10.000Z"
  }
}
```

**주의:**
- Git에 커밋하지 마세요 (`.gitignore` 추가 권장)
- 백업 권장 (인덱싱 히스토리 유지)

## 트러블슈팅

### Q1. 변경했는데 스킵된다?
**A:** 파일 내용이 실제로 변경되었는지 확인
```bash
# 해시 확인
md5 rag-docs/yourfile.json
```

### Q2. 히스토리 초기화하려면?
**A:** API 호출 또는 파일 삭제
```bash
curl -X POST http://localhost:3000/rag/reset-history
# 또는
rm .indexing-history.json
```

### Q3. 전체 재인덱싱하려면?
**A:** 기존 `index-docs` 스크립트 사용
```bash
pnpm run index-docs
```

### Q4. 통계가 안 나온다?
**A:** 서버가 실행 중인지 확인
```bash
curl http://localhost:3000/rag/stats
```

## 모범 사례

1. **개발 환경**: 매번 증분 인덱싱
2. **프로덕션**: 일일 증분 + 주간 전체 재인덱싱
3. **대용량 데이터셋**: 증분 인덱싱 필수
4. **소규모 데이터셋**: 전체 재인덱싱도 괜찮음

## 관련 문서

- [인덱싱 가이드](./INDEXING_GUIDE.md) - 전체 인덱싱
- [쿼리 가이드](./QUERY_GUIDE.md) - RAG 쿼리
- [작업 로그 12](./ai-logs/12-증분-업데이트-구현.md) - 상세 구현

