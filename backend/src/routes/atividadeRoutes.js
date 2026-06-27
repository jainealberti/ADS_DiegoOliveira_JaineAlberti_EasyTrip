const express = require('express');
const router = express.Router();
const { editarAtividade, adicionarAtividade, excluirAtividade, toggleRealizada } = require('../controllers/atividadeController');
const autenticar = require('../middleware/authMiddleware');

router.post('/adicionar', autenticar, adicionarAtividade);
router.put('/editar/:id_atividade', autenticar, editarAtividade);
router.patch('/realizada/:id_atividade', autenticar, toggleRealizada);
router.delete('/excluir/:id_atividade', autenticar, excluirAtividade);

module.exports = router;