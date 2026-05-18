import type { GameQuestion, PublicWeddingGame, WeddingGame } from "./types";

const brideName = process.env.BRIDE_NAME || "Tyla";
const groomName = process.env.GROOM_NAME || "Satish";

export const coupleNames = {
  bride: brideName,
  groom: groomName,
  display: process.env.COUPLE_DISPLAY_NAME || `${brideName} & ${groomName}`,
};

export const games: WeddingGame[] = [
  {
    id: "couple-quiz",
    title: "Who Knows the Couple Best?",
    shortTitle: "Couple Quiz",
    icon: "💍",
    description: "Classic multiple-choice questions about the couple.",
    questions: [
      {
        id: "first-date",
        type: "multiple",
        prompt: "Where did the couple have their first official date?",
        options: ["A restaurant", "The movies", "A beach lime", "A family event"],
        correctAnswer: "The movies",
        points: 10,
        explanation: "Edit this answer in src/lib/game-data.ts to match the real story.",
      },
      {
        id: "proposal",
        type: "multiple",
        prompt: "Who planned the proposal surprise?",
        options: [brideName, groomName, "Both of them", "The family"],
        correctAnswer: groomName,
        points: 10,
      },
      {
        id: "food",
        type: "multiple",
        prompt: "What food would the couple most likely order together?",
        options: ["Burger", "Sushi", "Roti", "Pasta"],
        correctAnswer: "Sushi",
        points: 10,
      },
      {
        id: "vacation",
        type: "multiple",
        prompt: "What kind of vacation fits them best?",
        options: ["Adventure trip", "Beach getaway", "City shopping trip", "Quiet mountain retreat"],
        correctAnswer: "Adventure trip",
        points: 10,
      },
      {
        id: "pet-name",
        type: "multiple",
        prompt: "Which pet name is most likely used between them?",
        options: ["Babe", "Love", "Honey", "Bob"],
        correctAnswer: "Bob",
        points: 10,
      },
    ],
  },
  {
    id: "he-said-she-said",
    title: "He Said, She Said",
    shortTitle: "He/She Said",
    icon: "🎤",
    description: "Guess who is more likely to say or do each thing.",
    questions: [
      {
        id: "late",
        type: "who-said",
        prompt: "Who is more likely to say, ‘I am ready’ but still needs 20 more minutes?",
        options: [brideName, groomName, "Both"],
        correctAnswer: brideName,
        points: 10,
      },
      {
        id: "snacks",
        type: "who-said",
        prompt: "Who is more likely to buy snacks and say they are ‘for later’?",
        options: [brideName, groomName, "Both"],
        correctAnswer: "Both",
        points: 10,
      },
      {
        id: "directions",
        type: "who-said",
        prompt: "Who is more likely to insist they know the directions without checking GPS?",
        options: [brideName, groomName, "Both"],
        correctAnswer: brideName,
        points: 10,
      },
      {
        id: "photos",
        type: "who-said",
        prompt: "Who is more likely to ask for ‘one more photo’?",
        options: [brideName, groomName, "Both"],
        correctAnswer: brideName,
        points: 10,
      },
      {
        id: "budget",
        type: "who-said",
        prompt: "Who is more likely to say, ‘Do we really need that?’ while shopping?",
        options: [brideName, groomName, "Both"],
        correctAnswer: "Both",
        points: 10,
      },
    ],
  },
  {
    id: "timeline",
    title: "Love Timeline",
    shortTitle: "Timeline",
    icon: "🗓️",
    description: "Pick the correct order or moment from the couple's story.",
    questions: [
      {
        id: "first-step",
        type: "multiple",
        prompt: "What happened on the first date?",
        options: ["Tyla had an allergic reaction", "Satish spilled a drink", "Got lost on the way"],
        correctAnswer: "Tyla had an allergic reaction",
        points: 10,
      },
      {
        id: "proposal-place",
        type: "multiple",
        prompt: "Where did the proposal happen?",
        options: ["Botanical garden", "At dinner", "On vacation", "At a family gathering", "Satish backyard garden"],
        correctAnswer: "Botanical garden",
        points: 10,
      },
    ],
  },
  {
    id: "closest-guess",
    title: "Closest Guess Wins",
    shortTitle: "Closest Guess",
    icon: "🎯",
    description: "Type a number. Exact answers score full points, close answers get partial points.",
    questions: [
      {
        id: "dates-before-official",
        type: "numeric",
        prompt: "How many dates did they have before becoming official?",
        correctAnswer: 3,
        points: 15,
        tolerance: 2,
      },
      {
        id: "guest-count",
        type: "numeric",
        prompt: "How many guests are celebrating with them today?",
        correctAnswer: 120,
        points: 15,
        tolerance: 30,
      },
      {
        id: "years-known",
        type: "numeric",
        prompt: "How many years have they known each other?",
        correctAnswer: 4,
        points: 15,
        tolerance: 2,
      },
    ],
  },
];

export function getTotalPossibleScore() {
  return games.reduce((total, game) => total + getGameTotalPoints(game.id), 0);
}

export function getGameTotalPoints(gameId: string) {
  const game = games.find((item) => item.id === gameId);
  return game ? game.questions.reduce((sum, question) => sum + question.points, 0) : 0;
}

export function findQuestion(gameId: string, questionId: string): GameQuestion | undefined {
  return games.find((game) => game.id === gameId)?.questions.find((question) => question.id === questionId);
}

export function getPublicGames(): PublicWeddingGame[] {
  return games.map((game) => ({
    ...game,
    totalPoints: getGameTotalPoints(game.id),
    questions: game.questions.map(({ correctAnswer: _correctAnswer, ...question }) => question),
  }));
}
