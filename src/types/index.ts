/**
 * Tipos e interfaces do MCP Server TDocs7
 */

// ============================================================================
// Configuração
// ============================================================================

export interface MCPConfig {
    /** URL base da documentação */
    docsUrl: string;
    /** Token JWT para autenticação */
    jwtToken: string;
    /** Número padrão de resultados */
    defaultMaxResults: number;
    /** Timeout das requisições em ms */
    requestTimeout: number;
}

// ============================================================================
// Busca em Documentação
// ============================================================================

export interface DocChunk {
    /** Conteúdo do chunk */
    content: string;
    /** Índice do chunk no documento original */
    index: number;
    /** Pontuação de relevância */
    score: number;
}

export interface SearchResult {
    /** Trechos relevantes encontrados */
    results: string[];
    /** Total de chunks no documento */
    totalChunks: number;
    /** Número de chunks com match */
    matchedChunks: number;
}

export interface SearchOutput {
    /** Trechos relevantes encontrados */
    results: string[];
    /** Total de seções na documentação */
    total_chunks: number;
    /** Número de seções com matches */
    matched_chunks: number;
    /** Termo buscado */
    query: string;
    /** URL da documentação consultada */
    docs_url: string;
    /** Mensagem de erro (se houver) */
    error?: string;
    /** Index signature para compatibilidade com MCP SDK */
    [key: string]: unknown;
}

// ============================================================================
// Padrões de Separação
// ============================================================================

export interface SeparationPatterns {
    /** Headers markdown - usa lookahead para manter o header */
    headers: RegExp;
    /** Detecta se chunk contém header (para bonus de score) */
    hasHeader: RegExp;
    /** Separadores horizontais (---, ***, ===) */
    horizontalRules: RegExp;
    /** Múltiplas quebras de linha (3+) */
    multipleBreaks: RegExp;
    /** Parágrafos (2 quebras de linha) */
    paragraphs: RegExp;
    /** Sentenças (para subdivisão de chunks grandes) */
    sentences: RegExp;
    /** Detecta blocos de código */
    codeBlock: RegExp;
}
