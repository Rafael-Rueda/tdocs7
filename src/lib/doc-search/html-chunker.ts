/**
 * Módulo de chunking para documentação HTML
 * Extrai texto estruturado de HTML e divide em chunks semânticos
 */

import { HTML_PATTERNS, MAX_CHUNK_SIZE, MIN_CHUNK_SIZE, SEPARATION_PATTERNS } from "./patterns.js";

/**
 * Representa uma seção extraída do HTML
 */
interface HtmlSection {
    /** Tipo da seção (header, paragraph, list, code, etc) */
    type: "header" | "paragraph" | "list" | "code" | "text";
    /** Conteúdo de texto da seção */
    content: string;
    /** Nível do header (1-6) se for header */
    level?: number;
}

/**
 * Divide documento HTML em chunks de texto
 * Extrai conteúdo semântico removendo tags e scripts
 *
 * @param htmlDocument - Documento HTML completo
 * @returns Array de chunks de texto extraídos
 */
export function splitHtmlIntoChunks(htmlDocument: string): string[] {
    // 1. Limpa o HTML (remove scripts, styles, comentários)
    const cleanedHtml = cleanHtml(htmlDocument);

    // 2. Extrai seções semânticas
    const sections = extractSections(cleanedHtml);

    // 3. Agrupa seções em chunks respeitando tamanho máximo
    const chunks = groupSectionsIntoChunks(sections);

    // 4. Remove chunks muito pequenos
    return chunks.filter((chunk) => chunk.trim().length > MIN_CHUNK_SIZE);
}

/**
 * Remove elementos indesejados do HTML (scripts, styles, comentários)
 */
function cleanHtml(html: string): string {
    let cleaned = html;

    // Remove scripts e styles
    cleaned = cleaned.replace(HTML_PATTERNS.scriptStyleTags, "");

    // Remove comentários HTML
    cleaned = cleaned.replace(HTML_PATTERNS.htmlComments, "");

    return cleaned;
}

/**
 * Extrai seções semânticas do HTML limpo
 */
function extractSections(html: string): HtmlSection[] {
    const sections: HtmlSection[] = [];

    // Estratégia: processar o HTML sequencialmente, identificando elementos semânticos

    // Primeiro, vamos identificar e extrair headers com seu conteúdo
    const headerChunks = extractHeaderSections(html);

    if (headerChunks.length > 1) {
        // Se encontrou headers, usa como base para chunks
        for (const chunk of headerChunks) {
            const extracted = extractTextContent(chunk);
            if (extracted.trim()) {
                sections.push({
                    type: "text",
                    content: extracted,
                });
            }
        }
    } else {
        // Fallback: extrai por elementos semânticos
        const semanticSections = extractSemanticElements(html);
        sections.push(...semanticSections);
    }

    return sections;
}

/**
 * Extrai seções baseadas em headers HTML (h1-h6)
 * Similar ao chunking por headers markdown
 */
function extractHeaderSections(html: string): string[] {
    // Padrão para dividir por headers mantendo o header com o conteúdo
    const headerSplitPattern = /(?=<h[1-6][^>]*>)/gi;

    const chunks = html.split(headerSplitPattern).filter((chunk) => chunk.trim());

    return chunks;
}

/**
 * Extrai elementos semânticos do HTML
 */
function extractSemanticElements(html: string): HtmlSection[] {
    const sections: HtmlSection[] = [];
    let remainingHtml = html;

    // Extrai blocos de código primeiro (preserva formatação)
    const codePattern = /<(pre|code)[^>]*>([\s\S]*?)<\/\1>/gi;
    let codeMatch: RegExpExecArray | null = null;

    // biome-ignore lint/suspicious/noAssignInExpressions: Necessário para regex exec loop
    while ((codeMatch = codePattern.exec(html)) !== null) {
        const rawContent = codeMatch[2];
        if (rawContent) {
            const codeContent = decodeHtmlEntities(stripTags(rawContent));
            if (codeContent.trim()) {
                sections.push({
                    type: "code",
                    content: `\`\`\`\n${codeContent.trim()}\n\`\`\``,
                });
            }
        }
    }

    // Remove código do HTML para processar o resto
    remainingHtml = remainingHtml.replace(codePattern, "");

    // Extrai parágrafos
    const paragraphPattern = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let paraMatch: RegExpExecArray | null = null;

    // biome-ignore lint/suspicious/noAssignInExpressions: Necessário para regex exec loop
    while ((paraMatch = paragraphPattern.exec(remainingHtml)) !== null) {
        const rawContent = paraMatch[1];
        if (rawContent) {
            const text = extractTextContent(rawContent);
            if (text.trim()) {
                sections.push({
                    type: "paragraph",
                    content: text.trim(),
                });
            }
        }
    }

    // Se não encontrou parágrafos, extrai texto geral
    if (sections.length === 0) {
        const generalText = extractTextContent(remainingHtml);
        if (generalText.trim()) {
            sections.push({
                type: "text",
                content: generalText.trim(),
            });
        }
    }

    return sections;
}

/**
 * Extrai texto puro de um fragmento HTML
 * Remove todas as tags e decodifica entidades
 */
function extractTextContent(html: string): string {
    let text = html;

    // Adiciona quebras de linha após tags de bloco
    text = text.replace(HTML_PATTERNS.blockTags, "\n");

    // Adiciona quebras de linha após <br>
    text = text.replace(/<br\s*\/?>/gi, "\n");

    // Remove todas as tags HTML
    text = text.replace(HTML_PATTERNS.allTags, "");

    // Decodifica entidades HTML
    text = decodeHtmlEntities(text);

    // Normaliza espaços em branco
    text = normalizeWhitespace(text);

    return text;
}

/**
 * Remove todas as tags HTML de uma string
 */
function stripTags(html: string): string {
    return html.replace(HTML_PATTERNS.allTags, "");
}

/**
 * Decodifica entidades HTML comuns
 */
function decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
        nbsp: " ",
        amp: "&",
        lt: "<",
        gt: ">",
        quot: '"',
        apos: "'",
    };

    return text.replace(HTML_PATTERNS.htmlEntities, (match, entity: string) => {
        // Entidades nomeadas
        const lowerEntity = entity.toLowerCase();
        if (entities[lowerEntity]) {
            return entities[lowerEntity];
        }

        // Entidades numéricas decimais
        if (entity.startsWith("#") && !entity.startsWith("#x")) {
            const code = Number.parseInt(entity.slice(1), 10);
            return String.fromCharCode(code);
        }

        // Entidades numéricas hexadecimais
        if (entity.startsWith("#x")) {
            const code = Number.parseInt(entity.slice(2), 16);
            return String.fromCharCode(code);
        }

        return match;
    });
}

/**
 * Normaliza espaços em branco
 * - Converte múltiplos espaços em um
 * - Converte múltiplas quebras de linha em duas
 * - Remove espaços no início/fim de linhas
 */
function normalizeWhitespace(text: string): string {
    return text
        .replace(/[ \t]+/g, " ") // Múltiplos espaços -> um espaço
        .replace(/\n\s*\n/g, "\n\n") // Normaliza quebras de linha
        .replace(/^\s+|\s+$/gm, "") // Trim de cada linha
        .replace(/\n{3,}/g, "\n\n") // Máximo 2 quebras de linha
        .trim();
}

/**
 * Agrupa seções em chunks respeitando tamanho máximo
 */
function groupSectionsIntoChunks(sections: HtmlSection[]): string[] {
    const chunks: string[] = [];
    let currentChunk = "";

    for (const section of sections) {
        const content = section.content;

        // Se a seção sozinha excede o tamanho máximo, subdivide
        if (content.length > MAX_CHUNK_SIZE) {
            // Salva chunk atual se existir
            if (currentChunk.trim()) {
                chunks.push(currentChunk.trim());
                currentChunk = "";
            }

            // Subdivide seção grande
            const subChunks = subdivideContent(content);
            chunks.push(...subChunks);
            continue;
        }

        // Verifica se adicionar ao chunk atual excederia o tamanho
        const separator = currentChunk ? "\n\n" : "";
        const wouldExceed = (currentChunk + separator + content).length > MAX_CHUNK_SIZE;

        if (wouldExceed && currentChunk.trim()) {
            chunks.push(currentChunk.trim());
            currentChunk = content;
        } else {
            currentChunk += separator + content;
        }
    }

    // Adiciona último chunk
    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

/**
 * Subdivide conteúdo grande em chunks menores
 * Usa estratégia similar ao chunker markdown
 */
function subdivideContent(content: string): string[] {
    // Primeiro tenta dividir por parágrafos
    const paragraphs = content.split(SEPARATION_PATTERNS.paragraphs).filter((p) => p.trim());

    if (paragraphs.length > 1) {
        // Reagrupa parágrafos em chunks de tamanho adequado
        return groupTextIntoChunks(paragraphs);
    }

    // Fallback: divide por sentenças
    const sentences = content.split(SEPARATION_PATTERNS.sentences).filter((s) => s.trim());
    return groupTextIntoChunks(sentences);
}

/**
 * Agrupa array de textos em chunks de tamanho adequado
 */
function groupTextIntoChunks(texts: string[]): string[] {
    const chunks: string[] = [];
    let currentChunk = "";

    for (const text of texts) {
        const separator = currentChunk ? " " : "";
        const wouldExceed = (currentChunk + separator + text).length > MAX_CHUNK_SIZE && currentChunk;

        if (wouldExceed) {
            chunks.push(currentChunk.trim());
            currentChunk = text;
        } else {
            currentChunk += separator + text;
        }
    }

    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

/**
 * Converte HTML para Markdown simplificado
 * Útil para preservar estrutura semântica
 *
 * @param html - Fragmento HTML
 * @returns Texto com formatação Markdown básica
 */
export function htmlToSimpleMarkdown(html: string): string {
    let markdown = html;

    // Limpa primeiro
    markdown = cleanHtml(markdown);

    // Converte headers
    markdown = markdown.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n");
    markdown = markdown.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n");
    markdown = markdown.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n");
    markdown = markdown.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n#### $1\n");
    markdown = markdown.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, "\n##### $1\n");
    markdown = markdown.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, "\n###### $1\n");

    // Converte ênfase
    markdown = markdown.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**");
    markdown = markdown.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*");

    // Converte código
    markdown = markdown.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");
    markdown = markdown.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, "\n```\n$1\n```\n");

    // Converte listas
    markdown = markdown.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n");
    markdown = markdown.replace(/<\/?[uo]l[^>]*>/gi, "\n");

    // Converte links
    markdown = markdown.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");

    // Converte parágrafos e quebras
    markdown = markdown.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n");
    markdown = markdown.replace(/<br\s*\/?>/gi, "\n");
    markdown = markdown.replace(/<hr\s*\/?>/gi, "\n---\n");

    // Remove tags restantes
    markdown = markdown.replace(HTML_PATTERNS.allTags, "");

    // Decodifica entidades
    markdown = decodeHtmlEntities(markdown);

    // Normaliza espaços
    markdown = normalizeWhitespace(markdown);

    return markdown;
}
