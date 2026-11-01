import type {
  HevyBodyMeasurement,
  HevyExerciseTemplate,
  HevyUserInfo,
  HevyWorkout,
  HevyWorkoutEvent,
  Paged,
} from './types';
import { mockFetch } from './mock';

const BASE_URL = 'https://api.hevyapp.com';

export class HevyError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export class HevyClient {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: Fetch = fetch,
  ) {}

  /** HEVY_MOCK=1 serves realistic fake data, so the app works before you have a key. */
  static fromEnv(): HevyClient {
    if (process.env.HEVY_MOCK === '1') return new HevyClient('mock', mockFetch);
    const key = process.env.HEVY_API_KEY;
    if (!key) throw new HevyError('HEVY_API_KEY is not set. Add it to .env.local, or set HEVY_MOCK=1 to use sample data.', 401);
    return new HevyClient(key);
  }

  get isMock(): boolean {
    return this.apiKey === 'mock';
  }

  private async get<T>(path: string, query: Record<string, string | number | undefined> = {}): Promise<T> {
    const url = new URL(path, BASE_URL);
    for (const [k, v] of Object.entries(query)) if (v !== undefined) url.searchParams.set(k, String(v));
    for (let attempt = 0; ; attempt++) {
      const res = await this.fetchImpl(url.toString(), { headers: { 'api-key': this.apiKey, accept: 'application/json' } });
      if (res.ok) return (await res.json()) as T;
      // back off on rate limits and transient server errors
      if ((res.status === 429 || res.status >= 500) && attempt < 3) {
        const retryAfter = Number(res.headers.get('retry-after')) || 2 ** attempt;
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }
      if (res.status === 401) throw new HevyError('Hevy rejected the API key. Check HEVY_API_KEY (it needs Hevy Pro).', 401);
      throw new HevyError(`Hevy ${path} failed with ${res.status}: ${await res.text().catch(() => '')}`, res.status);
    }
  }

  /** Walks every page of a list endpoint. */
  private async *pages<T, K extends string>(path: string, key: K, pageSize: number, query: Record<string, string> = {}): AsyncGenerator<T> {
    for (let page = 1; ; page++) {
      const body = await this.get<Paged & Record<K, T[]>>(path, { ...query, page, pageSize });
      for (const item of body[key] ?? []) yield item;
      if (page >= (body.page_count ?? 1)) return;
    }
  }

  userInfo() {
    return this.get<{ data: HevyUserInfo }>('/v1/user/info').then((r) => r.data);
  }
  workouts() {
    return this.pages<HevyWorkout, 'workouts'>('/v1/workouts', 'workouts', 10);
  }
  workoutEvents(since: string) {
    return this.pages<HevyWorkoutEvent, 'events'>('/v1/workouts/events', 'events', 10, { since });
  }
  exerciseTemplates() {
    return this.pages<HevyExerciseTemplate, 'exercise_templates'>('/v1/exercise_templates', 'exercise_templates', 100);
  }
  bodyMeasurements() {
    return this.pages<HevyBodyMeasurement, 'body_measurements'>('/v1/body_measurements', 'body_measurements', 10);
  }
}
