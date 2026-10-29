// Biblioteca de exercícios comuns (só nomes e grupo muscular, para sugerir e somar séries por grupo).
// Você pode usar qualquer outro nome: o que não está aqui entra como "Outros".
export const BASE = {
  Peito: ['Supino reto com barra', 'Supino reto com halteres', 'Supino inclinado com barra', 'Supino inclinado com halteres', 'Supino declinado', 'Crucifixo reto', 'Crucifixo inclinado', 'Crossover na polia', 'Peck deck', 'Flexão de braço', 'Mergulho nas paralelas'],
  Costas: ['Puxada frontal', 'Puxada atrás da nuca', 'Puxada com triângulo', 'Barra fixa', 'Remada curvada com barra', 'Remada curvada com halteres', 'Remada baixa', 'Remada cavalinho', 'Remada unilateral com halter', 'Pulldown com corda', 'Levantamento terra'],
  Ombros: ['Desenvolvimento com barra', 'Desenvolvimento com halteres', 'Desenvolvimento Arnold', 'Elevação lateral', 'Elevação frontal', 'Crucifixo invertido', 'Remada alta', 'Encolhimento de ombros'],
  Bíceps: ['Rosca direta com barra', 'Rosca direta com halteres', 'Rosca alternada', 'Rosca martelo', 'Rosca scott', 'Rosca concentrada', 'Rosca na polia'],
  Tríceps: ['Tríceps pulley', 'Tríceps corda', 'Tríceps testa', 'Tríceps francês', 'Tríceps banco', 'Tríceps coice', 'Supino fechado'],
  Quadríceps: ['Agachamento livre', 'Agachamento no smith', 'Agachamento búlgaro', 'Leg press 45', 'Leg press horizontal', 'Cadeira extensora', 'Hack squat', 'Avanço', 'Passada'],
  Posterior: ['Mesa flexora', 'Cadeira flexora', 'Stiff', 'Levantamento terra romeno', 'Good morning'],
  Glúteos: ['Elevação pélvica', 'Glúteo na polia', 'Cadeira abdutora', 'Glúteo no smith', 'Afundo'],
  Panturrilha: ['Panturrilha em pé', 'Panturrilha sentado', 'Panturrilha no leg press'],
  Abdômen: ['Abdominal reto', 'Abdominal infra', 'Abdominal na máquina', 'Abdominal com roda', 'Prancha', 'Elevação de pernas', 'Abdominal oblíquo']
};

export const norm = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const MAPA = new Map();
Object.entries(BASE).forEach(([grupo, lista]) => lista.forEach((n) => MAPA.set(norm(n), grupo)));

export const todosOsNomes = () => Object.values(BASE).flat();

// Descobre o grupo pelo nome. Aceita variações: ignora acento/maiúscula e procura o nome da biblioteca dentro do nome digitado.
export function grupoDoExercicio(nome) {
  const k = norm(nome);
  if (!k) return 'Outros';
  if (MAPA.has(k)) return MAPA.get(k);
  let melhor = null;
  MAPA.forEach((g, n) => { if ((k.includes(n) || n.includes(k)) && k.length >= 4 && (!melhor || n.length > melhor[0].length)) melhor = [n, g]; });
  return melhor ? melhor[1] : 'Outros';
}
