export interface CoachAggregateMetric {
  key: string;
  value: number | null;
  evidenceCount: number;
  confidence: "insufficient" | "low" | "medium" | "high";
}

export interface CoachAggregatePayload {
  methodVersion: string;
  averageDelta: CoachAggregateMetric;
  riseSuccess: CoachAggregateMetric;
  protocolEffects: CoachAggregateMetric[];
  factorEffects: CoachAggregateMetric[];
}

export interface GeneratedCoachInsight {
  summary: string;
  nextExperiment: string;
  caveat: string;
  model: string;
}

export interface CoachGateway {
  generate(payload: CoachAggregatePayload): Promise<GeneratedCoachInsight>;
}

interface DeepSeekResponse {
  model?: unknown;
  choices?: Array<{ message?: { content?: unknown } }>;
}

function validatedContent(value: unknown): Omit<GeneratedCoachInsight, "model"> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("DeepSeek returned invalid JSON object");
  }
  const record = value as Record<string, unknown>;
  const allowed = ["summary", "nextExperiment", "caveat"];
  if (Object.keys(record).some((key) => !allowed.includes(key))) {
    throw new Error("DeepSeek returned unsupported fields");
  }
  const limits = { summary: 400, nextExperiment: 300, caveat: 300 } as const;
  const result = {} as Record<keyof typeof limits, string>;
  for (const key of allowed as Array<keyof typeof limits>) {
    const text = record[key];
    if (typeof text !== "string" || text.trim().length === 0 || text.trim().length > limits[key]) {
      throw new Error(`DeepSeek returned invalid ${key}`);
    }
    result[key] = text.trim();
  }
  return result;
}

export class DeepSeekCoachGateway implements CoachGateway {
  constructor(
    private readonly options: {
      apiKey: string;
      baseUrl: string;
      model: string;
      timeoutMs: number;
      fetcher?: typeof fetch;
    },
  ) {}

  async generate(payload: CoachAggregatePayload): Promise<GeneratedCoachInsight> {
    const fetcher = this.options.fetcher ?? fetch;
    const response = await fetcher(`${this.options.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.options.apiKey}`,
        "content-type": "application/json",
      },
      signal: AbortSignal.timeout(this.options.timeoutMs),
      body: JSON.stringify({
        model: this.options.model,
        stream: false,
        max_tokens: 450,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Ты AI Wake Coach. Анализируй только переданные агрегаты. Не ставь диагнозы, не выдумывай причинность и не упоминай внутренние ключи. Верни только JSON вида {"summary":"...","nextExperiment":"...","caveat":"..."}. Пиши кратко по-русски.',
          },
          {
            role: "user",
            content: `Сформируй JSON-вывод по агрегированному профилю: ${JSON.stringify(payload)}`,
          },
        ],
      }),
    });
    if (!response.ok) throw new Error(`DeepSeek request failed with ${response.status}`);
    const body = (await response.json()) as DeepSeekResponse;
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      throw new Error("DeepSeek returned empty content");
    }
    const validated = validatedContent(JSON.parse(content) as unknown);
    return {
      ...validated,
      model: typeof body.model === "string" ? body.model : this.options.model,
    };
  }
}
