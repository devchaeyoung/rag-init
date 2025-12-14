import { Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';

/**
 * LLM 서비스
 * 
 * 대규모 언어 모델(LLM)을 사용한 텍스트 생성 기능을 제공합니다.
 * OpenAI GPT 모델을 사용하여 컨텍스트 기반 답변을 생성합니다.
 */
@Injectable()
export class LLMService {
  /** LLM 모델 인스턴스 */
  private llm: ChatOpenAI;

  constructor() {
    // LLM 초기화
    // temperature: 0으로 설정하여 일관된 답변 생성
    this.llm = new ChatOpenAI({
      modelName: 'gpt-3.5-turbo',
      temperature: 0,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * 컨텍스트와 질문을 기반으로 답변 생성
   * 
   * @param context - 컨텍스트 텍스트
   * @param question - 질문 텍스트
   * @returns 생성된 답변
   */
  async generateAnswer(context: string, question: string): Promise<string> {
    // 프롬프트 템플릿 설정
    const promptTemplate = PromptTemplate.fromTemplate(
      `다음 컨텍스트를 사용하여 질문에 답변해주세요. 컨텍스트에 답이 없으면 모른다고 답변하세요.

컨텍스트:
{context}

질문: {question}

답변:`,
    );

    // LangChain 체인 생성 및 실행
    const chain = RunnableSequence.from([
      promptTemplate,
      this.llm,
      new StringOutputParser(),
    ]);

    // 체인 실행하여 답변 생성
    return await chain.invoke({
      context,
      question,
    });
  }

  /**
   * 커스텀 프롬프트로 답변 생성
   * 
   * @param prompt - 프롬프트 텍스트
   * @param variables - 프롬프트 변수 객체
   * @returns 생성된 답변
   */
  async generateWithPrompt(prompt: string, variables: Record<string, string>): Promise<string> {
    const promptTemplate = PromptTemplate.fromTemplate(prompt);
    const chain = RunnableSequence.from([
      promptTemplate,
      this.llm,
      new StringOutputParser(),
    ]);

    return await chain.invoke(variables);
  }

  /**
   * LLM 인스턴스 반환
   * 
   * @returns ChatOpenAI 인스턴스
   */
  getLLM(): ChatOpenAI {
    return this.llm;
  }
}

