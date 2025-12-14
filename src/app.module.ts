import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RagModule } from './rag/rag.module';

@Module({
  imports: [
    // 환경 변수 로드 (.env 파일)
    ConfigModule.forRoot({
      isGlobal: true, // 전역에서 사용 가능
      envFilePath: '.env', // .env 파일 경로
    }),
    RagModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
