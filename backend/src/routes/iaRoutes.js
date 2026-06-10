const express = require('express');
const router = express.Router();
const { gerarPreferenciasPorCidade, chatIA, explorarDestino } = require('../controllers/iaController');
const verificarToken = require('../middleware/authMiddleware');

router.post('/preferencias', verificarToken, gerarPreferenciasPorCidade);
router.post('/chat', verificarToken, chatIA);
router.post('/explorar-destino', explorarDestino);

module.exports = router;
