import { Injectable, Logger } from '@nestjs/common';
import { Document } from '@langchain/core/documents';
import { ChunkingService } from './chunking.service';
import { VectorStoreService } from './vector-store.service';
import { DocumentLoaderService } from './document-loader.service';
import { LLMService } from './llm.service';
import { IndexingHistoryService } from './indexing-history.service';
import { FileHashUtil } from '../utils/file-hash.util';

/**
 * RAG (Retrieval-Augmented Generation) 서비스
 *
 * RAG 파이프라인을 조합하여 제공하는 서비스입니다.
 * 문서 추가, 검색, 답변 생성 등의 고수준 기능을 제공하며,
 * 각 세부 작업은 전용 서비스에 위임합니다.
 */
@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly chunkingService: ChunkingService,
    private readonly vectorStoreService: VectorStoreService,
    private readonly documentLoaderService: DocumentLoaderService,
    private readonly llmService: LLMService,
    private readonly indexingHistoryService: IndexingHistoryService,
  ) {}

  /**
   * 텍스트 문서를 벡터 스토어에 추가
   *
   * @param texts - 벡터 스토어에 추가할 텍스트 배열
   * @param metadata - 메타데이터 배열 (선택)
   *
   * 처리 과정:
   * 1. ChunkingService를 사용하여 텍스트를 청크로 분할
   * 2. VectorStoreService를 사용하여 벡터 스토어에 저장
   */
  async addDocuments(
    texts: string[],
    metadata?: Record<string, any>[],
  ): Promise<void> {
    // 텍스트를 청크로 분할
    const splitDocs = await this.chunkingService.splitTexts(texts, metadata);

    // 벡터 스토어에 추가
    await this.vectorStoreService.addDocuments(splitDocs);
  }

  /**
   * 파일에서 문서 로드
   *
   * @param filePath - 로드할 파일의 경로
   * @throws Error - 파일 읽기 실패 시 에러 발생
   *
   * DocumentLoaderService를 사용하여 파일을 읽고,
   * 내용을 벡터 스토어에 추가합니다.
   */
  async loadDocumentFromFile(filePath: string): Promise<void> {
    // 파일에서 텍스트와 메타데이터 읽기
    const { content, metadata } = await this.documentLoaderService.loadFromFile(filePath);
    // 읽은 내용을 벡터 스토어에 추가
    await this.addDocuments([content], [metadata]);
  }

  /**
   * 디렉토리의 모든 파일을 로드하여 벡터 스토어에 추가
   *
   * @param dirPath - 디렉토리 경로
   * @param recursive - 하위 디렉토리 포함 여부 (기본값: true)
   * @returns 처리된 파일 수
   */
  async loadDocumentsFromDirectory(
    dirPath: string,
    recursive = true,
  ): Promise<number> {
    // 디렉토리의 모든 파일 로드
    const documents = await this.documentLoaderService.loadFromDirectory(
      dirPath,
      recursive,
    );

    // 텍스트와 메타데이터 분리
    const texts = documents.map((doc) => doc.content);
    const metadata = documents.map((doc) => doc.metadata);

    // 벡터 스토어에 추가
    await this.addDocuments(texts, metadata);

    return documents.length;
  }

  /**
   * 디렉토리의 파일을 증분 업데이트 (변경된 파일만 재인덱싱)
   *
   * @param dirPath - 디렉토리 경로
   * @param recursive - 하위 디렉토리 포함 여부 (기본값: true)
   * @returns 처리 결과 (추가, 업데이트, 삭제된 파일 수)
   */
  async incrementalIndexDirectory(
    dirPath: string,
    recursive = true,
  ): Promise<{
    added: number;
    updated: number;
    deleted: number;
    skipped: number;
    total: number;
  }> {
    this.logger.log(`📂 증분 인덱싱 시작: ${dirPath}`);

    let added = 0;
    let updated = 0;
    let skipped = 0;

    // 1. 디렉토리의 모든 파일 가져오기
    const documents = await this.documentLoaderService.loadFromDirectory(
      dirPath,
      recursive,
    );

    this.logger.log(`📄 발견된 파일: ${documents.length}개`);

    // 2. 각 파일 처리
    for (const doc of documents) {
      const filePath = doc.metadata.filePath;
      
      try {
        // 파일 해시 계산
        const fileInfo = FileHashUtil.getFileInfo(filePath);
        
        // 기존 인덱싱 기록 확인
        if (this.indexingHistoryService.isIndexed(filePath)) {
          // 변경 여부 확인
          if (this.indexingHistoryService.hasChanged(filePath, fileInfo.hash)) {
            // 변경됨 → 재인덱싱
            this.logger.log(`🔄 업데이트: ${doc.metadata.fileName}`);
            await this.addDocuments([doc.content], [doc.metadata]);
            
            // 히스토리 업데이트
            const chunkCount = await this.getChunkCount(doc.content);
            this.indexingHistoryService.recordIndexing(
              filePath,
              fileInfo.hash,
              fileInfo.modifiedTime,
              chunkCount,
            );
            
            updated++;
          } else {
            // 변경 없음 → 스킵
            this.logger.log(`⏭️  스킵: ${doc.metadata.fileName} (변경 없음)`);
            skipped++;
          }
        } else {
          // 새 파일 → 추가
          this.logger.log(`➕ 추가: ${doc.metadata.fileName}`);
          await this.addDocuments([doc.content], [doc.metadata]);
          
          // 히스토리 기록
          const chunkCount = await this.getChunkCount(doc.content);
          this.indexingHistoryService.recordIndexing(
            filePath,
            fileInfo.hash,
            fileInfo.modifiedTime,
            chunkCount,
          );
          
          added++;
        }
      } catch (error) {
        this.logger.error(`❌ 처리 실패: ${doc.metadata.fileName}`, error.stack);
      }
    }

    // 3. 삭제된 파일 감지
    const deletedFiles = this.indexingHistoryService.findDeletedFiles();
    const deleted = deletedFiles.length;

    if (deleted > 0) {
      this.logger.log(`🗑️  삭제된 파일 감지: ${deleted}개`);
      for (const filePath of deletedFiles) {
        // 히스토리에서 제거
        this.indexingHistoryService.removeRecord(filePath);
        this.logger.log(`  - ${filePath}`);
      }
      
      this.logger.warn('⚠️  벡터 DB에서 삭제된 파일의 청크를 수동으로 제거해야 합니다.');
    }

    // 4. 결과 요약
    const total = added + updated + skipped;
    
    this.logger.log('');
    this.logger.log('📊 증분 인덱싱 완료');
    this.logger.log(`  ➕ 추가: ${added}개`);
    this.logger.log(`  🔄 업데이트: ${updated}개`);
    this.logger.log(`  ⏭️  스킵: ${skipped}개`);
    this.logger.log(`  🗑️  삭제: ${deleted}개`);
    this.logger.log(`  📈 전체: ${total}개`);

    return {
      added,
      updated,
      deleted,
      skipped,
      total,
    };
  }

  /**
   * 텍스트의 청크 개수 계산 (헬퍼)
   */
  private async getChunkCount(text: string): Promise<number> {
    const docs = await this.chunkingService.splitTexts([text]);
    return docs.length;
  }

  /**
   * 인덱싱 통계 조회
   */
  getIndexingStats() {
    return this.indexingHistoryService.getStats();
  }

  /**
   * 인덱싱 히스토리 초기화
   */
  clearIndexingHistory(): void {
    this.indexingHistoryService.clearHistory();
  }

  /**
   * 질문에 대한 답변 생성 (RAG 파이프라인)
   *
   * @param question - 사용자의 질문
   * @returns 답변 텍스트와 참조된 문서들
   *
   * RAG 프로세스:
   * 1. VectorStoreService를 사용하여 관련 문서 검색 (상위 10개)
   * 2. 질문에서 회사명 추출 및 Re-ranking (회사명 필터링)
   * 3. 검색된 문서를 컨텍스트로 구성
   * 4. LLMService를 사용하여 컨텍스트와 질문을 기반으로 답변 생성
   */
  async query(
    question: string,
  ): Promise<{ answer: string; sourceDocuments?: Document[] }> {
    // 1. 더 많은 문서 검색 (Re-ranking을 위해 10개 검색)
    const candidateDocs = await this.vectorStoreService.similaritySearch(
      question,
      10,
    );

    // 2. 질문에서 회사명 추출
    const companyName = this.extractCompanyName(question);

    // 3. Re-ranking: 회사명으로 필터링
    let relevantDocs: Document[];
    
    if (companyName) {
      // 회사명이 감지되면 해당 회사의 문서만 필터링
      const filteredDocs = candidateDocs.filter((doc) => {
        const metadata = doc.metadata;
        const fileName = metadata.fileName?.toLowerCase() || '';
        const docCompanyName = metadata.company_name?.toLowerCase() || '';
        const companyNameEn = metadata.company_name_en?.toLowerCase() || '';
        
        const searchTerm = companyName.toLowerCase();
        
        // 파일명, 회사명, 영문 회사명에서 검색
        return (
          fileName.includes(searchTerm) ||
          docCompanyName.includes(searchTerm) ||
          companyNameEn.includes(searchTerm)
        );
      });

      // 필터링된 문서가 있으면 상위 4개 사용, 없으면 원본 4개 사용
      relevantDocs = filteredDocs.length > 0 
        ? filteredDocs.slice(0, 4) 
        : candidateDocs.slice(0, 4);

      console.log(`🔍 회사명 감지: "${companyName}"`);
      console.log(`📊 필터링 결과: ${filteredDocs.length}개 문서 (상위 ${relevantDocs.length}개 사용)`);
    } else {
      // 회사명이 없으면 상위 4개 사용
      relevantDocs = candidateDocs.slice(0, 4);
      console.log(`ℹ️  회사명 미감지 - 전체 검색 결과 사용`);
    }

    // 4. 컨텍스트 생성 (검색된 문서들을 하나의 텍스트로 결합)
    const context = relevantDocs.map((doc) => doc.pageContent).join('\n\n');

    // 5. LLM을 사용하여 답변 생성
    const answer = await this.llmService.generateAnswer(context, question);

    return {
      answer,
      sourceDocuments: relevantDocs, // 참조된 문서들 반환 (출처 표시용)
    };
  }

  /**
   * 질문에서 회사명 추출
   * 
   * @param question - 사용자 질문
   * @returns 추출된 회사명 또는 null
   */
  private extractCompanyName(question: string): string | null {
    // 지원하는 회사명 목록 (한글명과 영문명)
    const companies = [
      { ko: '쿠팡', en: 'coupang' },
      { ko: '토스', en: 'toss' },
      { ko: '케이뱅크', en: 'kbank' },
      { ko: '네이버', en: 'naver' },
      { ko: '카카오', en: 'kakao' },
      { ko: '삼성', en: 'samsung' },
      { ko: '현대', en: 'hyundai' },
      { ko: 'lg', en: 'lg' },
      { ko: 'skt', en: 'skt' },
      { ko: '배달의민족', en: 'woowa' },
      { ko: '우아한형제들', en: 'woowa' },
      { ko: '직방', en: 'zigbang' },
    ];

    const lowerQuestion = question.toLowerCase();

    for (const company of companies) {
      if (
        question.includes(company.ko) ||
        lowerQuestion.includes(company.en)
      ) {
        return company.ko;
      }
    }

    return null;
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
