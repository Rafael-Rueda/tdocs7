/**
 * Módulo de cálculo de relevância para busca em documentação
 * Implementa sistema de pontuação similar a RAG
 */

import { SEPARATION_PATTERNS } from "./patterns.js";

/**
 * Pesos para cálculo de score
 */
const SCORE_WEIGHTS = {
    /** Peso para match exato da frase completa */
    exactMatch: 10,
    /** Peso por ocorrência de palavra individual */
    wordMatch: 2,
    /** Peso para match parcial (início da palavra) */
    partialMatch: 0.5,
    /** Multiplicador bonus para chunks com código */
    codeBonus: 1.2,
    /** Multiplicador bonus para chunks com headers */
    headerBonus: 1.3,
};

/**
 * Normaliza texto para comparação
 * Remove acentos, converte para minúsculas, remove pontuação
 *
 * @param text - Texto para normalizar
 * @returns Texto normalizado
 */
export function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/[^\w\s]/g, " ") // Remove pontuação
        .replace(/\s+/g, " ") // Normaliza espaços
        .trim();
}

/**
 * Escapa caracteres especiais de regex
 *
 * @param str - String para escapar
 * @returns String com caracteres especiais escapados
 */
export function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Calcula a pontuação de relevância de um chunk para os termos de busca
 *
 * @param chunk - Conteúdo do chunk
 * @param searchTerms - Array de termos de busca
 * @returns Pontuação de relevância (0 = nenhum match)
 */
export function calculateRelevanceScore(chunk: string, searchTerms: string[]): number {
    const normalizedChunk = normalizeText(chunk);
    let score = 0;

    for (const term of searchTerms) {
        const normalizedTerm = normalizeText(term);
        if (!normalizedTerm) continue;

        // Match exato da frase completa (maior peso)
        if (normalizedChunk.includes(normalizedTerm)) {
            score += SCORE_WEIGHTS.exactMatch * normalizedTerm.split(" ").length;
        }

        // Match de palavras individuais
        score += calculateWordMatchScore(normalizedChunk, normalizedTerm);
    }

    // Aplica bonus para chunks especiais
    score = applyBonuses(chunk, score);

    return score;
}

/**
 * Calcula score baseado em matches de palavras individuais
 */
function calculateWordMatchScore(normalizedChunk: string, normalizedTerm: string): number {
    let score = 0;
    const words = normalizedTerm.split(" ");

    for (const word of words) {
        if (word.length < 2) continue;

        // Conta ocorrências da palavra (match exato)
        const exactRegex = new RegExp(`\\b${escapeRegex(word)}\\b`, "gi");
        const exactMatches = normalizedChunk.match(exactRegex);
        if (exactMatches) {
            score += exactMatches.length * SCORE_WEIGHTS.wordMatch;
        }

        // Match parcial (início da palavra)
        const partialRegex = new RegExp(`\\b${escapeRegex(word)}`, "gi");
        const partialMatches = normalizedChunk.match(partialRegex);
        if (partialMatches) {
            score += partialMatches.length * SCORE_WEIGHTS.partialMatch;
        }
    }

    return score;
}

/**
 * Aplica bonus de score para chunks com características especiais
 */
function applyBonuses(chunk: string, score: number): number {
    let finalScore = score;

    // Bonus para chunks que contêm código (geralmente mais informativos)
    if (SEPARATION_PATTERNS.codeBlock.test(chunk)) {
        finalScore *= SCORE_WEIGHTS.codeBonus;
    }

    // Bonus para chunks com headers (indicam tópicos principais)
    if (SEPARATION_PATTERNS.hasHeader.test(chunk)) {
        finalScore *= SCORE_WEIGHTS.headerBonus;
    }

    return finalScore;
}

/**
 * Extrai termos de busca a partir de uma query
 * Retorna a frase completa + palavras individuais significativas
 *
 * @param query - Query de busca do usuário
 * @returns Array de termos para busca
 */
export function extractSearchTerms(query: string): string[] {
    const terms = [query];

    // Adiciona palavras individuais (com mais de 2 caracteres)
    const words = query.split(/\s+/).filter((word) => word.length > 2);
    terms.push(...words);

    return terms;
}
