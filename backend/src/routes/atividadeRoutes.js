const express = require('express');
const router = express.Router();
const { editarAtividade, adicionarAtividade, excluirAtividade, marcarRealizada } = require('../controllers/atividadeController');
const verificarToken = require('../middleware/authMiddleware');

router.post('/adicionar', verificarToken, adicionarAtividade);
router.put('/editar/:id_atividade', verificarToken, editarAtividade);
router.patch('/realizada/:id_atividade', verificarToken, marcarRealizada);
router.delete('/excluir/:id_atividade', verificarToken, excluirAtividade);

module.exports = router;
