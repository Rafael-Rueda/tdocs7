# TDocs7

MCP Server para busca inteligente em documentação com estratégia RAG-like.

## O que faz?

O TDocs7 é um servidor [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) que permite que assistentes de IA (como Claude) busquem informações em sua documentação de forma inteligente.

- Carrega documentação de uma URL configurada
- Divide o conteúdo em chunks semânticos
- Busca e rankeia os trechos mais relevantes
- Retorna resultados formatados para o assistente

## Instalacao

### Via npx (recomendado)

Nao precisa instalar nada. Configure diretamente no seu cliente MCP.

### Via npm (global)

```bash
npm install -g tdocs7
```

## Configuracao

### Claude Code

Adicione ao seu arquivo `.mcp.json`:

```json
{
  "mcpServers": {
    "tdocs7": {
      "command": "npx",
      "args": ["-y", "tdocs7"],
      "env": {
        "MCP_DOCS_URL": "https://sua-api.com/docs",
        "MCP_JWT_TOKEN": "seu_token_jwt"
      }
    }
  }
}
```

### Claude Desktop

Adicione ao arquivo de configuracao (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "tdocs7": {
      "command": "npx",
      "args": ["-y", "tdocs7"],
      "env": {
        "MCP_DOCS_URL": "https://sua-api.com/docs",
        "MCP_JWT_TOKEN": "seu_token_jwt"
      }
    }
  }
}
```

## Variaveis de Ambiente

| Variavel | Obrigatorio | Descricao | Default |
|----------|-------------|-----------|---------|
| `MCP_DOCS_URL` | Sim | URL da documentacao | - |
| `MCP_JWT_TOKEN` | Sim | Token JWT para autenticacao | - |
| `MCP_DEFAULT_MAX_RESULTS` | Nao | Numero de resultados por busca (1-10) | 3 |
| `MCP_REQUEST_TIMEOUT` | Nao | Timeout em ms | 10000 |

## Tools Disponiveis

### `search_docs`

Busca informacoes na documentacao configurada.

**Parametros:**
- `search` (string, obrigatorio): Termo ou frase para buscar
- `max_results` (number, opcional): Numero de trechos a retornar (1-10)

**Exemplo de uso pelo assistente:**
```
Buscando "autenticacao" na documentacao...
```

## Desenvolvimento

```bash
# Clonar o repositorio
git clone https://github.com/SEU_USUARIO/tdocs7.git
cd tdocs7

# Instalar dependencias
npm install

# Configurar variaveis de ambiente
cp .env.example .env
# Edite o arquivo .env com suas configuracoes

# Rodar em desenvolvimento
npm run dev

# Build
npm run build

# Lint e formatacao
npm run lint
npm run format
```

## Requisitos

- Node.js >= 20.0.0

## Licenca

ISC
