import { Injectable, OnModuleInit } from '@nestjs/common';
import { QdrantVectorStore } from '../stores/qdrant-vector-store';
import { EmbeddingService } from './embedding.service';
import { Document } from '@langchain/core/documents';

/**
 * 벡터 스토어 서비스
 *
 * 벡터 데이터베이스(Qdrant) 관리 및 벡터 검색 기능을 제공합니다.
 * 벡터 스토어의 초기화, 문서 추가, 유사도 검색 등의 책임을 가집니다.
 */
@Injectable()
export class VectorStoreService implements OnModuleInit {
  /** Qdrant 벡터 스토어 인스턴스 */
  private vectorStore: QdrantVectorStore | null = null;

  constructor(private readonly embeddingService: EmbeddingService) {}

  /**
   * NestJS 모듈 초기화 시 호출되는 메서드
   * 애플리케이션 시작 시 벡터 스토어를 초기화합니다.
   */
  async onModuleInit() {
    await this.initializeVectorStore();
  }

  /**
   * 벡터 스토어 초기화
   * Qdrant는 서버 기반이므로 연결만 확인
   */
  private async initializeVectorStore() {
    try {
      const collectionName =
        process.env.QDRANT_COLLECTION_NAME || 'rag-documents';

      // Qdrant VectorStore 초기화 (컬렉션은 문서 추가 시 자동 생성)
      this.vectorStore = new QdrantVectorStore(
        this.embeddingService.getEmbeddings(),
        {
          url: process.env.QDRANT_URL,
          apiKey: process.env.QDRANT_API_KEY,
          collectionName,
          vectorSize: 1536, // OpenAI embedding 크기
        },
      );

      console.log(
        `Qdrant 벡터 스토어가 초기화되었습니다. (컬렉션: ${collectionName})`,
      );
    } catch (error) {
      console.error('벡터 스토어 초기화 중 오류:', error);
      console.error('Qdrant 서버가 실행 중인지 확인해주세요.');
    }
  }

  /**
   * 벡터 스토어에 문서 추가
   *
   * @param documents - 추가할 문서 배열
   * @throws Error - 벡터 스토어가 초기화되지 않은 경우
   */
  async addDocuments(documents: Document[]): Promise<void> {
    if (!this.vectorStore) {
      // 벡터 스토어가 없으면 새로 생성
      const collectionName =
        process.env.QDRANT_COLLECTION_NAME || 'rag-documents';
      this.vectorStore = await QdrantVectorStore.fromDocuments(
        documents,
        this.embeddingService.getEmbeddings(),
        {
          url: process.env.QDRANT_URL,
          apiKey: process.env.QDRANT_API_KEY,
          collectionName,
          vectorSize: 1536,
        },
      );
    } else {
      // 기존 벡터 스토어에 문서 추가
      await this.vectorStore.addDocuments(documents);
    }

    console.log(
      `Qdrant 벡터 스토어에 ${documents.length}개의 문서 청크를 추가했습니다.`,
    );
  }

  /**
   * 유사 문서 검색 (벡터 검색)
   *
   * @param query - 검색할 쿼리 텍스트
   * @param k - 반환할 문서 개수 (기본값: 4)
   * @returns 유사한 문서 배열
   * @throws Error - 벡터 스토어가 초기화되지 않은 경우
   */
  async similaritySearch(query: string, k: number = 4): Promise<Document[]> {
    if (!this.vectorStore) {
      throw new Error(
        '벡터 스토어가 초기화되지 않았습니다. 먼저 문서를 추가해주세요.',
      );
    }

    return await this.vectorStore.similaritySearch(query, k);
  }

  /**
   * 검색기(Retriever) 생성
   *
   * @param k - 반환할 문서 개수
   * @returns Retriever 인스턴스
   * @throws Error - 벡터 스토어가 초기화되지 않은 경우
   */
  asRetriever(k: number = 4) {
    if (!this.vectorStore) {
      throw new Error(
        '벡터 스토어가 초기화되지 않았습니다. 먼저 문서를 추가해주세요.',
      );
    }

    return this.vectorStore.asRetriever(k);
  }

  /**
   * 벡터 스토어 인스턴스 반환
   *
   * @returns QdrantVectorStore 인스턴스 또는 null
   */
  getVectorStore(): QdrantVectorStore | null {
    return this.vectorStore;
  }
}
