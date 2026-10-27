// Guarda na memória tudo o que o app mostra e mantém atualizado em tempo real.
import { db, onSnapshot, collection, doc, query, orderBy, limit } from './firebase.js';

export const estado = {
  uid: null,
  email: '',
  perfil: undefined, // undefined = ainda carregando | null = não existe | objeto = existe
  criandoConta: false,
  treinos: [],
  regras: [],
  sessoes: [],
  peso: [],
  checks: []
};

let paradores = [];

export function iniciarDados(uid, email, aoMudar) {
  pararDados();
  estado.uid = uid;
  estado.email = email || '';
  estado.perfil = undefined;

  // Se o servidor demorar, depois de 4 segundos assume que o perfil não existe.
  const espera = setTimeout(() => {
    if (estado.perfil === undefined) { estado.perfil = null; aoMudar('perfil'); }
  }, 4000);
  paradores.push(() => clearTimeout(espera));

  paradores.push(onSnapshot(doc(db, 'usuarios', uid), (snap) => {
    if (snap.exists()) {
      estado.perfil = { ...snap.data() };
    } else if (snap.metadata && snap.metadata.fromCache) {
      return; // ainda esperando a resposta do servidor
    } else {
      estado.perfil = null;
    }
    clearTimeout(espera);
    aoMudar('perfil');
  }, (e) => console.error(e)));

  const ouvir = (sub, campo, restricoes) => {
    const q = query(collection(db, 'usuarios', uid, sub), ...restricoes);
    paradores.push(onSnapshot(q, (snap) => {
      estado[campo] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      aoMudar(campo);
    }, (e) => console.error(e)));
  };

  ouvir('treinos', 'treinos', [orderBy('ordem', 'asc')]);
  ouvir('regras', 'regras', [orderBy('ordem', 'asc')]);
  ouvir('sessoes', 'sessoes', [orderBy('data', 'desc'), limit(400)]);
  ouvir('peso', 'peso', [orderBy('data', 'desc'), limit(400)]);
  ouvir('checks', 'checks', [orderBy('data', 'desc'), limit(60)]);
}

export function pararDados() {
  paradores.forEach((p) => p());
  paradores = [];
  estado.uid = null;
  estado.email = '';
  estado.perfil = undefined;
  estado.treinos = [];
  estado.regras = [];
  estado.sessoes = [];
  estado.peso = [];
  estado.checks = [];
}
