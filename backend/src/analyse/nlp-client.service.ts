import {
  BadGatewayException,
  Injectable,
  Logger,
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

export interface NlpLexicalResponse {
  model: string
  global: NlpGlobalStats
  units: NlpUnitStats[]
  entities: NlpEntity[]
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
