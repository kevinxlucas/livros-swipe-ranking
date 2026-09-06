import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addBook,
  chooseWinner,
  createInitialState,
  getNextPair,
  getRankings,
  isReadyToFinish,
} from './ranker.mjs';

test('cria estado inicial com os livros fornecidos', () => {
  const state = createInitialState([
    { title: 'A', author: 'Autor A' },
    { title: 'B', author: 'Autor B' },
  ]);
  assert.equal(state.books.length, 2);
  assert.equal(state.books[0].rating, 1500);
  assert.equal(state.finished, false);
});

test('gera um par válido para duelo', () => {
  const state = createInitialState([
    { title: 'A', author: 'Autor A' },
    { title: 'B', author: 'Autor B' },
    { title: 'C', author: 'Autor C' },
  ]);
  const pair = getNextPair(state, () => 0);
  assert.equal(pair.length, 2);
  assert.notEqual(pair[0], pair[1]);
  assert.ok(state.books.some((book) => book.id === pair[0]));
  assert.ok(state.books.some((book) => book.id === pair[1]));
});

test('escolher vencedor atualiza pontuação, vitórias e ranking', () => {
  let state = createInitialState([
    { title: 'A', author: 'Autor A' },
    { title: 'B', author: 'Autor B' },
  ]);
  state.currentPair = [state.books[0].id, state.books[1].id];
  state = chooseWinner(state, state.books[0].id, state.books[1].id);
  const rankings = getRankings(state);
  assert.equal(rankings[0].title, 'A');
  assert.equal(rankings[0].wins, 1);
  assert.equal(rankings[1].losses, 1);
  assert.ok(rankings[0].rating > rankings[1].rating);
  assert.equal(state.battles.length, 1);
});

test('adicionar livro rejeita duplicados e reinicia duelos', () => {
  let state = createInitialState([{ title: 'A', author: 'Autor A' }, { title: 'B', author: 'Autor B' }]);
  state = addBook(state, { title: 'C', author: 'Autor C' });
  assert.equal(state.books.length, 3);
  assert.equal(state.finished, false);
  assert.throws(() => addBook(state, { title: 'C', author: 'Outro' }), /já está/);
});

test('consegue chegar a estado pronto para terminar depois de vitórias consistentes', () => {
  let state = createInitialState([
    { title: 'Favorito', author: 'X' },
    { title: 'Rival 1', author: 'Y' },
    { title: 'Rival 2', author: 'Z' },
  ]);
  const favorite = state.books[0].id;
  for (let i = 0; i < 14; i += 1) {
    const loser = state.books[(i % 2) + 1].id;
    state.currentPair = [favorite, loser];
    state = chooseWinner(state, favorite, loser);
  }
  assert.equal(isReadyToFinish(state), true);
});
