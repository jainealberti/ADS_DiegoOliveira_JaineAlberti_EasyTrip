const jwt = require('jsonwebtoken');
require('dotenv').config();

async function testar() {
  const token = jwt.sign({ id: 4 }, process.env.JWT_SECRET, { expiresIn: '1h' });

  console.log('Chamando POST /roteiro/gerar para viagem 36 (Lisboa)...');
  console.log('(Isso pode demorar até 1 minuto com retries)\n');

  const resp = await fetch('http://localhost:3001/roteiro/gerar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ id_viagem: 36 }),
  });

  const data = await resp.json();
  console.log('\n=== RESPOSTA ===');
  console.log('Status:', resp.status);
  console.log('Gerado por IA:', data.gerado_por_ia);
  console.log('Total atividades:', data.total_atividades);
  console.log('Mensagem:', data.mensagem);

  if (data.dias && data.dias[0]?.atividades?.[0]) {
    const primeira = data.dias[0].atividades[0];
    console.log('\nPrimeira atividade:');
    console.log('  Nome:', primeira.nome);
    console.log('  Endereço:', primeira.endereco);
    console.log('  Tipo:', primeira.tipo);
    console.log('  Horário:', primeira.horarioSugerido);
    console.log('  Custo:', primeira.custoEstimado);
  }
}

testar().catch(e => console.error('Erro:', e));
