import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
const pdfParse = require('pdf-parse');

/**
 * 문서 로더 서비스
 *
 * 파일 시스템에서 문서를 읽어오는 책임을 가집니다.
 * 다양한 파일 형식에서 텍스트를 추출하는 기능을 제공합니다.
 * 
 * 지원 형식: TXT, JSON, PDF, MD
 */
@Injectable()
export class DocumentLoaderService {
  private readonly logger = new Logger(DocumentLoaderService.name);

  /**
   * 파일에서 텍스트 읽기 (자동 형식 감지)
   *
   * @param filePath - 읽을 파일의 경로
   * @returns 파일 내용 텍스트와 메타데이터
   * @throws Error - 파일 읽기 실패 시 에러 발생
   */
  async loadFromFile(filePath: string): Promise<{ content: string; metadata: Record<string, any> }> {
    try {
      const ext = path.extname(filePath).toLowerCase();
      const fileName = path.basename(filePath);
      
      this.logger.log(`파일 로드 중: ${fileName} (${ext})`);

      let content: string;
      let metadata: Record<string, any> = {
        fileName,
        filePath,
        fileType: ext,
        loadedAt: new Date().toISOString(),
      };

      switch (ext) {
        case '.json':
          const result = await this.loadJsonFile(filePath);
          content = result.content;
          metadata = { ...metadata, ...result.metadata };
          break;

        case '.pdf':
          content = await this.loadPdfFile(filePath);
          break;

        case '.txt':
        case '.md':
        case '.markdown':
          content = fs.readFileSync(filePath, 'utf-8');
          break;

        default:
          // 기본적으로 텍스트로 읽기 시도
          content = fs.readFileSync(filePath, 'utf-8');
      }

      this.logger.log(`파일 로드 완료: ${fileName} (${content.length} 문자)`);
      
      return { content, metadata };
    } catch (error) {
      this.logger.error(`파일 로드 실패: ${filePath}`, error.stack);
      throw new Error(`파일 로드 실패: ${error.message}`);
    }
  }

  /**
   * JSON 파일 로드
   * JSON 구조를 텍스트로 변환하여 의미 있는 내용 추출
   */
  private async loadJsonFile(filePath: string): Promise<{ content: string; metadata: Record<string, any> }> {
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const jsonData = JSON.parse(rawData);
    
    // JSON 데이터를 읽기 쉬운 텍스트로 변환
    const content = this.jsonToReadableText(jsonData);
    
    // 메타데이터 추출 (있는 경우)
    const metadata = jsonData.metadata || {};
    
    return { content, metadata };
  }

  /**
   * JSON 객체를 읽기 쉬운 텍스트로 변환
   */
  private jsonToReadableText(obj: any, prefix = ''): string {
    const lines: string[] = [];

    const traverse = (data: any, currentPrefix: string) => {
      if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
        lines.push(`${currentPrefix}: ${data}`);
      } else if (Array.isArray(data)) {
        data.forEach((item, index) => {
          if (typeof item === 'object') {
            traverse(item, `${currentPrefix}[${index}]`);
          } else {
            lines.push(`${currentPrefix}[${index}]: ${item}`);
          }
        });
      } else if (typeof data === 'object' && data !== null) {
        for (const [key, value] of Object.entries(data)) {
          const newPrefix = currentPrefix ? `${currentPrefix}.${key}` : key;
          traverse(value, newPrefix);
        }
      }
    };

    traverse(obj, prefix);
    return lines.join('\n');
  }

  /**
   * PDF 파일 로드
   */
  private async loadPdfFile(filePath: string): Promise<string> {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  }

  /**
   * 여러 파일에서 텍스트 읽기
   *
   * @param filePaths - 읽을 파일 경로 배열
   * @returns 파일 내용과 메타데이터 배열
   */
  async loadFromFiles(filePaths: string[]): Promise<Array<{ content: string; metadata: Record<string, any> }>> {
    return Promise.all(filePaths.map((path) => this.loadFromFile(path)));
  }

  /**
   * 디렉토리의 모든 파일 로드
   *
   * @param dirPath - 디렉토리 경로
   * @param recursive - 하위 디렉토리 포함 여부
   * @returns 모든 파일의 내용과 메타데이터
   */
  async loadFromDirectory(
    dirPath: string,
    recursive = true,
  ): Promise<Array<{ content: string; metadata: Record<string, any> }>> {
    const files = this.getAllFiles(dirPath, recursive);
    this.logger.log(`디렉토리에서 ${files.length}개 파일 발견: ${dirPath}`);
    
    const results = await this.loadFromFiles(files);
    return results;
  }

  /**
   * 디렉토리의 모든 파일 경로 가져오기
   */
  private getAllFiles(dirPath: string, recursive: boolean): string[] {
    const files: string[] = [];
    
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (recursive) {
          files.push(...this.getAllFiles(fullPath, recursive));
        }
      } else {
        // 숨김 파일 제외
        if (!item.startsWith('.')) {
          files.push(fullPath);
        }
      }
    }
    
    return files;
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
