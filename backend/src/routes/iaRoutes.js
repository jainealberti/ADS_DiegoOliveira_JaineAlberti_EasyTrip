const express = require('express');
const router = express.Router();
const { gerarPreferenciasPorCidade, chatIA } = require('../controllers/iaController');
const verificarToken = require('../middleware/authMiddleware');

router.post('/preferencias', verificarToken, gerarPreferenciasPorCidade);
router.post('/chat', verificarToken, chatIA);

module.exports = router;
