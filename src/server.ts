/**
 * Configuração e inicialização do servidor MCP
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { getConfig, logStartup } from "./config/index.js";
import { registerAllTools } from "./tools/index.js";

/**
 * Cria e configura o servidor MCP
 */
export function createServer(): McpServer {
    // Carrega configuração (valida variáveis de ambiente)
    const config = getConfig();

    // Log de inicialização
    logStartup(config);

    // Cria instância do servidor
    const server = new McpServer({
        name: "tdocs7",
        version: "1.0.0",
    });

    // Registra todas as tools
    registerAllTools(server);

    return server;
}

/**
 * Inicia o servidor com transporte stdio
 */
export async function startServer(): Promise<void> {
    const server = createServer();

    // Conecta via stdio (padrão para MCP)
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error("Server conectado e aguardando requisições...");
}
