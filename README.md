# freio. — Controle Financeiro Pessoal

> Aplicativo mobile para evitar compras por impulso e gerenciar finanças pelo método **50-30-20**.

**Desenvolvido por [Maikelen Salles](https://maikelen-dev.web.app/)**
**Demo:** [freio-app.web.app](https://freio-app.web.app)

---

## Sobre o projeto

O **freio.** ajuda o usuário a ter consciência de seus gastos em tempo real. Com um termômetro visual baseado no método 50-30-20, é possível acompanhar quanto da renda está sendo gasto em necessidades fixas, variáveis e reserva — e colocar o freio antes de gastar por impulso.

**Funcionalidades:**
- Registro de ganhos (salário, freela, Pix recebido) como fluxo de caixa real
- Termômetro 50-30-20 calculado sobre os ganhos do mês
- Atalhos rápidos para lançar gastos recorrentes
- Marcação de compras por impulso
- Agenda mensal com breakdown por categoria e bucket
- Renda Fixa Base + Ganhos Variáveis = Total Disponível do mês
- Autenticação segura com RLS por usuário (cada um vê apenas seus próprios dados)

---

## Stack

| Tecnologia | Uso |
|---|---|
| **React Native** | Framework mobile cross-platform |
| **Expo** (SDK 54) + **Expo Router** | Build toolchain e navegação baseada em arquivos |
| **TypeScript** | Tipagem estática em todo o projeto |
| **Supabase** | Backend as a Service: PostgreSQL, Auth e Row Level Security |
| **Supabase Auth** | Autenticação por e-mail/senha com sessão persistida |
| **Row Level Security (RLS)** | Isolamento de dados por usuário no banco |
| **React Context API** | Estado global de sessão e renda base compartilhados entre telas |
| **Ionicons** | Ícones via `@expo/vector-icons` |

---

## Estrutura principal

```
app/
  _layout.tsx          # Auth guard + provider raiz
  login.tsx            # Tela de autenticação
  (tabs)/
    index.tsx          # Home: ganhos, termômetro 50-30-20, gastos rápidos
    calendar.tsx       # Agenda: breakdown por categoria e bucket
    profile.tsx        # Perfil do usuário

hooks/
  AppContext.tsx       # Contexto global: sessão, renda base

src/lib/
  supabase.ts          # Cliente Supabase configurado
```

---

## Como rodar localmente

```bash
# Instalar dependências
npm install

# Iniciar o servidor de desenvolvimento
npx expo start
```

Abra no [Expo Go](https://expo.dev/go), emulador Android/iOS ou build de desenvolvimento.

### Variáveis de ambiente

Crie um arquivo `.env` na raiz com:

```env
EXPO_PUBLIC_SUPABASE_URL=sua_url_aqui
EXPO_PUBLIC_SUPABASE_ANON_KEY=sua_chave_aqui
```

---

## Banco de dados (Supabase)

O projeto utiliza duas tabelas principais com RLS ativo:

- **`categories`** — categorias de gasto (fixos, variáveis, reserva) com ícone e bucket 50-30-20
- **`transactions`** — transações do usuário com `type: 'income' | 'expense'`, `user_id` e `category_id`

---

## Autora

**Maikelen Salles**
[maikelen-dev.web.app](https://maikelen-dev.web.app/)
