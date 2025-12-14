import { Module } from '@nestjs/common';
import { RagService } from './rag.service';
import { RagController } from './rag.controller';

/**
 * RAG 모듈
 * 
 * RAG 서비스와 컨트롤러를 등록하는 NestJS 모듈입니다.
 * 이 모듈을 AppModule에 import하여 사용합니다.
 */
@Module({
  providers: [RagService], // RAG 서비스 제공자 등록
  controllers: [RagController] // RAG 컨트롤러 등록
})
export class RagModule {}
