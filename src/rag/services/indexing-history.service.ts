import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 인덱싱 히스토리 추적 서비스
 *
 * 어떤 파일이 언제 인덱싱되었는지 추적하여
 * 증분 업데이트를 가능하게 합니다.
 */
@Injectable()
export class IndexingHistoryService {
  private readonly logger = new Logger(IndexingHistoryService.name);
  private readonly historyFilePath: string;
  private history: Map<string, FileIndexInfo>;

  constructor() {
    // 히스토리 파일 경로
    this.historyFilePath = path.join(process.cwd(), '.indexing-history.json');

    // 히스토리 로드
    this.history = this.loadHistory();
  }

  /**
   * 파일 인덱싱 기록 추가/업데이트
   *
   * @param filePath - 파일 경로
   * @param hash - 파일 해시
   * @param modifiedTime - 파일 수정 시간
   * @param chunkCount - 생성된 청크 수
   */
  recordIndexing(
    filePath: string,
    hash: string,
    modifiedTime: string,
    chunkCount: number,
  ): void {
    this.history.set(filePath, {
      hash,
      modifiedTime,
      chunkCount,
      indexedAt: new Date().toISOString(),
    });

    this.saveHistory();
  }

  /**
   * 파일이 인덱싱되었는지 확인
   *
   * @param filePath - 파일 경로
   * @returns 인덱싱 여부
   */
  isIndexed(filePath: string): boolean {
    return this.history.has(filePath);
  }

  /**
   * 파일이 변경되었는지 확인 (해시 비교)
   *
   * @param filePath - 파일 경로
   * @param currentHash - 현재 파일 해시
   * @returns 변경 여부
   */
  hasChanged(filePath: string, currentHash: string): boolean {
    const record = this.history.get(filePath);
    if (!record) {
      return true; // 기록이 없으면 새 파일
    }
    return record.hash !== currentHash;
  }

  /**
   * 파일 인덱싱 정보 가져오기
   *
   * @param filePath - 파일 경로
   * @returns 인덱싱 정보 또는 null
   */
  getFileInfo(filePath: string): FileIndexInfo | null {
    return this.history.get(filePath) || null;
  }

  /**
   * 모든 인덱싱 기록 가져오기
   *
   * @returns 파일 경로를 키로 하는 인덱싱 정보 Map
   */
  getAllRecords(): Map<string, FileIndexInfo> {
    return new Map(this.history);
  }

  /**
   * 파일 인덱싱 기록 삭제
   *
   * @param filePath - 파일 경로
   */
  removeRecord(filePath: string): void {
    this.history.delete(filePath);
    this.saveHistory();
  }

  /**
   * 삭제된 파일 감지
   *
   * 히스토리에는 있지만 실제로는 존재하지 않는 파일 찾기
   *
   * @returns 삭제된 파일 경로 배열
   */
  findDeletedFiles(): string[] {
    const deletedFiles: string[] = [];

    for (const filePath of this.history.keys()) {
      if (!fs.existsSync(filePath)) {
        deletedFiles.push(filePath);
      }
    }

    return deletedFiles;
  }

  /**
   * 통계 정보 가져오기
   *
   * @returns 전체 파일 수, 전체 청크 수 등
   */
  getStats(): {
    totalFiles: number;
    totalChunks: number;
    lastIndexedAt: string | null;
  } {
    let totalChunks = 0;
    let lastIndexedAt: string | null = null;

    for (const record of this.history.values()) {
      totalChunks += record.chunkCount;
      if (!lastIndexedAt || record.indexedAt > lastIndexedAt) {
        lastIndexedAt = record.indexedAt;
      }
    }

    return {
      totalFiles: this.history.size,
      totalChunks,
      lastIndexedAt,
    };
  }

  /**
   * 히스토리 파일 로드
   */
  private loadHistory(): Map<string, FileIndexInfo> {
    try {
      if (fs.existsSync(this.historyFilePath)) {
        const data = fs.readFileSync(this.historyFilePath, 'utf-8');
        const obj = JSON.parse(data);
        return new Map(Object.entries(obj));
      }
    } catch (error) {
      this.logger.warn(`히스토리 로드 실패: ${error.message}`);
    }

    return new Map();
  }

  /**
   * 히스토리 파일 저장
   */
  private saveHistory(): void {
    try {
      const obj = Object.fromEntries(this.history);
      fs.writeFileSync(
        this.historyFilePath,
        JSON.stringify(obj, null, 2),
        'utf-8',
      );
    } catch (error) {
      this.logger.error(`히스토리 저장 실패: ${error.message}`);
    }
  }

  /**
   * 히스토리 초기화 (모든 기록 삭제)
   */
  clearHistory(): void {
    this.history.clear();
    this.saveHistory();
    this.logger.log('인덱싱 히스토리가 초기화되었습니다.');
  }
}

/**
 * 파일 인덱싱 정보 인터페이스
 */
interface FileIndexInfo {
  /** 파일 내용의 MD5 해시 */
  hash: string;
  /** 파일 수정 시간 */
  modifiedTime: string;
  /** 생성된 청크 수 */
  chunkCount: number;
  /** 인덱싱된 시간 */
  indexedAt: string;
}
