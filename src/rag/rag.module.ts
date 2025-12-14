import { Module } from '@nestjs/common';
import { RagService } from './services/rag.service';
import { RagController } from './controllers/rag.controller';
import { EmbeddingService } from './services/embedding.service';
import { ChunkingService } from './services/chunking.service';
import { VectorStoreService } from './services/vector-store.service';
import { DocumentLoaderService } from './services/document-loader.service';
import { LLMService } from './services/llm.service';
import { IndexingHistoryService } from './services/indexing-history.service';

/**
 * RAG 모듈
 *
 * RAG 관련 서비스와 컨트롤러를 등록하는 NestJS 모듈입니다.
 * 각 서비스는 단일 책임 원칙에 따라 분리되어 있습니다:
 * - EmbeddingService: 임베딩 모델 관리
 * - ChunkingService: 텍스트 분할 처리
 * - VectorStoreService: 벡터 스토어 관리
 * - DocumentLoaderService: 문서 로딩 처리
 * - LLMService: LLM 모델 관리 및 답변 생성
 * - IndexingHistoryService: 인덱싱 히스토리 추적
 * - RagService: RAG 파이프라인 조합
 *
 * 이 모듈을 AppModule에 import하여 사용합니다.
 */
@Module({
  providers: [
    EmbeddingService,
    ChunkingService,
    VectorStoreService,
    DocumentLoaderService,
    LLMService,
    IndexingHistoryService,
    RagService,
  ],
  controllers: [RagController],
})
export class RagModule {}
