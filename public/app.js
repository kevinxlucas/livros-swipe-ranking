import {
  DEFAULT_BOOKS,
  addBook,
  chooseWinner,
  createInitialState,
  getNextPair,
  getRankings,
  isReadyToFinish,
  resetScores,
} from './ranker.mjs';

const STORAGE_KEY = 'livros-swipe-ranking:v1';
const app = document.querySelector('#app');
let mode = 'duel';
let state = loadState();

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed.books) && parsed.books.length) {
        if (!parsed.currentPair) parsed.currentPair = getNextPair(parsed);
        return parsed;
      }
    }
  } catch (error) {
    console.warn('Estado local inválido, a reiniciar.', error);
  }
  const initial = createInitialState(DEFAULT_BOOKS);
  initial.currentPair = getNextPair(initial);
  return initial;
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.__LIVROS_STATE__ = state;
}

function bookById(id) {
  return state.books.find((book) => book.id === id);
}

function comparedCount() {
  return state.battles.filter((battle) => !battle.skipped).length;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function render() {
  save();
  const rankings = getRankings(state);
  const leader = rankings[0];
  const runnerUp = rankings[1];
  const progress = Math.min(100, Math.round((comparedCount() / Math.max(1, state.targetComparisons)) * 100));
  const confidence = runnerUp ? Math.max(0, Math.min(100, Math.round((leader.rating - runnerUp.rating) * 1.7))) : 100;

  app.innerHTML = `
    <section class="hero">
      <div>
        <p class="eyebrow">Swipe literário</p>
        <h1>Duelo de Livros</h1>
        <p class="subtitle">Escolhe entre dois livros, como uma app de dating. Eu vou recalculando o ranking até ficar claro qual é o teu favorito.</p>
      </div>
      <div class="leader-card" aria-label="Favorito atual">
        <span>Favorito atual</span>
        <strong>${escapeHtml(leader?.title || 'Ainda sem líder')}</strong>
        <small>${leader ? `${Math.round(leader.rating)} pts · ${leader.wins} vitórias` : 'Começa o primeiro duelo'}</small>
      </div>
    </section>

    <nav class="tabs" aria-label="Navegação">
      <button class="tab ${mode === 'duel' ? 'active' : ''}" data-mode="duel">Duelos</button>
      <button class="tab ${mode === 'results' ? 'active' : ''}" data-mode="results">Quadro de resultados</button>
      <button class="tab ${mode === 'add' ? 'active' : ''}" data-mode="add">Adicionar livros</button>
    </nav>

    <section class="status-grid">
      <article><strong>${comparedCount()}</strong><span>duelos feitos</span></article>
      <article><strong>${state.books.length}</strong><span>livros na lista</span></article>
      <article><strong>${progress}%</strong><span>progresso sugerido</span></article>
      <article><strong>${confidence}%</strong><span>clareza do líder</span></article>
    </section>

    ${mode === 'duel' ? renderDuel() : ''}
    ${mode === 'results' ? renderResults(rankings) : ''}
    ${mode === 'add' ? renderAddBook() : ''}
  `;

  bindEvents();
}

function renderDuel() {
  const pair = state.currentPair || getNextPair(state);
  state.currentPair = pair;
  if (!pair) {
    return `<section class="panel empty"><h2>Adiciona pelo menos dois livros.</h2>${renderAddBook(true)}</section>`;
  }
  const left = bookById(pair[0]);
  const right = bookById(pair[1]);
  const ready = isReadyToFinish(state);
  return `
    <section class="duel-panel">
      <div class="duel-header">
        <div>
          <p class="eyebrow">Duelo ${comparedCount() + 1}</p>
          <h2>Qual destes te chama mais?</h2>
        </div>
        <div class="progress-wrap" title="Progresso sugerido">
          <div class="progress-bar"><span style="width:${Math.min(100, Math.round((comparedCount() / Math.max(1, state.targetComparisons)) * 100))}%"></span></div>
          <small>${comparedCount()} / ${state.targetComparisons} duelos sugeridos</small>
        </div>
      </div>

      <div class="duel-zone" id="duelZone">
        ${renderBookCard(left, 'left')}
        <div class="versus">ou</div>
        ${renderBookCard(right, 'right')}
      </div>

      <div class="action-row">
        <button class="ghost" id="switchPair">Trocar duelo</button>
        <button class="primary" id="finishNow">${ready ? 'Ver vencedor final' : 'Terminar e ver resultados'}</button>
      </div>
      <p class="hint">Dica: toca num cartão, usa ←/→, ou faz swipe para o lado do livro escolhido.</p>
    </section>
  `;
}

function renderBookCard(book, side) {
  return `
    <button class="book-card ${side}" data-pick="${escapeHtml(book.id)}" aria-label="Escolher ${escapeHtml(book.title)}">
      <span class="card-tag">${side === 'left' ? '← escolha esquerda' : 'escolha direita →'}</span>
      <h3>${escapeHtml(book.title)}</h3>
      <p>${escapeHtml(book.author || 'Autor por preencher')}</p>
      ${book.note ? `<small>${escapeHtml(book.note)}</small>` : ''}
      <span class="choose-pill">Escolho este</span>
    </button>
  `;
}

function renderResults(rankings) {
  const winner = rankings[0];
  return `
    <section class="panel results-panel">
      <div class="results-header">
        <div>
          <p class="eyebrow">Resultado</p>
          <h2>${winner ? `#1 ${escapeHtml(winner.title)}` : 'Ainda sem resultados'}</h2>
          <p>${winner ? `${escapeHtml(winner.author)} · ${winner.wins} vitórias em ${winner.matches} duelos.` : 'Faz pelo menos um duelo.'}</p>
        </div>
        <div class="result-actions">
          <button class="ghost" id="backToDuel">Continuar duelos</button>
          <button class="danger" id="resetScores">Recomeçar pontuações</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Livro</th>
              <th>Autor</th>
              <th>Pts</th>
              <th>V-D</th>
              <th>% vitórias</th>
            </tr>
          </thead>
          <tbody>
            ${rankings.map((book) => `
              <tr class="${book.position === 1 ? 'winner-row' : ''}">
                <td>${book.position}</td>
                <td><strong>${escapeHtml(book.title)}</strong>${book.note ? `<br><small>${escapeHtml(book.note)}</small>` : ''}</td>
                <td>${escapeHtml(book.author || '—')}</td>
                <td>${Math.round(book.rating)}</td>
                <td>${book.wins}-${book.losses}</td>
                <td>${Math.round(book.winRate * 100)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <details class="history">
        <summary>Histórico dos últimos duelos</summary>
        <ol>
          ${state.battles.slice(-12).reverse().map((battle) => {
            const winner = bookById(battle.winnerId);
            const loser = bookById(battle.loserId);
            return `<li><strong>${escapeHtml(winner?.title || '—')}</strong> venceu ${escapeHtml(loser?.title || '—')}</li>`;
          }).join('') || '<li>Ainda não há duelos.</li>'}
        </ol>
      </details>
      ${renderAddBook(true)}
    </section>
  `;
}

function renderAddBook(compact = false) {
  return `
    <section class="panel add-panel ${compact ? 'compact' : ''}">
      <div>
        <p class="eyebrow">Expandir lista</p>
        <h2>Adicionar livro</h2>
        <p>Os livros novos entram com pontuação neutra e começam a aparecer nos duelos seguintes.</p>
      </div>
      <form id="addBookForm" class="add-form">
        <label>Título<input name="title" autocomplete="off" placeholder="Ex.: A Náusea" required /></label>
        <label>Autor<input name="author" autocomplete="off" placeholder="Ex.: Sartre" /></label>
        <label>Nota opcional<input name="note" autocomplete="off" placeholder="Ex.: Reli, parei a meio..." /></label>
        <button class="primary" type="submit">Adicionar à lista</button>
      </form>
    </section>
  `;
}

function bindEvents() {
  document.querySelectorAll('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      mode = button.dataset.mode;
      render();
    });
  });

  document.querySelectorAll('[data-pick]').forEach((button) => {
    button.addEventListener('click', () => pick(button.dataset.pick));
  });

  document.querySelector('#switchPair')?.addEventListener('click', () => {
    state = { ...state, currentPair: getNextPair(state), updatedAt: new Date().toISOString() };
    render();
  });

  document.querySelector('#finishNow')?.addEventListener('click', () => {
    state = { ...state, finished: true, updatedAt: new Date().toISOString() };
    mode = 'results';
    render();
  });

  document.querySelector('#backToDuel')?.addEventListener('click', () => {
    state = { ...state, finished: false, currentPair: state.currentPair || getNextPair(state) };
    mode = 'duel';
    render();
  });

  document.querySelector('#resetScores')?.addEventListener('click', () => {
    if (confirm('Recomeçar pontuações e histórico de duelos? A lista de livros fica guardada.')) {
      state = resetScores(state);
      mode = 'duel';
      render();
    }
  });

  document.querySelector('#addBookForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      state = addBook(state, {
        title: form.get('title'),
        author: form.get('author'),
        note: form.get('note'),
      });
      mode = 'duel';
      render();
    } catch (error) {
      alert(error.message);
    }
  });

  let startX = null;
  const duelZone = document.querySelector('#duelZone');
  duelZone?.addEventListener('pointerdown', (event) => {
    startX = event.clientX;
  });
  duelZone?.addEventListener('pointerup', (event) => {
    if (startX === null) return;
    const delta = event.clientX - startX;
    startX = null;
    if (Math.abs(delta) > 90 && state.currentPair) {
      pick(delta < 0 ? state.currentPair[0] : state.currentPair[1]);
    }
  });
}

function pick(winnerId) {
  const pair = state.currentPair || getNextPair(state);
  if (!pair || !pair.includes(winnerId)) return;
  const loserId = pair.find((id) => id !== winnerId);
  state.currentPair = pair;
  state = chooseWinner(state, winnerId, loserId);
  mode = state.finished ? 'results' : 'duel';
  render();
}

window.addEventListener('keydown', (event) => {
  if (!state.currentPair || mode !== 'duel') return;
  if (event.key === 'ArrowLeft') pick(state.currentPair[0]);
  if (event.key === 'ArrowRight') pick(state.currentPair[1]);
});

render();
