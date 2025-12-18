/**
 * Módulo de detecção e extração de documentação Swagger/OpenAPI
 * Identifica páginas Swagger UI e extrai a URL da spec
 */

import axios from "axios";

/**
 * Resultado da detecção de Swagger
 */
export interface SwaggerDetectionResult {
    /** Se a página é Swagger UI */
    isSwagger: boolean;
    /** URL da spec OpenAPI encontrada */
    specUrl?: string;
    /** Tipo da spec (json ou yaml) */
    specType?: "json" | "yaml";
    /** Método de detecção usado */
    detectionMethod?: string;
}

/**
 * Padrões para detectar Swagger UI
 */
const SWAGGER_PATTERNS = {
    // Detecta Swagger UI no HTML
    swaggerUi: /swagger-ui|swagger-ui-bundle|SwaggerUIBundle/i,

    // Extrai URL da spec de diferentes formatos
    specUrlPatterns: [
        // SwaggerUIBundle({ url: "..." })
        /SwaggerUIBundle\s*\(\s*\{[^}]*url\s*:\s*["']([^"']+)["']/i,
        // swagger-ui url="..."
        /swagger-ui[^>]*url\s*=\s*["']([^"']+)["']/i,
        // spec: "..."
        /spec\s*:\s*["']([^"']+)["']/i,
        // configUrl: "..."
        /configUrl\s*:\s*["']([^"']+)["']/i,
        // "url": "..."
        /"url"\s*:\s*"([^"]+\.(?:json|yaml|yml))"/i,
        // data-url="..."
        /data-url\s*=\s*["']([^"']+)["']/i,
    ],

    // Detecta ReDoc
    redoc: /redoc|ReDoc/i,

    // Detecta Stoplight
    stoplight: /stoplight/i,
};

/**
 * Endpoints comuns onde a spec OpenAPI pode estar (relativos à raiz)
 */
const ROOT_SPEC_ENDPOINTS = [
    "/swagger.json",
    "/swagger.yaml",
    "/openapi.json",
    "/openapi.yaml",
    "/docs.json",
    "/spec.json",
    "/api-docs",
    "/api-docs.json",
    "/api-docs.yaml",
    "/v3/api-docs",
    "/v3/api-docs.json",
    "/v2/api-docs",
    "/v2/api-docs.json",
    "/docs/openapi.json",
    "/docs/swagger.json",
    "/api/swagger.json",
    "/api/openapi.json",
    "/api/docs.json",
    "/.well-known/openapi.json",
    "/.well-known/openapi.yaml",
];

/**
 * Sufixos comuns para tentar relativos ao caminho atual
 * Serão adicionados ao diretório pai da URL
 */
const RELATIVE_SPEC_SUFFIXES = [
    "docs.json",
    "swagger.json",
    "openapi.json",
    "spec.json",
    "api-docs.json",
    "docs.yaml",
    "swagger.yaml",
    "openapi.yaml",
    "../swagger.json",
    "../openapi.json",
    "../docs.json",
    "../api-docs.json",
];

/**
 * Detecta se uma página é Swagger UI e extrai a URL da spec
 *
 * @param html - Conteúdo HTML da página
 * @param pageUrl - URL da página original
 * @returns Resultado da detecção
 */
export function detectSwagger(html: string, pageUrl: string): SwaggerDetectionResult {
    // Verifica se é Swagger UI
    const isSwagger =
        SWAGGER_PATTERNS.swaggerUi.test(html) ||
        SWAGGER_PATTERNS.redoc.test(html) ||
        SWAGGER_PATTERNS.stoplight.test(html);

    if (!isSwagger) {
        return { isSwagger: false };
    }

    // Tenta extrair URL da spec
    const specInfo = extractSpecUrl(html, pageUrl);

    return {
        isSwagger: true,
        ...specInfo,
    };
}

/**
 * Extrai a URL da spec OpenAPI do HTML
 */
function extractSpecUrl(
    html: string,
    pageUrl: string,
): { specUrl?: string; specType?: "json" | "yaml"; detectionMethod?: string } {
    // Tenta cada padrão de extração
    for (const pattern of SWAGGER_PATTERNS.specUrlPatterns) {
        const match = html.match(pattern);
        if (match?.[1]) {
            const specUrl = resolveUrl(match[1], pageUrl);
            return {
                specUrl,
                specType: getSpecType(specUrl),
                detectionMethod: "pattern_match",
            };
        }
    }

    return {};
}

/**
 * Resolve URL relativa para absoluta
 */
function resolveUrl(url: string, baseUrl: string): string {
    try {
        return new URL(url, baseUrl).href;
    } catch {
        return url;
    }
}

/**
 * Determina o tipo da spec baseado na URL
 */
function getSpecType(url: string): "json" | "yaml" {
    if (url.endsWith(".yaml") || url.endsWith(".yml")) {
        return "yaml";
    }
    return "json";
}

/**
 * Tenta encontrar a spec OpenAPI em endpoints comuns
 * Tenta primeiro caminhos relativos à URL fornecida, depois na raiz do domínio
 *
 * @param baseUrl - URL base do site (ex: https://api.example.com/api/v1/docs/)
 * @param timeout - Timeout para cada requisição
 * @returns URL da spec se encontrada
 */
export async function probeCommonSpecEndpoints(
    baseUrl: string,
    timeout = 5000,
): Promise<{ specUrl: string; specType: "json" | "yaml" } | null> {
    const base = new URL(baseUrl);
    const origin = base.origin;

    // Gera lista de URLs para tentar
    const urlsToTry = generateSpecUrls(base);

    for (const specUrl of urlsToTry) {
        const result = await tryFetchSpec(specUrl, timeout);
        if (result) {
            return result;
        }
    }

    // Fallback: tenta endpoints na raiz do domínio
    for (const endpoint of ROOT_SPEC_ENDPOINTS) {
        const specUrl = `${origin}${endpoint}`;
        const result = await tryFetchSpec(specUrl, timeout);
        if (result) {
            return result;
        }
    }

    return null;
}

/**
 * Gera lista de URLs para tentar baseado na URL original
 */
function generateSpecUrls(base: URL): string[] {
    const urls: string[] = [];
    const origin = base.origin;
    let pathname = base.pathname;

    // Normaliza pathname (remove trailing slash exceto se for raiz)
    if (pathname.length > 1 && pathname.endsWith("/")) {
        pathname = pathname.slice(0, -1);
    }

    // Extrai partes do caminho
    // Ex: /api/v1/docs -> ["api", "v1", "docs"]
    const pathParts = pathname.split("/").filter(Boolean);

    // 1. Tenta sufixos relativos ao caminho atual
    // Ex: /api/v1/docs/ + docs.json = /api/v1/docs/docs.json
    for (const suffix of RELATIVE_SPEC_SUFFIXES) {
        if (suffix.startsWith("../")) {
            // Sobe um nível
            const parentPath = pathParts.slice(0, -1).join("/");
            const file = suffix.slice(3);
            urls.push(`${origin}/${parentPath}/${file}`);
        } else {
            urls.push(`${origin}${pathname}/${suffix}`);
        }
    }

    // 2. Tenta substituindo o último segmento do caminho
    // Ex: /api/v1/docs -> /api/v1/swagger.json
    if (pathParts.length > 0) {
        const basePath = pathParts.slice(0, -1).join("/");
        const specFiles = ["swagger.json", "openapi.json", "docs.json", "api-docs.json", "spec.json"];
        for (const file of specFiles) {
            urls.push(`${origin}/${basePath}/${file}`);
        }
    }

    // 3. Tenta no mesmo nível com variações do caminho
    // Ex: /api/v1/docs -> /api/v1/api-docs.json
    if (pathParts.length >= 2) {
        const versionPath = pathParts.slice(0, 2).join("/"); // Ex: api/v1
        const specFiles = ["swagger.json", "openapi.json", "docs.json", "api-docs.json"];
        for (const file of specFiles) {
            urls.push(`${origin}/${versionPath}/${file}`);
        }
    }

    // Remove duplicatas mantendo ordem
    return [...new Set(urls)];
}

/**
 * Tenta buscar uma spec em uma URL específica
 */
async function tryFetchSpec(
    specUrl: string,
    timeout: number,
): Promise<{ specUrl: string; specType: "json" | "yaml" } | null> {
    try {
        const response = await axios.head(specUrl, {
            timeout,
            validateStatus: (status) => status === 200,
        });

        // Verifica se é JSON ou YAML
        const contentType = response.headers["content-type"] || "";
        if (contentType.includes("json") || contentType.includes("yaml") || contentType.includes("yml")) {
            return {
                specUrl,
                specType: contentType.includes("yaml") || contentType.includes("yml") ? "yaml" : "json",
            };
        }

        // Se não tem content-type mas a URL termina em .json ou .yaml, aceita
        if (specUrl.endsWith(".json")) {
            return { specUrl, specType: "json" };
        }
        if (specUrl.endsWith(".yaml") || specUrl.endsWith(".yml")) {
            return { specUrl, specType: "yaml" };
        }
    } catch {
        // Ignora erros e continua
    }

    return null;
}

/**
 * Busca e retorna o conteúdo da spec OpenAPI
 *
 * @param specUrl - URL da spec
 * @param timeout - Timeout da requisição
 * @returns Conteúdo da spec como objeto
 */
export async function fetchOpenApiSpec(specUrl: string, timeout = 10000): Promise<object | null> {
    try {
        const response = await axios.get(specUrl, {
            timeout,
            headers: {
                Accept: "application/json, application/yaml, text/yaml, */*",
            },
        });

        const data = response.data;

        // Se já é objeto, retorna diretamente
        if (typeof data === "object") {
            return data;
        }

        // Se é string, tenta parsear
        if (typeof data === "string") {
            // Tenta JSON primeiro
            try {
                return JSON.parse(data);
            } catch {
                // Pode ser YAML - retorna como está para ser parseado depois
                return { _rawYaml: data };
            }
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Verifica se o conteúdo parece ser uma spec OpenAPI válida
 */
export function isValidOpenApiSpec(spec: unknown): boolean {
    if (typeof spec !== "object" || spec === null) {
        return false;
    }

    const obj = spec as Record<string, unknown>;

    // OpenAPI 3.x
    if (obj.openapi && typeof obj.openapi === "string" && obj.openapi.startsWith("3.")) {
        return true;
    }

    // Swagger 2.x
    if (obj.swagger && typeof obj.swagger === "string" && obj.swagger.startsWith("2.")) {
        return true;
    }

    // Verifica estrutura comum
    if (obj.paths || obj.info || obj.components || obj.definitions) {
        return true;
    }

    return false;
}
