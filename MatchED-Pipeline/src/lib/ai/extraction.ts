import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { ExtractionSchema, ExtractionResult } from '@/schemas/extraction';

const LLM_PROVIDER = process.env.LLM_PROVIDER || 'openai';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

let openai: OpenAI | null = null;
let anthropic: Anthropic | null = null;

if (LLM_PROVIDER === 'openai' && OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: OPENAI_API_KEY });
} else if (LLM_PROVIDER === 'anthropic' && ANTHROPIC_API_KEY) {
  anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
}

const EXTRACTION_PROMPT = `You are an opportunity extraction engine for MatchED. Extract structured opportunity data from the provided webpage text. Return only valid JSON. Do not invent information. If a field is missing, return null or an empty array. Summarize in your own words. Do not copy long paragraphs. Identify eligibility, funding, deadline, application link, location, opportunity type, education level, and target audience. Assign a confidence score from 0 to 1.

Schema expected:
{
  "title": string,
  "summary": string,
  "opportunity_type": string,
  "organization_name": string | null,
  "host_institution": string | null,
  "country": string | null,
  "region": string | null,
  "city": string | null,
  "is_remote": boolean | null,
  "is_online": boolean | null,
  "eligible_countries": string[],
  "eligible_regions": string[],
  "education_levels": string[],
  "target_audience": string[],
  "fields_of_interest": string[],
  "funding_type": string,
  "funding_amount": string | null,
  "currency": string | null,
  "costs_covered": string[],
  "application_deadline": string | null,
  "start_date": string | null,
  "end_date": string | null,
  "duration": string | null,
  "language_requirements": string[],
  "age_min": number | null,
  "age_max": number | null,
  "gender_eligibility": string | null,
  "citizenship_requirements": string[],
  "academic_requirements": string[],
  "documents_required": string[],
  "selection_criteria": string[],
  "benefits": string[],
  "application_url": string | null,
  "tags": string[],
  "difficulty_level": string,
  "competitiveness_level": string,
  "confidence_score": number,
  "missing_important_fields": string[]
}`;

export async function extractOpportunityData(text: string, url: string): Promise<ExtractionResult> {
  if (!openai && !anthropic) {
    throw new Error('No LLM provider configured');
  }

  const messages = [
    { role: 'system' as const, content: EXTRACTION_PROMPT },
    { role: 'user' as const, content: `URL: ${url}\n\nContent:\n${text}` },
  ];

  let response: string;

  try {
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.1,
        max_tokens: 2000,
      });
      response = completion.choices[0]?.message?.content || '';
    } else if (anthropic) {
      const completion = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2000,
        system: EXTRACTION_PROMPT,
        messages: [{ role: 'user', content: `URL: ${url}\n\nContent:\n${text}` }],
      });
      response = completion.content[0]?.type === 'text' ? completion.content[0].text : '';
    } else {
      throw new Error('No LLM provider available');
    }

    // Clean the response to extract JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const validated = ExtractionSchema.parse(parsed);

    return validated;
  } catch (error) {
    console.error('AI extraction failed:', error);
    throw new Error(`Failed to extract opportunity data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}