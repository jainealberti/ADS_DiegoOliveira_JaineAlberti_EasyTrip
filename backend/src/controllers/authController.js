const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const cadastrar = async (req, res) => {
  const { nome, email, senha } = req.body;

  try {
    const usuarioExiste = await pool.query(
      'SELECT * FROM usuario WHERE email = $1',
      [email]
    );

    if (usuarioExiste.rows.length > 0) {
      return res.status(400).json({ mensagem: 'Email já cadastrado!' });
    }

    const senhaCriptografada = await bcrypt.hash(senha, 10);

    const novoUsuario = await pool.query(
      'INSERT INTO usuario (nome, email, senha) VALUES ($1, $2, $3) RETURNING id_usuario, nome, email',
      [nome, email, senhaCriptografada]
    );

    res.status(201).json({ mensagem: 'Usuário cadastrado com sucesso!', usuario: novoUsuario.rows[0] });
  } catch (erro) {
    res.status(500).json({ mensagem: 'Erro ao cadastrar usuário', erro: erro.message });
  }
};

const login = async (req, res) => {
  const { email, senha } = req.body;

  try {
    const usuario = await pool.query(
      'SELECT * FROM usuario WHERE email = $1',
      [email]
    );

    if (usuario.rows.length === 0) {
      return res.status(400).json({ mensagem: 'Email ou senha inválidos!' });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.rows[0].senha);

    if (!senhaValida) {
      return res.status(400).json({ mensagem: 'Email ou senha inválidos!' });
    }

    const token = jwt.sign(
      { id: usuario.rows[0].id_usuario },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ mensagem: 'Login realizado com sucesso!', token });
  } catch (erro) {
    res.status(500).json({ mensagem: 'Erro ao realizar login', erro: erro.message });
  }
};

module.exports = { cadastrar, login };