#!/usr/bin/env node
/**
 * TDocs7 - MCP Documentation Search Server
 *
 * Entry point do servidor MCP para busca em documentação.
 * Utiliza estratégia RAG-like para dividir e buscar trechos relevantes.
 *
 * @example
 * ```bash
 * # Desenvolvimento
 * npm run dev
 *
 * # Produção
 * npm run build && npm run start
 * ```
 */

import { startServer } from "./server.js";

// Inicia o servidor
startServer().catch((error) => {
    console.error("Erro fatal ao iniciar servidor:", error);
    process.exit(1);
});
