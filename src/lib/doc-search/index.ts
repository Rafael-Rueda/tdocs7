/**
 * Módulo de busca em documentação (RAG-like)
 * Exporta a função principal de busca e utilitários
 */

import { getExpandedContext, splitIntoChunks } from "./chunker.js";
import { calculateRelevanceScore, extractSearchTerms } from "./scorer.js";
import type { ChunkingOptions, DocChunk, SearchResult } from "../../types/index.js";

// Re-exporta funções de detecção de formato
export { detectDocumentFormat, isHtmlDocument, isJsonDocument, isMarkdownDocument } from "./format-detector.js";
// Re-exporta chunker HTML
export { htmlToSimpleMarkdown, splitHtmlIntoChunks } from "./html-chunker.js";
// Re-exporta patterns
export { HTML_PATTERNS, SEPARATION_PATTERNS } from "./patterns.js";
// Re-exporta utilitários de scoring
export { escapeRegex, normalizeText } from "./scorer.js";

/**
 * Opções para a função de busca
 */
export interface SearchOptions extends ChunkingOptions {
    /** Número máximo de resultados a retornar (padrão: 3) */
    maxResults?: number;
}

/**
 * Busca os trechos mais relevantes na documentação
 * Detecta automaticamente o formato do documento e aplica estratégia de chunking adequada
 *
 * @param document - Documento completo para buscar
 * @param searchQuery - Query de busca do usuário
 * @param options - Opções de busca (maxResults, forceFormat, enableHtmlFallback, enableJsonFallback)
 * @returns Objeto com resultados da busca
 *
 * @example
 * ```typescript
 * // Busca padrão com detecção automática de formato
 * const result = searchInDocs(documentContent, "como criar uma tool");
 *
 * // Forçando formato HTML
 * const result = searchInDocs(htmlContent, "authentication", { forceFormat: "html" });
 *
 * // Desabilitando fallback HTML
 * const result = searchInDocs(content, "query", { enableHtmlFallback: false });
 * ```
 */
export function searchInDocs(document: string, searchQuery: string, options: SearchOptions = {}): SearchResult {
    const { maxResults = 3, ...chunkingOptions } = options;

    // 1. Divide documento em chunks (com detecção automática de formato)
    const chunks = splitIntoChunks(document, chunkingOptions);

    // 2. Extrai termos de busca
    const searchTerms = extractSearchTerms(searchQuery);

    // 3. Calcula score de relevância para cada chunk
    const scoredChunks: DocChunk[] = chunks.map((content, index) => ({
        content,
        index,
        score: calculateRelevanceScore(content, searchTerms),
    }));

    // 4. Filtra chunks com score > 0 e ordena por relevância
    const relevantChunks = scoredChunks.filter((chunk) => chunk.score > 0).sort((a, b) => b.score - a.score);

    // 5. Seleciona os melhores resultados com contexto expandido
    const results = selectBestResults(chunks, relevantChunks, maxResults);

    return {
        results,
        totalChunks: chunks.length,
        matchedChunks: relevantChunks.length,
    };
}

/**
 * Versão simplificada mantida para compatibilidade
 * @deprecated Use searchInDocs com options ao invés
 */
export function searchInDocsLegacy(document: string, searchQuery: string, maxResults = 3): SearchResult {
    return searchInDocs(document, searchQuery, { maxResults });
}

/**
 * Seleciona os melhores resultados, evitando sobreposição de contexto
 */
function selectBestResults(chunks: string[], relevantChunks: DocChunk[], maxResults: number): string[] {
    const results: string[] = [];
    const usedIndices = new Set<number>();

    for (const chunk of relevantChunks) {
        // Para quando atingir o máximo de resultados
        if (results.length >= maxResults) break;

        // Pula se este índice já foi usado (evita sobreposição)
        if (usedIndices.has(chunk.index)) continue;

        // Marca índices usados (incluindo adjacentes)
        usedIndices.add(chunk.index);
        if (chunk.index > 0) {
            usedIndices.add(chunk.index - 1);
        }
        if (chunk.index < chunks.length - 1) {
            usedIndices.add(chunk.index + 1);
        }

        // Adiciona contexto expandido ao resultado
        const expandedContext = getExpandedContext(chunks, chunk.index);
        results.push(expandedContext);
    }

    return results;
}
