/**
 * Módulo de divisão de documentação em chunks
 * Implementa estratégia hierárquica de chunking
 */

import { SEPARATION_PATTERNS, MAX_CHUNK_SIZE, MIN_CHUNK_SIZE, MAX_CONTEXT_SIZE } from "./patterns.js";

/**
 * Divide o documento em chunks usando padrões de separação hierárquicos
 * Prioridade: Headers > Separadores horizontais > Parágrafos > Sentenças
 *
 * @param document - Documento completo para dividir
 * @returns Array de chunks de texto
 */
export function splitIntoChunks(document: string): string[] {
    let chunks: string[] = [document];

    // 1. Tenta dividir por headers markdown (mantém o header com o conteúdo)
    const headerSplit = document.split(SEPARATION_PATTERNS.headers).filter((chunk) => chunk.trim());

    if (headerSplit.length > 1) {
        chunks = headerSplit;
    } else {
        // 2. Se não tem headers, divide por separadores horizontais
        const separatorSplit = document.split(SEPARATION_PATTERNS.horizontalRules).filter((chunk) => chunk.trim());

        if (separatorSplit.length > 1) {
            chunks = separatorSplit;
        } else {
            // 3. Fallback: divide por parágrafos (2+ quebras de linha)
            chunks = document.split(SEPARATION_PATTERNS.paragraphs).filter((chunk) => chunk.trim());
        }
    }

    // 4. Refina chunks muito grandes
    const refinedChunks = refineChunks(chunks);

    // 5. Remove chunks muito pequenos
    return refinedChunks.filter((chunk) => chunk.trim().length > MIN_CHUNK_SIZE);
}

/**
 * Subdivide chunks que excedem o tamanho máximo
 *
 * @param chunks - Array de chunks para refinar
 * @returns Array de chunks refinados
 */
function refineChunks(chunks: string[]): string[] {
    const refinedChunks: string[] = [];

    for (const chunk of chunks) {
        if (chunk.length <= MAX_CHUNK_SIZE) {
            refinedChunks.push(chunk);
            continue;
        }

        // Tenta subdividir por parágrafos
        const subChunks = chunk.split(SEPARATION_PATTERNS.paragraphs).filter((c) => c.trim());

        if (subChunks.length > 1) {
            refinedChunks.push(...subChunks);
        } else {
            // Último recurso: divide por sentenças
            const sentenceChunks = splitBySentences(chunk);
            refinedChunks.push(...sentenceChunks);
        }
    }

    return refinedChunks;
}

/**
 * Divide um chunk por sentenças, agrupando para não exceder o tamanho máximo
 *
 * @param chunk - Chunk para dividir
 * @returns Array de chunks divididos por sentenças
 */
function splitBySentences(chunk: string): string[] {
    const sentences = chunk.split(SEPARATION_PATTERNS.sentences);
    const result: string[] = [];
    let currentChunk = "";

    for (const sentence of sentences) {
        const wouldExceed = (currentChunk + sentence).length > MAX_CHUNK_SIZE && currentChunk;

        if (wouldExceed) {
            result.push(currentChunk.trim());
            currentChunk = sentence;
        } else {
            currentChunk += (currentChunk ? " " : "") + sentence;
        }
    }

    if (currentChunk.trim()) {
        result.push(currentChunk.trim());
    }

    return result;
}

/**
 * Extrai o contexto expandido de um chunk, incluindo chunks adjacentes
 *
 * @param chunks - Array completo de chunks
 * @param targetIndex - Índice do chunk alvo
 * @returns Contexto expandido com chunks adjacentes
 */
export function getExpandedContext(chunks: string[], targetIndex: number): string {
    const targetChunk = chunks[targetIndex];

    // Verifica se o índice é válido
    if (targetChunk === undefined) {
        return "";
    }

    const result: string[] = [targetChunk];
    let totalSize = targetChunk.length;

    // Tenta adicionar chunk anterior
    const prevChunk = chunks[targetIndex - 1];
    if (prevChunk !== undefined && totalSize + prevChunk.length < MAX_CONTEXT_SIZE) {
        result.unshift(prevChunk);
        totalSize += prevChunk.length;
    }

    // Tenta adicionar chunk posterior
    const nextChunk = chunks[targetIndex + 1];
    if (nextChunk !== undefined && totalSize + nextChunk.length < MAX_CONTEXT_SIZE) {
        result.push(nextChunk);
    }

    return result.join("\n\n---\n\n");
}
