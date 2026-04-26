const pool = require('../config/db');

// Adicionar um custo a uma viagem
const adicionarCusto = async (req, res) => {
  const { id_viagem, categoria, descricao, valor } = req.body;

  try {
    const resultado = await pool.query(
      `INSERT INTO custo (id_viagem, categoria, descricao, valor)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id_viagem, categoria, descricao, valor]
    );

    res.status(201).json({
      mensagem: 'Custo adicionado com sucesso!',
      custo: resultado.rows[0]
    });
  } catch (erro) {
    console.error('Erro ao adicionar custo:', erro);
    res.status(500).json({ mensagem: 'Erro interno ao adicionar custo.' });
  }
};

// Listar todos os custos de uma viagem
const listarCustos = async (req, res) => {
  const { id_viagem } = req.params;

  try {
    const resultado = await pool.query(
      `SELECT * FROM custo WHERE id_viagem = $1 ORDER BY id_custo ASC`,
      [id_viagem]
    );

    res.json({ custos: resultado.rows });
  } catch (erro) {
    console.error('Erro ao listar custos:', erro);
    res.status(500).json({ mensagem: 'Erro interno ao listar custos.' });
  }
};

// Calcular o total de custos de uma viagem
const totalCustos = async (req, res) => {
  const { id_viagem } = req.params;

  try {
    const resultado = await pool.query(
      `SELECT SUM(valor) AS total FROM custo WHERE id_viagem = $1`,
      [id_viagem]
    );

    res.json({ total: resultado.rows[0].total || 0 });
  } catch (erro) {
    console.error('Erro ao calcular total:', erro);
    res.status(500).json({ mensagem: 'Erro interno ao calcular total.' });
  }
};

// Excluir um custo
const excluirCusto = async (req, res) => {
  const { id_custo } = req.params;

  try {
    const resultado = await pool.query(
      `DELETE FROM custo WHERE id_custo = $1 RETURNING *`,
      [id_custo]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ mensagem: 'Custo não encontrado.' });
    }

    res.json({ mensagem: 'Custo excluído com sucesso!' });
  } catch (erro) {
    console.error('Erro ao excluir custo:', erro);
    res.status(500).json({ mensagem: 'Erro interno ao excluir custo.' });
  }
};

module.exports = { adicionarCusto, listarCustos, totalCustos, excluirCusto };