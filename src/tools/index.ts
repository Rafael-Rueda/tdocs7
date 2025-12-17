/**
 * Registro de todas as tools do MCP Server
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerSearchDocsTool } from "./search-docs.js";

/**
 * Registra todas as tools no servidor MCP
 *
 * @param server - Instância do servidor MCP
 */
export function registerAllTools(server: McpServer): void {
    registerSearchDocsTool(server);

    // Adicione novas tools aqui:
    // registerOutraTool(server);
}
