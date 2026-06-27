const pool = require('../config/db');

const editarAtividade = async (req, res) => {
  const { id_atividade } = req.params;
  const { nome_atividade, horario, descricao, local, custo_estimado } = req.body;

  try {
    const resultado = await pool.query(
      `UPDATE atividade 
       SET nome_atividade = $1, horario = $2, descricao = $3, local = $4, custo_estimado = $5
       WHERE id_atividade = $6 
       RETURNING *`,
      [nome_atividade, horario, descricao, local, custo_estimado, id_atividade]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ mensagem: 'Atividade não encontrada.' });
    }

    res.json({ mensagem: 'Atividade atualizada com sucesso!', atividade: resultado.rows[0] });
  } catch (erro) {
    console.error('Erro ao editar atividade:', erro);
    res.status(500).json({ mensagem: 'Erro interno ao editar atividade.' });
  }
};

const adicionarAtividade = async (req, res) => {
  const { fk_roteiro_id_roteiro, dia, nome_atividade, descricao, local, horario, custo_estimado } = req.body;

  try {
    const resultado = await pool.query(
      `INSERT INTO atividade (fk_roteiro_id_roteiro, dia, nome_atividade, descricao, local, horario, custo_estimado)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [fk_roteiro_id_roteiro, dia, nome_atividade, descricao, local, horario, custo_estimado || 0]
    );

    res.status(201).json({ mensagem: 'Atividade adicionada com sucesso!', atividade: resultado.rows[0] });
  } catch (erro) {
    console.error('Erro ao adicionar atividade:', erro);
    res.status(500).json({ mensagem: 'Erro ao adicionar atividade.' });
  }
};

const excluirAtividade = async (req, res) => {
  const { id_atividade } = req.params;

  try {
    const resultado = await pool.query(
      'DELETE FROM atividade WHERE id_atividade = $1 RETURNING *',
      [id_atividade]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ mensagem: 'Atividade não encontrada.' });
    }

    res.json({ mensagem: 'Atividade excluída com sucesso!' });
  } catch (erro) {
    console.error('Erro ao excluir atividade:', erro);
    res.status(500).json({ mensagem: 'Erro ao excluir atividade.' });
  }
};

const toggleRealizada = async (req, res) => {
  const { id_atividade } = req.params;
  const { realizada } = req.body;

  try {
    const resultado = await pool.query(
      'UPDATE atividade SET realizada = $1 WHERE id_atividade = $2 RETURNING *',
      [realizada, id_atividade]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ mensagem: 'Atividade não encontrada.' });
    }

    res.json({ mensagem: 'Status atualizado!', atividade: resultado.rows[0] });
  } catch (erro) {
    console.error('Erro ao atualizar status da atividade:', erro);
    res.status(500).json({ mensagem: 'Erro ao atualizar status da atividade.' });
  }
};

module.exports = { editarAtividade, adicionarAtividade, excluirAtividade, toggleRealizada };