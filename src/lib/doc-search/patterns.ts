/**
 * Padrões de separação para divisão de documentação em chunks
 */

import type { SeparationPatterns } from "../../types/index.js";

/**
 * Padrões regex para identificar e dividir seções de documentação
 * Cada padrão tem um propósito específico no processo de chunking
 */
export const SEPARATION_PATTERNS: SeparationPatterns = {
    // Headers markdown (# ## ### etc) - usa lookahead para manter o header com o conteúdo
    headers: /(?=^#{1,6}\s+.+$)/gm,

    // Detecta se chunk contém header (para bonus de score)
    hasHeader: /^#{1,6}\s+/m,

    // Separadores horizontais (---, ***, ===)
    horizontalRules: /(?:^---+$|^\*{3,}$|^={3,}$)/gm,

    // Múltiplas quebras de linha (3+)
    multipleBreaks: /\n{3,}/g,

    // Parágrafos (2 quebras de linha)
    paragraphs: /\n{2,}/,

    // Sentenças (para subdivisão de chunks grandes)
    sentences: /(?<=[.!?])\s+/,

    // Detecta blocos de código (fenced ou indentado)
    codeBlock: /```[\s\S]*?```|^ {4,}\S/m,
};

/**
 * Tamanho máximo de um chunk em caracteres
 * Chunks maiores que isso serão subdivididos
 */
export const MAX_CHUNK_SIZE = 2000;

/**
 * Tamanho mínimo de um chunk em caracteres
 * Chunks menores que isso serão descartados
 */
export const MIN_CHUNK_SIZE = 10;

/**
 * Tamanho máximo do contexto expandido (chunk + adjacentes)
 */
export const MAX_CONTEXT_SIZE = 3000;
