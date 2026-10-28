// Ajuda, boas-vindas e contato do suporte.
import { estado } from './estado.js';
import { abrirFolha } from './folha.js';
import { escaparHtml } from './util.js';
import { salvarPerfil } from './dados.js';

// Preencha para aparecer o botão "Falar com o suporte" (deixe vazio para esconder).
export const SUPORTE_EMAIL = '';
export const SUPORTE_WHATSAPP = ''; // só números com DDD, ex.: 5511999999999

export const temSuporte = () => !!(SUPORTE_EMAIL || SUPORTE_WHATSAPP);

export function linkSuporte() {
  if (SUPORTE_WHATSAPP) return `https://wa.me/${encodeURIComponent(SUPORTE_WHATSAPP)}`;
  if (SUPORTE_EMAIL) return `mailto:${SUPORTE_EMAIL}`;
  return '';
}

const topico = (titulo, corpo) => `<details class="topico"><summary>${titulo}</summary><div class="topico-corpo">${corpo}</div></details>`;

export function abrirAjuda() {
  const personal = estado.perfil && estado.perfil.papel === 'personal';
  const html = `
    <h2>Ajuda</h2>
    <p class="mudo peq">Toque em um assunto para abrir.</p>
    ${topico('Como o app funciona', '<p>O app tem 4 abas: <b>Hoje</b> (o que fazer agora), <b>Treinos</b> (seus treinos), <b>Dieta</b> (regras e alimentos) e <b>Progresso</b> (gráficos e histórico). Em <b>Perfil</b> ficam suas metas, backup e conta.' + (personal ? ' Como você é personal, também tem a aba <b>Alunos</b>.' : '') + '</p>')}
    ${topico('Fazer um treino', '<p>Na aba <b>Hoje</b>, toque em <b>Começar</b> no treino do dia. Marque cada série como feita, digite a carga e as repetições. O descanso começa sozinho. No fim, toque em <b>Finalizar</b>.</p><p>Toque no número da série para marcar <b>A</b> (aquecimento, não conta no volume), <b>D</b> (drop) ou <b>F</b> (falha). O botão <b>?</b> ao lado do nome do exercício mostra como fazer.</p>')}
    ${topico('Montar treino e dieta', '<p>Em <b>Treinos</b>, toque em <b>Novo treino</b>, escolha os dias e adicione os exercícios (as sugestões aparecem enquanto você digita). Em <b>Dieta</b>, crie regras por horário e cadastre seus alimentos para anotar as calorias.</p><p>Se você tem um personal, ele monta seu treino e sua dieta, e você só executa.</p>')}
    ${topico('Calorias, água e metas', '<p>Na aba <b>Hoje</b> você anota a água e o que comeu. As metas (volume, água, peso, calorias) ficam em <b>Perfil → Minhas metas</b>. Se você tem personal, ele define as suas metas.</p>')}
    ${topico('Progresso e fotos', '<p>Em <b>Progresso</b> você vê treinos da semana, volume levantado, peso, medidas, calorias e conquistas. As fotos do corpo ficam guardadas só para você, a não ser que escolha compartilhar com seu personal.</p>')}
    ${topico('Conectar com um personal', '<p>Peça o código de 8 letras ao seu personal e digite em <b>Perfil → Tenho um código de personal</b>. Para se desligar, use o mesmo lugar. Seus dados ficam com você.</p>')}
    ${personal ? topico('Para personal: convidar alunos', '<p>Na aba <b>Alunos</b> está o seu código de convite. Passe para o aluno. Toque no aluno para montar treino, dieta e metas, ver o progresso e mandar recados. Você também pode salvar <b>modelos</b> de treino e aplicar em qualquer aluno.</p>') : ''}
    ${topico('Instalar no celular', '<p><b>iPhone (Safari):</b> toque no botão de compartilhar (quadrado com seta), depois em <b>Adicionar à Tela de Início</b>.</p><p><b>Android (Chrome):</b> toque nos três pontinhos e em <b>Instalar app</b> (ou <b>Adicionar à tela inicial</b>).</p><p>Depois disso o app abre em tela cheia, como um aplicativo.</p>')}
    ${topico('Sem internet', '<p>O app guarda seus dados no aparelho e continua funcionando sem internet. Quando a conexão volta, ele sincroniza sozinho.</p>')}
    ${topico('Assinatura', '<p>Toda conta começa com 30 dias grátis. Alunos conectados a um personal não pagam enquanto o plano do personal estiver em dia. Veja os detalhes em <b>Perfil → Assinatura</b>.</p>')}
    ${topico('Meus dados e privacidade', '<p>Em <b>Perfil → Seus dados</b> você salva um backup. Em <b>Privacidade</b> e <b>Termos de uso</b> estão as regras do app. Você pode excluir sua conta e todos os dados quando quiser, em <b>Perfil → Conta</b>.</p>')}
    ${temSuporte() ? `<a class="btn cheio" href="${escaparHtml(linkSuporte())}" target="_blank" rel="noopener">Falar com o suporte</a>` : ''}
    <button class="btn secundario cheio" type="button" data-ed="boas">Ver as boas-vindas de novo</button>
    <button class="btn secundario cheio" type="button" data-fechar>Fechar</button>`;
  const f = abrirFolha(html, { classe: 'folha-alta' });
  f.el.addEventListener('click', (e) => {
    if (e.target.closest('[data-ed="boas"]')) { f.fechar(); setTimeout(() => abrirBoasVindas(false), 250); }
  });
}

const PASSOS = [
  ['👋', 'Bem-vindo ao Treino', 'Treino, dieta e progresso num lugar só, simples de usar no celular e no computador.'],
  ['🏋️', 'Treine sem complicação', 'Abra a aba Hoje, toque em Começar, marque as séries e deixe o descanso por conta do app. Ele guarda suas cargas e mostra quando você bate um recorde.'],
  ['🍎', 'Dieta, água e calorias', 'Marque as regras da dieta, anote a água e o que comeu. Defina metas em Perfil e acompanhe tudo em Progresso.'],
  ['🤝', 'Tem um personal?', 'Em Perfil, digite o código que ele te passou. Ele monta seu treino e sua dieta, e você só executa.']
];

export function abrirBoasVindas(marcar = true) {
  let i = 0;
  const f = abrirFolha('<div id="boas"></div>', { fixo: true });
  const pintar = () => {
    const [ico, tit, txt] = PASSOS[i];
    const ultimo = i === PASSOS.length - 1;
    f.el.querySelector('#boas').innerHTML = `
      <div class="boas">
        <div class="boas-ico" aria-hidden="true">${ico}</div>
        <h2>${escaparHtml(tit)}</h2>
        <p>${escaparHtml(txt)}</p>
        <div class="boas-pontos" aria-hidden="true">${PASSOS.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
        <div class="linha-botoes">
          ${ultimo ? '' : '<button class="btn secundario" type="button" data-ed="pular">Pular</button>'}
          <button class="btn" type="button" data-ed="${ultimo ? 'fim' : 'prox'}">${ultimo ? 'Começar' : 'Continuar'}</button>
        </div>
      </div>`;
  };
  pintar();
  const terminar = () => {
    f.fechar();
    if (marcar && estado.uid) salvarPerfil(estado.uid, { viuBoasVindas: true }, { merge: true });
  };
  f.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ed]');
    if (!b) return;
    if (b.dataset.ed === 'prox') { i += 1; pintar(); } else terminar();
  });
}
