const pool = require('../config/db');

const criarViagem = async (req, res) => {
  const { destino, quantidade_dias, orcamento, nome_preferencia } = req.body;
  const id_usuario = req.usuario.id;

  try {
    if (!destino || !quantidade_dias) {
      return res.status(400).json({ mensagem: 'Destino e quantidade de dias são obrigatórios!' });
    }

    const novaViagem = await pool.query(
      'INSERT INTO viagem (destino, quantidade_dias, orcamento, nome_preferencia, fk_usuario_id_usuario) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [destino, quantidade_dias, orcamento, nome_preferencia, id_usuario]
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

module.exports = { criarViagem, listarViagens };