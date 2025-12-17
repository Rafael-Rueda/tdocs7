/**
 * Módulo de configuração do MCP Server
 * Carrega e valida variáveis de ambiente
 */

import type { MCPConfig } from "../types/index.js";

/**
 * Carrega e valida as configurações do MCP a partir de variáveis de ambiente
 * @throws {Error} Se variáveis obrigatórias não estiverem definidas
 */
export function loadConfig(): MCPConfig {
    const docsUrl = process.env.MCP_DOCS_URL;
    const jwtToken = process.env.MCP_JWT_TOKEN;
    const defaultMaxResults = parseInt(process.env.MCP_DEFAULT_MAX_RESULTS || "3", 10);
    const requestTimeout = parseInt(process.env.MCP_REQUEST_TIMEOUT || "10000", 10);

    // Validação das variáveis obrigatórias
    const errors: string[] = [];

    if (!docsUrl) {
        errors.push("MCP_DOCS_URL não configurada - URL da documentação");
    }

    if (!jwtToken) {
        errors.push("MCP_JWT_TOKEN não configurado - Token de autenticação");
    }

    if (errors.length > 0) {
        console.error("╔══════════════════════════════════════════════════════════╗");
        console.error("║           ERRO DE CONFIGURAÇÃO - TDocs7                  ║");
        console.error("╠══════════════════════════════════════════════════════════╣");
        for (const error of errors) {
            console.error(`║ ❌ ${error.padEnd(54)}║`);
        }
        console.error("╠══════════════════════════════════════════════════════════╣");
        console.error("║ Configure as variáveis no arquivo .env                   ║");
        console.error("║ Veja .env.example para referência                        ║");
        console.error("╚══════════════════════════════════════════════════════════╝");
        process.exit(1);
    }

    return {
        docsUrl: docsUrl!,
        jwtToken: jwtToken!,
        defaultMaxResults: clamp(defaultMaxResults, 1, 10),
        requestTimeout: Math.max(requestTimeout, 1000),
    };
}

/**
 * Limita um número entre um mínimo e máximo
 */
function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/**
 * Mascara um token para exibição segura em logs
 */
export function maskToken(token: string): string {
    if (token.length <= 14) {
        return "***";
    }
    return `${token.slice(0, 10)}...${token.slice(-4)}`;
}

/**
 * Exibe log de inicialização com as configurações carregadas
 */
export function logStartup(config: MCPConfig): void {
    console.error("╔══════════════════════════════════════════════════════════╗");
    console.error("║         TDocs7 - MCP Documentation Search Server         ║");
    console.error("╠══════════════════════════════════════════════════════════╣");
    console.error(`║ Docs URL:     ${config.docsUrl.slice(0, 42).padEnd(42)} ║`);
    console.error(`║ JWT Token:    ${maskToken(config.jwtToken).padEnd(42)} ║`);
    console.error(`║ Max Results:  ${String(config.defaultMaxResults).padEnd(42)} ║`);
    console.error(`║ Timeout:      ${`${config.requestTimeout}ms`.padEnd(42)} ║`);
    console.error("╚══════════════════════════════════════════════════════════╝");
}

// Singleton da configuração
let configInstance: MCPConfig | null = null;

/**
 * Retorna a instância de configuração (singleton)
 * Carrega na primeira chamada
 */
export function getConfig(): MCPConfig {
    if (!configInstance) {
        configInstance = loadConfig();
    }
    return configInstance;
}
