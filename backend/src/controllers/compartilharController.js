const crypto = require('crypto');
const pool = require('../config/db');
const nodemailer = require('nodemailer');

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

const enviarPorEmail = async (req, res) => {
  const { id_roteiro } = req.params;
  const id_usuario = req.usuario.id;
  const { email_destino, mensagem_pessoal } = req.body;

  if (!email_destino || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email_destino)) {
    return res.status(400).json({ mensagem: 'Email inválido.' });
  }

  try {
    const resultado = await pool.query(
      `SELECT r.id_roteiro, r.titulo, r.share_token, r.is_public,
              v.destino, v.quantidade_dias
       FROM roteiro r
       JOIN viagem v ON r.fk_viagem_id_viagem = v.id_viagem
       WHERE r.id_roteiro = $1 AND v.fk_usuario_id_usuario = $2`,
      [id_roteiro, id_usuario]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ mensagem: 'Roteiro não encontrado.' });
    }

    const roteiro = resultado.rows[0];

    let shareToken = roteiro.share_token;
    if (!shareToken || !roteiro.is_public) {
      shareToken = shareToken || crypto.randomUUID();
      await pool.query(
        'UPDATE roteiro SET share_token = $1, is_public = true, data_compartilhamento = NOW() WHERE id_roteiro = $2',
        [shareToken, id_roteiro]
      );
    }

    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = parseInt(process.env.SMTP_PORT || '587');
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpUser || !smtpPass) {
      return res.status(500).json({
        mensagem: 'Servidor de email não configurado. Configure SMTP_USER e SMTP_PASS no .env',
      });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const nomeRemetente = req.usuario.nome || 'Um amigo';
    const linkPublico = `${req.protocol}://${req.get('host').replace(':3001', ':5173')}/roteiro/publico/${shareToken}`;

    const htmlEmail = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:linear-gradient(135deg,#FF6B35,#ff9a6c);border-radius:16px 16px 0 0;padding:32px 24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:28px;">✈️ EasyTrip</h1>
      <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;font-size:14px;">Seu guia turístico personalizado</p>
    </div>
    <div style="background:#fff;padding:32px 24px;border-radius:0 0 16px 16px;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
      <h2 style="color:#2d3436;margin:0 0 8px;font-size:22px;">
        📍 Roteiro para ${roteiro.destino}
      </h2>
      <p style="color:#636e72;font-size:14px;margin:0 0 16px;">
        ${roteiro.quantidade_dias} dia(s) de viagem
      </p>
      <div style="background:#f0faf4;border-radius:12px;padding:16px;margin-bottom:20px;border-left:4px solid #27ae60;">
        <p style="margin:0;color:#2d3436;font-size:14px;">
          <strong>${nomeRemetente}</strong> compartilhou um roteiro de viagem com você!
        </p>
        ${mensagem_pessoal ? `<p style="margin:10px 0 0;color:#555;font-size:14px;font-style:italic;">"${mensagem_pessoal}"</p>` : ''}
      </div>
      <p style="color:#636e72;font-size:14px;line-height:1.6;margin:0 0 24px;">
        Clique no botão abaixo para ver o roteiro completo com todos os pontos turísticos,
        restaurantes, horários e dicas de viagem.
      </p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${linkPublico}" target="_blank"
           style="display:inline-block;background:#FF6B35;color:#fff;text-decoration:none;
                  padding:14px 32px;border-radius:12px;font-weight:700;font-size:16px;
                  box-shadow:0 4px 12px rgba(255,107,53,0.3);">
          🗺️ Ver Roteiro Completo
        </a>
      </div>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
      <p style="color:#b2bec3;font-size:12px;text-align:center;margin:0;">
        Este email foi enviado pelo EasyTrip. O roteiro está disponível enquanto o compartilhamento estiver ativo.
      </p>
    </div>
  </div>
</body>
</html>`;

    await transporter.sendMail({
      from: `"EasyTrip" <${smtpUser}>`,
      to: email_destino,
      subject: `📍 Roteiro de viagem: ${roteiro.destino} - EasyTrip`,
      html: htmlEmail,
    });

    console.log(`[Compartilhar] Email enviado para ${email_destino} - roteiro ${id_roteiro}`);

    res.json({
      mensagem: 'Email enviado com sucesso!',
      share_token: shareToken,
    });
  } catch (erro) {
    console.error('[Compartilhar] Erro ao enviar email:', erro.message);
    if (erro.code === 'EAUTH') {
      return res.status(500).json({ mensagem: 'Falha na autenticação do email. Verifique SMTP_USER e SMTP_PASS.' });
    }
    res.status(500).json({ mensagem: 'Erro ao enviar email.' });
  }
};

module.exports = { compartilharRoteiro, buscarRoteiroPublico, desativarCompartilhamento, enviarPorEmail };
