"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { AnswerState, LeaderboardRow, Player, PublicWeddingGame, PublicGameQuestion } from "@/lib/types";

interface ConfigState {
  couple: {
    bride: string;
    groom: string;
    display: string;
  };
  totalPossibleScore: number;
}

interface FeedbackState {
  scoreAwarded: number;
  isCorrect: boolean;
  correctAnswer: string | number;
  message: string;
}

const storageKey = "wedding-games-player";

function answerKey(gameId: string, questionId: string) {
  return `${gameId}:${questionId}`;
}

async function jsonFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }
  return payload as T;
}

export default function GameShell() {
  const [config, setConfig] = useState<ConfigState | null>(null);
  const [games, setGames] = useState<PublicWeddingGame[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [player, setPlayer] = useState<Player | null>(null);
  const [username, setUsername] = useState("");
  const [answers, setAnswers] = useState<AnswerState[]>([]);
  const [activeGameId, setActiveGameId] = useState<string>("");
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [reviewQuestionId, setReviewQuestionId] = useState<string | null>(null);
  const [numericAnswer, setNumericAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const answeredMap = useMemo(() => {
    const map = new Map<string, AnswerState>();
    answers.forEach((answer) => map.set(answerKey(answer.gameId, answer.questionId), answer));
    return map;
  }, [answers]);

  const activeGame = games.find((game) => game.id === activeGameId) || games[0];
  const currentQuestion = useMemo(() => {
    if (!activeGame) return undefined;
    if (reviewQuestionId) {
      return activeGame.questions.find((question) => question.id === reviewQuestionId);
    }
    return activeGame.questions.find((question) => !answeredMap.has(answerKey(activeGame.id, question.id)));
  }, [activeGame, answeredMap, reviewQuestionId]);

  const playerScore = answers.reduce((sum, answer) => sum + answer.scoreAwarded, 0);
  const answeredCount = answers.length;
  const totalQuestionCount = games.reduce((sum, game) => sum + game.questions.length, 0);

  async function loadLeaderboard() {
    const payload = await jsonFetch<{ leaderboard: LeaderboardRow[] }>("/api/game?action=leaderboard");
    setLeaderboard(payload.leaderboard);
  }

  async function loadState(playerId: string) {
    const payload = await jsonFetch<{ answers: AnswerState[] }>(`/api/game?action=state&playerId=${encodeURIComponent(playerId)}`);
    setAnswers(payload.answers);
  }

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const [configPayload, gamesPayload, leaderboardPayload] = await Promise.all([
          jsonFetch<ConfigState>("/api/game?action=config"),
          jsonFetch<{ games: PublicWeddingGame[] }>("/api/game?action=games"),
          jsonFetch<{ leaderboard: LeaderboardRow[] }>("/api/game?action=leaderboard"),
        ]);

        if (cancelled) return;
        setConfig(configPayload);
        setGames(gamesPayload.games);
        setActiveGameId(gamesPayload.games[0]?.id || "");
        setLeaderboard(leaderboardPayload.leaderboard);

        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved) as Player;
          if (parsed?.id && parsed?.username) {
            setPlayer(parsed);
            await jsonFetch("/api/game", {
              method: "POST",
              body: JSON.stringify({ action: "rejoin", playerId: parsed.id, username: parsed.username }),
            }).catch(() => undefined);
            await loadState(parsed.id);
          }
        }
      } catch (bootError) {
        setError(bootError instanceof Error ? bootError.message : "Could not start the game.");
      }
    }

    boot();
    const timer = window.setInterval(() => loadLeaderboard().catch(() => undefined), 5000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  async function joinGame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const payload = await jsonFetch<{ playerId: string; username: string }>("/api/game", {
        method: "POST",
        body: JSON.stringify({ action: "join", username }),
      });
      const joinedPlayer = { id: payload.playerId, username: payload.username };
      setPlayer(joinedPlayer);
      localStorage.setItem(storageKey, JSON.stringify(joinedPlayer));
      await Promise.all([loadState(joinedPlayer.id), loadLeaderboard()]);
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Could not join game.");
    } finally {
      setBusy(false);
    }
  }

  async function submitAnswer(question: PublicGameQuestion, answer: string | number) {
    if (!player || !activeGame) return;
    setBusy(true);
    setError("");
    setFeedback(null);

    try {
      setReviewQuestionId(question.id);
      const payload = await jsonFetch<{ feedback: FeedbackState }>("/api/game", {
        method: "POST",
        body: JSON.stringify({
          action: "answer",
          playerId: player.id,
          username: player.username,
          gameId: activeGame.id,
          questionId: question.id,
          answer,
        }),
      });
      setFeedback(payload.feedback);
      setNumericAnswer("");
      await Promise.all([loadState(player.id), loadLeaderboard()]);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not submit answer.");
    } finally {
      setBusy(false);
    }
  }

  async function resetMyGame() {
    if (!player) return;
    setBusy(true);
    setError("");
    setFeedback(null);
    setReviewQuestionId(null);

    try {
      await jsonFetch("/api/game", {
        method: "POST",
        body: JSON.stringify({ action: "reset-player", playerId: player.id }),
      });
      await Promise.all([loadState(player.id), loadLeaderboard()]);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Could not reset your answers.");
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem(storageKey);
    setPlayer(null);
    setAnswers([]);
    setFeedback(null);
    setReviewQuestionId(null);
    setUsername("");
  }

  function gameProgress(game: PublicWeddingGame) {
    const answered = game.questions.filter((question) => answeredMap.has(answerKey(game.id, question.id))).length;
    const score = game.questions.reduce((sum, question) => {
      const answer = answeredMap.get(answerKey(game.id, question.id));
      return sum + (answer?.scoreAwarded || 0);
    }, 0);
    return { answered, score, total: game.questions.length, complete: answered === game.questions.length };
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-card">
          <p className="kicker">Wedding Game Night</p>
          <h1>{config?.couple.display || "The Couple"}</h1>
          <p className="hero-copy">
            Guests enter a username, play a series of mini-games, and compete on a live leaderboard to prove who knows the couple best.
          </p>
          <div className="stats-row">
            <div className="stat-pill">
              <strong>{games.length || "—"}</strong>
              <span>Mini games</span>
            </div>
            <div className="stat-pill">
              <strong>{totalQuestionCount || "—"}</strong>
              <span>Questions</span>
            </div>
            <div className="stat-pill">
              <strong>{config?.totalPossibleScore || "—"}</strong>
              <span>Total points</span>
            </div>
          </div>
        </div>

        <aside className="panel join-card">
          {!player ? (
            <>
              <div>
                <p className="kicker">Join the game</p>
                <h2>Enter your player name</h2>
                <p className="muted">Use a name the couple will recognize on the leaderboard.</p>
              </div>
              <form className="join-form" onSubmit={joinGame}>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="e.g. Auntie Lisa, Team Groom, Kevin"
                  maxLength={32}
                  autoComplete="nickname"
                />
                <button className="primary-button" disabled={busy || username.trim().length < 2} type="submit">
                  Start Playing
                </button>
              </form>
            </>
          ) : (
            <>
              <div>
                <p className="kicker">Playing as</p>
                <h2>{player.username}</h2>
                <p className="muted">
                  Score: <strong>{playerScore}</strong> / {config?.totalPossibleScore || 0} · Answered {answeredCount} / {totalQuestionCount}
                </p>
              </div>
              <div className="progress-track" aria-label="Overall progress">
                <div
                  className="progress-fill"
                  style={{ width: `${totalQuestionCount ? (answeredCount / totalQuestionCount) * 100 : 0}%` }}
                />
              </div>
              <button className="secondary-button" onClick={logout} type="button">
                Switch Player
              </button>
              <button className="danger-button" onClick={resetMyGame} disabled={busy} type="button">
                Reset My Answers
              </button>
            </>
          )}
          {error ? <div className="error-box">{error}</div> : null}
        </aside>
      </section>

      {player ? (
        <section className="dashboard-grid">
          <div>
            <div className="game-grid">
              {games.map((game) => {
                const progress = gameProgress(game);
                return (
                  <button
                    key={game.id}
                    type="button"
                    className={`game-card ${game.id === activeGame?.id ? "active" : ""} ${progress.complete ? "complete" : ""}`}
                    onClick={() => {
                      setActiveGameId(game.id);
                      setFeedback(null);
                      setReviewQuestionId(null);
                    }}
                  >
                    <div className="game-title-row">
                      <span className="game-icon">{game.icon}</span>
                      <span>
                        <strong>{game.shortTitle}</strong>
                        <br />
                        <span className="muted">{progress.score} / {game.totalPoints} points</span>
                      </span>
                    </div>
                    <p className="muted">{game.description}</p>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${(progress.answered / progress.total) * 100}%` }} />
                    </div>
                    <small className="muted">
                      {progress.complete ? "Completed" : `${progress.answered} of ${progress.total} answered`}
                    </small>
                  </button>
                );
              })}
            </div>

            {activeGame && currentQuestion ? (
              <QuestionCard
                game={activeGame}
                question={currentQuestion}
                busy={busy}
                feedback={feedback}
                numericAnswer={numericAnswer}
                setNumericAnswer={setNumericAnswer}
                onSubmit={submitAnswer}
                onContinue={() => {
                  setFeedback(null);
                  setReviewQuestionId(null);
                }}
              />
            ) : activeGame ? (
              <div className="question-card">
                <p className="kicker">Mini game completed</p>
                <h2>{activeGame.title}</h2>
                <p className="muted">You answered every question in this round. Pick another mini game or check the leaderboard.</p>
                <div className="success-box">Nice work. Your score has been saved.</div>
              </div>
            ) : null}
          </div>

          <Leaderboard rows={leaderboard} totalPossibleScore={config?.totalPossibleScore || 0} />
        </section>
      ) : (
        <section className="panel">
          <h2>How it works</h2>
          <p className="muted">
            Guests join from their phone, answer each round once, and watch the leaderboard update live. The host can open <strong>/host</strong> on a big screen.
          </p>
        </section>
      )}
    </main>
  );
}

function QuestionCard({
  game,
  question,
  busy,
  feedback,
  numericAnswer,
  setNumericAnswer,
  onSubmit,
  onContinue,
}: {
  game: PublicWeddingGame;
  question: PublicGameQuestion;
  busy: boolean;
  feedback: FeedbackState | null;
  numericAnswer: string;
  setNumericAnswer: (value: string) => void;
  onSubmit: (question: PublicGameQuestion, answer: string | number) => Promise<void>;
  onContinue: () => void;
}) {
  return (
    <article className="question-card">
      <div className="question-topline">
        <span>{game.icon} {game.title}</span>
        <span>{question.points} pts</span>
      </div>
      <h2 className="question-prompt">{question.prompt}</h2>
      {question.helper ? <p className="muted">{question.helper}</p> : null}

      {question.type === "numeric" ? (
        <form
          className="numeric-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(question, Number(numericAnswer));
          }}
        >
          <input
            value={numericAnswer}
            onChange={(event) => setNumericAnswer(event.target.value)}
            inputMode="numeric"
            type="number"
            placeholder="Enter your number guess"
            disabled={busy || Boolean(feedback)}
          />
          <button className="primary-button" type="submit" disabled={busy || !numericAnswer || Boolean(feedback)}>
            Lock In
          </button>
        </form>
      ) : (
        <div className="choice-grid">
          {(question.options || []).map((option) => (
            <button
              key={option}
              className="choice-button"
              type="button"
              disabled={busy || Boolean(feedback)}
              onClick={() => onSubmit(question, option)}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {feedback ? (
        <div className="feedback-box">
          <strong>{feedback.message}</strong>
          <span>
            Correct answer: {feedback.correctAnswer}. You earned {feedback.scoreAwarded} point{feedback.scoreAwarded === 1 ? "" : "s"}.
          </span>
          <div className="question-actions">
            <button className="primary-button" type="button" onClick={onContinue}>
              Next Question
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function Leaderboard({ rows, totalPossibleScore }: { rows: LeaderboardRow[]; totalPossibleScore: number }) {
  return (
    <aside className="leaderboard-card">
      <p className="kicker">Live leaderboard</p>
      <h2>Top Players</h2>
      {rows.length ? (
        <div className="leaderboard-list">
          {rows.slice(0, 10).map((row, index) => (
            <div className="leaderboard-row" key={row.playerId}>
              <span className="rank">{index + 1}</span>
              <span>
                <strong>{row.username}</strong>
                <br />
                <small className="muted">{row.answeredCount} answered</small>
              </span>
              <span className="score">{row.totalScore}/{totalPossibleScore}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">No players yet. Be the first to join.</div>
      )}
    </aside>
  );
}
