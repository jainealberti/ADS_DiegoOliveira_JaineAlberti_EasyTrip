const PDFDocument = require('pdfkit');
const pool = require('../config/db');
const { buscarImagemCidade } = require('../services/imageService');

const ORANGE = '#FF6B35';
const DARK = '#1a1a2e';
const GRAY = '#636e72';
const LIGHT_BG = '#fef6f1';
const GREEN = '#27ae60';

async function baixarImagemComoBuffer(url) {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return null;
    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.includes('image')) return null;
    const arrayBuffer = await resp.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    if (buf.length < 500) return null;
    return buf;
  } catch {
    return null;
  }
}

async function gerarPDF(req, res) {
  const { id_roteiro } = req.params;
  const userId = req.usuario.id;

  try {
    const roteiroResult = await pool.query(
      `SELECT r.id_roteiro, r.titulo, r.descricao, r.status, r.metadados,
              r.data_criacao, v.destino, v.quantidade_dias, v.orcamento,
              v.nome_preferencia, v.meio_transporte, v.detalhes_extra
       FROM roteiro r
       INNER JOIN viagem v ON r.fk_viagem_id_viagem = v.id_viagem
       WHERE r.id_roteiro = $1 AND v.fk_usuario_id_usuario = $2`,
      [id_roteiro, userId]
    );

    if (roteiroResult.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Roteiro não encontrado' }
      });
    }

    const roteiro = roteiroResult.rows[0];

    const atividadesResult = await pool.query(
      `SELECT id_atividade, nome_atividade, descricao, local, dia,
              horario, custo_estimado, tipo, tempo_visita
       FROM atividade
       WHERE fk_roteiro_id_roteiro = $1
       ORDER BY dia ASC, horario ASC`,
      [id_roteiro]
    );

    const atividades = atividadesResult.rows;

    let imagemCidadeBuffer = null;
    try {
      const imageUrl = await buscarImagemCidade(roteiro.destino);
      if (imageUrl) {
        console.log('[PDF] Baixando imagem da cidade:', imageUrl.substring(0, 80));
        imagemCidadeBuffer = await baixarImagemComoBuffer(imageUrl);
        if (imagemCidadeBuffer) {
          console.log('[PDF] Imagem baixada:', (imagemCidadeBuffer.length / 1024).toFixed(1), 'KB');
        } else {
          console.log('[PDF] Falha ao baixar imagem, usando fallback');
        }
      }
    } catch (e) {
      console.warn('[PDF] Erro ao buscar imagem da cidade:', e.message);
    }

    const destinoSlug = roteiro.destino
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="easytrip-roteiro-${destinoSlug}.pdf"`);

    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    doc.pipe(res);

    const W = doc.page.width;
    const H = doc.page.height;
    const M = 50;
    const PW = W - M * 2;

    function drawFooter() {
      doc.save();
      doc.fillOpacity(1);
      doc.rect(0, H - 35, W, 35).fill('#2d3436');
      doc.fontSize(8).fillColor('#ffffff').font('Helvetica')
        .text('Roteiro gerado com EasyTrip  |  easytrip.com', M, H - 24, { width: PW, align: 'center' });
      doc.restore();
    }

    function checkPageBreak(needed) {
      if (doc.y + needed > H - M - 45) {
        drawFooter();
        doc.addPage({ margin: 0 });
        drawPageHeader();
      }
    }

    function drawPageHeader() {
      doc.save();
      doc.fillOpacity(1);
      doc.rect(0, 0, W, 6).fill(ORANGE);
      doc.restore();
      doc.y = M + 10;
    }

    // === COVER PAGE ===
    const COVER_H = 300;
    let temImagem = false;

    if (imagemCidadeBuffer) {
      try {
        doc.image(imagemCidadeBuffer, 0, 0, {
          width: W,
          height: COVER_H,
          cover: [W, COVER_H],
          align: 'center',
          valign: 'center'
        });
        temImagem = true;
      } catch (e) {
        console.warn('[PDF] Erro ao inserir imagem no PDF:', e.message);
        temImagem = false;
      }
    }

    if (temImagem) {
      doc.save();
      doc.fillOpacity(0.5);
      doc.rect(0, 0, W, COVER_H).fill('#000000');
      doc.fillOpacity(1);
      doc.restore();
    } else {
      doc.save();
      doc.fillOpacity(1);
      doc.rect(0, 0, W, COVER_H).fill(ORANGE);
      doc.rect(0, COVER_H - 60, W, 60).fill('#e5571e');
      doc.restore();
    }

    doc.save();
    doc.fillOpacity(1);
    doc.fontSize(36).fillColor('#ffffff').font('Helvetica-Bold')
      .text('EasyTrip', M, 40, { width: PW, align: 'center' });
    doc.restore();

    doc.save();
    doc.fillOpacity(0.85);
    doc.fontSize(11).fillColor('#ffffff').font('Helvetica')
      .text('Planejador Inteligente de Viagens', M, 85, { width: PW, align: 'center' });
    doc.fillOpacity(1);
    doc.restore();

    doc.save();
    doc.strokeOpacity(0.5);
    doc.strokeColor('#ffffff').lineWidth(1)
      .moveTo(W / 2 - 60, 108).lineTo(W / 2 + 60, 108).stroke();
    doc.strokeOpacity(1);
    doc.restore();

    doc.save();
    doc.fillOpacity(1);
    doc.fontSize(22).fillColor('#ffffff').font('Helvetica-Bold')
      .text(roteiro.titulo, M + 20, 125, { width: PW - 40, align: 'center' });
    doc.restore();

    if (roteiro.descricao) {
      const descCurta = roteiro.descricao.length > 120
        ? roteiro.descricao.substring(0, 120) + '...'
        : roteiro.descricao;
      doc.save();
      doc.fillOpacity(0.9);
      doc.fontSize(10).fillColor('#ffffff').font('Helvetica')
        .text(descCurta, M + 30, 175, { width: PW - 60, align: 'center' });
      doc.fillOpacity(1);
      doc.restore();
    }

    doc.save();
    doc.fillOpacity(0.8);
    doc.fontSize(10).fillColor('#ffffff').font('Helvetica')
      .text(`${roteiro.quantidade_dias} dia(s) de aventura`, M, COVER_H - 30, { width: PW, align: 'center' });
    doc.fillOpacity(1);
    doc.restore();

    // === INFO CARDS ===
    const infoY = COVER_H + 15;

    doc.save();
    doc.fillOpacity(1);
    doc.rect(M, infoY, PW, 90).fill('#ffffff');
    doc.strokeColor('#e0e0e0').lineWidth(1).rect(M, infoY, PW, 90).stroke();
    doc.restore();

    const dataCriacao = roteiro.data_criacao
      ? new Date(roteiro.data_criacao).toLocaleDateString('pt-BR')
      : '--';

    const infoCols = [
      { label: 'Destino', value: roteiro.destino },
      { label: 'Dias', value: `${roteiro.quantidade_dias}` },
      { label: 'Criado em', value: dataCriacao },
    ];
    if (roteiro.orcamento) {
      infoCols.push({ label: 'Orcamento', value: `R$ ${parseFloat(roteiro.orcamento).toFixed(2)}` });
    }

    const colW = PW / infoCols.length;
    infoCols.forEach((col, i) => {
      const cx = M + i * colW;
      doc.fillOpacity(1);
      doc.fontSize(8).fillColor(GRAY).font('Helvetica')
        .text(col.label.toUpperCase(), cx + 5, infoY + 18, { width: colW - 10, align: 'center' });
      doc.fontSize(11).fillColor(DARK).font('Helvetica-Bold')
        .text(col.value, cx + 5, infoY + 34, { width: colW - 10, align: 'center' });

      if (i < infoCols.length - 1) {
        doc.strokeColor('#e0e0e0').lineWidth(0.5)
          .moveTo(cx + colW, infoY + 15).lineTo(cx + colW, infoY + 75).stroke();
      }
    });

    if (roteiro.nome_preferencia || roteiro.meio_transporte) {
      doc.fillOpacity(1);
      doc.fontSize(8).fillColor(GRAY).font('Helvetica');
      const extras = [];
      if (roteiro.nome_preferencia) extras.push(`Preferencias: ${roteiro.nome_preferencia}`);
      if (roteiro.meio_transporte) extras.push(`Transporte: ${roteiro.meio_transporte}`);
      doc.text(extras.join('  |  '), M + 10, infoY + 62, { width: PW - 20, align: 'center' });
    }

    doc.y = infoY + 110;

    // === ACTIVITIES BY DAY ===
    const atividadesPorDia = {};
    let custoTotal = 0;

    for (const ativ of atividades) {
      const dia = ativ.dia || 1;
      if (!atividadesPorDia[dia]) atividadesPorDia[dia] = [];
      atividadesPorDia[dia].push(ativ);
      custoTotal += parseFloat(ativ.custo_estimado) || 0;
    }

    const dias = Object.keys(atividadesPorDia).sort((a, b) => a - b);

    for (const dia of dias) {
      checkPageBreak(100);

      const headerY = doc.y;
      doc.save();
      doc.fillOpacity(1);
      doc.rect(M, headerY, PW, 30).fill(ORANGE);
      doc.restore();

      doc.fillOpacity(1);
      doc.fontSize(13).fillColor('#ffffff').font('Helvetica-Bold')
        .text(`DIA ${dia}`, M + 15, headerY + 8);

      const custoTotalDia = atividadesPorDia[dia].reduce((s, a) => s + (parseFloat(a.custo_estimado) || 0), 0);
      doc.fontSize(9).fillColor('#ffffff').font('Helvetica')
        .text(`${atividadesPorDia[dia].length} atividade(s)  |  R$ ${custoTotalDia.toFixed(2)}`, M + 15, headerY + 10, { width: PW - 30, align: 'right' });

      doc.y = headerY + 40;

      for (const ativ of atividadesPorDia[dia]) {
        checkPageBreak(85);

        const cardY = doc.y;
        const temDesc = ativ.descricao && ativ.descricao.length > 0;
        const cardH = temDesc ? 78 : 55;

        doc.save();
        doc.fillOpacity(1);
        doc.rect(M + 5, cardY, PW - 10, cardH).fill(LIGHT_BG);
        doc.rect(M + 5, cardY, 4, cardH).fill(ORANGE);
        doc.restore();

        const horario = ativ.horario ? String(ativ.horario).substring(0, 5) : '--:--';

        doc.save();
        doc.fillOpacity(1);
        doc.rect(M + 18, cardY + 8, 44, 18).fill(ORANGE);
        doc.restore();
        doc.fillOpacity(1);
        doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold')
          .text(horario, M + 19, cardY + 12, { width: 42, align: 'center' });

        doc.fontSize(11).fillColor(DARK).font('Helvetica-Bold')
          .text(ativ.nome_atividade || 'Atividade', M + 70, cardY + 10, { width: PW - 170 });

        if (ativ.local) {
          doc.fontSize(8.5).fillColor(GRAY).font('Helvetica')
            .text(`Local: ${ativ.local}`, M + 70, cardY + 26, { width: PW - 170 });
        }

        if (temDesc) {
          const desc = ativ.descricao.length > 140
            ? ativ.descricao.substring(0, 140) + '...'
            : ativ.descricao;
          doc.fontSize(8).fillColor('#888888').font('Helvetica')
            .text(desc, M + 70, cardY + 42, { width: PW - 100 });
        }

        const custo = parseFloat(ativ.custo_estimado) || 0;
        const custoTexto = custo > 0 ? `R$ ${custo.toFixed(2)}` : 'Gratuito';
        const corCusto = custo > 0 ? GREEN : GRAY;

        doc.save();
        doc.fillOpacity(1);
        doc.rect(M + PW - 90, cardY + 8, 75, 16).fill(corCusto);
        doc.restore();
        doc.fillOpacity(1);
        doc.fontSize(8).fillColor('#ffffff').font('Helvetica-Bold')
          .text(custoTexto, M + PW - 89, cardY + 11, { width: 73, align: 'center' });

        doc.y = cardY + cardH + 6;
      }

      doc.moveDown(0.5);
    }

    // === COST SUMMARY ===
    checkPageBreak(100);

    doc.moveDown(0.5);
    const summY = doc.y;

    doc.save();
    doc.fillOpacity(1);
    doc.rect(M, summY, PW, 70).fill('#2d3436');
    doc.restore();

    doc.fillOpacity(0.7);
    doc.fontSize(10).fillColor('#ffffff').font('Helvetica')
      .text('RESUMO FINANCEIRO', M, summY + 12, { width: PW, align: 'center' });

    doc.fillOpacity(1);
    doc.fontSize(22).fillColor('#ffffff').font('Helvetica-Bold')
      .text(`R$ ${custoTotal.toFixed(2)}`, M, summY + 28, { width: PW, align: 'center' });

    const totalAtiv = atividades.length;
    const gratuitas = atividades.filter(a => parseFloat(a.custo_estimado) === 0).length;
    doc.fillOpacity(0.6);
    doc.fontSize(8).fillColor('#ffffff').font('Helvetica')
      .text(`${totalAtiv} atividades  |  ${gratuitas} gratuitas  |  ${dias.length} dia(s)`, M, summY + 54, { width: PW, align: 'center' });

    doc.fillOpacity(1);

    drawFooter();
    doc.end();
  } catch (error) {
    console.error('Erro ao gerar PDF do roteiro:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Erro ao gerar PDF do roteiro' }
      });
    }
  }
}

module.exports = { gerarPDF };
