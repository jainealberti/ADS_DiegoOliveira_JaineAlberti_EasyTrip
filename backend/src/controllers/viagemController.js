const pool = require('../config/db');

const criarViagem = async (req, res) => {
  const { destino, quantidade_dias, orcamento, nome_preferencia, meio_transporte, detalhes_extra } = req.body;
  const id_usuario = req.usuario.id;

  try {
    if (!destino || !quantidade_dias) {
      return res.status(400).json({ mensagem: 'Destino e quantidade de dias são obrigatórios!' });
    }

    const novaViagem = await pool.query(
      'INSERT INTO viagem (destino, quantidade_dias, orcamento, nome_preferencia, meio_transporte, detalhes_extra, fk_usuario_id_usuario) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [destino, quantidade_dias, orcamento, nome_preferencia, meio_transporte || null, detalhes_extra || null, id_usuario]
    );

    res.status(201).json({ mensagem: 'Viagem criada com sucesso!', viagem: novaViagem.rows[0] });
  } catch (erro) {
    res.status(500).json({ mensagem: 'Erro ao criar viagem', erro: erro.message });
  }
};

const listarViagens = async (req, res) => {
  const id_usuario = req.usuario.id;

  try {
    const viagens = await pool.query(
      'SELECT * FROM viagem WHERE fk_usuario_id_usuario = $1 ORDER BY data_criacao DESC',
      [id_usuario]
    );

    res.json({ viagens: viagens.rows });
  } catch (erro) {
    res.status(500).json({ mensagem: 'Erro ao listar viagens', erro: erro.message });
  }
};

const buscarViagemPorId = async (req, res) => {
  const { id } = req.params;
  const id_usuario = req.usuario.id;

  try {
    const viagem = await pool.query(
      'SELECT * FROM viagem WHERE id_viagem = $1 AND fk_usuario_id_usuario = $2',
      [id, id_usuario]
    );

    if (viagem.rows.length === 0) {
      return res.status(404).json({ mensagem: 'Viagem não encontrada!' });
    }

    res.json({ viagem: viagem.rows[0] });
  } catch (erro) {
    res.status(500).json({ mensagem: 'Erro ao buscar viagem', erro: erro.message });
  }
};

const atualizarViagem = async (req, res) => {
  const { id } = req.params;
  const id_usuario = req.usuario.id;
  const { destino, quantidade_dias, orcamento } = req.body;

  try {
    const resultado = await pool.query(
      `UPDATE viagem SET destino = $1, quantidade_dias = $2, orcamento = $3
       WHERE id_viagem = $4 AND fk_usuario_id_usuario = $5 RETURNING *`,
      [destino, quantidade_dias, orcamento, id, id_usuario]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ mensagem: 'Viagem não encontrada!' });
    }

    res.json({ mensagem: 'Viagem atualizada com sucesso!', viagem: resultado.rows[0] });
  } catch (erro) {
    res.status(500).json({ mensagem: 'Erro ao atualizar viagem', erro: erro.message });
  }
};

const excluirViagem = async (req, res) => {
  const { id } = req.params;
  const id_usuario = req.usuario.id;

  try {
    const resultado = await pool.query(
      'DELETE FROM viagem WHERE id_viagem = $1 AND fk_usuario_id_usuario = $2 RETURNING *',
      [id, id_usuario]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ mensagem: 'Viagem não encontrada!' });
    }

    res.json({ mensagem: 'Viagem excluída com sucesso!' });
  } catch (erro) {
    res.status(500).json({ mensagem: 'Erro ao excluir viagem', erro: erro.message });
  }
};

module.exports = { criarViagem, listarViagens, buscarViagemPorId, atualizarViagem, excluirViagem };