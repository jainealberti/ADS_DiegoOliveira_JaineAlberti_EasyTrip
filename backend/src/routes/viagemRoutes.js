const express = require('express');
const router = express.Router();
const { criarViagem, listarViagens, buscarViagemPorId, atualizarViagem, excluirViagem } = require('../controllers/viagemController');
const verificarToken = require('../middleware/authMiddleware');

router.post('/criar', verificarToken, criarViagem);
router.get('/listar', verificarToken, listarViagens);
router.get('/:id', verificarToken, buscarViagemPorId);
router.put('/:id', verificarToken, atualizarViagem);
router.delete('/:id', verificarToken, excluirViagem);

module.exports = router;