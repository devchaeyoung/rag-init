import { Injectable } from '@nestjs/common';
import * as fs from 'fs';

/**
 * 문서 로더 서비스
 *
 * 파일 시스템에서 문서를 읽어오는 책임을 가집니다.
 * 다양한 파일 형식에서 텍스트를 추출하는 기능을 제공합니다.
 */
@Injectable()
export class DocumentLoaderService {
  /**
   * 파일에서 텍스트 읽기
   *
   * @param filePath - 읽을 파일의 경로
   * @returns 파일 내용 텍스트
   * @throws Error - 파일 읽기 실패 시 에러 발생
   */
  async loadFromFile(filePath: string): Promise<string> {
    try {
      // 파일을 UTF-8 인코딩으로 읽기
      return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      throw new Error(`파일 로드 실패: ${error.message}`);
    }
  }

  /**
   * 여러 파일에서 텍스트 읽기
   *
   * @param filePaths - 읽을 파일 경로 배열
   * @returns 파일 내용 텍스트 배열
   */
  async loadFromFiles(filePaths: string[]): Promise<string[]> {
    return Promise.all(filePaths.map((path) => this.loadFromFile(path)));
  }

  /**
   * 파일 존재 여부 확인
   *
   * @param filePath - 확인할 파일 경로
   * @returns 파일 존재 여부
   */
  fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }
}
