/**
 * Cliente HTTP configurado para requisições à API de documentação
 */

import axios, { type AxiosError, type AxiosInstance } from "axios";

import { getConfig } from "../config/index.js";

let httpClientInstance: AxiosInstance | null = null;

/**
 * Retorna instância configurada do cliente HTTP (singleton)
 * Configurado com JWT e timeout da configuração do MCP
 */
export function getHttpClient(): AxiosInstance {
    if (!httpClientInstance) {
        const config = getConfig();

        httpClientInstance = axios.create({
            headers: {
                Authorization: `Bearer ${config.jwtToken}`,
                "Content-Type": "application/json",
            },
            timeout: config.requestTimeout,
        });
    }

    return httpClientInstance;
}

/**
 * Interface para erro formatado
 */
export interface FormattedError {
    message: string;
    userMessage: string;
    statusCode?: number;
}

/**
 * Formata erros de requisição HTTP para mensagens amigáveis
 *
 * @param error - Erro capturado
 * @param url - URL que foi requisitada
 * @returns Objeto com mensagens de erro formatadas
 */
export function formatHttpError(error: unknown, url: string): FormattedError {
    const defaultMessage = error instanceof Error ? error.message : "Erro desconhecido";

    if (!axios.isAxiosError(error)) {
        return {
            message: defaultMessage,
            userMessage: `Erro ao buscar documentação: ${defaultMessage}`,
        };
    }

    const axiosError = error as AxiosError;

    // Erros de conexão
    if (axiosError.code === "ECONNREFUSED") {
        return {
            message: defaultMessage,
            userMessage: `Não foi possível conectar à documentação (${url}). Verifique se a URL está correta e o servidor está online.`,
        };
    }

    if (axiosError.code === "ETIMEDOUT" || axiosError.code === "ECONNABORTED") {
        return {
            message: defaultMessage,
            userMessage: `Timeout ao conectar à documentação. Verifique sua conexão ou aumente MCP_REQUEST_TIMEOUT.`,
        };
    }

    // Erros HTTP
    const status = axiosError.response?.status;

    if (status === 401) {
        return {
            message: defaultMessage,
            userMessage: `Token JWT inválido ou expirado. Verifique MCP_JWT_TOKEN.`,
            statusCode: status,
        };
    }

    if (status === 403) {
        return {
            message: defaultMessage,
            userMessage: `Acesso negado à documentação. Verifique as permissões do token JWT.`,
            statusCode: status,
        };
    }

    if (status === 404) {
        return {
            message: defaultMessage,
            userMessage: `Documentação não encontrada em ${url}. Verifique MCP_DOCS_URL.`,
            statusCode: status,
        };
    }

    if (status && status >= 500) {
        return {
            message: defaultMessage,
            userMessage: `Erro no servidor de documentação (${status}). Tente novamente mais tarde.`,
            statusCode: status,
        };
    }

    return {
        message: defaultMessage,
        userMessage: `Erro ao buscar documentação: ${defaultMessage}`,
        statusCode: status,
    };
}

/**
 * Opções para fetch de documento
 */
export interface FetchDocumentOptions {
    /** Usa fetch inteligente com detecção de Swagger/SPA (padrão: true) */
    useSmartFetch?: boolean;
    /** Timeout para requisições HTTP (ms) */
    httpTimeout?: number;
    /** Timeout para renderização headless (ms) */
    headlessTimeout?: number;
}

/**
 * Busca conteúdo de uma URL e retorna como string
 * Suporta detecção automática de Swagger/OpenAPI e renderização de SPAs
 *
 * @param url - URL para buscar
 * @param options - Opções de fetch
 * @returns Conteúdo da resposta como string
 */
export async function fetchDocument(url: string, options: FetchDocumentOptions = {}): Promise<string> {
    const { useSmartFetch = true, httpTimeout, headlessTimeout } = options;

    // Se smart fetch está habilitado, usa ele
    if (useSmartFetch) {
        // Importa dinamicamente para evitar dependência circular
        const { smartFetch } = await import("./smart-fetch.js");

        const result = await smartFetch(url, {
            httpTimeout,
            headlessTimeout,
        });

        if (result.success && result.content) {
            return result.content;
        }

        // Se falhou, tenta método tradicional
        if (result.error) {
            console.error(`Smart fetch falhou: ${result.error}. Tentando método tradicional...`);
        }
    }

    // Método tradicional
    const client = getHttpClient();
    const response = await client.get<string | object>(url);

    // Garante que o retorno seja string
    if (typeof response.data === "string") {
        return response.data;
    }

    return JSON.stringify(response.data, null, 2);
}
