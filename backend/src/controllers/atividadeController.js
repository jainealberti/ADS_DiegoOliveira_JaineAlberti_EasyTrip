const pool = require('../config/db');

const editarAtividade = async (req, res) => {
  const { id_atividade } = req.params;
  const id_usuario = req.usuario.id;
  const { nome_atividade, descricao, local, dia, horario, custo_estimado, realizada } = req.body;

  try {
    const atividade = await pool.query(
      `SELECT a.* FROM atividade a
       JOIN roteiro r ON a.fk_roteiro_id_roteiro = r.id_roteiro
       JOIN viagem v ON r.fk_viagem_id_viagem = v.id_viagem
       WHERE a.id_atividade = $1 AND v.fk_usuario_id_usuario = $2`,
      [id_atividade, id_usuario]
    );

    if (atividade.rows.length === 0) {
      return res.status(404).json({ mensagem: 'Atividade não encontrada.' });
    }

    const atual = atividade.rows[0];

    const resultado = await pool.query(
      `UPDATE atividade 
       SET nome_atividade = $1, descricao = $2, local = $3, dia = $4, horario = $5, custo_estimado = $6, realizada = $7
       WHERE id_atividade = $8
       RETURNING *`,
      [
        nome_atividade !== undefined ? nome_atividade : atual.nome_atividade,
        descricao !== undefined ? descricao : atual.descricao,
        local !== undefined ? local : atual.local,
        dia !== undefined ? dia : atual.dia,
        horario !== undefined ? horario : atual.horario,
        custo_estimado !== undefined ? custo_estimado : atual.custo_estimado,
        realizada !== undefined ? realizada : (atual.realizada || false),
        id_atividade
      ]
    );

    res.json({
      mensagem: 'Atividade atualizada com sucesso!',
      atividade: resultado.rows[0]
    });
  } catch (erro) {
    console.error('Erro ao editar atividade:', erro);
    res.status(500).json({ mensagem: 'Erro ao editar atividade.' });
  }
};

const adicionarAtividade = async (req, res) => {
  const id_usuario = req.usuario.id;
  const { fk_roteiro_id_roteiro, nome_atividade, descricao, local, dia, horario, custo_estimado } = req.body;

  try {
    if (!fk_roteiro_id_roteiro) {
      return res.status(400).json({ mensagem: 'ID do roteiro é obrigatório!' });
    }

    const roteiro = await pool.query(
      `SELECT r.id_roteiro FROM roteiro r
       JOIN viagem v ON r.fk_viagem_id_viagem = v.id_viagem
       WHERE r.id_roteiro = $1 AND v.fk_usuario_id_usuario = $2`,
      [fk_roteiro_id_roteiro, id_usuario]
    );

    if (roteiro.rows.length === 0) {
      return res.status(404).json({ mensagem: 'Roteiro não encontrado.' });
    }

    const resultado = await pool.query(
      `INSERT INTO atividade (nome_atividade, descricao, local, dia, horario, custo_estimado, realizada, fk_roteiro_id_roteiro)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        nome_atividade || 'Nova atividade',
        descricao || null,
        local || null,
        dia || 1,
        horario || '09:00',
        custo_estimado || 0,
        false,
        fk_roteiro_id_roteiro
      ]
    );

    res.status(201).json({
      mensagem: 'Atividade adicionada com sucesso!',
      atividade: resultado.rows[0]
    });
  } catch (erro) {
    console.error('Erro ao adicionar atividade:', erro);
    res.status(500).json({ mensagem: 'Erro ao adicionar atividade.' });
  }
};

const excluirAtividade = async (req, res) => {
  const { id_atividade } = req.params;
  const id_usuario = req.usuario.id;

  try {
    const atividade = await pool.query(
      `SELECT a.id_atividade FROM atividade a
       JOIN roteiro r ON a.fk_roteiro_id_roteiro = r.id_roteiro
       JOIN viagem v ON r.fk_viagem_id_viagem = v.id_viagem
       WHERE a.id_atividade = $1 AND v.fk_usuario_id_usuario = $2`,
      [id_atividade, id_usuario]
    );

    if (atividade.rows.length === 0) {
      return res.status(404).json({ mensagem: 'Atividade não encontrada.' });
    }

    await pool.query('DELETE FROM atividade WHERE id_atividade = $1', [id_atividade]);

    res.json({ mensagem: 'Atividade excluída com sucesso!' });
  } catch (erro) {
    console.error('Erro ao excluir atividade:', erro);
    res.status(500).json({ mensagem: 'Erro ao excluir atividade.' });
  }
};

const marcarRealizada = async (req, res) => {
  const { id_atividade } = req.params;
  const id_usuario = req.usuario.id;
  const { realizada } = req.body;

  try {
    const atividade = await pool.query(
      `SELECT a.id_atividade FROM atividade a
       JOIN roteiro r ON a.fk_roteiro_id_roteiro = r.id_roteiro
       JOIN viagem v ON r.fk_viagem_id_viagem = v.id_viagem
       WHERE a.id_atividade = $1 AND v.fk_usuario_id_usuario = $2`,
      [id_atividade, id_usuario]
    );

    if (atividade.rows.length === 0) {
      return res.status(404).json({ mensagem: 'Atividade não encontrada.' });
    }

    const resultado = await pool.query(
      'UPDATE atividade SET realizada = $1 WHERE id_atividade = $2 RETURNING *',
      [realizada === true, id_atividade]
    );

    res.json({
      mensagem: 'Status atualizado!',
      atividade: resultado.rows[0]
    });
  } catch (erro) {
    console.error('Erro ao marcar atividade:', erro);
    res.status(500).json({ mensagem: 'Erro ao atualizar status da atividade.' });
  }
};

module.exports = { editarAtividade, adicionarAtividade, excluirAtividade, marcarRealizada };
