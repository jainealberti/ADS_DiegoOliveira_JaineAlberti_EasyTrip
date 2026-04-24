const express = require('express');
const router = express.Router();
const { criarViagem, listarViagens } = require('../controllers/viagemController');
const verificarToken = require('../middleware/authMiddleware');

router.post('/criar', verificarToken, criarViagem);
router.get('/listar', verificarToken, listarViagens);

module.exports = router;