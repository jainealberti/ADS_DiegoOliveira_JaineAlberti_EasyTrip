-- ============================================
-- EasyTrip - Script de criação do banco de dados
-- Planejador Inteligente de Viagens com IA
-- ============================================

CREATE DATABASE easytrip;

\c easytrip;

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS usuario (
    id_usuario SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de viagens
CREATE TABLE IF NOT EXISTS viagem (
    id_viagem SERIAL PRIMARY KEY,
    destino VARCHAR(200) NOT NULL,
    quantidade_dias INTEGER NOT NULL,
    orcamento DECIMAL(10,2),
    nome_preferencia VARCHAR(255),
    meio_transporte VARCHAR(50),
    detalhes_extra TEXT,
    fk_usuario_id_usuario INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de roteiros
CREATE TABLE IF NOT EXISTS roteiro (
    id_roteiro SERIAL PRIMARY KEY,
    titulo VARCHAR(200) NOT NULL,
    descricao TEXT,
    status VARCHAR(50) DEFAULT 'gerado',
    metadados TEXT,
    fk_viagem_id_viagem INTEGER NOT NULL REFERENCES viagem(id_viagem) ON DELETE CASCADE,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de atividades
CREATE TABLE IF NOT EXISTS atividade (
    id_atividade SERIAL PRIMARY KEY,
    nome_atividade VARCHAR(200),
    descricao TEXT,
    local VARCHAR(200),
    dia INTEGER,
    horario VARCHAR(10),
    custo_estimado DECIMAL(10,2),
    lat DECIMAL(10,7),
    lng DECIMAL(10,7),
    tipo VARCHAR(50),
    tempo_visita VARCHAR(50),
    deslocamento_proximo VARCHAR(100),
    realizada BOOLEAN DEFAULT FALSE,
    fk_roteiro_id_roteiro INTEGER NOT NULL REFERENCES roteiro(id_roteiro) ON DELETE CASCADE,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de custos
CREATE TABLE IF NOT EXISTS custo (
    id_custo SERIAL PRIMARY KEY,
    categoria VARCHAR(100),
    descricao VARCHAR(255),
    valor DECIMAL(10,2) NOT NULL,
    id_viagem INTEGER NOT NULL REFERENCES viagem(id_viagem) ON DELETE CASCADE,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_viagem_usuario ON viagem(fk_usuario_id_usuario);
CREATE INDEX IF NOT EXISTS idx_roteiro_viagem ON roteiro(fk_viagem_id_viagem);
CREATE INDEX IF NOT EXISTS idx_atividade_roteiro ON atividade(fk_roteiro_id_roteiro);
CREATE INDEX IF NOT EXISTS idx_custo_viagem ON custo(id_viagem);

-- Caso as tabelas já existam sem as colunas novas, execute:
-- ALTER TABLE viagem ADD COLUMN IF NOT EXISTS meio_transporte VARCHAR(50);
-- ALTER TABLE viagem ADD COLUMN IF NOT EXISTS detalhes_extra TEXT;
-- ALTER TABLE roteiro ADD COLUMN IF NOT EXISTS metadados TEXT;
-- ALTER TABLE atividade ADD COLUMN IF NOT EXISTS dia INTEGER;
-- ALTER TABLE atividade ADD COLUMN IF NOT EXISTS realizada BOOLEAN DEFAULT FALSE;
-- ALTER TABLE atividade ADD COLUMN IF NOT EXISTS lat DECIMAL(10,7);
-- ALTER TABLE atividade ADD COLUMN IF NOT EXISTS lng DECIMAL(10,7);
-- ALTER TABLE atividade ADD COLUMN IF NOT EXISTS tipo VARCHAR(50);
-- ALTER TABLE atividade ADD COLUMN IF NOT EXISTS tempo_visita VARCHAR(50);
-- ALTER TABLE atividade ADD COLUMN IF NOT EXISTS deslocamento_proximo VARCHAR(100);
