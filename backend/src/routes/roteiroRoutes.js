const express = require('express');
const router = express.Router();
const { gerarRoteiro, listarRoteiros, excluirRoteiro, buscarRoteiroPorId, enriquecerComImagens } = require('../controllers/roteiroController');
const { gerarPDF } = require('../controllers/pdfController');
const { compartilharRoteiro, buscarRoteiroPublico, desativarCompartilhamento, enviarPorEmail } = require('../controllers/compartilharController');
const verificarToken = require('../middleware/authMiddleware');

router.post('/gerar', verificarToken, gerarRoteiro);
router.get('/listar', verificarToken, listarRoteiros);
router.get('/publico/:share_token', buscarRoteiroPublico);
router.delete('/excluir/:id_roteiro', verificarToken, excluirRoteiro);
router.get('/:id_roteiro/pdf', verificarToken, gerarPDF);
router.post('/:id_roteiro/compartilhar', verificarToken, compartilharRoteiro);
router.post('/:id_roteiro/enviar-email', verificarToken, enviarPorEmail);
router.patch('/:id_roteiro/desativar-compartilhamento', verificarToken, desativarCompartilhamento);
router.get('/:id_roteiro/imagens', verificarToken, enriquecerComImagens);
router.get('/:id', verificarToken, buscarRoteiroPorId);

module.exports = router;