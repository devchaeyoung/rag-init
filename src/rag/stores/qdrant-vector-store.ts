import { QdrantClient } from '@qdrant/qdrant-js';
import { VectorStore } from '@langchain/core/vectorstores';
import { Document } from '@langchain/core/documents';
import { Embeddings } from '@langchain/core/embeddings';
import { CallbackManagerForRetrieverRun } from '@langchain/core/callbacks/manager';
import { BaseRetriever } from '@langchain/core/retrievers';

/**
 * Qdrant VectorStore 설정 인터페이스
 */
interface QdrantVectorStoreConfig {
  url?: string; // Qdrant 서버 URL
  apiKey?: string; // Qdrant API 키 (선택)
  collectionName: string; // 컬렉션 이름
  vectorSize?: number; // 벡터 차원 수 (기본값: 1536)
}

/**
 * Qdrant를 사용하는 VectorStore 구현
 * 
 * LangChain의 VectorStore 인터페이스를 구현하여
 * Qdrant 벡터 데이터베이스와 통합합니다.
 * 
 * 주요 기능:
 * - 문서를 벡터로 변환하여 저장
 * - 벡터 유사도 검색
 * - 컬렉션 자동 생성 및 관리
 */
export class QdrantVectorStore extends VectorStore {
  /** Qdrant 클라이언트 인스턴스 */
  private client: QdrantClient;
  
  /** 컬렉션 이름 */
  private collectionName: string;
  
  /** 벡터 차원 수 */
  private vectorSize: number;

  /**
   * 벡터 스토어 타입 반환
   */
  _vectorstoreType(): string {
    return 'qdrant';
  }

  /**
   * QdrantVectorStore 생성자
   * 
   * @param embeddings - 텍스트를 벡터로 변환하는 임베딩 모델
   * @param config - Qdrant 설정
   */
  constructor(embeddings: Embeddings, config: QdrantVectorStoreConfig) {
    super(embeddings, {
      collectionName: config.collectionName,
    });

    this.collectionName = config.collectionName;
    this.vectorSize = config.vectorSize || 1536; // OpenAI embedding 기본 크기

    // Qdrant 클라이언트 초기화
    // 환경변수 또는 설정값을 사용하여 클라이언트 생성
    this.client = new QdrantClient({
      url: config.url || process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: config.apiKey || process.env.QDRANT_API_KEY,
    });
  }

  /**
   * 문서를 벡터 스토어에 추가
   * 
   * @param documents - 추가할 문서 배열
   * @returns 생성된 문서 ID 배열
   * 
   * 처리 과정:
   * 1. 문서 텍스트를 임베딩 벡터로 변환
   * 2. 컬렉션이 없으면 생성
   * 3. 각 문서를 벡터 포인트로 변환 (벡터 + 메타데이터)
   * 4. Qdrant에 업로드
   */
  async addDocuments(documents: Document[]): Promise<string[]> {
    // 문서 텍스트 추출
    const texts = documents.map((doc) => doc.pageContent);
    // 텍스트를 벡터로 변환 (배치 처리)
    const embeddings = await this.embeddings.embedDocuments(texts);
    const ids: string[] = [];

    // 컬렉션이 없으면 생성
    await this.ensureCollection();

    // 벡터 포인트 생성
    // 각 문서를 Qdrant 포인트 형식으로 변환
    const points = documents.map((doc, index) => {
      // 고유 ID 생성 (숫자 ID 사용)
      const id = Date.now() * 1000 + index;
      ids.push(id.toString());

      return {
        id, // 숫자 ID
        vector: embeddings[index], // 임베딩 벡터
        payload: {
          pageContent: doc.pageContent, // 원본 텍스트
          metadata: doc.metadata, // 메타데이터
        },
      };
    });

    // 배치 크기 제한 (한 번에 너무 많은 문서를 보내지 않음)
    const batchSize = 100;
    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize);
      
      // Qdrant에 업로드 (wait: true로 동기 처리)
      await this.client.upsert(this.collectionName, {
        wait: true,
        points: batch,
      });
      
      console.log(`📦 배치 업로드 완료: ${i + batch.length}/${points.length}`);
      
      // 과도한 요청 방지를 위한 짧은 대기
      if (i + batchSize < points.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return ids;
  }

  /**
   * 벡터로 직접 추가
   * 
   * @param vectors - 이미 생성된 벡터 배열
   * @param documents - 해당하는 문서 배열
   * @returns 생성된 문서 ID 배열
   * 
   * 이미 벡터화된 데이터를 직접 추가할 때 사용합니다.
   * 임베딩 과정을 건너뛰고 바로 저장합니다.
   */
  async addVectors(vectors: number[][], documents: Document[]): Promise<string[]> {
    const ids: string[] = [];

    // 컬렉션이 없으면 생성
    await this.ensureCollection();

    // 벡터 포인트 생성
    const points = documents.map((doc, index) => {
      const id = `${Date.now()}-${index}`;
      ids.push(id);

      return {
        id,
        vector: vectors[index], // 전달받은 벡터 사용
        payload: {
          pageContent: doc.pageContent,
          metadata: doc.metadata,
        },
      };
    });

    // Qdrant에 업로드
    await this.client.upsert(this.collectionName, {
      wait: true,
      points,
    });

    return ids;
  }

  /**
   * 유사도 검색 (점수 포함)
   * 
   * @param query - 검색할 쿼리 텍스트
   * @param k - 반환할 문서 개수 (기본값: 4)
   * @returns [문서, 유사도 점수] 튜플 배열
   * 
   * 쿼리를 벡터로 변환한 후 코사인 유사도로 검색합니다.
   * 유사도 점수도 함께 반환합니다.
   */
  async similaritySearchWithScore(
    query: string,
    k: number = 4,
  ): Promise<[Document, number][]> {
    // 쿼리 텍스트를 벡터로 변환
    const queryEmbedding = await this.embeddings.embedQuery(query);

    // Qdrant에서 벡터 검색 수행
    const searchResult = await this.client.search(this.collectionName, {
      vector: queryEmbedding,
      limit: k, // 상위 k개 결과 반환
      with_payload: true, // 페이로드(텍스트, 메타데이터) 포함
    });

    // 검색 결과를 Document 객체로 변환
    return searchResult.map((result) => {
      const document = new Document({
        pageContent: result.payload?.pageContent as string,
        metadata: (result.payload?.metadata as Record<string, unknown>) || {},
      });

      // [문서, 유사도 점수] 튜플 반환
      return [document, result.score || 0];
    });
  }

  /**
   * 유사도 검색 (점수 없이)
   * 
   * @param query - 검색할 쿼리 텍스트
   * @param k - 반환할 문서 개수 (기본값: 4)
   * @returns 유사한 문서 배열
   * 
   * similaritySearchWithScore를 호출하되 점수는 제외하고 문서만 반환합니다.
   */
  async similaritySearch(query: string, k: number = 4): Promise<Document[]> {
    const results = await this.similaritySearchWithScore(query, k);
    // 점수는 제외하고 문서만 추출
    return results.map(([document]) => document);
  }

  /**
   * 벡터로 유사도 검색 (점수 포함)
   * 
   * @param query - 검색할 벡터 (이미 벡터화된 쿼리)
   * @param k - 반환할 문서 개수
   * @returns [문서, 유사도 점수] 튜플 배열
   * 
   * 이미 벡터화된 쿼리를 사용하여 검색합니다.
   * 임베딩 과정을 건너뛰고 바로 검색합니다.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
  ): Promise<[Document, number][]> {
    // 벡터로 직접 검색
    const searchResult = await this.client.search(this.collectionName, {
      vector: query,
      limit: k,
      with_payload: true,
    });

    // 검색 결과를 Document 객체로 변환
    return searchResult.map((result) => {
      const document = new Document({
        pageContent: result.payload?.pageContent as string,
        metadata: (result.payload?.metadata as Record<string, unknown>) || {},
      });

      return [document, result.score || 0];
    });
  }

  /**
   * 컬렉션이 존재하는지 확인하고 없으면 생성
   * 
   * Qdrant 컬렉션이 없으면 자동으로 생성합니다.
   * 벡터 크기와 거리 측정 방법(코사인 유사도)을 설정합니다.
   */
  private async ensureCollection(): Promise<void> {
    try {
      // 기존 컬렉션 목록 조회
      const collections = await this.client.getCollections();
      const collectionExists = collections.collections.some(
        (col) => col.name === this.collectionName,
      );

      if (!collectionExists) {
        // 컬렉션이 없으면 생성
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: this.vectorSize, // 벡터 차원 수
            distance: 'Cosine', // 코사인 유사도 사용
          },
        });
        console.log(`Qdrant 컬렉션 '${this.collectionName}'을 생성했습니다.`);
      }
    } catch (error) {
      console.error('컬렉션 확인/생성 중 오류:', error);
      throw error;
    }
  }

  /**
   * 정적 메서드: 문서로부터 VectorStore 생성
   * 
   * @param documents - 초기 문서 배열
   * @param embeddings - 임베딩 모델
   * @param config - Qdrant 설정
   * @returns 생성된 QdrantVectorStore 인스턴스
   * 
   * 편의 메서드로, 인스턴스 생성과 문서 추가를 한 번에 수행합니다.
   * 첫 문서 추가 시 사용하면 컬렉션도 자동으로 생성됩니다.
   */
  static async fromDocuments(
    documents: Document[],
    embeddings: Embeddings,
    config: QdrantVectorStoreConfig,
  ): Promise<QdrantVectorStore> {
    const instance = new QdrantVectorStore(embeddings, config);
    await instance.addDocuments(documents);
    return instance;
  }
}


