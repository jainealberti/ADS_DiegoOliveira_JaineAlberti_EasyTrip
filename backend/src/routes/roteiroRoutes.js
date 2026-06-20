const express = require('express');
const router = express.Router();
const { gerarRoteiro, listarRoteiros, buscarRoteiro, excluirRoteiro } = require('../controllers/roteiroController');
const { gerarPDF } = require('../controllers/pdfController');
const { compartilharRoteiro, buscarRoteiroPublico, desativarCompartilhamento } = require('../controllers/compartilharController');
const verificarToken = require('../middleware/authMiddleware');

router.post('/gerar', verificarToken, gerarRoteiro);
router.get('/listar', verificarToken, listarRoteiros);

router.get('/publico/:share_token', buscarRoteiroPublico);

router.get('/:id_roteiro/pdf', verificarToken, gerarPDF);
router.post('/:id_roteiro/compartilhar', verificarToken, compartilharRoteiro);
router.patch('/:id_roteiro/desativar-compartilhamento', verificarToken, desativarCompartilhamento);

router.get('/:id_roteiro', verificarToken, buscarRoteiro);
router.delete('/excluir/:id_roteiro', verificarToken, excluirRoteiro);

module.exports = router;
