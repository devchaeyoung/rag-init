import { Injectable } from '@nestjs/common';
import { Document } from '@langchain/core/documents';
import { ChunkingService } from './chunking.service';
import { VectorStoreService } from './vector-store.service';
import { DocumentLoaderService } from './document-loader.service';
import { LLMService } from './llm.service';

/**
 * RAG (Retrieval-Augmented Generation) 서비스
 *
 * RAG 파이프라인을 조합하여 제공하는 서비스입니다.
 * 문서 추가, 검색, 답변 생성 등의 고수준 기능을 제공하며,
 * 각 세부 작업은 전용 서비스에 위임합니다.
 */
@Injectable()
export class RagService {
  constructor(
    private readonly chunkingService: ChunkingService,
    private readonly vectorStoreService: VectorStoreService,
    private readonly documentLoaderService: DocumentLoaderService,
    private readonly llmService: LLMService,
  ) {}

  /**
   * 텍스트 문서를 벡터 스토어에 추가
   *
   * @param texts - 벡터 스토어에 추가할 텍스트 배열
   *
   * 처리 과정:
   * 1. ChunkingService를 사용하여 텍스트를 청크로 분할
   * 2. VectorStoreService를 사용하여 벡터 스토어에 저장
   */
  async addDocuments(texts: string[]): Promise<void> {
    // 텍스트를 청크로 분할
    const splitDocs = await this.chunkingService.splitTexts(texts);

    // 벡터 스토어에 추가
    await this.vectorStoreService.addDocuments(splitDocs);
  }

  /**
   * 파일에서 문서 로드 (텍스트 파일)
   *
   * @param filePath - 로드할 파일의 경로
   * @throws Error - 파일 읽기 실패 시 에러 발생
   *
   * DocumentLoaderService를 사용하여 파일을 읽고,
   * 내용을 벡터 스토어에 추가합니다.
   */
  async loadDocumentFromFile(filePath: string): Promise<void> {
    // 파일에서 텍스트 읽기
    const content = await this.documentLoaderService.loadFromFile(filePath);
    // 읽은 내용을 벡터 스토어에 추가
    await this.addDocuments([content]);
  }

  /**
   * 질문에 대한 답변 생성 (RAG 파이프라인)
   *
   * @param question - 사용자의 질문
   * @returns 답변 텍스트와 참조된 문서들
   *
   * RAG 프로세스:
   * 1. VectorStoreService를 사용하여 관련 문서 검색 (상위 4개)
   * 2. 검색된 문서를 컨텍스트로 구성
   * 3. LLMService를 사용하여 컨텍스트와 질문을 기반으로 답변 생성
   */
  async query(
    question: string,
  ): Promise<{ answer: string; sourceDocuments?: Document[] }> {
    // 관련 문서 검색 (질문과 유사한 문서를 벡터 검색으로 찾음)
    const relevantDocs = await this.vectorStoreService.similaritySearch(
      question,
      4,
    );

    // 컨텍스트 생성 (검색된 문서들을 하나의 텍스트로 결합)
    const context = relevantDocs.map((doc) => doc.pageContent).join('\n\n');

    // LLM을 사용하여 답변 생성
    const answer = await this.llmService.generateAnswer(context, question);

    return {
      answer,
      sourceDocuments: relevantDocs, // 참조된 문서들 반환 (출처 표시용)
    };
  }

  /**
   * 유사 문서 검색 (벡터 검색)
   *
   * @param query - 검색할 쿼리 텍스트
   * @param k - 반환할 문서 개수 (기본값: 4)
   * @returns 유사한 문서 배열
   *
   * VectorStoreService를 사용하여 벡터 유사도 검색을 수행합니다.
   */
  async similaritySearch(query: string, k: number = 4): Promise<Document[]> {
    return await this.vectorStoreService.similaritySearch(query, k);
  }
}
