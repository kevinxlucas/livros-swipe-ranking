export const DEFAULT_BOOKS = [
  { title: 'Fome', author: 'Knut Hamsun' },
  { title: 'Vigiar e Punir', author: 'Michel Foucault' },
  { title: 'Siddhartha', author: 'Hermann Hesse' },
  { title: 'Ensaio sobre a Cegueira', author: 'José Saramago' },
  { title: 'Jerusalém', author: 'Gonçalo M. Tavares' },
  { title: 'A Montanha Mágica', author: 'Thomas Mann' },
  { title: 'O Estrangeiro', author: 'Albert Camus' },
  { title: 'Noites Brancas', author: 'Fiódor Dostoiévski' },
  { title: 'Pequenas Coisas Como Estas', author: 'Claire Keegan' },
  { title: 'O Velho e o Mar', author: 'Ernest Hemingway' },
  { title: 'Livro do Desassossego', author: 'Fernando Pessoa' },
  { title: 'As Famosas Lâmpadas do Cidadão Zero', author: 'Amílcar Augusto' },
  { title: 'O Médico e o Monstro', author: 'Robert Louis Stevenson', note: 'Parei 30%' },
  { title: 'Cândido', author: 'Voltaire' },
  { title: 'O Mapa e o Território', author: 'Michel Houellebecq' },
  { title: 'Eu Que Nunca Conheci os Homens', author: 'Jacqueline Harpman' },
  { title: 'Cem Anos de Solidão', author: 'Gabriel García Márquez' },
  { title: 'A Volta ao Mundo em 80 Dias', author: 'Júlio Verne' },
];

export function slugify(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || `livro-${Date.now()}`;
}

export function makeBook(input, existingIds = new Set()) {
  const title = String(input.title || '').trim();
  const author = String(input.author || '').trim();
  if (!title) throw new Error('O título é obrigatório.');
  let base = slugify(`${title}-${author || 'autor'}`);
  let id = base;
  let index = 2;
  while (existingIds.has(id)) id = `${base}-${index++}`;
  return {
    id,
    title,
    author,
    note: String(input.note || '').trim(),
    rating: 1500,
    wins: 0,
    losses: 0,
    matches: 0,
    active: true,
    createdAt: new Date().toISOString(),
  };
}

export function createInitialState(seedBooks = DEFAULT_BOOKS) {
  const ids = new Set();
  const books = seedBooks.map((book) => {
    const made = makeBook(book, ids);
    ids.add(made.id);
    return made;
  });
  return {
    version: 1,
    books,
    battles: [],
    currentPair: null,
    finished: false,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    targetComparisons: recommendedTarget(books.length),
  };
}

export function recommendedTarget(count) {
  if (count < 2) return 0;
  return Math.max(18, Math.ceil(count * 2.5));
}

export function pairKey(a, b) {
  return [a, b].sort().join('::');
}

export function pairCounts(state) {
  const counts = new Map();
  for (const battle of state.battles) {
    if (!battle.skipped) counts.set(battle.key, (counts.get(battle.key) || 0) + 1);
  }
  return counts;
}

export function getRankings(state) {
  return [...state.books]
    .filter((book) => book.active !== false)
    .sort((a, b) => {
      const byRating = b.rating - a.rating;
      if (Math.abs(byRating) > 0.001) return byRating;
      const byWins = b.wins - a.wins;
      if (byWins) return byWins;
      return a.losses - b.losses;
    })
    .map((book, index) => ({
      ...book,
      position: index + 1,
      winRate: book.matches ? book.wins / book.matches : 0,
    }));
}

export function isReadyToFinish(state) {
  const active = state.books.filter((book) => book.active !== false);
  if (active.length < 2) return true;
  const rankings = getRankings(state);
  const leader = rankings[0];
  const runnerUp = rankings[1];
  const minimumComparisons = Math.min(state.targetComparisons, Math.max(12, active.length));
  const hasEnoughEvidence = state.battles.filter((b) => !b.skipped).length >= minimumComparisons;
  const leaderSeen = leader.matches >= Math.min(6, active.length - 1);
  const ratingGap = leader.rating - runnerUp.rating;
  return hasEnoughEvidence && leaderSeen && ratingGap >= 45;
}

export function getNextPair(state, rng = Math.random) {
  const active = state.books.filter((book) => book.active !== false);
  if (active.length < 2) return null;

  const counts = pairCounts(state);
  const candidates = [];
  for (let i = 0; i < active.length; i += 1) {
    for (let j = i + 1; j < active.length; j += 1) {
      const a = active[i];
      const b = active[j];
      const seen = counts.get(pairKey(a.id, b.id)) || 0;
      const balancePenalty = (a.matches + b.matches) * 2;
      const closeness = Math.abs(a.rating - b.rating) / 30;
      const leaderProbe = Math.min(a.matches, b.matches) === 0 ? -8 : 0;
      candidates.push({ a, b, score: seen * 1000 + balancePenalty + closeness + leaderProbe });
    }
  }
  candidates.sort((x, y) => x.score - y.score);
  const pool = candidates.slice(0, Math.min(8, candidates.length));
  const selected = pool[Math.floor(rng() * pool.length)] || candidates[0];
  return rng() > 0.5 ? [selected.a.id, selected.b.id] : [selected.b.id, selected.a.id];
}

export function expectedScore(ratingA, ratingB) {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

export function chooseWinner(state, winnerId, loserId) {
  if (winnerId === loserId) throw new Error('Escolhe dois livros diferentes.');
  const next = structuredClone(state);
  const winner = next.books.find((book) => book.id === winnerId);
  const loser = next.books.find((book) => book.id === loserId);
  if (!winner || !loser) throw new Error('Livro não encontrado.');

  const k = 36;
  const expectedWinner = expectedScore(winner.rating, loser.rating);
  const expectedLoser = expectedScore(loser.rating, winner.rating);
  winner.rating = Math.round((winner.rating + k * (1 - expectedWinner)) * 10) / 10;
  loser.rating = Math.round((loser.rating + k * (0 - expectedLoser)) * 10) / 10;
  winner.wins += 1;
  winner.matches += 1;
  loser.losses += 1;
  loser.matches += 1;

  next.battles.push({
    key: pairKey(winner.id, loser.id),
    leftId: state.currentPair?.[0] || winner.id,
    rightId: state.currentPair?.[1] || loser.id,
    winnerId,
    loserId,
    at: new Date().toISOString(),
  });
  next.currentPair = getNextPair(next);
  next.finished = isReadyToFinish(next);
  next.updatedAt = new Date().toISOString();
  return next;
}

export function addBook(state, input) {
  const next = structuredClone(state);
  const existingIds = new Set(next.books.map((book) => book.id));
  const normalized = String(input.title || '').trim().toLocaleLowerCase('pt-PT');
  const duplicate = next.books.find((book) => book.title.trim().toLocaleLowerCase('pt-PT') === normalized);
  if (duplicate) throw new Error('Esse livro já está na lista.');
  const book = makeBook(input, existingIds);
  next.books.push(book);
  next.targetComparisons = recommendedTarget(next.books.filter((item) => item.active !== false).length);
  next.currentPair = getNextPair(next);
  next.finished = false;
  next.updatedAt = new Date().toISOString();
  return next;
}

export function resetScores(state) {
  const next = structuredClone(state);
  next.books = next.books.map((book) => ({ ...book, rating: 1500, wins: 0, losses: 0, matches: 0 }));
  next.battles = [];
  next.finished = false;
  next.currentPair = getNextPair(next);
  next.startedAt = new Date().toISOString();
  next.updatedAt = new Date().toISOString();
  return next;
}
