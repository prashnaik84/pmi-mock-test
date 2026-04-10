export type TestStatus = 'paid' | 'questions_ready' | 'in_progress' | 'completed' | 'expired';

export interface Question {
  id: string;
  q: string;
  options: string[];
  answer: number;        // 0–3 index (stored, exposed only after submit)
  explanation: string;
  domain: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

// What the client receives (answer hidden until submission)
export interface ClientQuestion {
  id: string;
  q: string;
  options: string[];
  domain: string;
  difficulty: string;
}

export interface DomainResult {
  domain: string;
  correct: number;
  total: number;
  pct: number;
}

export interface TestSession {
  id: string;
  email: string;
  stripe_session_id: string;
  status: TestStatus;
  score: number | null;
  total_questions: number;
  correct_answers: number | null;
  time_taken_seconds: number | null;
  domain_results: DomainResult[] | null;
  created_at: string;
  completed_at: string | null;
}
