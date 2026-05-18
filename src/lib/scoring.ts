import type { GameQuestion } from "./types";

export interface GradeResult {
  scoreAwarded: number;
  isCorrect: boolean;
  correctAnswer: string | number;
  message: string;
}

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function gradeAnswer(question: GameQuestion, answer: unknown): GradeResult {
  if (question.type === "numeric") {
    const submitted = Number(answer);
    const correct = Number(question.correctAnswer);
    const tolerance = question.tolerance ?? 0;

    if (!Number.isFinite(submitted)) {
      return {
        scoreAwarded: 0,
        isCorrect: false,
        correctAnswer: question.correctAnswer,
        message: "That was not a valid number.",
      };
    }

    const difference = Math.abs(submitted - correct);
    if (difference === 0) {
      return {
        scoreAwarded: question.points,
        isCorrect: true,
        correctAnswer: question.correctAnswer,
        message: "Perfect guess!",
      };
    }

    if (difference <= tolerance) {
      const scoreAwarded = Math.max(1, Math.round(question.points * (1 - difference / (tolerance + 1))));
      return {
        scoreAwarded,
        isCorrect: false,
        correctAnswer: question.correctAnswer,
        message: `Close! You were off by ${difference}.`,
      };
    }

    return {
      scoreAwarded: 0,
      isCorrect: false,
      correctAnswer: question.correctAnswer,
      message: `Not close enough this time. You were off by ${difference}.`,
    };
  }

  const isCorrect = normalize(answer) === normalize(question.correctAnswer);
  return {
    scoreAwarded: isCorrect ? question.points : 0,
    isCorrect,
    correctAnswer: question.correctAnswer,
    message: isCorrect ? "Correct!" : "Not quite.",
  };
}
