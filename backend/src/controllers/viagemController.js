const pool = require('../config/db');

const criarViagem = async (req, res) => {
  const { destino, quantidade_dias, orcamento, nome_preferencia, meio_transporte, detalhes_extra } = req.body;
  const id_usuario = req.usuario.id;

  try {
    if (!destino || !quantidade_dias) {
      return res.status(400).json({ mensagem: 'Destino e quantidade de dias são obrigatórios!' });
    }

    const novaViagem = await pool.query(
      `INSERT INTO viagem (destino, quantidade_dias, orcamento, nome_preferencia, meio_transporte, detalhes_extra, fk_usuario_id_usuario)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [destino, quantidade_dias, orcamento || null, nome_preferencia || null, meio_transporte || null, detalhes_extra || null, id_usuario]
    );

    res.status(201).json({
      mensagem: 'Viagem criada com sucesso!',
      viagem: novaViagem.rows[0]
    });
  } catch (erro) {
    console.error('Erro ao criar viagem:', erro);
    res.status(500).json({ mensagem: 'Erro ao criar viagem.' });
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
    console.error('Erro ao listar viagens:', erro);
    res.status(500).json({ mensagem: 'Erro ao listar viagens.' });
  }
};

const buscarViagem = async (req, res) => {
  const { id_viagem } = req.params;
  const id_usuario = req.usuario.id;

  try {
    const viagem = await pool.query(
      'SELECT * FROM viagem WHERE id_viagem = $1 AND fk_usuario_id_usuario = $2',
      [id_viagem, id_usuario]
    );

    if (viagem.rows.length === 0) {
      return res.status(404).json({ mensagem: 'Viagem não encontrada.' });
    }

    res.json({ viagem: viagem.rows[0] });
  } catch (erro) {
    console.error('Erro ao buscar viagem:', erro);
    res.status(500).json({ mensagem: 'Erro ao buscar viagem.' });
  }
};

const atualizarViagem = async (req, res) => {
  const { id_viagem } = req.params;
  const id_usuario = req.usuario.id;
  const { destino, quantidade_dias, orcamento, nome_preferencia, meio_transporte, detalhes_extra } = req.body;

  try {
    const viagemExiste = await pool.query(
      'SELECT * FROM viagem WHERE id_viagem = $1 AND fk_usuario_id_usuario = $2',
      [id_viagem, id_usuario]
    );

    if (viagemExiste.rows.length === 0) {
      return res.status(404).json({ mensagem: 'Viagem não encontrada.' });
    }

    const atual = viagemExiste.rows[0];

    const resultado = await pool.query(
      `UPDATE viagem 
       SET destino = $1, quantidade_dias = $2, orcamento = $3, nome_preferencia = $4, meio_transporte = $5, detalhes_extra = $6
       WHERE id_viagem = $7 AND fk_usuario_id_usuario = $8 
       RETURNING *`,
      [
        destino || atual.destino,
        quantidade_dias || atual.quantidade_dias,
        orcamento !== undefined ? orcamento : atual.orcamento,
        nome_preferencia !== undefined ? nome_preferencia : atual.nome_preferencia,
        meio_transporte !== undefined ? meio_transporte : atual.meio_transporte,
        detalhes_extra !== undefined ? detalhes_extra : atual.detalhes_extra,
        id_viagem,
        id_usuario
      ]
    );

    res.json({
      mensagem: 'Viagem atualizada com sucesso!',
      viagem: resultado.rows[0]
    });
  } catch (erro) {
    console.error('Erro ao atualizar viagem:', erro);
    res.status(500).json({ mensagem: 'Erro ao atualizar viagem.' });
  }
};

const excluirViagem = async (req, res) => {
  const { id_viagem } = req.params;
  const id_usuario = req.usuario.id;

  try {
    const viagemExiste = await pool.query(
      'SELECT * FROM viagem WHERE id_viagem = $1 AND fk_usuario_id_usuario = $2',
      [id_viagem, id_usuario]
    );

    if (viagemExiste.rows.length === 0) {
      return res.status(404).json({ mensagem: 'Viagem não encontrada.' });
    }

    await pool.query(
      'DELETE FROM viagem WHERE id_viagem = $1 AND fk_usuario_id_usuario = $2',
      [id_viagem, id_usuario]
    );

    res.json({ mensagem: 'Viagem excluída com sucesso!' });
  } catch (erro) {
    console.error('Erro ao excluir viagem:', erro);
    res.status(500).json({ mensagem: 'Erro ao excluir viagem.' });
  }
};

module.exports = { criarViagem, listarViagens, buscarViagem, atualizarViagem, excluirViagem };
