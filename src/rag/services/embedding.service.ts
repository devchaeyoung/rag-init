import { Injectable } from '@nestjs/common';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Embeddings } from '@langchain/core/embeddings';

/**
 * 임베딩 서비스
 * 
 * 텍스트를 벡터로 변환하는 임베딩 모델을 관리합니다.
 * OpenAI Embeddings 모델을 사용하여 텍스트를 벡터로 변환합니다.
 */
@Injectable()
export class EmbeddingService {
  /** OpenAI 임베딩 모델 인스턴스 */
  private embeddings: OpenAIEmbeddings;

  constructor() {
    // OpenAI 임베딩 모델 초기화
    // 텍스트를 1536차원 벡터로 변환하여 유사도 검색에 사용
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * 임베딩 모델 인스턴스 반환
   * 
   * @returns Embeddings 인스턴스
   */
  getEmbeddings(): Embeddings {
    return this.embeddings;
  }

  /**
   * 단일 텍스트를 벡터로 변환
   * 
   * @param text - 변환할 텍스트
   * @returns 벡터 배열
   */
  async embedQuery(text: string): Promise<number[]> {
    return await this.embeddings.embedQuery(text);
  }

  /**
   * 여러 텍스트를 벡터로 변환 (배치 처리)
   * 
   * @param texts - 변환할 텍스트 배열
   * @returns 벡터 배열의 배열
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    return await this.embeddings.embedDocuments(texts);
  }
}

