#!/usr/bin/env ts-node

/**
 * 증분 인덱싱 스크립트
 * 
 * 변경된 파일만 재인덱싱하여 시간과 비용을 절약합니다.
 * 
 * 사용법:
 *   pnpm run index-incremental
 *   또는
 *   ts-node -r tsconfig-paths/register scripts/incremental-index.ts
 */

// 환경 변수 로드 (제일 먼저 실행)
import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { RagService } from '../src/rag/services/rag.service';
import * as path from 'path';

async function incrementalIndex() {
  console.log('🔄 증분 인덱싱 시작...\n');

  // 환경 변수 확인
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ 오류: OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.');
    console.error('💡 해결 방법: .env 파일에 다음을 추가하세요:');
    console.error('   OPENAI_API_KEY=your_openai_api_key_here\n');
    process.exit(1);
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
    console.log('');
    
    // 증분 인덱싱 실행
    const result = await ragService.incrementalIndexDirectory(ragDocsPath, true);
    
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 증분 인덱싱 완료!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`➕ 새로 추가된 파일: ${result.added}개`);
    console.log(`🔄 업데이트된 파일: ${result.updated}개`);
    console.log(`⏭️  스킵된 파일: ${result.skipped}개 (변경 없음)`);
    console.log(`🗑️  삭제된 파일: ${result.deleted}개`);
    console.log(`📈 전체 파일 수: ${result.total}개`);
    console.log('');
    
    // 통계 조회
    const stats = ragService.getIndexingStats();
    console.log('📊 전체 인덱싱 통계:');
    console.log(`  - 총 인덱싱된 파일: ${stats.totalFiles}개`);
    console.log(`  - 총 청크 수: ${stats.totalChunks}개`);
    console.log(`  - 마지막 인덱싱: ${stats.lastIndexedAt || '없음'}`);
    console.log('');
    
    // 비용 절감 효과
    const savedFiles = result.skipped;
    if (savedFiles > 0) {
      console.log('💰 비용 절감:');
      console.log(`  - 재처리 스킵: ${savedFiles}개 파일`);
      console.log(`  - 예상 절감 청크: ~${savedFiles * 15}개`);
      console.log(`  - 예상 절감 비용: ~$${(savedFiles * 15 * 0.0001).toFixed(4)}`);
      console.log('');
    }
    
    // 애플리케이션 종료
    await app.close();
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 증분 인덱싱 실패:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 스크립트 실행
incrementalIndex();

