// Privacidade, termos e exclusão da conta.
import { auth, signOut, deleteUser } from './firebase.js';
import { estado } from './estado.js';
import { abrirFolha, confirmar } from './folha.js';
import { toast } from './util.js';
import { apagarSubcolecao, apagarPerfil, removerGlobal } from './dados.js';

// Se quiser mostrar um contato de privacidade no app, escreva aqui (ex.: um e-mail). Vazio = não mostra.
const CONTATO = 'WhatsApp (44) 99921-5031';

const SUBCOLECOES = ['treinos', 'regras', 'dietaItens', 'checks', 'sessoes', 'peso', 'agua', 'medidas', 'recados', 'modelos', 'alimentos', 'refeicoes', 'fotos', 'config'];

export function abrirPrivacidade() {
  abrirFolha(`
    <h2>Privacidade</h2>
    <div class="texto-legal">
      <p class="mudo peq">Resumo em linguagem simples. Este texto é um modelo e precisa ser revisado por um profissional antes de o app ser aberto ao público.</p>
      <h3>Quais dados o app guarda</h3>
      <p>Nome, e-mail, objetivo, data de nascimento, sexo, altura, peso, <strong>informações de saúde que você escolher informar</strong> (condições, lesões, medicamentos e restrições alimentares; são dados sensíveis e só são guardados com o seu consentimento), treinos e dieta cadastrados, treinos feitos (cargas e repetições), peso, medidas, água, alimentos e calorias registrados, anotações, recados e, se você enviar, fotos de progresso.</p>
      <h3>Para que usamos</h3>
      <p>Somente para o app funcionar para você: mostrar seu treino, dieta e progresso. Não vendemos seus dados e não há anúncios.</p>
      <h3>Quem vê seus dados</h3>
      <p>Só você. Se você se conectar a um personal usando o código dele, ele passa a ver seus treinos feitos, dieta, peso, água, medidas, alimentos, calorias e recados, e a montar seu treino e sua dieta. As fotos só são vistas por ele se você ligar “Compartilhar com meu personal”. Você pode se desligar quando quiser, em Minha conta.</p>
      <h3>Onde ficam guardados</h3>
      <p>Em servidores do Google (Firebase), na região de São Paulo, Brasil.</p>
      <h3>Seus direitos</h3>
      <p>Você pode salvar uma cópia dos seus dados (Configurações → Salvar backup), corrigir o que quiser dentro do app e <strong>excluir sua conta e todos os seus dados</strong> (Configurações → Excluir minha conta).</p>
      <h3>Aviso de saúde</h3>
      <p>O app organiza treino e dieta, mas não substitui médico, nutricionista ou profissional de educação física. Em caso de dor, mal-estar ou dúvida, procure um profissional.</p>
      ${CONTATO ? `<h3>Contato</h3><p>${CONTATO}</p>` : ''}
    </div>
    <button class="btn cheio" type="button" data-fechar>Fechar</button>`, { classe: 'folha-alta' });
}

export function abrirTermos() {
  abrirFolha(`
    <h2>Termos de uso</h2>
    <div class="texto-legal">
      <p class="mudo peq">Modelo em linguagem simples. Precisa ser revisado por um profissional antes de o app ser aberto ao público.</p>
      <h3>O que é o app</h3>
      <p>O PFit Coach ajuda você a organizar treinos, dieta e acompanhamento do seu progresso, sozinho ou com um personal.</p>
      <h3>Sua conta</h3>
      <p>Você é responsável por manter sua senha em segurança e por informar dados verdadeiros. Cada conta é pessoal.</p>
      <h3>Assinatura</h3>
      <p>Toda conta tem um período grátis de 15 dias. Depois, o uso depende de assinatura ativa. Alunos conectados a um personal usam enquanto o plano do personal estiver em dia. Quando a assinatura vence, o acesso para alterar dados é pausado, mas seus dados continuam guardados e você pode salvar um backup ou excluir a conta.</p>
      <h3>Uso adequado</h3>
      <p>Não use o app para fins ilegais, nem tente acessar dados de outras pessoas. Contas que violem isso podem ser bloqueadas.</p>
      <h3>Saúde</h3>
      <p>O app não é aconselhamento médico, nutricional ou de educação física. Treino e dieta têm riscos: procure um profissional de saúde antes de começar ou mudar sua rotina. Você usa o app por sua conta e risco.</p>
      <h3>Personal e aluno</h3>
      <p>O personal é responsável pelo treino e pela dieta que monta para seus alunos. O app é só a ferramenta.</p>
      <h3>Mudanças</h3>
      <p>Estes termos podem mudar. Mudanças importantes serão avisadas no app.</p>
      ${CONTATO ? `<h3>Contato</h3><p>${CONTATO}</p>` : ''}
    </div>
    <button class="btn cheio" type="button" data-fechar>Fechar</button>`, { classe: 'folha-alta' });
}

export function abrirExclusao() {
  const personal = estado.alunos.length > 0;
  const f = abrirFolha(`
    <h2>Excluir minha conta</h2>
    <p>Isso apaga <strong>para sempre</strong> seus treinos, dieta, histórico, peso, medidas, fotos, recados e a própria conta. Não dá para desfazer.</p>
    ${personal ? `<p class="mudo">Você é personal de ${estado.alunos.length} aluno(s): eles serão desconectados de você. Os dados deles continuam com eles.</p>` : ''}
    <p class="mudo peq">Quer guardar uma cópia? Feche e use Configurações → Salvar backup antes.</p>
    <label class="campo">Para confirmar, digite EXCLUIR<input class="in" data-f="confirma" autocomplete="off" autocapitalize="characters"></label>
    <p class="erro" data-erro role="alert"></p>
    <div class="linha-botoes"><button class="btn secundario" type="button" data-fechar>Cancelar</button><button class="btn perigo-claro" type="button" data-ed="excluir">Excluir tudo</button></div>`);
  f.el.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-ed="excluir"]')) return;
    if (f.el.querySelector('[data-f="confirma"]').value.trim().toUpperCase() !== 'EXCLUIR') { f.el.querySelector('[data-erro]').textContent = 'Digite EXCLUIR para confirmar.'; return; }
    if (!(await confirmar('Última chance: excluir a conta e todos os dados?', { ok: 'Excluir tudo', perigo: true }))) return;
    const uid = estado.uid;
    try {
      // 1) desfaz as ligações (senão as regras impedem apagar treino/dieta de quem tem personal)
      if (estado.vinculo) await removerGlobal('vinculos', uid);
      for (const a of estado.alunos) await removerGlobal('vinculos', a.id);
      const codigo = estado.perfil && estado.perfil.codigoConvite;
      if (codigo) await removerGlobal('convites', codigo);
      // 2) apaga os dados
      for (const s of SUBCOLECOES) await apagarSubcolecao(uid, s);
      await apagarPerfil(uid);
      // 3) apaga o login
      try {
        await deleteUser(auth.currentUser);
      } catch (err) {
        console.error(err);
        f.fechar();
        await signOut(auth);
        toast('Seus dados foram apagados. Para remover também o login, entre de novo e repita “Excluir minha conta”.');
        return;
      }
      f.fechar();
      toast('Conta excluída.');
    } catch (err) {
      console.error(err);
      f.el.querySelector('[data-erro]').textContent = 'Não consegui apagar tudo. Confira a internet e tente de novo.';
    }
  });
}
