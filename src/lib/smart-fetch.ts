/**
 * Módulo de fetch inteligente com fallbacks
 * Detecta tipo de documentação e usa a melhor estratégia para extrair conteúdo
 */

import { isPuppeteerAvailable, renderSwaggerPage } from "./headless-renderer.js";
import { getHttpClient } from "./http-client.js";
import { openApiToMarkdown } from "./openapi-parser.js";
import { detectSwagger, fetchOpenApiSpec, isValidOpenApiSpec, probeCommonSpecEndpoints } from "./swagger-detector.js";

/**
 * Resultado do fetch inteligente
 */
export interface SmartFetchResult {
    /** Se o fetch foi bem sucedido */
    success: boolean;
    /** Conteúdo extraído (texto/markdown) */
    content?: string;
    /** Tipo de conteúdo detectado */
    contentType: "markdown" | "html" | "json" | "openapi" | "text" | "unknown";
    /** Método usado para extrair */
    method: "direct" | "openapi_spec" | "headless" | "html_extract";
    /** Mensagem de erro se falhou */
    error?: string;
    /** URL original */
    url: string;
    /** URL da spec OpenAPI se detectada */
    specUrl?: string;
}

/**
 * Opções para o fetch inteligente
 */
export interface SmartFetchOptions {
    /** Timeout para requisições HTTP (ms) */
    httpTimeout?: number;
    /** Timeout para renderização headless (ms) */
    headlessTimeout?: number;
    /** Se deve tentar buscar spec OpenAPI */
    tryOpenApiSpec?: boolean;
    /** Se deve usar renderização headless como fallback */
    useHeadlessFallback?: boolean;
    /** Se deve probe endpoints comuns de spec */
    probeCommonEndpoints?: boolean;
    /** Headers customizados */
    headers?: Record<string, string>;
}

const DEFAULT_OPTIONS: Required<SmartFetchOptions> = {
    httpTimeout: 10000,
    headlessTimeout: 30000,
    tryOpenApiSpec: true,
    useHeadlessFallback: true,
    probeCommonEndpoints: true,
    headers: {},
};

/**
 * Busca documentação de forma inteligente
 * Detecta Swagger/OpenAPI e usa a melhor estratégia para extrair conteúdo
 *
 * Fluxo:
 * 1. Faz requisição HTTP normal
 * 2. Se detectar Swagger, tenta buscar spec OpenAPI diretamente
 * 3. Se não encontrar spec, tenta renderização headless (se disponível)
 * 4. Fallback: extrai texto do HTML recebido
 *
 * @param url - URL da documentação
 * @param options - Opções de configuração
 * @returns Resultado com conteúdo extraído
 */
export async function smartFetch(url: string, options: SmartFetchOptions = {}): Promise<SmartFetchResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    try {
        // 1. Primeira tentativa: requisição HTTP direta
        const httpResult = await fetchWithHttp(url, opts);

        // Se não é HTML ou é conteúdo válido, retorna direto
        if (httpResult.contentType !== "html" || !looksLikeSpa(httpResult.content || "")) {
            return httpResult;
        }

        // 2. Detecta se é Swagger/OpenAPI
        if (opts.tryOpenApiSpec) {
            const swaggerResult = await trySwaggerExtraction(url, httpResult.content || "", opts);
            if (swaggerResult.success) {
                return swaggerResult;
            }
        }

        // 3. Tenta renderização headless se disponível
        if (opts.useHeadlessFallback) {
            const headlessResult = await tryHeadlessRender(url, opts);
            if (headlessResult.success) {
                return headlessResult;
            }
        }

        // 4. Fallback: retorna HTML original (será processado pelo chunker HTML)
        return httpResult;
    } catch (error) {
        const message = error instanceof Error ? error.message : "Erro desconhecido";
        return {
            success: false,
            error: message,
            contentType: "unknown",
            method: "direct",
            url,
        };
    }
}

/**
 * Faz requisição HTTP básica
 */
async function fetchWithHttp(url: string, opts: Required<SmartFetchOptions>): Promise<SmartFetchResult> {
    const client = getHttpClient();

    const response = await client.get<string | object>(url, {
        timeout: opts.httpTimeout,
        headers: opts.headers,
    });

    const data = response.data;

    // Se é objeto (JSON), converte
    if (typeof data === "object") {
        // Verifica se é spec OpenAPI
        if (isValidOpenApiSpec(data)) {
            const markdown = openApiToMarkdown(data);
            return {
                success: true,
                content: markdown || JSON.stringify(data, null, 2),
                contentType: "openapi",
                method: "direct",
                url,
            };
        }

        return {
            success: true,
            content: JSON.stringify(data, null, 2),
            contentType: "json",
            method: "direct",
            url,
        };
    }

    // É string - detecta tipo
    const contentType = detectContentType(data);

    return {
        success: true,
        content: data,
        contentType,
        method: "direct",
        url,
    };
}

/**
 * Detecta tipo de conteúdo baseado no texto
 */
function detectContentType(content: string): "markdown" | "html" | "json" | "text" {
    const trimmed = content.trim();

    // JSON
    if ((trimmed.startsWith("{") || trimmed.startsWith("[")) && isValidJson(trimmed)) {
        return "json";
    }

    // HTML
    if (/<(!DOCTYPE|html|head|body|div)/i.test(trimmed)) {
        return "html";
    }

    // Markdown (tem headers ou código fenced)
    if (/^#{1,6}\s/m.test(trimmed) || /```[\s\S]*?```/.test(trimmed)) {
        return "markdown";
    }

    return "text";
}

/**
 * Verifica se é JSON válido
 */
function isValidJson(str: string): boolean {
    try {
        JSON.parse(str);
        return true;
    } catch {
        return false;
    }
}

/**
 * Verifica se o HTML parece ser uma SPA (conteúdo mínimo)
 */
function looksLikeSpa(html: string): boolean {
    // Remove scripts e styles
    const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, "");
    const withoutStyles = withoutScripts.replace(/<style[\s\S]*?<\/style>/gi, "");

    // Extrai texto
    const textOnly = withoutStyles
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    // Se o texto é muito curto em relação ao HTML total, provavelmente é SPA
    const ratio = textOnly.length / html.length;

    // Também verifica indicadores de SPA
    const spaIndicators = [
        /swagger-ui|SwaggerUIBundle/i,
        /react|vue|angular|ember/i,
        /<div\s+id=["'](?:app|root)["']/i,
        /window\.__INITIAL_STATE__/i,
        /data-reactroot|ng-app|v-app/i,
    ];

    const hasSpaIndicator = spaIndicators.some((pattern) => pattern.test(html));

    return ratio < 0.05 || hasSpaIndicator;
}

/**
 * Tenta extrair conteúdo de documentação Swagger/OpenAPI
 */
async function trySwaggerExtraction(
    url: string,
    html: string,
    opts: Required<SmartFetchOptions>,
): Promise<SmartFetchResult> {
    // Detecta Swagger no HTML
    const detection = detectSwagger(html, url);

    if (!detection.isSwagger) {
        return {
            success: false,
            error: "Não é Swagger",
            contentType: "unknown",
            method: "openapi_spec",
            url,
        };
    }

    // Tenta buscar spec pela URL detectada
    if (detection.specUrl) {
        const spec = await fetchOpenApiSpec(detection.specUrl, opts.httpTimeout);
        if (spec && isValidOpenApiSpec(spec)) {
            const markdown = openApiToMarkdown(spec);
            return {
                success: true,
                content: markdown,
                contentType: "openapi",
                method: "openapi_spec",
                url,
                specUrl: detection.specUrl,
            };
        }
    }

    // Tenta probe de endpoints comuns
    if (opts.probeCommonEndpoints) {
        const probeResult = await probeCommonSpecEndpoints(url, opts.httpTimeout / 2);
        if (probeResult) {
            const spec = await fetchOpenApiSpec(probeResult.specUrl, opts.httpTimeout);
            if (spec && isValidOpenApiSpec(spec)) {
                const markdown = openApiToMarkdown(spec);
                return {
                    success: true,
                    content: markdown,
                    contentType: "openapi",
                    method: "openapi_spec",
                    url,
                    specUrl: probeResult.specUrl,
                };
            }
        }
    }

    return {
        success: false,
        error: "Spec OpenAPI não encontrada",
        contentType: "unknown",
        method: "openapi_spec",
        url,
    };
}

/**
 * Tenta renderização headless com Puppeteer
 */
async function tryHeadlessRender(url: string, opts: Required<SmartFetchOptions>): Promise<SmartFetchResult> {
    // Verifica se Puppeteer está disponível
    const available = await isPuppeteerAvailable();
    if (!available) {
        return {
            success: false,
            error: "Puppeteer não disponível",
            contentType: "unknown",
            method: "headless",
            url,
        };
    }

    // Renderiza a página
    const result = await renderSwaggerPage(url, opts.headlessTimeout);

    if (!result.success || !result.text) {
        return {
            success: false,
            error: result.error || "Falha na renderização",
            contentType: "unknown",
            method: "headless",
            url,
        };
    }

    return {
        success: true,
        content: result.text,
        contentType: "text",
        method: "headless",
        url,
    };
}

/**
 * Verifica se o sistema tem suporte a renderização headless
 */
export async function checkHeadlessSupport(): Promise<{
    available: boolean;
    method: "puppeteer" | "none";
    message: string;
}> {
    const puppeteer = await isPuppeteerAvailable();

    if (puppeteer) {
        return {
            available: true,
            method: "puppeteer",
            message: "Puppeteer disponível para renderização de SPAs",
        };
    }

    return {
        available: false,
        method: "none",
        message:
            "Nenhum renderizador headless disponível. Instale puppeteer para suporte a SPAs: npm install puppeteer",
    };
}
