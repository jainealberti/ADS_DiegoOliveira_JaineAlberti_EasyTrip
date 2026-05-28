const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { adicionarCusto, listarCustos, totalCustos, excluirCusto } = require('../controllers/custoController');
const autenticar = require('../middleware/authMiddleware');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', '..', 'uploads', 'despesas'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `despesa-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Formato de arquivo não suportado. Use JPEG, PNG ou WebP.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.post('/adicionar', autenticar, upload.single('foto_despesa'), adicionarCusto);
router.get('/listar/:id_viagem', autenticar, listarCustos);
router.get('/total/:id_viagem', autenticar, totalCustos);
router.delete('/excluir/:id_custo', autenticar, excluirCusto);

module.exports = router;
