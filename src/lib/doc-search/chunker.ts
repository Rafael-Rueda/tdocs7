/**
 * Módulo de divisão de documentação em chunks
 * Implementa estratégia hierárquica de chunking com suporte a múltiplos formatos
 */

import { detectDocumentFormat } from "./format-detector.js";
import { htmlToSimpleMarkdown, splitHtmlIntoChunks } from "./html-chunker.js";
import { MAX_CHUNK_SIZE, MAX_CONTEXT_SIZE, MIN_CHUNK_SIZE, SEPARATION_PATTERNS } from "./patterns.js";
import type { ChunkingOptions, DocumentFormat } from "../../types/index.js";

/**
 * Divide o documento em chunks usando padrões de separação hierárquicos
 * Detecta automaticamente o formato (Markdown, HTML, JSON) e aplica estratégia adequada
 *
 * @param document - Documento completo para dividir
 * @param options - Opções de chunking (formato forçado, fallbacks habilitados)
 * @returns Array de chunks de texto
 */
export function splitIntoChunks(document: string, options: ChunkingOptions = {}): string[] {
    const { forceFormat, enableHtmlFallback = true, enableJsonFallback = true } = options;

    // Determina o formato do documento
    const format = forceFormat ?? detectFormat(document, enableHtmlFallback, enableJsonFallback);

    // Aplica estratégia de chunking baseada no formato
    switch (format) {
        case "html":
            return splitHtmlDocument(document);
        case "json":
            return splitJsonDocument(document);
        default:
            return splitMarkdownDocument(document);
    }
}

/**
 * Detecta o formato do documento para escolher a estratégia de chunking
 */
function detectFormat(document: string, enableHtml: boolean, enableJson: boolean): DocumentFormat {
    const detection = detectDocumentFormat(document);

    // Se HTML detectado e fallback habilitado
    if (detection.format === "html" && enableHtml && detection.confidence > 0.5) {
        return "html";
    }

    // Se JSON detectado e fallback habilitado
    if (detection.format === "json" && enableJson && detection.confidence > 0.7) {
        return "json";
    }

    // Markdown ou texto usa estratégia padrão
    return detection.format;
}

/**
 * Divide documento HTML em chunks
 * Extrai texto e preserva estrutura semântica
 */
function splitHtmlDocument(document: string): string[] {
    // Usa o chunker HTML especializado
    const chunks = splitHtmlIntoChunks(document);

    // Se o chunker HTML não produziu bons resultados, converte para markdown e usa estratégia padrão
    if (chunks.length <= 1 && document.length > MAX_CHUNK_SIZE) {
        const markdown = htmlToSimpleMarkdown(document);
        return splitMarkdownDocument(markdown);
    }

    return chunks;
}

/**
 * Divide documento JSON em chunks
 * Tenta extrair texto de campos de documentação comuns
 */
function splitJsonDocument(document: string): string[] {
    try {
        const parsed = JSON.parse(document);
        const textContent = extractJsonTextContent(parsed);

        if (textContent) {
            // Se extraiu texto, aplica chunking de markdown
            return splitMarkdownDocument(textContent);
        }
    } catch {
        // Se falhar parse, trata como texto
    }

    // Fallback: trata JSON como texto formatado
    return splitMarkdownDocument(document);
}

/**
 * Extrai conteúdo de texto de estruturas JSON comuns de documentação
 */
function extractJsonTextContent(obj: unknown, depth = 0): string {
    // Limite de profundidade para evitar recursão infinita
    if (depth > 10) return "";

    if (typeof obj === "string") {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map((item) => extractJsonTextContent(item, depth + 1)).join("\n\n");
    }

    if (typeof obj === "object" && obj !== null) {
        const record = obj as Record<string, unknown>;
        const parts: string[] = [];

        // Campos comuns de documentação
        const textFields = [
            "content",
            "text",
            "body",
            "description",
            "summary",
            "documentation",
            "docs",
            "readme",
            "markdown",
            "html",
            "title",
            "name",
        ];

        for (const field of textFields) {
            if (record[field]) {
                const content = extractJsonTextContent(record[field], depth + 1);
                if (content) parts.push(content);
            }
        }

        // Se não encontrou campos conhecidos, processa todos os valores
        if (parts.length === 0) {
            for (const value of Object.values(record)) {
                const content = extractJsonTextContent(value, depth + 1);
                if (content) parts.push(content);
            }
        }

        return parts.join("\n\n");
    }

    return "";
}

/**
 * Divide documento Markdown/texto em chunks usando padrões de separação hierárquicos
 * Prioridade: Headers > Separadores horizontais > Parágrafos > Sentenças
 */
function splitMarkdownDocument(document: string): string[] {
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
