const pool = require('../config/db');

const adicionarCusto = async (req, res) => {
  const { id_viagem, categoria, descricao, valor } = req.body;
  const id_usuario = req.usuario.id;

  try {
    if (!id_viagem || !valor) {
      return res.status(400).json({ mensagem: 'ID da viagem e valor são obrigatórios!' });
    }

    // Verifica se a viagem pertence ao usuário
    const viagem = await pool.query(
      'SELECT id_viagem FROM viagem WHERE id_viagem = $1 AND fk_usuario_id_usuario = $2',
      [id_viagem, id_usuario]
    );

    if (viagem.rows.length === 0) {
      return res.status(404).json({ mensagem: 'Viagem não encontrada.' });
    }

    const resultado = await pool.query(
      `INSERT INTO custo (id_viagem, categoria, descricao, valor)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id_viagem, categoria || 'Outros', descricao || null, valor]
    );

    res.status(201).json({
      mensagem: 'Custo adicionado com sucesso!',
      custo: resultado.rows[0]
    });
  } catch (erro) {
    console.error('Erro ao adicionar custo:', erro);
    res.status(500).json({ mensagem: 'Erro ao adicionar custo.' });
  }
};

const listarCustos = async (req, res) => {
  const { id_viagem } = req.params;
  const id_usuario = req.usuario.id;

  try {
    // Verifica se a viagem pertence ao usuário
    const viagem = await pool.query(
      'SELECT id_viagem FROM viagem WHERE id_viagem = $1 AND fk_usuario_id_usuario = $2',
      [id_viagem, id_usuario]
    );

    if (viagem.rows.length === 0) {
      return res.status(404).json({ mensagem: 'Viagem não encontrada.' });
    }

    const resultado = await pool.query(
      'SELECT * FROM custo WHERE id_viagem = $1 ORDER BY id_custo ASC',
      [id_viagem]
    );

    res.json({ custos: resultado.rows });
  } catch (erro) {
    console.error('Erro ao listar custos:', erro);
    res.status(500).json({ mensagem: 'Erro ao listar custos.' });
  }
};

const totalCustos = async (req, res) => {
  const { id_viagem } = req.params;
  const id_usuario = req.usuario.id;

  try {
    const viagem = await pool.query(
      'SELECT id_viagem FROM viagem WHERE id_viagem = $1 AND fk_usuario_id_usuario = $2',
      [id_viagem, id_usuario]
    );

    if (viagem.rows.length === 0) {
      return res.status(404).json({ mensagem: 'Viagem não encontrada.' });
    }

    const resultado = await pool.query(
      'SELECT COALESCE(SUM(valor), 0) AS total FROM custo WHERE id_viagem = $1',
      [id_viagem]
    );

    res.json({ total: parseFloat(resultado.rows[0].total) });
  } catch (erro) {
    console.error('Erro ao calcular total:', erro);
    res.status(500).json({ mensagem: 'Erro ao calcular total de custos.' });
  }
};

const excluirCusto = async (req, res) => {
  const { id_custo } = req.params;
  const id_usuario = req.usuario.id;

  try {
    // Verifica se o custo pertence a uma viagem do usuário
    const custo = await pool.query(
      `SELECT c.id_custo FROM custo c
       JOIN viagem v ON c.id_viagem = v.id_viagem
       WHERE c.id_custo = $1 AND v.fk_usuario_id_usuario = $2`,
      [id_custo, id_usuario]
    );

    if (custo.rows.length === 0) {
      return res.status(404).json({ mensagem: 'Custo não encontrado.' });
    }

    await pool.query('DELETE FROM custo WHERE id_custo = $1', [id_custo]);

    res.json({ mensagem: 'Custo excluído com sucesso!' });
  } catch (erro) {
    console.error('Erro ao excluir custo:', erro);
    res.status(500).json({ mensagem: 'Erro ao excluir custo.' });
  }
};

module.exports = { adicionarCusto, listarCustos, totalCustos, excluirCusto };
