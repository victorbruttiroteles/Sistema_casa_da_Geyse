# Sistema de Reservas — Casa da Geyse
## Guia de Instalação e Configuração

---

## Pré-requisitos

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- (Opcional) Docker + Docker Compose

---

## 1. Instalação Rápida (Desenvolvimento)

```bash
# 1. Entrar na pasta do projeto
cd casa-da-geyse-reservas

# 2. Instalar dependências de todos os workspaces
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# 3. Configurar variáveis de ambiente do backend
cp backend/.env.example backend/.env
# Edite o arquivo backend/.env com suas credenciais

# 4. Criar banco de dados e rodar migrations
cd backend
node src/config/migrate.js

# 5. Popular banco com dados iniciais (cidades, casas, quartos, admin)
node src/config/seed.js

# 6. Iniciar backend e frontend em paralelo
cd ..
npm run dev
```

Acesse: **http://localhost:5173**  
Login: `admin@casadageyse.com.br` / `Admin@2024!`

---

## 2. Instalação com Docker (Produção)

```bash
# 1. Configurar .env
cp backend/.env.example backend/.env
# Edite backend/.env com todas as credenciais de produção

# 2. Subir todos os serviços
docker-compose up -d

# 3. Rodar migrations e seed (apenas na primeira vez)
docker exec geyse_backend node src/config/migrate.js
docker exec geyse_backend node src/config/seed.js
```

Acesse: **http://seu-servidor**

---

## 3. Configuração das Integrações Externas

### 3.1 Efí Bank (Pagamentos Pix)

1. Acesse https://sejaefi.com.br e crie uma conta
2. Vá em **API → Credenciais → Produção**
3. Copie `Client ID` e `Client Secret`
4. Ative o webhook para o endpoint: `https://seu-dominio.com/api/webhooks/pix`
5. Preencha no `.env`:
   ```
   EFI_CLIENT_ID=seu_client_id
   EFI_CLIENT_SECRET=seu_client_secret
   EFI_SANDBOX=false
   EFI_PIX_KEY=sua_chave_pix
   EFI_WEBHOOK_SECRET=uma_string_secreta_qualquer
   ```

### 3.2 Evolution API (WhatsApp Bot)

1. Instale a Evolution API no mesmo servidor:
   ```bash
   docker run -d --name evolution_api \
     -p 8080:8080 \
     -e AUTHENTICATION_API_KEY=sua_api_key \
     atendai/evolution-api:latest
   ```
2. Crie uma instância e escaneie o QR Code
3. Configure o webhook apontando para: `https://seu-dominio.com/api/webhooks/whatsapp`
4. Preencha no `.env`:
   ```
   EVOLUTION_API_URL=http://localhost:8080
   EVOLUTION_API_KEY=sua_api_key
   EVOLUTION_INSTANCE=casa_geyse
   ```

### 3.3 N8N (Automações Avançadas) — Opcional

O sistema já possui automações nativas via node-cron. O N8N é opcional para automações mais complexas.

---

## 4. Estrutura do Projeto

```
casa-da-geyse-reservas/
├── backend/
│   ├── src/
│   │   ├── config/          # DB, Redis, migrations, seed
│   │   ├── middlewares/     # Auth JWT
│   │   ├── routes/          # Todas as rotas da API
│   │   ├── services/        # Pix, WhatsApp, Bot, Scheduler
│   │   └── utils/           # Helpers
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # Layout, UI (Modal, Table, Badge...)
│   │   ├── pages/           # Todas as páginas do painel
│   │   ├── services/        # API client (axios)
│   │   └── store/           # Zustand (auth)
│   └── package.json
├── docker-compose.yml
└── INSTALACAO.md
```

---

## 5. Rotas da API

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/auth/login` | Login admin |
| GET | `/api/cities` | Listar cidades |
| GET | `/api/houses` | Listar casas |
| GET | `/api/rooms` | Quartos com disponibilidade |
| GET | `/api/companions` | Acompanhantes com filtros |
| POST | `/api/reservations` | Criar reserva + Pix |
| POST | `/api/reservations/:id/renew` | Renovar reserva |
| GET | `/api/customers` | CRM — lista clientes |
| GET | `/api/reports/dashboard` | Dados do dashboard |
| GET | `/api/reports/room-map` | Mapa de quartos ao vivo |
| POST | `/api/webhooks/pix` | Webhook Efí Bank |
| POST | `/api/webhooks/whatsapp` | Webhook Evolution API |
| POST | `/api/campaigns/:id/send` | Disparar campanha |
| GET | `/api/settings` | Configurações do sistema |

---

## 6. Perfis de Acesso

| Perfil | Acesso |
|--------|--------|
| `super_admin` | Acesso total |
| `house_manager` | Sua unidade: quartos, reservas, relatórios |
| `receptionist` | Visualizar reservas + check-in manual |
| `financial` | Relatórios e extrato financeiro |

---

## 7. Fluxo do Bot WhatsApp

```
Cliente entra →
  ✅ Confirmação de maioridade (SIM/NÃO)
  🏙️ Seleção de cidade
  🏠 Seleção de casa
  🛏️ Seleção de quarto e duração
  👥 Acompanhante (opcional)
  💳 Checkout Pix (QR Code 10 min)
  ✅ Confirmação automática ao pagar
  ⏰ Alerta 15 min antes do término → Renovação
  ⭐ NPS 1h após o checkout
```

---

## 8. Variáveis de Ambiente Obrigatórias

```env
DB_PASSWORD=               # Senha do PostgreSQL
JWT_SECRET=                # Chave secreta JWT (mínimo 32 chars)
EFI_CLIENT_ID=             # Credencial Efí Bank
EFI_CLIENT_SECRET=         # Credencial Efí Bank
EFI_PIX_KEY=               # Chave Pix registrada no Efí
EFI_WEBHOOK_SECRET=        # String secreta para validar webhook
EVOLUTION_API_KEY=         # Chave da Evolution API
EVOLUTION_INSTANCE=        # Nome da instância WhatsApp
ADMIN_WHATSAPP=            # WhatsApp do admin (relatório diário)
```

---

Sistema desenvolvido para uso restrito a maiores de 18 anos. Conformidade LGPD aplicada.
