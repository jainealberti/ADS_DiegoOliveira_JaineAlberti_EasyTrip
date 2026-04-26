const pool = require('../config/db');

const gerarRoteiro = async (req, res) => {
  const { id_viagem } = req.body;
  const id_usuario = req.usuario.id;

  try {
    const viagem = await pool.query(
      'SELECT * FROM viagem WHERE id_viagem = $1 AND fk_usuario_id_usuario = $2',
      [id_viagem, id_usuario]
    );

    if (viagem.rows.length === 0) {
      return res.status(404).json({ mensagem: 'Viagem não encontrada!' });
    }

    const v = viagem.rows[0];

    const roteiroDias = [];
    for (let dia = 1; dia <= v.quantidade_dias; dia++) {
      roteiroDias.push({
        dia: dia,
        atividades: [
          {
            nome: `Atividade 1 - Dia ${dia}`,
            descricao: `Explorar pontos turísticos de ${v.destino}`,
            horario: '09:00',
            custo_estimado: 50.00
          },
          {
            nome: `Atividade 2 - Dia ${dia}`,
            descricao: `Gastronomia local em ${v.destino}`,
            horario: '12:00',
            custo_estimado: 80.00
          },
          {
            nome: `Atividade 3 - Dia ${dia}`,
            descricao: `Passeio noturno em ${v.destino}`,
            horario: '19:00',
            custo_estimado: 60.00
          }
        ]
      });
    }

    const novoRoteiro = await pool.query(
      'INSERT INTO roteiro (titulo, descricao, status, fk_viagem_id_viagem) VALUES ($1, $2, $3, $4) RETURNING *',
      [`Roteiro - ${v.destino}`, `Roteiro gerado para ${v.destino}`, 'gerado', id_viagem]
    );

    const id_roteiro = novoRoteiro.rows[0].id_roteiro;

    for (const dia of roteiroDias) {
      for (const atividade of dia.atividades) {
        await pool.query(
          'INSERT INTO atividade (descricao, local, custo_estimado, fk_roteiro_id_roteiro) VALUES ($1, $2, $3, $4)',
          [atividade.descricao, atividade.nome, atividade.custo_estimado, id_roteiro]
        );
      }
    }

    res.status(201).json({
      mensagem: 'Roteiro gerado com sucesso!',
      roteiro: novoRoteiro.rows[0],
      dias: roteiroDias
    });

  } catch (erro) {
    res.status(500).json({ mensagem: 'Erro ao gerar roteiro', erro: erro.message });
  }
};

const listarRoteiros = async (req, res) => {
  const id_usuario = req.usuario.id;

  try {
    const roteiros = await pool.query(
      `SELECT r.*, v.destino, v.quantidade_dias 
       FROM roteiro r 
       JOIN viagem v ON r.fk_viagem_id_viagem = v.id_viagem 
       WHERE v.fk_usuario_id_usuario = $1 
       ORDER BY r.data_criacao DESC`,
      [id_usuario]
    );

    res.json({ roteiros: roteiros.rows });
  } catch (erro) {
    res.status(500).json({ mensagem: 'Erro ao listar roteiros', erro: erro.message });
  }
};

const excluirRoteiro = async (req, res) => {
  const { id_roteiro } = req.params;
  const id_usuario = req.usuario.id;

  try {
    await pool.query(
      'DELETE FROM atividade WHERE fk_roteiro_id_roteiro = $1',
      [id_roteiro]
    );

    const resultado = await pool.query(
      `DELETE FROM roteiro WHERE id_roteiro = $1 
       AND fk_viagem_id_viagem IN (
         SELECT id_viagem FROM viagem WHERE fk_usuario_id_usuario = $2
       ) RETURNING *`,
      [id_roteiro, id_usuario]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ mensagem: 'Roteiro não encontrado!' });
    }

    res.json({ mensagem: 'Roteiro excluído com sucesso!' });
  } catch (erro) {
    res.status(500).json({ mensagem: 'Erro ao excluir roteiro', erro: erro.message });
  }
};

module.exports = { gerarRoteiro, listarRoteiros, excluirRoteiro };