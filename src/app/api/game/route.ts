import { NextResponse } from "next/server";
import {
  createOrFindPlayer,
  ensurePlayer,
  findPlayerById,
  getAnswersForPlayer,
  getExistingAnswer,
  getLeaderboard,
  getStorageMode,
  resetAllScores,
  resetPlayerAnswers,
  saveAnswer,
  serializeAnswer,
} from "@/lib/db";
import { coupleNames, findQuestion, getPublicGames, getTotalPossibleScore } from "@/lib/game-data";
import { gradeAnswer } from "@/lib/scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 });
}

function safeText(value: unknown) {
  return String(value || "").trim();
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "health";

    if (action === "health") {
      return NextResponse.json({ ok: true, service: "wedding-games-app", storage: getStorageMode() });
    }

    if (action === "config") {
      return NextResponse.json({
        couple: coupleNames,
        totalPossibleScore: getTotalPossibleScore(),
      });
    }

    if (action === "games") {
      return NextResponse.json({ games: getPublicGames() });
    }

    if (action === "leaderboard") {
      return NextResponse.json({ leaderboard: await getLeaderboard(), totalPossibleScore: getTotalPossibleScore() });
    }

    if (action === "state") {
      const playerId = safeText(searchParams.get("playerId"));
      if (!playerId) return badRequest("A valid playerId is required.");
      return NextResponse.json({ answers: await getAnswersForPlayer(playerId) });
    }

    return badRequest("Unknown game action.");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Game request failed." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = safeText(body.action);

    if (action === "join") {
      const username = safeText(body.username).replace(/\s+/g, " ").slice(0, 32);

      if (username.length < 2) {
        return badRequest("Username must be at least 2 characters.");
      }

      const result = await createOrFindPlayer(username);
      return NextResponse.json({ playerId: result.player.id, username: result.player.username, existing: result.existing });
    }

    if (action === "answer") {
      const playerId = safeText(body.playerId);
      const username = safeText(body.username).replace(/\s+/g, " ").slice(0, 32);
      const gameId = safeText(body.gameId);
      const questionId = safeText(body.questionId);
      const answer = body.answer;

      if (!playerId) return badRequest("A valid playerId is required.");
      if (!username) return badRequest("A valid username is required.");

      const question = findQuestion(gameId, questionId);
      if (!question) {
        return NextResponse.json({ error: "Question was not found." }, { status: 404 });
      }

      await ensurePlayer(playerId, username);

      const existing = await getExistingAnswer(playerId, gameId, questionId);
      if (existing) {
        return NextResponse.json({
          alreadyAnswered: true,
          answer: existing.answer,
          feedback: {
            scoreAwarded: existing.scoreAwarded,
            isCorrect: existing.isCorrect,
            correctAnswer: question.correctAnswer,
            message: "This question was already answered.",
          },
        });
      }

      const result = gradeAnswer(question, answer);
      const storedAnswer = serializeAnswer(answer);

      await saveAnswer({
        playerId,
        gameId,
        questionId,
        answer: storedAnswer,
        scoreAwarded: result.scoreAwarded,
        isCorrect: result.isCorrect,
      });

      return NextResponse.json({
        alreadyAnswered: false,
        answer: storedAnswer,
        feedback: result,
      });
    }

    if (action === "reset-player") {
      const playerId = safeText(body.playerId);
      if (!playerId) return badRequest("A valid playerId is required.");
      await resetPlayerAnswers(playerId);
      return NextResponse.json({ ok: true });
    }

    if (action === "reset-all") {
      const configuredPin = process.env.HOST_PIN || "";
      const providedPin = safeText(body.pin);

      if (configuredPin && providedPin !== configuredPin) {
        return unauthorized("Invalid host PIN.");
      }

      await resetAllScores();
      return NextResponse.json({ ok: true });
    }

    if (action === "rejoin") {
      const playerId = safeText(body.playerId);
      const username = safeText(body.username).replace(/\s+/g, " ").slice(0, 32);
      if (!playerId || !username) return badRequest("A valid saved player is required.");

      const existing = await findPlayerById(playerId);
      if (!existing) await ensurePlayer(playerId, username);
      return NextResponse.json({ ok: true, playerId, username });
    }

    return badRequest("Unknown game action.");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Game request failed." },
      { status: 500 }
    );
  }
}
