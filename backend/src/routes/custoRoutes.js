const express = require('express');
const router = express.Router();
const { adicionarCusto, listarCustos, totalCustos, excluirCusto } = require('../controllers/custoController');
const autenticar = require('../middleware/authMiddleware');

// Adicionar custo
router.post('/adicionar', autenticar, adicionarCusto);

// Listar custos de uma viagem
router.get('/listar/:id_viagem', autenticar, listarCustos);

// Total de custos de uma viagem
router.get('/total/:id_viagem', autenticar, totalCustos);

// Excluir custo
router.delete('/excluir/:id_custo', autenticar, excluirCusto);

module.exports = router;