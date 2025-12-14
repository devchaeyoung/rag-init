#!/usr/bin/env ts-node

/**
 * RAG 문서 인덱싱 스크립트
 * 
 * rag-docs 디렉토리의 모든 문서를 읽어서 벡터 DB에 저장합니다.
 * 
 * 사용법:
 *   pnpm run index-docs
 *   또는
 *   ts-node scripts/index-rag-docs.ts
 */

// 환경 변수 로드 (제일 먼저 실행)
import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { RagService } from '../src/rag/services/rag.service';
import * as path from 'path';

async function indexDocuments() {
  console.log('🚀 RAG 문서 인덱싱 시작...\n');

  // 환경 변수 확인
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ 오류: OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.');
    console.error('💡 해결 방법: .env 파일에 다음을 추가하세요:');
    console.error('   OPENAI_API_KEY=your_openai_api_key_here\n');
    process.exit(1);
  }

  if (!process.env.QDRANT_URL && !process.env.QDRANT_HOST) {
    console.warn('⚠️  경고: QDRANT_URL이 설정되지 않았습니다. 기본값(http://localhost:6333)을 사용합니다.\n');
  }

  try {
    // NestJS 애플리케이션 컨텍스트 생성
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn', 'log'],
    });
    
    // RagService 가져오기
    const ragService = app.get(RagService);
    
    // rag-docs 디렉토리 경로
    const ragDocsPath = path.join(process.cwd(), 'rag-docs');
    
    console.log(`📁 디렉토리: ${ragDocsPath}`);
    console.log('📄 문서 로딩 중...\n');
    
    // 디렉토리의 모든 문서 인덱싱
    const filesProcessed = await ragService.loadDocumentsFromDirectory(
      ragDocsPath,
      true, // 하위 디렉토리 포함
    );
    
    console.log(`\n✅ 인덱싱 완료!`);
    console.log(`📊 처리된 파일 수: ${filesProcessed}개`);
    console.log(`💾 벡터 DB에 저장되었습니다.`);
    
    // 애플리케이션 종료
    await app.close();
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 인덱싱 실패:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 스크립트 실행
indexDocuments();

