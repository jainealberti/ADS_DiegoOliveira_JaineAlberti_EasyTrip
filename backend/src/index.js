const express = require('express');
const cors = require('cors');
require('dotenv').config();
const pool = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const viagemRoutes = require('./routes/viagemRoutes');
const roteiroRoutes = require('./routes/roteiroRoutes');
const atividadeRoutes = require('./routes/atividadeRoutes');
const custoRoutes = require('./routes/custoRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/viagem', viagemRoutes);
app.use('/roteiro', roteiroRoutes);
app.use('/atividade', atividadeRoutes);
app.use('/custo', custoRoutes);

app.get('/', (req, res) => {
  res.json({ mensagem: 'Servidor EasyTrip funcionando!' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

pool.connect()
  .then(() => console.log('Conectado ao banco de dados!'))
  .catch((err) => console.error('Erro ao conectar ao banco:', err));