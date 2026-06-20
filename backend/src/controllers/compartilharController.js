const crypto = require('crypto');
const pool = require('../config/db');

async function inicializarColunas() {
  try {
    await pool.query(`
      ALTER TABLE roteiro ADD COLUMN IF NOT EXISTS share_token VARCHAR(64) UNIQUE;
      ALTER TABLE roteiro ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;
      ALTER TABLE roteiro ADD COLUMN IF NOT EXISTS data_compartilhamento TIMESTAMP;
    `);
    console.log('[Compartilhar] Colunas de compartilhamento verificadas/criadas.');
  } catch (erro) {
    console.error('[Compartilhar] Erro ao inicializar colunas:', erro.message);
  }
}

inicializarColunas();

const compartilharRoteiro = async (req, res) => {
  const { id_roteiro } = req.params;
  const id_usuario = req.usuario.id;

  try {
    const roteiro = await pool.query(
      `SELECT r.id_roteiro, r.share_token, r.is_public
       FROM roteiro r
       JOIN viagem v ON r.fk_viagem_id_viagem = v.id_viagem
       WHERE r.id_roteiro = $1 AND v.fk_usuario_id_usuario = $2`,
      [id_roteiro, id_usuario]
    );

    if (roteiro.rows.length === 0) {
      return res.status(404).json({ mensagem: 'Roteiro não encontrado.' });
    }

    const existing = roteiro.rows[0];

    if (existing.share_token && existing.is_public) {
      return res.status(200).json({
        mensagem: 'Roteiro já está compartilhado.',
        link: `/roteiro/publico/${existing.share_token}`,
        share_token: existing.share_token,
      });
    }

    const token = existing.share_token || crypto.randomUUID();

    await pool.query(
      `UPDATE roteiro
       SET share_token = $1, is_public = true, data_compartilhamento = NOW()
       WHERE id_roteiro = $2`,
      [token, id_roteiro]
    );

    res.status(200).json({
      mensagem: 'Roteiro compartilhado com sucesso!',
      link: `/roteiro/publico/${token}`,
      share_token: token,
    });
  } catch (erro) {
    console.error('[Compartilhar] Erro ao compartilhar roteiro:', erro);
    res.status(500).json({ mensagem: 'Erro ao compartilhar roteiro.' });
  }
};

const buscarRoteiroPublico = async (req, res) => {
  const { share_token } = req.params;

  try {
    const resultado = await pool.query(
      `SELECT r.id_roteiro, r.titulo, r.descricao, r.metadados, r.data_criacao,
              v.destino, v.quantidade_dias, v.orcamento, v.nome_preferencia, v.meio_transporte
       FROM roteiro r
       JOIN viagem v ON r.fk_viagem_id_viagem = v.id_viagem
       WHERE r.share_token = $1 AND r.is_public = true`,
      [share_token]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ mensagem: 'Roteiro não encontrado ou não está público.' });
    }

    const roteiro = resultado.rows[0];

    const atividades = await pool.query(
      `SELECT nome_atividade, descricao, local, dia, horario, custo_estimado, tipo, tempo_visita, lat, lng
       FROM atividade
       WHERE fk_roteiro_id_roteiro = $1
       ORDER BY dia ASC, horario ASC`,
      [roteiro.id_roteiro]
    );

    const atividadesPorDia = {};
    for (const ativ of atividades.rows) {
      const dia = ativ.dia || 1;
      if (!atividadesPorDia[dia]) atividadesPorDia[dia] = [];
      atividadesPorDia[dia].push(ativ);
    }

    const dias = Object.keys(atividadesPorDia)
      .sort((a, b) => a - b)
      .map(dia => ({ dia: parseInt(dia), atividades: atividadesPorDia[dia] }));

    let metadados = {};
    try {
      const parsed = roteiro.metadados ? JSON.parse(roteiro.metadados) : {};
      metadados = {
        info_cidade: parsed.info_cidade || null,
        centro: parsed.centro || null,
        mensagem_pessoal: parsed.mensagem_pessoal || '',
      };
    } catch {
      metadados = {};
    }

    res.status(200).json({
      roteiro: {
        titulo: roteiro.titulo,
        descricao: roteiro.descricao,
        data_criacao: roteiro.data_criacao,
      },
      viagem: {
        destino: roteiro.destino,
        quantidade_dias: roteiro.quantidade_dias,
        orcamento: roteiro.orcamento,
        nome_preferencia: roteiro.nome_preferencia,
        meio_transporte: roteiro.meio_transporte,
      },
      dias,
      metadados,
    });
  } catch (erro) {
    console.error('[Compartilhar] Erro ao buscar roteiro público:', erro);
    res.status(500).json({ mensagem: 'Erro ao buscar roteiro público.' });
  }
};

const desativarCompartilhamento = async (req, res) => {
  const { id_roteiro } = req.params;
  const id_usuario = req.usuario.id;

  try {
    const roteiro = await pool.query(
      `SELECT r.id_roteiro
       FROM roteiro r
       JOIN viagem v ON r.fk_viagem_id_viagem = v.id_viagem
       WHERE r.id_roteiro = $1 AND v.fk_usuario_id_usuario = $2`,
      [id_roteiro, id_usuario]
    );

    if (roteiro.rows.length === 0) {
      return res.status(404).json({ mensagem: 'Roteiro não encontrado.' });
    }

    await pool.query(
      `UPDATE roteiro SET is_public = false WHERE id_roteiro = $1`,
      [id_roteiro]
    );

    res.status(200).json({ mensagem: 'Compartilhamento desativado com sucesso.' });
  } catch (erro) {
    console.error('[Compartilhar] Erro ao desativar compartilhamento:', erro);
    res.status(500).json({ mensagem: 'Erro ao desativar compartilhamento.' });
  }
};

module.exports = { compartilharRoteiro, buscarRoteiroPublico, desativarCompartilhamento };
