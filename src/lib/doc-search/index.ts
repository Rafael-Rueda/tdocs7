/**
 * Módulo de busca em documentação (RAG-like)
 * Exporta a função principal de busca e utilitários
 */

import type { DocChunk, SearchResult } from "../../types/index.js";
import { splitIntoChunks, getExpandedContext } from "./chunker.js";
import { calculateRelevanceScore, extractSearchTerms } from "./scorer.js";

// Re-exporta utilitários úteis
export { normalizeText, escapeRegex } from "./scorer.js";
export { SEPARATION_PATTERNS } from "./patterns.js";

/**
 * Busca os trechos mais relevantes na documentação
 *
 * @param document - Documento completo para buscar
 * @param searchQuery - Query de busca do usuário
 * @param maxResults - Número máximo de resultados a retornar
 * @returns Objeto com resultados da busca
 *
 * @example
 * ```typescript
 * const result = searchInDocs(documentContent, "como criar uma tool", 3);
 * console.log(result.results); // Array com os 3 trechos mais relevantes
 * ```
 */
export function searchInDocs(document: string, searchQuery: string, maxResults: number = 3): SearchResult {
    // 1. Divide documento em chunks
    const chunks = splitIntoChunks(document);

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
