/**
 * Tool: search_docs
 * Busca informações na documentação configurada
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";

import { getConfig } from "../config/index.js";
import { searchInDocs } from "../lib/doc-search/index.js";
import { fetchDocument, formatHttpError } from "../lib/http-client.js";
import type { SearchOutput } from "../types/index.js";

/**
 * Registra a tool search_docs no servidor MCP
 *
 * @param server - Instância do servidor MCP
 */
export function registerSearchDocsTool(server: McpServer): void {
    const config = getConfig();

    server.registerTool(
        "search_docs",
        {
            title: "Buscar na documentação",
            description: `Busca informações na documentação configurada.
Use para encontrar trechos relevantes sobre um tema específico.
A documentação é carregada da URL configurada no servidor.`,
            inputSchema: {
                search: z.string().min(1).describe("Termo ou frase para buscar na documentação"),
                max_results: z
                    .number()
                    .min(1)
                    .max(10)
                    .optional()
                    .describe(`Número de trechos a retornar (1-10, padrão: ${config.defaultMaxResults})`),
            },
            outputSchema: {
                results: z.array(z.string()).describe("Trechos relevantes encontrados"),
                total_chunks: z.number().describe("Total de seções na documentação"),
                matched_chunks: z.number().describe("Seções com matches"),
                query: z.string().describe("Termo buscado"),
                docs_url: z.string().describe("URL da documentação consultada"),
            },
        },
        async ({ search, max_results }) => {
            const maxResults = max_results ?? config.defaultMaxResults;
            const docsUrl = config.docsUrl;

            try {
                // Busca a documentação
                const document = await fetchDocument(docsUrl);

                // Executa a busca
                const { results, totalChunks, matchedChunks } = searchInDocs(document, search, maxResults);

                // Prepara output
                const output: SearchOutput = {
                    results: results.length > 0 ? results : ["Nenhum resultado encontrado para a busca."],
                    total_chunks: totalChunks,
                    matched_chunks: matchedChunks,
                    query: search,
                    docs_url: docsUrl,
                };

                // Formata texto de resposta
                const responseText =
                    results.length > 0
                        ? `Encontrados ${matchedChunks} trechos relevantes para "${search}":\n\n${results.join("\n\n===\n\n")}`
                        : `Nenhum resultado encontrado para "${search}" na documentação.`;

                return {
                    content: [{ type: "text" as const, text: responseText }],
                    structuredContent: output,
                };
            } catch (error) {
                const { message, userMessage } = formatHttpError(error, docsUrl);

                const output: SearchOutput = {
                    results: [],
                    total_chunks: 0,
                    matched_chunks: 0,
                    query: search,
                    docs_url: docsUrl,
                    error: message,
                };

                return {
                    content: [{ type: "text" as const, text: userMessage }],
                    structuredContent: output,
                };
            }
        },
    );
}
