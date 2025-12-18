/**
 * Padrões de separação para divisão de documentação em chunks
 */

import type { HtmlPatterns, SeparationPatterns } from "../../types/index.js";

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
 * Padrões para processamento de HTML
 * Usados para detectar, parsear e extrair texto de documentação HTML
 */
export const HTML_PATTERNS: HtmlPatterns = {
    // Detecta se o documento é HTML (tags de abertura comuns)
    isHtml: /^\s*<!DOCTYPE\s+html|^\s*<html|^\s*<head|^\s*<body|^\s*<div|^\s*<article|^\s*<section/i,

    // Tags de seção que definem blocos de conteúdo (para chunking)
    sectionTags: /<(article|section|div|main|aside|nav|header|footer)[\s>]/gi,

    // Headers HTML (h1-h6)
    headerTags: /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi,

    // Parágrafos HTML
    paragraphTags: /<p[^>]*>([\s\S]*?)<\/p>/gi,

    // Listas (ul, ol, li)
    listTags: /<(ul|ol)[^>]*>([\s\S]*?)<\/\1>/gi,

    // Blocos de código HTML
    codeTags: /<(pre|code)[^>]*>([\s\S]*?)<\/\1>/gi,

    // Tags de script e style (para remoção)
    scriptStyleTags: /<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi,

    // Comentários HTML (para remoção)
    htmlComments: /<!--[\s\S]*?-->/g,

    // Todas as tags HTML (para extração de texto puro)
    allTags: /<[^>]+>/g,

    // Entidades HTML comuns
    htmlEntities: /&(nbsp|amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi,

    // Tags que criam quebra de linha semântica
    blockTags: /<\/(p|div|section|article|header|footer|main|aside|li|tr|br|hr)[^>]*>/gi,
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
