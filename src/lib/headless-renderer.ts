/**
 * Renderizador headless para páginas SPA usando Puppeteer
 * Dependência opcional - funciona apenas se puppeteer estiver instalado
 */

/**
 * Resultado da renderização
 */
export interface RenderResult {
    /** Se a renderização foi bem sucedida */
    success: boolean;
    /** Conteúdo HTML renderizado */
    html?: string;
    /** Texto extraído da página */
    text?: string;
    /** Erro se falhou */
    error?: string;
    /** Método usado (puppeteer ou fallback) */
    method: "puppeteer" | "fallback" | "unavailable";
}

/**
 * Opções de renderização
 */
export interface RenderOptions {
    /** Timeout em ms (padrão: 30000) */
    timeout?: number;
    /** Esperar por seletor específico antes de extrair */
    waitForSelector?: string;
    /** Tempo adicional de espera após load (ms) */
    extraWaitTime?: number;
    /** Se deve extrair texto além do HTML */
    extractText?: boolean;
}

/**
 * Interface simplificada para o módulo Puppeteer
 * Usada para evitar dependência de tipos quando puppeteer não está instalado
 */
interface PuppeteerModule {
    launch(options?: Record<string, unknown>): Promise<PuppeteerBrowser>;
    executablePath?(): string;
}

interface PuppeteerBrowser {
    newPage(): Promise<PuppeteerPage>;
    version(): Promise<string>;
    close(): Promise<void>;
}

interface PuppeteerPage {
    setViewport(viewport: { width: number; height: number }): Promise<void>;
    setUserAgent(userAgent: string): Promise<void>;
    goto(url: string, options?: Record<string, unknown>): Promise<unknown>;
    waitForSelector(selector: string, options?: Record<string, unknown>): Promise<unknown>;
    content(): Promise<string>;
    evaluate<T>(fn: () => T): Promise<T>;
}

// Cache para verificar se puppeteer está disponível
let puppeteerAvailable: boolean | null = null;
let puppeteerModule: PuppeteerModule | null = null;

/**
 * Verifica se Puppeteer está instalado e disponível
 */
export async function isPuppeteerAvailable(): Promise<boolean> {
    if (puppeteerAvailable !== null) {
        return puppeteerAvailable;
    }

    try {
        // Tenta importar dinamicamente
        // biome-ignore lint/suspicious/noExplicitAny: Puppeteer é dependência opcional sem tipos
        puppeteerModule = (await import("puppeteer")) as any;
        puppeteerAvailable = true;
        return true;
    } catch {
        // Tenta puppeteer-core como alternativa
        try {
            // biome-ignore lint/suspicious/noExplicitAny: Puppeteer é dependência opcional sem tipos
            puppeteerModule = (await import("puppeteer-core")) as any;
            puppeteerAvailable = true;
            return true;
        } catch {
            puppeteerAvailable = false;
            return false;
        }
    }
}

/**
 * Renderiza uma página usando Puppeteer (headless browser)
 *
 * @param url - URL da página para renderizar
 * @param options - Opções de renderização
 * @returns Resultado com HTML/texto renderizado
 */
export async function renderPage(url: string, options: RenderOptions = {}): Promise<RenderResult> {
    const { timeout = 30000, waitForSelector, extraWaitTime = 2000, extractText = true } = options;

    // Verifica se puppeteer está disponível
    const available = await isPuppeteerAvailable();
    if (!available || !puppeteerModule) {
        return {
            success: false,
            error: "Puppeteer não está instalado. Execute: npm install puppeteer",
            method: "unavailable",
        };
    }

    let browser = null;

    try {
        // Inicia o browser
        browser = await puppeteerModule.launch({
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--disable-gpu",
                "--window-size=1920,1080",
            ],
        });

        const page = await browser.newPage();

        // Configura viewport
        await page.setViewport({ width: 1920, height: 1080 });

        // Configura user agent
        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        );

        // Navega para a URL
        await page.goto(url, {
            waitUntil: "networkidle2",
            timeout,
        });

        // Espera por seletor específico se fornecido
        if (waitForSelector) {
            try {
                await page.waitForSelector(waitForSelector, { timeout: timeout / 2 });
            } catch {
                // Continua mesmo se o seletor não for encontrado
            }
        }

        // Espera adicional para JS finalizar renderização
        if (extraWaitTime > 0) {
            await new Promise((resolve) => setTimeout(resolve, extraWaitTime));
        }

        // Extrai HTML
        const html = await page.content();

        // Extrai texto se solicitado
        let text: string | undefined;
        if (extractText) {
            // A função é executada no contexto do browser, não no Node
            // biome-ignore lint/suspicious/noExplicitAny: Executado no contexto do browser
            text = await (page as any).evaluate(`
                (() => {
                    const clone = document.body.cloneNode(true);
                    const scripts = clone.querySelectorAll("script, style, noscript");
                    for (const el of scripts) {
                        el.remove();
                    }
                    return clone.innerText || clone.textContent || "";
                })()
            `);
        }

        return {
            success: true,
            html,
            text: text?.trim(),
            method: "puppeteer",
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Erro desconhecido";
        return {
            success: false,
            error: `Falha ao renderizar página: ${message}`,
            method: "puppeteer",
        };
    } finally {
        if (browser) {
            try {
                await browser.close();
            } catch {
                // Ignora erros ao fechar
            }
        }
    }
}

/**
 * Renderiza página Swagger e extrai spec via window.ui.spec()
 * O Swagger UI expõe a spec completa carregada em memória
 */
export async function renderSwaggerPage(url: string, timeout = 30000): Promise<RenderResult> {
    // Verifica se puppeteer está disponível
    const available = await isPuppeteerAvailable();
    if (!available || !puppeteerModule) {
        return {
            success: false,
            error: "Puppeteer não está instalado. Execute: npm install puppeteer",
            method: "unavailable",
        };
    }

    let browser = null;

    try {
        browser = await puppeteerModule.launch({
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
            ],
        });

        const page = await browser.newPage();

        // Navega para a página
        await page.goto(url, {
            waitUntil: "networkidle2",
            timeout,
        });

        // Espera o Swagger UI carregar
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Tenta extrair a spec via window.ui.spec()
        // O Swagger UI usa Immutable.js, então precisamos chamar .toJS() para converter
        // biome-ignore lint/suspicious/noExplicitAny: Executado no contexto do browser
        const spec = await (page as any).evaluate(`
            (() => {
                // Função helper para converter Immutable.js para JS puro
                const toPlainJS = (obj) => {
                    if (!obj) return obj;
                    // Se tem método toJS (Immutable.js), usa ele
                    if (typeof obj.toJS === 'function') {
                        return obj.toJS();
                    }
                    return obj;
                };

                // 1. Swagger UI padrão - window.ui.spec() retorna Immutable.js Map
                if (window.ui && typeof window.ui.spec === 'function') {
                    const spec = window.ui.spec();
                    const plainSpec = toPlainJS(spec);
                    if (plainSpec && (plainSpec.openapi || plainSpec.swagger || plainSpec.paths)) {
                        return JSON.stringify(plainSpec);
                    }
                }

                // 2. Swagger UI specSelectors.specJson() - também retorna Immutable.js
                if (window.ui && window.ui.specSelectors) {
                    if (typeof window.ui.specSelectors.specJson === 'function') {
                        const spec = window.ui.specSelectors.specJson();
                        const plainSpec = toPlainJS(spec);
                        if (plainSpec && (plainSpec.openapi || plainSpec.swagger || plainSpec.paths)) {
                            return JSON.stringify(plainSpec);
                        }
                    }
                    // specSelectors.specStr() retorna a spec como string JSON
                    if (typeof window.ui.specSelectors.specStr === 'function') {
                        const specStr = window.ui.specSelectors.specStr();
                        if (specStr && typeof specStr === 'string') {
                            return specStr;
                        }
                    }
                }

                // 3. Swagger UI com getSpec
                if (window.ui && typeof window.ui.getSpec === 'function') {
                    const spec = window.ui.getSpec();
                    const plainSpec = toPlainJS(spec);
                    if (plainSpec) {
                        return JSON.stringify(plainSpec);
                    }
                }

                // 4. Variável global spec
                if (window.spec) {
                    const plainSpec = toPlainJS(window.spec);
                    return JSON.stringify(plainSpec);
                }

                // 5. SwaggerUIBundle armazenado
                if (window.swaggerUi && window.swaggerUi.api) {
                    return JSON.stringify(window.swaggerUi.api);
                }

                // 6. Procura no window por objetos que parecem ser spec
                for (const key of Object.keys(window)) {
                    try {
                        const obj = window[key];
                        if (obj && typeof obj === 'object' && (obj.openapi || obj.swagger) && obj.paths) {
                            return JSON.stringify(obj);
                        }
                    } catch {}
                }

                return null;
            })()
        `);

        // Se encontrou a spec, converte para markdown
        if (spec) {
            const markdown = await convertSpecToMarkdown(spec);
            if (markdown) {
                return {
                    success: true,
                    html: spec,
                    text: markdown,
                    method: "puppeteer",
                };
            }
        }

        // Fallback: extrai texto da página renderizada
        const html = await page.content();

        // biome-ignore lint/suspicious/noExplicitAny: Executado no contexto do browser
        const text = await (page as any).evaluate(`
            (() => {
                const clone = document.body.cloneNode(true);
                clone.querySelectorAll('script, style, noscript, svg, link, meta, button').forEach(el => el.remove());
                return clone.innerText || clone.textContent || '';
            })()
        `);

        return {
            success: true,
            html,
            text: text?.trim(),
            method: "puppeteer",
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Erro desconhecido";
        return {
            success: false,
            error: `Falha ao renderizar página: ${message}`,
            method: "puppeteer",
        };
    } finally {
        if (browser) {
            try {
                await browser.close();
            } catch {
                // Ignora erros ao fechar
            }
        }
    }
}

/**
 * Converte spec OpenAPI para Markdown
 */
async function convertSpecToMarkdown(content: string): Promise<string | null> {
    try {
        // Importa dinamicamente para evitar dependência circular
        const { openApiToMarkdown } = await import("./openapi-parser.js");

        let spec: unknown;

        try {
            spec = JSON.parse(content);
        } catch {
            // TODO: Adicionar suporte a YAML se necessário
            return null;
        }

        return openApiToMarkdown(spec);
    } catch {
        return null;
    }
}

/**
 * Extrai texto estruturado de uma página Swagger renderizada
 */
export async function extractSwaggerContent(url: string): Promise<string | null> {
    const result = await renderSwaggerPage(url);

    if (!result.success || !result.text) {
        return null;
    }

    // Limpa o texto extraído
    return cleanSwaggerText(result.text);
}

/**
 * Limpa texto extraído do Swagger UI
 */
function cleanSwaggerText(text: string): string {
    return (
        text
            // Remove linhas vazias excessivas
            .replace(/\n{3,}/g, "\n\n")
            // Remove caracteres de controle (NUL, SOH, STX, etc.)
            // biome-ignore lint/suspicious/noControlCharactersInRegex: Intencional para limpar texto
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
            // Normaliza espaços
            .replace(/[ \t]+/g, " ")
            // Trim de cada linha
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .join("\n")
    );
}

/**
 * Verifica status do Puppeteer e retorna informações
 */
export async function getPuppeteerStatus(): Promise<{
    available: boolean;
    version?: string;
    executablePath?: string;
}> {
    const available = await isPuppeteerAvailable();

    if (!available || !puppeteerModule) {
        return { available: false };
    }

    try {
        const browser = await puppeteerModule.launch({ headless: true });
        const version = await browser.version();
        const executablePath = puppeteerModule.executablePath?.() || "unknown";
        await browser.close();

        return {
            available: true,
            version,
            executablePath,
        };
    } catch {
        return { available: true };
    }
}
