const jwt = require('jsonwebtoken');

const verificarToken = (req, res, next) => {
  const token = req.headers['authorization'];

  if (!token) {
    return res.status(401).json({ mensagem: 'Acesso negado! Token não encontrado.' });
  }

  try {
    const tokenLimpo = token.replace('Bearer ', '');
    const dados = jwt.verify(tokenLimpo, process.env.JWT_SECRET);
    req.usuario = dados;
    next();
  } catch (erro) {
    res.status(401).json({ mensagem: 'Token inválido!' });
  }
};

module.exports = verificarToken;