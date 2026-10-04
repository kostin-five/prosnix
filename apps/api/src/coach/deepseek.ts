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
  sequenceEffects: CoachAggregateMetric[];
  trendSignals: {
    observedDays: number;
    recentDirection: "improving" | "stable" | "declining" | "unknown";
    variability: number | null;
  };
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

export type CoachFailureReason = "http" | "timeout" | "network" | "invalid_response" | "unknown";

export class CoachGatewayError extends Error {
  constructor(
    public readonly reason: CoachFailureReason,
    public readonly httpStatus?: number,
  ) {
    super(`Coach provider failure: ${reason}`);
    this.name = "CoachGatewayError";
  }
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
  const limits = { summary: 600, nextExperiment: 350, caveat: 350 } as const;
  const result = {} as Record<keyof typeof limits, string>;
  for (const key of allowed as Array<keyof typeof limits>) {
    const text = record[key];
    if (typeof text !== "string" || text.trim().length === 0 || text.trim().length > limits[key]) {
      throw new Error(`DeepSeek returned invalid ${key}`);
    }
    result[key] = text.trim();
  }
  if (/средн[а-яё]*\s+прирост[а-яё]*\s+бодрост/i.test(result.summary)) {
    throw new Error("DeepSeek repeated an already visible average metric");
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
    const signal = AbortSignal.timeout(this.options.timeoutMs);
    let response: Response;
    try {
      response = await fetcher(`${this.options.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          "content-type": "application/json",
        },
        signal,
        body: JSON.stringify({
          model: this.options.model,
          stream: false,
          max_tokens: 650,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                'Ты персональный аналитик пробуждения Prosnix. Анализируй только переданные обезличенные агрегаты. В summary сначала объясни смысл наблюдаемой динамики и устойчивости результата, а не пересказывай видимые числа или средний прирост бодрости. В nextExperiment используй самый сильный или самый слабый сигнал последовательности и предложи одну конкретную проверяемую гипотезу; не ограничивайся очевидной инструкцией пройти назначенный протокол и ответить через 15 минут. Если сравнений мало, точно назови, какого повтора не хватает. Переводи task id в понятные русские названия и не показывай внутренние ключи. В caveat честно укажи размер и ограничения выборки. Не ставь диагнозы, не давай медицинских обещаний и не выдумывай причинность. Верни только JSON вида {"summary":"...","nextExperiment":"...","caveat":"..."}. Пиши ясным русским языком, содержательно и без лишнего вступления.',
            },
            {
              role: "user",
              content: `Сформируй JSON-вывод по агрегированному профилю: ${JSON.stringify(payload)}`,
            },
          ],
        }),
      });
    } catch {
      throw new CoachGatewayError(signal.aborted ? "timeout" : "network");
    }
    if (!response.ok) throw new CoachGatewayError("http", response.status);
    try {
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
    } catch {
      throw new CoachGatewayError(signal.aborted ? "timeout" : "invalid_response");
    }
  }
}
