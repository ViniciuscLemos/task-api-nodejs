const { rateLimit } = require('express-rate-limit');

// Segura quem tenta adivinhar senha na força bruta: por padrão 10 tentativas
// a cada 15 minutos por IP. LIMITE_TENTATIVAS muda o número (os testes usam um valor alto).
function limiteTentativas(maximo = Number(process.env.LIMITE_TENTATIVAS) || 10) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: maximo,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { erro: 'Muitas tentativas. Espere alguns minutos e tente de novo.' },
  });
}

module.exports = limiteTentativas;
