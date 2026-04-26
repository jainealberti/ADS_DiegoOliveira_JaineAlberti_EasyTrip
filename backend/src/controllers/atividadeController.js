const pool = require('../config/db');

// Editar uma atividade existente
const editarAtividade = async (req, res) => {
  const { id_atividade } = req.params;
  const { nome_atividade, horario, descricao } = req.body;

  try {
    const resultado = await pool.query(
      `UPDATE atividade 
       SET nome_atividade = $1, horario = $2, descricao = $3 
       WHERE id_atividade = $4 
       RETURNING *`,
      [nome_atividade, horario, descricao, id_atividade]
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

module.exports = { editarAtividade };