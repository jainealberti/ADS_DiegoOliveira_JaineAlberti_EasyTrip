# EasyTrip - Planejador Inteligente de Viagens com IA

Sistema web para planejamento de viagens com geração de roteiros inteligentes usando IA (OpenAI). O usuário pode criar viagens, gerar roteiros automáticos, editar atividades e controlar custos.

## Tecnologias Utilizadas

| Camada     | Tecnologia                          |
|------------|-------------------------------------|
| Frontend   | React 19 + Vite + React Router      |
| Backend    | Node.js + Express 5                 |
| Banco      | PostgreSQL                          |
| IA         | OpenAI API (GPT-3.5-turbo)          |
| Auth       | JWT + bcryptjs                       |
| HTTP       | Axios                               |

## Estrutura do Projeto

```
EasyTrip/
├── backend/
│   ├── src/
│   │   ├── config/          # Conexão com o banco (db.js)
│   │   ├── controllers/     # Lógica de negócio (auth, viagem, roteiro, atividade, custo)
│   │   ├── middleware/       # Middleware JWT (authMiddleware.js)
│   │   └── routes/          # Definição de rotas Express
│   ├── database.sql          # Script SQL para criar o banco
│   ├── .env.example          # Modelo de variáveis de ambiente
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # Componentes reutilizáveis (Navbar, RotaPrivada)
│   │   ├── context/         # Contexto de autenticação (AuthContext)
│   │   ├── pages/           # Páginas da aplicação
│   │   ├── services/        # Serviço de API centralizado (Axios)
│   │   ├── App.jsx          # Rotas da aplicação
│   │   ├── main.jsx         # Ponto de entrada
│   │   └── styles.css       # Estilos globais
│   └── package.json
└── README.md
```

## Como Instalar e Rodar

### 1. Pré-requisitos

- Node.js (v18+)
- PostgreSQL
- Git

### 2. Clonar o repositório

```bash
git clone <url-do-repositorio>
cd ADS_DiegoOliveira_JaineAlberti_EasyTrip-main
```

### 3. Configurar o Banco de Dados

Abra o pgAdmin ou psql e execute o script:

```bash
psql -U postgres -f backend/database.sql
```

Ou copie e cole o conteúdo de `backend/database.sql` no pgAdmin.

### 4. Configurar Variáveis de Ambiente

Copie o arquivo de exemplo e preencha:

```bash
cd backend
cp .env.example .env
```

Edite o `.env` com suas credenciais:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=easytrip
DB_USER=postgres
DB_PASSWORD=sua_senha
JWT_SECRET=uma_chave_secreta_qualquer
PORT=3001
OPENAI_API_KEY=sua_chave_openai_aqui
```

> A chave da OpenAI é **opcional**. Sem ela, os roteiros são gerados por template fixo.

### 5. Instalar e Rodar o Backend

```bash
cd backend
npm install
node src/index.js
```

O servidor roda em `http://localhost:3001`.

### 6. Instalar e Rodar o Frontend

```bash
cd frontend
npm install
npm run dev
```

O frontend roda em `http://localhost:5173`.

## Principais Rotas da API

### Autenticação (sem token)

| Método | Rota              | Descrição          |
|--------|-------------------|--------------------|
| POST   | `/auth/cadastrar` | Cadastrar usuário  |
| POST   | `/auth/login`     | Login (retorna JWT)|

### Viagens (token obrigatório)

| Método | Rota                | Descrição              |
|--------|---------------------|------------------------|
| POST   | `/viagem/criar`     | Criar viagem           |
| GET    | `/viagem/listar`    | Listar viagens         |
| GET    | `/viagem/:id`       | Buscar viagem por ID   |
| PUT    | `/viagem/:id`       | Atualizar viagem       |
| DELETE | `/viagem/:id`       | Excluir viagem         |

### Roteiros (token obrigatório)

| Método | Rota                        | Descrição                       |
|--------|-----------------------------|---------------------------------|
| POST   | `/roteiro/gerar`            | Gerar roteiro (IA ou template)  |
| GET    | `/roteiro/listar`           | Listar roteiros                 |
| GET    | `/roteiro/:id`              | Detalhes do roteiro + atividades|
| DELETE | `/roteiro/excluir/:id`      | Excluir roteiro                 |

### Atividades (token obrigatório)

| Método | Rota                         | Descrição              |
|--------|------------------------------|------------------------|
| POST   | `/atividade/adicionar`       | Adicionar atividade    |
| PUT    | `/atividade/editar/:id`      | Editar atividade       |
| DELETE | `/atividade/excluir/:id`     | Excluir atividade      |

### Custos (token obrigatório)

| Método | Rota                        | Descrição              |
|--------|------------------------------|------------------------|
| POST   | `/custo/adicionar`           | Adicionar custo        |
| GET    | `/custo/listar/:id_viagem`   | Listar custos          |
| GET    | `/custo/total/:id_viagem`    | Total de custos        |
| DELETE | `/custo/excluir/:id_custo`   | Excluir custo          |

## Fluxo Principal

```
Cadastro → Login → Criar Viagem → Gerar Roteiro com IA →
Visualizar Roteiro → Editar Atividades → Controlar Custos
```

## Segurança

- Senhas são criptografadas com **bcryptjs** (hash + salt)
- Autenticação via **JWT** com validade de 24 horas
- Todas as rotas protegidas verificam o token no header `Authorization: Bearer <token>`
- Cada usuário só acessa seus próprios dados (verificação por `id_usuario` em todas as queries)
- Variáveis sensíveis ficam no `.env` (não versionado)
- Senhas nunca são retornadas nas respostas da API

## Integração com IA

O EasyTrip utiliza a API da OpenAI para gerar roteiros inteligentes. Quando o usuário clica em "Gerar Roteiro com IA":

1. O sistema envia destino, dias, orçamento e preferências para a OpenAI
2. A IA retorna um roteiro estruturado com atividades, horários e custos estimados
3. O roteiro é salvo no banco de dados
4. Se a API falhar ou não estiver configurada, um roteiro template é gerado como fallback

## Autores

- Diego Oliveira
- Jaine Alberti

## Licença

Projeto acadêmico - Análise e Desenvolvimento de Sistemas (ADS)
