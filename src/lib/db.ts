import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { AnswerState, LeaderboardRow } from "@/lib/types";

export interface PlayerRecord {
  id: string;
  username: string;
  createdAt: string;
}

export interface AnswerRecord {
  id: string;
  playerId: string;
  gameId: string;
  questionId: string;
  answer: string;
  scoreAwarded: number;
  isCorrect: boolean;
  createdAt: string;
}

interface StoreShape {
  players: PlayerRecord[];
  answers: AnswerRecord[];
}

declare global {
  // eslint-disable-next-line no-var
  var __weddingGamesStore: StoreShape | undefined;
}

const emptyStore = (): StoreShape => ({
  players: [],
  answers: [],
});

function normalizeStore(parsed: Partial<StoreShape> | null | undefined): StoreShape {
  return {
    players: Array.isArray(parsed?.players) ? parsed.players.filter((player) => player?.id && player?.username) : [],
    answers: Array.isArray(parsed?.answers) ? parsed.answers.filter((answer) => answer?.playerId && answer?.questionId) : [],
  };
}

function newId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function cleanUsername(username: string) {
  return username.trim().replace(/\s+/g, " ").slice(0, 32);
}

const getStorePath = () => {
  const configuredPath = process.env.DB_PATH || path.join(process.cwd(), "data", "wedding-games.json");
  return configuredPath.endsWith(".sqlite") ? configuredPath.replace(/\.sqlite$/i, ".json") : configuredPath;
};

function shouldUseMemoryStore() {
  return Boolean(process.env.VERCEL) || process.env.STORAGE_MODE === "memory";
}

function getMemoryStore(): StoreShape {
  globalThis.__weddingGamesStore ??= emptyStore();
  return globalThis.__weddingGamesStore;
}

function ensureStoreFile() {
  const storePath = getStorePath();
  fs.mkdirSync(path.dirname(storePath), { recursive: true });

  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify(emptyStore(), null, 2));
  }

  return storePath;
}

function readLocalStore(): StoreShape {
  const storePath = ensureStoreFile();

  try {
    const parsed = JSON.parse(fs.readFileSync(storePath, "utf8")) as Partial<StoreShape>;
    return normalizeStore(parsed);
  } catch {
    const backupPath = `${storePath}.broken-${Date.now()}`;
    fs.renameSync(storePath, backupPath);
    const fresh = emptyStore();
    writeLocalStore(fresh);
    return fresh;
  }
}

function writeLocalStore(store: StoreShape) {
  const storePath = ensureStoreFile();
  const tempPath = `${storePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(store, null, 2));
  fs.renameSync(tempPath, storePath);
}

async function readStore(): Promise<StoreShape> {
  return shouldUseMemoryStore() ? getMemoryStore() : readLocalStore();
}

async function writeStore(store: StoreShape) {
  if (shouldUseMemoryStore()) {
    globalThis.__weddingGamesStore = store;
    return;
  }

  writeLocalStore(store);
}

export function serializeAnswer(answer: unknown) {
  if (typeof answer === "string") return answer.trim();
  if (typeof answer === "number") return String(answer);
  return JSON.stringify(answer ?? "");
}

export function getStorageMode() {
  if (process.env.VERCEL) return "vercel-server-memory";
  if (process.env.STORAGE_MODE === "memory") return "server-memory";
  return "local-json";
}

export async function findPlayerById(playerId: string) {
  return (await readStore()).players.find((player) => player.id === playerId) || null;
}

export async function ensurePlayer(playerId: string, username: string) {
  const store = await readStore();
  const existing = store.players.find((player) => player.id === playerId);
  if (existing) return existing;

  const normalizedUsername = cleanUsername(username) || "Guest";
  const player: PlayerRecord = {
    id: playerId,
    username: normalizedUsername,
    createdAt: new Date().toISOString(),
  };

  store.players.push(player);
  await writeStore(store);
  return player;
}

export async function createOrFindPlayer(username: string) {
  const store = await readStore();
  const normalizedUsername = cleanUsername(username);
  const existing = store.players.find((player) => player.username.toLowerCase() === normalizedUsername.toLowerCase());

  if (existing) {
    return { player: existing, existing: true };
  }

  const player: PlayerRecord = {
    id: newId(),
    username: normalizedUsername,
    createdAt: new Date().toISOString(),
  };

  store.players.push(player);
  await writeStore(store);

  return { player, existing: false };
}

export async function getExistingAnswer(playerId: string, gameId: string, questionId: string) {
  return (
    (await readStore()).answers.find(
      (answer) => answer.playerId === playerId && answer.gameId === gameId && answer.questionId === questionId
    ) || null
  );
}

export async function saveAnswer(input: Omit<AnswerRecord, "id" | "createdAt">) {
  const store = await readStore();
  const duplicate = store.answers.find(
    (answer) =>
      answer.playerId === input.playerId && answer.gameId === input.gameId && answer.questionId === input.questionId
  );

  if (duplicate) return duplicate;

  const record: AnswerRecord = {
    ...input,
    id: newId(),
    createdAt: new Date().toISOString(),
  };

  store.answers.push(record);
  await writeStore(store);

  return record;
}

export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  const store = await readStore();

  return store.players
    .map((player) => {
      const answers = store.answers.filter((answer) => answer.playerId === player.id);
      const totalScore = answers.reduce((sum, answer) => sum + answer.scoreAwarded, 0);
      const lastAnswerAt = answers.reduce<string | null>((latest, answer) => {
        if (!latest || answer.createdAt > latest) return answer.createdAt;
        return latest;
      }, null);

      return {
        playerId: player.id,
        username: player.username,
        totalScore,
        answeredCount: answers.length,
        lastAnswerAt,
      } satisfies LeaderboardRow;
    })
    .sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.answeredCount !== a.answeredCount) return b.answeredCount - a.answeredCount;

      const playerA = store.players.find((player) => player.id === a.playerId);
      const playerB = store.players.find((player) => player.id === b.playerId);
      return String(playerA?.createdAt || "").localeCompare(String(playerB?.createdAt || ""));
    })
    .slice(0, 100);
}

export async function getAnswersForPlayer(playerId: string): Promise<AnswerState[]> {
  return (await readStore())
    .answers.filter((answer) => answer.playerId === playerId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((answer) => ({
      gameId: answer.gameId,
      questionId: answer.questionId,
      answer: answer.answer,
      scoreAwarded: answer.scoreAwarded,
      isCorrect: answer.isCorrect,
      answeredAt: answer.createdAt,
    }));
}

export async function resetPlayerAnswers(playerId: string) {
  const store = await readStore();
  store.answers = store.answers.filter((answer) => answer.playerId !== playerId);
  await writeStore(store);
}

export async function resetAllScores() {
  await writeStore(emptyStore());
}
