import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'

export interface NlpUnitIn {
  id: string
  text: string
}

export interface NlpUnitStats {
  id: string
  sentences: number
  words: number
  avgSentenceLength: number
  ttr: number
  lexicalDensity: number
}

export interface NlpGlobalStats {
  sentences: number
  tokens: number
  words: number
  uniqueLemmas: number
  ttr: number
  lexicalDensity: number
  avgSentenceLength: number
  posCounts: Record<string, number>
}

export interface NlpEntity {
  text: string
  label: string
  count: number
  units: { id: string; count: number }[]
}

export interface NlpLexicalGraph {
  sentences: number
  nodes: { lemma: string; count: number }[]
  edges: { source: string; target: string; count: number; npmi: number }[]
}

export interface NlpLexicalResponse {
  model: string
  global: NlpGlobalStats
  units: NlpUnitStats[]
  entities: NlpEntity[]
  graph: NlpLexicalGraph
}

export interface NlpEmbeddingsResponse {
  model: string
  dimensions: number
  vectors: number[][]
}

export interface NlpHealthResponse {
  status: string
  spacy: { version: string; model: string }
  embeddings: { model: string }
}

export interface NlpTopicWord {
  word: string
  weight: number
}

export interface NlpTopic {
  topic: number
  count: number
  words: NlpTopicWord[]
}

export interface NlpTopicsResult {
  model: string
  params: Record<string, unknown>
  topics: NlpTopic[]
  assignments: { id: string; topic: number }[]
  projection: { id: string; x: number; y: number }[]
}

export interface NlpJobStatus {
  jobId: string
  kind: string
  status: 'queued' | 'running' | 'done' | 'error'
  pct: number
  step: string
  error: string | null
  result: NlpTopicsResult | null
}

// Client HTTP du service Python nlp-service/ (FastAPI). Le service est
// sans état : il reçoit du texte brut, rend du JSON — toute persistance
// reste côté Nest (AnalyseService).
@Injectable()
export class NlpClientService {
  private readonly logger = new Logger(NlpClientService.name)
  private readonly baseUrl = (process.env.NLP_SERVICE_URL ?? 'http://localhost:8001').replace(
    /\/+$/,
    '',
  )

  lexical(units: NlpUnitIn[]): Promise<NlpLexicalResponse> {
    return this.post<NlpLexicalResponse>('/v1/lexical', { units })
  }

  // Lots de ≤512 textes (borne pydantic côté service) — l'appelant découpe.
  embeddings(texts: string[]): Promise<NlpEmbeddingsResponse> {
    return this.post<NlpEmbeddingsResponse>('/v1/embeddings', { texts })
  }

  similarity(texts: string[]): Promise<{ model: string; matrix: number[][] }> {
    return this.post<{ model: string; matrix: number[][] }>('/v1/similarity', { texts })
  }

  startTopicsJob(segments: { id: string; text: string }[]): Promise<{ jobId: string }> {
    return this.post<{ jobId: string }>('/v1/jobs/topics', { segments })
  }

  jobStatus(jobId: string): Promise<NlpJobStatus> {
    return this.getJson<NlpJobStatus>(`/v1/jobs/${jobId}`)
  }

  health(): Promise<NlpHealthResponse> {
    return this.getJson<NlpHealthResponse>('/health')
  }

  private async getJson<T>(path: string): Promise<T> {
    let res: Response
    try {
      res = await fetch(this.baseUrl + path)
    } catch {
      throw new ServiceUnavailableException(
        `Service NLP injoignable (${this.baseUrl}) — le lancer avec \`npm run dev:nlp\``,
      )
    }
    if (res.status === 404) {
      const detail = (await res.json().catch(() => null)) as { detail?: string } | null
      throw new NotFoundException(detail?.detail ?? `Service NLP : introuvable (${path})`)
    }
    if (!res.ok) throw new BadGatewayException(`Service NLP : HTTP ${res.status} sur ${path}`)
    return res.json() as Promise<T>
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    let res: Response
    try {
      res = await fetch(this.baseUrl + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch (e) {
      this.logger.warn(`Service NLP injoignable sur ${this.baseUrl} : ${(e as Error).message}`)
      throw new ServiceUnavailableException(
        `Service NLP injoignable (${this.baseUrl}) — le lancer avec \`npm run dev:nlp\``,
      )
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      this.logger.error(`Service NLP : HTTP ${res.status} sur ${path} — ${detail}`)
      throw new BadGatewayException(`Service NLP : HTTP ${res.status} sur ${path}`)
    }
    return res.json() as Promise<T>
  }
}
