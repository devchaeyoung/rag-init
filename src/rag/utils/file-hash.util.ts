import * as crypto from 'crypto';
import * as fs from 'fs';

/**
 * 파일 해시 유틸리티
 *
 * 파일의 내용 변경을 감지하기 위한 해시 계산 기능을 제공합니다.
 */
export class FileHashUtil {
  /**
   * 파일의 MD5 해시 계산
   *
   * @param filePath - 파일 경로
   * @returns MD5 해시 문자열
   */
  static calculateFileHash(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('md5');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  }

  /**
   * 텍스트의 MD5 해시 계산
   *
   * @param text - 텍스트 내용
   * @returns MD5 해시 문자열
   */
  static calculateTextHash(text: string): string {
    const hashSum = crypto.createHash('md5');
    hashSum.update(text);
    return hashSum.digest('hex');
  }

  /**
   * 파일의 수정 시간(mtime) 가져오기
   *
   * @param filePath - 파일 경로
   * @returns ISO 형식 수정 시간
   */
  static getFileModifiedTime(filePath: string): string {
    const stats = fs.statSync(filePath);
    return stats.mtime.toISOString();
  }

  /**
   * 파일 크기 가져오기
   *
   * @param filePath - 파일 경로
   * @returns 파일 크기 (바이트)
   */
  static getFileSize(filePath: string): number {
    const stats = fs.statSync(filePath);
    return stats.size;
  }

  /**
   * 파일 정보 객체 생성
   *
   * @param filePath - 파일 경로
   * @returns 파일 해시, 수정 시간, 크기를 포함한 객체
   */
  static getFileInfo(filePath: string): {
    hash: string;
    modifiedTime: string;
    size: number;
  } {
    return {
      hash: this.calculateFileHash(filePath),
      modifiedTime: this.getFileModifiedTime(filePath),
      size: this.getFileSize(filePath),
    };
  }
}
