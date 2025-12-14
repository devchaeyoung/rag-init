import { Injectable } from '@nestjs/common';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';

/**
 * 청킹 서비스
 *
 * 문서를 작은 청크로 분할하는 책임을 가집니다.
 * RecursiveCharacterTextSplitter를 사용하여 문서를 의미 있는 단위로 분할합니다.
 */
@Injectable()
export class ChunkingService {
  /** 텍스트 분할기 인스턴스 */
  private textSplitter: RecursiveCharacterTextSplitter;

  constructor() {
    // 텍스트 분할기 설정 (청크 크기: 1000, 오버랩: 200)
    // 오버랩을 두어 문맥 손실을 최소화
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
  }

  /**
   * 문서를 청크로 분할
   *
   * @param documents - 분할할 문서 배열
   * @returns 분할된 문서 배열
   */
  async splitDocuments(documents: Document[]): Promise<Document[]> {
    return await this.textSplitter.splitDocuments(documents);
  }

  /**
   * 텍스트 배열을 Document 객체로 변환 후 분할
   *
   * @param texts - 분할할 텍스트 배열
   * @param metadata - 메타데이터 배열 (텍스트와 동일한 길이)
   * @returns 분할된 문서 배열
   */
  async splitTexts(
    texts: string[],
    metadata?: Record<string, any>[],
  ): Promise<Document[]> {
    // 텍스트를 Document 객체로 변환
    const documents = texts.map(
      (text, index) =>
        new Document({
          pageContent: text,
          metadata: metadata?.[index] || {},
        }),
    );

    // 문서 분할
    return await this.splitDocuments(documents);
  }

  /**
   * 커스텀 설정으로 텍스트 분할기 생성
   *
   * @param chunkSize - 청크 크기
   * @param chunkOverlap - 오버랩 크기
   * @returns 새로운 텍스트 분할기 인스턴스
   */
  createSplitter(
    chunkSize: number,
    chunkOverlap: number,
  ): RecursiveCharacterTextSplitter {
    return new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
    });
  }
}
