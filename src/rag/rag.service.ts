import { Injectable, OnModuleInit } from '@nestjs/common';
import { OpenAIEmbeddings } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { QdrantVectorStore } from './qdrant-vector-store';
import * as fs from 'fs';

/**
 * RAG (Retrieval-Augmented Generation) 서비스
 * 
 * 문서를 벡터화하여 저장하고, 질의에 대해 관련 문서를 검색한 후
 * LLM을 사용하여 답변을 생성하는 서비스입니다.
 */
@Injectable()
export class RagService implements OnModuleInit {
  /** Qdrant 벡터 스토어 인스턴스 */
  private vectorStore: QdrantVectorStore | null = null;
  
  /** OpenAI 임베딩 모델 (텍스트를 벡터로 변환) */
  private embeddings: OpenAIEmbeddings;
  
  /** LLM 모델 (답변 생성용) */
  private llm: ChatOpenAI;

  constructor() {
    // OpenAI 임베딩 모델 초기화
    // 텍스트를 1536차원 벡터로 변환하여 유사도 검색에 사용
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    // LLM 초기화
    // temperature: 0으로 설정하여 일관된 답변 생성
    this.llm = new ChatOpenAI({
      modelName: 'gpt-3.5-turbo',
      temperature: 0,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * NestJS 모듈 초기화 시 호출되는 메서드
   * 애플리케이션 시작 시 벡터 스토어를 초기화합니다.
   */
  async onModuleInit() {
    // 모듈 초기화 시 벡터 스토어 초기화
    await this.initializeVectorStore();
  }

  /**
   * 벡터 스토어 초기화
   * Qdrant는 서버 기반이므로 연결만 확인
   */
  private async initializeVectorStore() {
    try {
      const collectionName = process.env.QDRANT_COLLECTION_NAME || 'rag-documents';
      
      // Qdrant VectorStore 초기화 (컬렉션은 문서 추가 시 자동 생성)
      this.vectorStore = new QdrantVectorStore(this.embeddings, {
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
        collectionName,
        vectorSize: 1536, // OpenAI embedding 크기
      });

      console.log(`Qdrant 벡터 스토어가 초기화되었습니다. (컬렉션: ${collectionName})`);
    } catch (error) {
      console.error('벡터 스토어 초기화 중 오류:', error);
      console.error('Qdrant 서버가 실행 중인지 확인해주세요.');
    }
  }

  /**
   * 텍스트 문서를 벡터 스토어에 추가
   * 
   * @param texts - 벡터 스토어에 추가할 텍스트 배열
   * 
   * 처리 과정:
   * 1. 텍스트를 Document 객체로 변환
   * 2. RecursiveCharacterTextSplitter를 사용하여 문서를 작은 청크로 분할
   *    - 청크 크기: 1000자
   *    - 오버랩: 200자 (문맥 유지를 위해)
   * 3. 각 청크를 임베딩하여 벡터로 변환
   * 4. Qdrant 벡터 스토어에 저장
   */
  async addDocuments(texts: string[]): Promise<void> {
    // 텍스트를 Document 객체로 변환
    const documents = texts.map(
      (text) =>
        new Document({
          pageContent: text,
          metadata: {},
        }),
    );

    // 텍스트 분할기 설정 (청크 크기: 1000, 오버랩: 200)
    // 오버랩을 두어 문맥 손실을 최소화
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    // 문서 분할
    const splitDocs = await textSplitter.splitDocuments(documents);

    // 벡터 스토어에 추가
    if (!this.vectorStore) {
      // 벡터 스토어가 없으면 새로 생성
      // fromDocuments는 컬렉션 생성과 문서 추가를 한 번에 처리
      const collectionName = process.env.QDRANT_COLLECTION_NAME || 'rag-documents';
      this.vectorStore = await QdrantVectorStore.fromDocuments(
        splitDocs,
        this.embeddings,
        {
          url: process.env.QDRANT_URL,
          apiKey: process.env.QDRANT_API_KEY,
          collectionName,
          vectorSize: 1536, // OpenAI embedding 차원 수
        },
      );
    } else {
      // 기존 벡터 스토어에 문서 추가
      await this.vectorStore.addDocuments(splitDocs);
    }

    console.log(`Qdrant 벡터 스토어에 ${splitDocs.length}개의 문서 청크를 추가했습니다.`);
  }

  /**
   * 파일에서 문서 로드 (텍스트 파일)
   * 
   * @param filePath - 로드할 파일의 경로
   * @throws Error - 파일 읽기 실패 시 에러 발생
   * 
   * 파일을 읽어서 텍스트로 변환한 후 addDocuments 메서드를 호출합니다.
   */
  async loadDocumentFromFile(filePath: string): Promise<void> {
    try {
      // 파일을 UTF-8 인코딩으로 읽기
      const content = fs.readFileSync(filePath, 'utf-8');
      // 읽은 내용을 벡터 스토어에 추가
      await this.addDocuments([content]);
    } catch (error) {
      throw new Error(`파일 로드 실패: ${error.message}`);
    }
  }

  /**
   * 질문에 대한 답변 생성 (RAG 파이프라인)
   * 
   * @param question - 사용자의 질문
   * @returns 답변 텍스트와 참조된 문서들
   * 
   * RAG 프로세스:
   * 1. 질문을 임베딩 벡터로 변환
   * 2. 벡터 유사도 검색으로 관련 문서 검색 (상위 4개)
   * 3. 검색된 문서를 컨텍스트로 구성
   * 4. LLM에 컨텍스트와 질문을 함께 전달하여 답변 생성
   */
  async query(question: string): Promise<{ answer: string; sourceDocuments?: Document[] }> {
    if (!this.vectorStore) {
      throw new Error('벡터 스토어가 초기화되지 않았습니다. 먼저 문서를 추가해주세요.');
    }

    // 검색기 생성 (상위 4개의 관련 문서 검색)
    const retriever = this.vectorStore.asRetriever(4);

    // 관련 문서 검색 (질문과 유사한 문서를 벡터 검색으로 찾음)
    const relevantDocs = await retriever.invoke(question);

    // 컨텍스트 생성 (검색된 문서들을 하나의 텍스트로 결합)
    const context = relevantDocs.map((doc) => doc.pageContent).join('\n\n');

    // 프롬프트 템플릿 설정
    // 컨텍스트와 질문을 조합하여 LLM에 전달할 프롬프트 생성
    const promptTemplate = PromptTemplate.fromTemplate(
      `다음 컨텍스트를 사용하여 질문에 답변해주세요. 컨텍스트에 답이 없으면 모른다고 답변하세요.

컨텍스트:
{context}

질문: {question}

답변:`,
    );

    // LangChain 체인 생성 및 실행
    // 프롬프트 템플릿 -> LLM -> 문자열 파서 순서로 실행
    const chain = RunnableSequence.from([
      promptTemplate,
      this.llm,
      new StringOutputParser(),
    ]);

    // 체인 실행하여 답변 생성
    const answer = await chain.invoke({
      context,
      question,
    });

    return {
      answer,
      sourceDocuments: relevantDocs, // 참조된 문서들 반환 (출처 표시용)
    };
  }

  /**
   * 유사 문서 검색 (벡터 검색)
   * 
   * @param query - 검색할 쿼리 텍스트
   * @param k - 반환할 문서 개수 (기본값: 4)
   * @returns 유사한 문서 배열
   * 
   * 질문을 임베딩 벡터로 변환한 후, 코사인 유사도를 사용하여
   * 가장 유사한 문서들을 검색합니다.
   */
  async similaritySearch(query: string, k: number = 4): Promise<Document[]> {
    if (!this.vectorStore) {
      throw new Error('벡터 스토어가 초기화되지 않았습니다. 먼저 문서를 추가해주세요.');
    }

    // 벡터 유사도 검색 수행
    return await this.vectorStore.similaritySearch(query, k);
  }
}
