const express = require('express');
const router = express.Router();
const { criarViagem, listarViagens, buscarViagem, atualizarViagem, excluirViagem } = require('../controllers/viagemController');
const verificarToken = require('../middleware/authMiddleware');

router.post('/criar', verificarToken, criarViagem);
router.get('/listar', verificarToken, listarViagens);
router.get('/:id_viagem', verificarToken, buscarViagem);
router.put('/:id_viagem', verificarToken, atualizarViagem);
router.delete('/:id_viagem', verificarToken, excluirViagem);

module.exports = router;
