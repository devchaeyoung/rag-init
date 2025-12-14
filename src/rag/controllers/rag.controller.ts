import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RagService } from '../services/rag.service';
import { diskStorage } from 'multer';
import { extname } from 'path';

/**
 * RAG API 컨트롤러
 * 
 * RAG 서비스의 HTTP 엔드포인트를 제공합니다.
 * - 문서 추가 (텍스트 또는 파일 업로드)
 * - 질의응답
 * - 유사 문서 검색
 */
@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  /**
   * 텍스트 문서 추가
   * 
   * POST /rag/documents
   * 
   * 요청 본문:
   * {
   *   "texts": ["문서 내용 1", "문서 내용 2", ...]
   * }
   * 
   * 텍스트 배열을 받아서 벡터 스토어에 추가합니다.
   */
  @Post('documents')
  async addDocuments(@Body() body: { texts: string[] }) {
    await this.ragService.addDocuments(body.texts);
    return { message: '문서가 성공적으로 추가되었습니다.' };
  }

  /**
   * 파일 업로드로 문서 추가
   * 
   * POST /rag/upload
   * 
   * multipart/form-data 형식으로 파일을 업로드합니다.
   * 파일 필드명: 'file'
   * 
   * 업로드된 파일은 ./uploads 디렉토리에 저장된 후
   * 내용을 읽어서 벡터 스토어에 추가합니다.
   */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads', // 파일 저장 디렉토리
        filename: (req, file, cb) => {
          // 고유한 파일명 생성 (타임스탬프 + 랜덤 숫자)
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, file.fieldname + '-' + uniqueSuffix + extname(file.originalname));
        },
      }),
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      return { error: '파일이 업로드되지 않았습니다.' };
    }

    try {
      // 업로드된 파일을 읽어서 벡터 스토어에 추가
      await this.ragService.loadDocumentFromFile(file.path);
      return { message: '파일이 성공적으로 처리되었습니다.', filename: file.filename };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * 질문에 대한 답변 생성
   * 
   * POST /rag/query
   * 
   * 요청 본문:
   * {
   *   "question": "질문 내용"
   * }
   * 
   * 응답:
   * {
   *   "answer": "생성된 답변",
   *   "sources": [참조된 문서들]
   * }
   * 
   * RAG 파이프라인을 통해 관련 문서를 검색하고 답변을 생성합니다.
   */
  @Post('query')
  async query(@Body() body: { question: string }) {
    try {
      const result = await this.ragService.query(body.question);
      return {
        answer: result.answer,
        // 참조된 문서들의 일부만 반환 (처음 200자)
        sources: result.sourceDocuments?.map((doc) => ({
          content: doc.pageContent.substring(0, 200) + '...',
          metadata: doc.metadata,
        })),
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * 유사 문서 검색
   * 
   * GET /rag/search?q=검색어&k=결과개수
   * 
   * 쿼리 파라미터:
   * - q: 검색할 쿼리 텍스트 (필수)
   * - k: 반환할 문서 개수 (선택, 기본값: 4)
   * 
   * 벡터 유사도 검색을 통해 쿼리와 유사한 문서들을 반환합니다.
   */
  @Get('search')
  async search(@Query('q') query: string, @Query('k') k?: string) {
    try {
      const documents = await this.ragService.similaritySearch(
        query,
        k ? parseInt(k) : 4, // k 파라미터가 있으면 파싱, 없으면 기본값 4
      );
      return {
        documents: documents.map((doc) => ({
          content: doc.pageContent,
          metadata: doc.metadata,
        })),
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * 디렉토리의 모든 문서 인덱싱 (전체 재인덱싱)
   * 
   * POST /rag/index-directory
   * 
   * 요청 본문:
   * {
   *   "dirPath": "rag-docs",
   *   "recursive": true  // 선택, 기본값: true
   * }
   * 
   * 응답:
   * {
   *   "success": true,
   *   "filesProcessed": 11,
   *   "message": "11개 파일이 성공적으로 인덱싱되었습니다."
   * }
   * 
   * 지정된 디렉토리의 모든 파일을 읽어서 벡터 스토어에 추가합니다.
   * JSON, PDF, TXT, MD 등 다양한 형식을 지원합니다.
   */
  @Post('index-directory')
  async indexDirectory(
    @Body() body: { dirPath: string; recursive?: boolean },
  ) {
    try {
      const recursive = body.recursive !== undefined ? body.recursive : true;
      const filesProcessed = await this.ragService.loadDocumentsFromDirectory(
        body.dirPath,
        recursive,
      );

      return {
        success: true,
        filesProcessed,
        message: `${filesProcessed}개 파일이 성공적으로 인덱싱되었습니다.`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 디렉토리의 문서 증분 업데이트 (변경된 파일만 재인덱싱)
   * 
   * POST /rag/incremental-index
   * 
   * 요청 본문:
   * {
   *   "dirPath": "rag-docs",
   *   "recursive": true  // 선택, 기본값: true
   * }
   * 
   * 응답:
   * {
   *   "success": true,
   *   "added": 2,        // 새로 추가된 파일
   *   "updated": 3,      // 변경되어 재인덱싱된 파일
   *   "skipped": 6,      // 변경 없어서 스킵된 파일
   *   "deleted": 0,      // 삭제된 파일
   *   "total": 11,       // 전체 파일 수
   *   "message": "증분 인덱싱 완료: 추가 2개, 업데이트 3개, 스킵 6개"
   * }
   * 
   * 파일 해시를 비교하여 변경된 파일만 재인덱싱합니다.
   * 이전에 인덱싱된 파일은 스킵하여 시간과 비용을 절약합니다.
   */
  @Post('incremental-index')
  async incrementalIndex(
    @Body() body: { dirPath: string; recursive?: boolean },
  ) {
    try {
      const recursive = body.recursive !== undefined ? body.recursive : true;
      const result = await this.ragService.incrementalIndexDirectory(
        body.dirPath,
        recursive,
      );

      return {
        success: true,
        ...result,
        message: `증분 인덱싱 완료: 추가 ${result.added}개, 업데이트 ${result.updated}개, 스킵 ${result.skipped}개`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 인덱싱 통계 조회
   * 
   * GET /rag/stats
   * 
   * 응답:
   * {
   *   "totalFiles": 11,
   *   "totalChunks": 204,
   *   "lastIndexedAt": "2024-12-14T08:30:00.000Z"
   * }
   */
  @Get('stats')
  async getStats() {
    try {
      const stats = this.ragService.getIndexingStats();
      return {
        success: true,
        ...stats,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 인덱싱 히스토리 초기화
   * 
   * POST /rag/reset-history
   * 
   * 인덱싱 히스토리를 모두 삭제합니다.
   * 다음 증분 인덱싱 시 모든 파일이 새로 추가됩니다.
   */
  @Post('reset-history')
  async resetHistory() {
    try {
      this.ragService.clearIndexingHistory();
      return {
        success: true,
        message: '인덱싱 히스토리가 초기화되었습니다.',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
