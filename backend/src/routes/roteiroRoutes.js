const express = require('express');
const router = express.Router();
const { gerarRoteiro, listarRoteiros, buscarRoteiro, excluirRoteiro } = require('../controllers/roteiroController');
const verificarToken = require('../middleware/authMiddleware');

router.post('/gerar', verificarToken, gerarRoteiro);
router.get('/listar', verificarToken, listarRoteiros);
router.get('/:id_roteiro', verificarToken, buscarRoteiro);
router.delete('/excluir/:id_roteiro', verificarToken, excluirRoteiro);

module.exports = router;
