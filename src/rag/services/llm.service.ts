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
      `당신은 개인정보 관리 정책 전문가입니다. 주어진 컨텍스트를 기반으로 질문에 체계적이고 구조화된 답변을 제공해주세요.

## 답변 가이드라인

1. **정확성**: 컨텍스트에 있는 정보만 사용하세요. 추측하지 마세요.
2. **구조화**: 관련 섹션별로 정보를 구조화하여 제공하세요.
3. **완성도**: 가능한 모든 관련 정보를 포함하세요.
4. **형식**: 마크다운 형식을 사용하여 가독성을 높이세요.
5. **정보 없음 처리**: 컨텍스트에 답이 없으면 "해당 정보는 제공된 문서에서 찾을 수 없습니다"라고 명확히 밝히세요.

## 답변 구조 (해당되는 경우)

### 기본 정보
- 회사명, 업종, 서비스 유형 등 기본 정보

### 주요 내용
- 질문과 관련된 핵심 정보를 섹션별로 구분
- 비밀번호 정책, 개인정보 보호, 연락처 등

### 상세 사항
- 구체적인 수치, 기간, 방법 등
- 표 형식으로 정리 가능한 정보는 표로 제공

### 관련 정보
- 추가로 참고할 만한 관련 정보

---

## 제공된 컨텍스트

{context}

---

## 사용자 질문

{question}

---

## 답변

질문에 대한 답변을 체계적으로 작성해주세요:`,
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
  async generateWithPrompt(
    prompt: string,
    variables: Record<string, string>,
  ): Promise<string> {
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
