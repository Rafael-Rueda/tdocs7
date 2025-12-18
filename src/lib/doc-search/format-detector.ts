/**
 * Módulo de detecção de formato de documento
 * Identifica se o conteúdo é HTML, JSON, Markdown ou texto puro
 */

import type { FormatDetectionResult } from "../../types/index.js";
import { HTML_PATTERNS, SEPARATION_PATTERNS } from "./patterns.js";

/**
 * Detecta o formato do documento analisando seu conteúdo
 *
 * @param document - Conteúdo do documento para analisar
 * @returns Resultado da detecção com formato, confiança e indicadores
 */
export function detectDocumentFormat(document: string): FormatDetectionResult {
    const trimmed = document.trim();

    // Verifica JSON primeiro (mais determinístico)
    const jsonResult = checkJson(trimmed);
    if (jsonResult.confidence > 0.8) {
        return jsonResult;
    }

    // Verifica HTML
    const htmlResult = checkHtml(trimmed);
    if (htmlResult.confidence > 0.6) {
        return htmlResult;
    }

    // Verifica Markdown
    const markdownResult = checkMarkdown(trimmed);
    if (markdownResult.confidence > 0.5) {
        return markdownResult;
    }

    // Fallback: texto puro
    return {
        format: "text",
        confidence: 0.5,
        indicators: ["Nenhum formato específico detectado"],
    };
}

/**
 * Verifica se o documento é JSON válido
 */
function checkJson(content: string): FormatDetectionResult {
    const indicators: string[] = [];
    let confidence = 0;

    // Verifica se começa com { ou [
    const startsWithJsonChar = /^\s*[[{]/.test(content);
    if (startsWithJsonChar) {
        indicators.push("Inicia com caractere JSON ({ ou [)");
        confidence += 0.3;
    }

    // Tenta parsear como JSON
    try {
        JSON.parse(content);
        indicators.push("JSON válido parseado com sucesso");
        confidence += 0.6;
    } catch {
        // Não é JSON válido, reduz confiança
        if (startsWithJsonChar) {
            indicators.push("Estrutura similar a JSON mas inválido");
            confidence = 0.2;
        }
    }

    return {
        format: "json",
        confidence: Math.min(confidence, 1),
        indicators,
    };
}

/**
 * Verifica se o documento é HTML
 */
function checkHtml(content: string): FormatDetectionResult {
    const indicators: string[] = [];
    let confidence = 0;

    // Verifica DOCTYPE ou tags HTML principais
    if (HTML_PATTERNS.isHtml.test(content)) {
        indicators.push("DOCTYPE ou tag HTML principal detectada");
        confidence += 0.5;
    }

    // Conta tags HTML no documento
    const tagMatches = content.match(HTML_PATTERNS.allTags);
    const tagCount = tagMatches?.length ?? 0;

    if (tagCount > 10) {
        indicators.push(`${tagCount} tags HTML encontradas`);
        confidence += 0.3;
    } else if (tagCount > 3) {
        indicators.push(`${tagCount} tags HTML encontradas`);
        confidence += 0.15;
    }

    // Verifica headers HTML
    if (HTML_PATTERNS.headerTags.test(content)) {
        indicators.push("Headers HTML (h1-h6) detectados");
        confidence += 0.1;
    }

    // Verifica parágrafos HTML
    if (HTML_PATTERNS.paragraphTags.test(content)) {
        indicators.push("Parágrafos HTML detectados");
        confidence += 0.1;
    }

    // Reseta os RegExp (necessário por causa do flag 'g')
    HTML_PATTERNS.headerTags.lastIndex = 0;
    HTML_PATTERNS.paragraphTags.lastIndex = 0;

    return {
        format: "html",
        confidence: Math.min(confidence, 1),
        indicators,
    };
}

/**
 * Verifica se o documento é Markdown
 */
function checkMarkdown(content: string): FormatDetectionResult {
    const indicators: string[] = [];
    let confidence = 0;

    // Verifica headers markdown
    if (SEPARATION_PATTERNS.hasHeader.test(content)) {
        indicators.push("Headers Markdown (#) detectados");
        confidence += 0.3;
    }

    // Verifica blocos de código fenced
    const fencedCodeBlocks = content.match(/```[\s\S]*?```/g);
    if (fencedCodeBlocks && fencedCodeBlocks.length > 0) {
        indicators.push(`${fencedCodeBlocks.length} blocos de código fenced`);
        confidence += 0.25;
    }

    // Verifica listas markdown
    const listItems = content.match(/^[\s]*[-*+]\s+/gm);
    if (listItems && listItems.length > 2) {
        indicators.push(`${listItems.length} itens de lista detectados`);
        confidence += 0.15;
    }

    // Verifica links markdown
    const links = content.match(/\[([^\]]+)\]\(([^)]+)\)/g);
    if (links && links.length > 0) {
        indicators.push(`${links.length} links Markdown detectados`);
        confidence += 0.15;
    }

    // Verifica emphasis (bold/italic)
    const emphasis = content.match(/(\*\*|__)[^*_]+\1|(\*|_)[^*_]+\2/g);
    if (emphasis && emphasis.length > 0) {
        indicators.push("Formatação de ênfase detectada");
        confidence += 0.1;
    }

    // Verifica separadores horizontais
    if (SEPARATION_PATTERNS.horizontalRules.test(content)) {
        indicators.push("Separadores horizontais detectados");
        confidence += 0.1;
    }

    // Reseta RegExp
    SEPARATION_PATTERNS.horizontalRules.lastIndex = 0;

    return {
        format: "markdown",
        confidence: Math.min(confidence, 1),
        indicators,
    };
}

/**
 * Verifica se o documento é HTML (função simplificada para uso externo)
 *
 * @param document - Documento para verificar
 * @returns true se for HTML
 */
export function isHtmlDocument(document: string): boolean {
    const result = detectDocumentFormat(document);
    return result.format === "html" && result.confidence > 0.5;
}

/**
 * Verifica se o documento é JSON (função simplificada para uso externo)
 *
 * @param document - Documento para verificar
 * @returns true se for JSON
 */
export function isJsonDocument(document: string): boolean {
    const result = detectDocumentFormat(document);
    return result.format === "json" && result.confidence > 0.7;
}

/**
 * Verifica se o documento é Markdown (função simplificada para uso externo)
 *
 * @param document - Documento para verificar
 * @returns true se for Markdown
 */
export function isMarkdownDocument(document: string): boolean {
    const result = detectDocumentFormat(document);
    return result.format === "markdown" && result.confidence > 0.4;
}
