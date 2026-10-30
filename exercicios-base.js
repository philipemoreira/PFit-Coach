// Biblioteca de exercícios comuns (só nomes e grupo muscular, para sugerir e somar séries por grupo).
// Você pode usar qualquer outro nome: o que não está aqui entra como "Outros".
export const BASE = {
  Peito: ['Supino reto com barra', 'Supino reto com halteres', 'Supino inclinado com barra', 'Supino inclinado com halteres', 'Supino declinado', 'Supino na máquina', 'Supino inclinado na máquina', 'Supino reto no smith', 'Supino inclinado no smith', 'Crucifixo reto', 'Crucifixo inclinado', 'Crucifixo na máquina', 'Peck deck', 'Crossover na polia', 'Crossover polia baixa', 'Crossover polia alta', 'Pullover com halter', 'Flexão de braço', 'Flexão com pés elevados', 'Mergulho nas paralelas'],
  Costas: ['Puxada frontal', 'Puxada atrás da nuca', 'Puxada com triângulo', 'Puxada com pegada supinada', 'Puxada articulada', 'Puxada unilateral na polia', 'Barra fixa', 'Barra fixa supinada', 'Barra fixa assistida', 'Remada curvada com barra', 'Remada curvada com halteres', 'Remada baixa', 'Remada baixa unilateral', 'Remada articulada', 'Remada cavalinho', 'Remada com barra T', 'Remada Pendlay', 'Remada no smith', 'Remada unilateral com halter', 'Pulldown com corda', 'Pullover na polia', 'Hiperextensão lombar', 'Levantamento terra'],
  Ombros: ['Desenvolvimento com barra', 'Desenvolvimento com halteres', 'Desenvolvimento Arnold', 'Desenvolvimento na máquina', 'Desenvolvimento no smith', 'Elevação lateral', 'Elevação lateral na polia', 'Elevação lateral na máquina', 'Elevação frontal', 'Elevação frontal com anilha', 'Elevação frontal na polia', 'Crucifixo invertido', 'Crucifixo invertido na máquina', 'Crucifixo invertido na polia', 'Face pull', 'Remada alta'],
  Trapézio: ['Encolhimento de ombros', 'Encolhimento com halteres', 'Encolhimento com barra', 'Encolhimento no smith', 'Encolhimento na máquina'],
  Bíceps: ['Rosca direta com barra', 'Rosca direta com barra W', 'Rosca direta com halteres', 'Rosca alternada', 'Rosca martelo', 'Rosca martelo na corda', 'Rosca inclinada', 'Rosca scott', 'Rosca scott na máquina', 'Rosca concentrada', 'Rosca spider', 'Rosca na polia', 'Rosca Bayesian na polia', 'Rosca 21'],
  Tríceps: ['Tríceps pulley', 'Tríceps corda', 'Tríceps unilateral na polia', 'Tríceps testa', 'Tríceps testa com halteres', 'Tríceps francês', 'Tríceps francês com halter', 'Tríceps corda acima da cabeça', 'Tríceps banco', 'Tríceps coice', 'Tríceps na máquina', 'Mergulho na máquina', 'Flexão diamante', 'Supino fechado'],
  Antebraço: ['Rosca punho', 'Rosca punho inversa', 'Rosca punho atrás das costas', 'Rosca inversa', 'Rosca inversa na polia', 'Rolo de punho', 'Caminhada do fazendeiro', 'Dead hang (pendurar na barra)'],
  Quadríceps: ['Agachamento livre', 'Agachamento frontal', 'Agachamento sumô', 'Agachamento goblet', 'Agachamento no smith', 'Agachamento na máquina', 'Agachamento búlgaro', 'Hack squat', 'Leg press 45', 'Leg press horizontal', 'Leg press unilateral', 'Cadeira extensora', 'Cadeira extensora unilateral', 'Sissy squat', 'Avanço', 'Passada', 'Afundo no smith', 'Step-up (subida no banco)'],
  Posterior: ['Mesa flexora', 'Mesa flexora unilateral', 'Cadeira flexora', 'Cadeira flexora unilateral', 'Flexora em pé', 'Stiff', 'Stiff com halteres', 'Levantamento terra romeno', 'Levantamento terra sumô', 'Good morning', 'Nordic curl'],
  Glúteos: ['Elevação pélvica', 'Hip thrust com barra', 'Hip thrust na máquina', 'Ponte de glúteo', 'Glúteo na polia', 'Glúteo no smith', 'Glúteo na máquina', 'Extensão de quadril (4 apoios)', 'Cadeira abdutora', 'Cadeira adutora', 'Abdução de quadril com elástico', 'Afundo'],
  Panturrilha: ['Panturrilha em pé', 'Panturrilha sentado', 'Panturrilha no leg press', 'Panturrilha no smith', 'Panturrilha na máquina em pé', 'Panturrilha burrinho', 'Panturrilha unilateral em pé', 'Panturrilha com halteres', 'Panturrilha no hack', 'Panturrilha no degrau'],
  Abdômen: ['Abdominal reto', 'Abdominal infra', 'Abdominal na máquina', 'Abdominal na polia', 'Abdominal declinado', 'Abdominal canivete', 'Abdominal bicicleta', 'Abdominal oblíquo', 'Abdominal com roda', 'Prancha', 'Prancha lateral', 'Elevação de pernas', 'Elevação de pernas na barra', 'Russian twist', 'Lenhador na polia', 'Mountain climber', 'Dead bug'],
  Cardio: ['Esteira (caminhada)', 'Esteira (corrida)', 'Esteira inclinada', 'Bicicleta ergométrica', 'Bicicleta spinning', 'Elíptico', 'Simulador de escada', 'Remo ergométrico', 'Corda de pular', 'Corrida ao ar livre', 'Caminhada ao ar livre', 'Pedalada ao ar livre', 'Natação', 'Tiros (HIIT)', 'Cordas navais']
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
