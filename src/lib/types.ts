export type QuestionType = "multiple" | "who-said" | "numeric";

export interface GameQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  options?: string[];
  correctAnswer: string | number;
  points: number;
  helper?: string;
  tolerance?: number;
  explanation?: string;
}

export interface WeddingGame {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  icon: string;
  questions: GameQuestion[];
}

export type PublicGameQuestion = Omit<GameQuestion, "correctAnswer">;

export interface PublicWeddingGame extends Omit<WeddingGame, "questions"> {
  questions: PublicGameQuestion[];
  totalPoints: number;
}

export interface Player {
  id: string;
  username: string;
}

export interface AnswerState {
  gameId: string;
  questionId: string;
  answer: string;
  scoreAwarded: number;
  isCorrect: boolean;
  answeredAt: string;
}

export interface LeaderboardRow {
  playerId: string;
  username: string;
  totalScore: number;
  answeredCount: number;
  lastAnswerAt: string | null;
}
