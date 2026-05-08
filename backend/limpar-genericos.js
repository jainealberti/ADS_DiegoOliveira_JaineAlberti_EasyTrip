const pool = require('./src/config/db');

async function main() {
  // Ver colunas de ambas as tabelas
  const colsR = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'roteiro'");
  console.log('Colunas ROTEIRO:', colsR.rows.map(r => r.column_name).join(', '));

  const colsA = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'atividade'");
  console.log('Colunas ATIVIDADE:', colsA.rows.map(r => r.column_name).join(', '));

  const colsV = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'viagem'");
  console.log('Colunas VIAGEM:', colsV.rows.map(r => r.column_name).join(', '));

  // Listar todos os roteiros
  const r = await pool.query('SELECT * FROM roteiro ORDER BY id_roteiro DESC');
  console.log('\n=== TODOS OS ROTEIROS ===');
  r.rows.forEach(row => console.log(`  ID: ${row.id_roteiro} | FK Viagem: ${row.fk_viagem_id_viagem} | Titulo: ${row.titulo}`));

  // Deletar tudo
  const del1 = await pool.query('DELETE FROM atividade');
  console.log('\nAtividades deletadas:', del1.rowCount);
  const del2 = await pool.query('DELETE FROM roteiro');
  console.log('Roteiros deletados:', del2.rowCount);

  // Listar viagens
  const v = await pool.query('SELECT * FROM viagem');
  console.log('\n=== VIAGENS EXISTENTES ===');
  v.rows.forEach(row => {
    const keys = Object.keys(row);
    console.log(`  ${JSON.stringify(row)}`);
  });

  pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
