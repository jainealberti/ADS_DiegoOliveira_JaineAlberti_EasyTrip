const express = require('express');
const router = express.Router();
const { editarAtividade } = require('../controllers/atividadeController');
const autenticar = require('../middleware/authMiddleware');

router.put('/editar/:id_atividade', autenticar, editarAtividade);

module.exports = router;