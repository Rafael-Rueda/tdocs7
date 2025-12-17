# TDocs7

MCP Server for intelligent documentation search with RAG-like strategy.

## What does it do?

TDocs7 is an [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that allows AI assistants (like Claude) to intelligently search your documentation.

- Loads documentation from a configured URL
- Splits content into semantic chunks
- Searches and ranks the most relevant excerpts
- Returns formatted results to the assistant

## Installation

### Via npx (recommended)

No installation required. Configure directly in your MCP client.

### Via npm (global)

```bash
npm install -g tdocs7
```

## Configuration

### Claude Code

Add to your `.mcp.json` file:

```json
{
  "mcpServers": {
    "tdocs7": {
      "command": "npx",
      "args": ["-y", "tdocs7"],
      "env": {
        "MCP_DOCS_URL": "https://your-api.com/docs",
        "MCP_JWT_TOKEN": "your_jwt_token"
      }
    }
  }
}
```

### Claude Desktop

Add to the configuration file (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "tdocs7": {
      "command": "npx",
      "args": ["-y", "tdocs7"],
      "env": {
        "MCP_DOCS_URL": "https://your-api.com/docs",
        "MCP_JWT_TOKEN": "your_jwt_token"
      }
    }
  }
}
```

## Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `MCP_DOCS_URL` | Yes | Documentation URL | - |
| `MCP_JWT_TOKEN` | Yes | JWT token for authentication | - |
| `MCP_DEFAULT_MAX_RESULTS` | No | Number of results per search (1-10) | 3 |
| `MCP_REQUEST_TIMEOUT` | No | Timeout in ms | 10000 |

## Available Tools

### `search_docs`

Searches for information in the configured documentation.

**Parameters:**
- `search` (string, required): Term or phrase to search
- `max_results` (number, optional): Number of excerpts to return (1-10)

**Example usage by assistant:**
```
Searching for "authentication" in the documentation...
```

## Development

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/tdocs7.git
cd tdocs7

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit the .env file with your settings

# Run in development
npm run dev

# Build
npm run build

# Lint and format
npm run lint
npm run format
```

## Requirements

- Node.js >= 20.0.0

## License

ISC
