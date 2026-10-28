// Guarda na memória tudo o que o app mostra e mantém atualizado em tempo real.
import { db, onSnapshot, collection, doc, setDoc, query, orderBy, limit, where } from './firebase.js';

export const estado = {
  uid: null,
  email: '',
  nomeSugerido: '',
  perfil: undefined, // undefined = ainda carregando | null = não existe | objeto = existe
  criandoConta: false,
  treinos: [],
  regras: [],
  dietaItens: [],     // a lista fixa da dieta (por refeição)
  sessoes: [],
  peso: [],
  checks: [],
  agua: [],
  medidas: [],
  vinculo: null,      // se tenho um personal: { personalUid, personalNome, ... }
  vinculoCarregado: false, // true depois que o app já soube se tem personal ou não
  metasConfig: null,  // metas definidas pelo meu personal
  recados: [],
  alunos: [],         // (para personal) vínculos dos meus alunos
  modelos: [],        // (para personal) modelos de treino
  alimentos: [],      // meus alimentos (biblioteca)
  refeicoes: [],      // o que comi, por dia
  assinatura: undefined,         // minha assinatura (undefined = carregando | null = não existe)
  assinaturaPersonal: undefined  // assinatura do meu personal (se eu tiver um)
};

let paradores = [];
let paradorPersonal = null;
let personalOuvido = null;

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
  ouvir('dietaItens', 'dietaItens', [orderBy('ordem', 'asc')]);
  ouvir('sessoes', 'sessoes', [orderBy('data', 'desc'), limit(400)]);
  ouvir('peso', 'peso', [orderBy('data', 'desc'), limit(400)]);
  ouvir('checks', 'checks', [orderBy('data', 'desc'), limit(60)]);
  ouvir('agua', 'agua', [orderBy('data', 'desc'), limit(120)]);
  ouvir('medidas', 'medidas', [orderBy('data', 'desc'), limit(120)]);
  ouvir('recados', 'recados', [orderBy('criadoEm', 'desc'), limit(40)]);
  ouvir('modelos', 'modelos', [orderBy('ordem', 'asc')]);
  ouvir('alimentos', 'alimentos', [orderBy('nome', 'asc')]);
  ouvir('refeicoes', 'refeicoes', [orderBy('data', 'desc'), limit(60)]);

  // Meu vínculo com um personal (o documento tem o meu próprio código de usuário como nome).
  paradores.push(onSnapshot(doc(db, 'vinculos', uid), (snap) => {
    estado.vinculo = snap.exists() ? { ...snap.data() } : null;
    estado.vinculoCarregado = true;
    ouvirAssinaturaDoPersonal(estado.vinculo ? estado.vinculo.personalUid : null, aoMudar);
    aoMudar('vinculo');
  }, (e) => console.error(e)));
  paradores.push(onSnapshot(doc(db, 'usuarios', uid, 'config', 'metas'), (snap) => {
    estado.metasConfig = snap.exists() ? { ...snap.data() } : null;
    aoMudar('metasConfig');
  }, (e) => console.error(e)));
  // Minha assinatura. Conta nova ganha 15 dias grátis (as regras só deixam criar um teste de até 16 dias).
  let criouTeste = false;
  paradores.push(onSnapshot(doc(db, 'assinaturas', uid), (snap) => {
    if (snap.exists()) {
      estado.assinatura = { ...snap.data() };
    } else if (snap.metadata && snap.metadata.fromCache) {
      return;
    } else {
      estado.assinatura = null;
      if (!criouTeste) {
        criouTeste = true;
        setDoc(doc(db, 'assinaturas', uid), { plano: 'teste', ate: new Date(Date.now() + 15 * 86400000), criadoEm: new Date().toISOString() })
          .catch((e) => { console.error(e); estado.assinatura = { plano: 'teste', ate: 0 }; aoMudar('assinatura'); });
      }
    }
    aoMudar('assinatura');
  }, (e) => console.error(e)));
  // Meus alunos (só aparece algo se eu for personal de alguém).
  paradores.push(onSnapshot(query(collection(db, 'vinculos'), where('personalUid', '==', uid)), (snap) => {
    estado.alunos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    aoMudar('alunos');
  }, (e) => console.error(e)));
}

function ouvirAssinaturaDoPersonal(personalUid, aoMudar) {
  if (personalUid === personalOuvido) return;
  if (paradorPersonal) { paradorPersonal(); paradorPersonal = null; }
  personalOuvido = personalUid;
  estado.assinaturaPersonal = undefined;
  if (!personalUid) return;
  paradorPersonal = onSnapshot(doc(db, 'assinaturas', personalUid), (snap) => {
    if (!snap.exists() && snap.metadata && snap.metadata.fromCache) return;
    estado.assinaturaPersonal = snap.exists() ? { ...snap.data() } : null;
    aoMudar('assinaturaPersonal');
  }, (e) => { console.error(e); estado.assinaturaPersonal = null; aoMudar('assinaturaPersonal'); });
}

export function pararDados() {
  if (paradorPersonal) { paradorPersonal(); paradorPersonal = null; }
  personalOuvido = null;
  paradores.forEach((p) => p());
  paradores = [];
  estado.uid = null;
  estado.email = '';
  estado.nomeSugerido = '';
  estado.perfil = undefined;
  estado.treinos = [];
  estado.regras = [];
  estado.dietaItens = [];
  estado.sessoes = [];
  estado.peso = [];
  estado.checks = [];
  estado.agua = [];
  estado.medidas = [];
  estado.vinculo = null;
  estado.vinculoCarregado = false;
  estado.metasConfig = null;
  estado.recados = [];
  estado.alunos = [];
  estado.modelos = [];
  estado.alimentos = [];
  estado.refeicoes = [];
  estado.assinatura = undefined;
  estado.assinaturaPersonal = undefined;
}

// A dieta só é liberada para quem tem personal (ou é personal). Enquanto o app ainda não sabe, não tranca.
export function dietaLiberada() {
  if (!estado.vinculoCarregado || !estado.perfil) return true;
  return !!estado.vinculo || estado.perfil.papel === 'personal';
}
