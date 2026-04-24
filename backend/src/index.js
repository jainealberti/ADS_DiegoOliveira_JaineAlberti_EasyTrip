const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { Pool } = require('pg');

const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

pool.connect()
  .then(() => console.log('Conectado ao banco de dados!'))
  .catch((err) => console.error('Erro ao conectar ao banco:', err));

app.get('/', (req, res) => {
  res.json({ mensagem: 'Servidor EasyTrip funcionando!' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});