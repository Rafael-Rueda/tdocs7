/**
 * Parser de especificações OpenAPI/Swagger para texto legível
 * Converte specs JSON em documentação formatada para chunking
 */

/**
 * Tipos básicos do OpenAPI (simplificados)
 */
interface OpenApiInfo {
    title?: string;
    description?: string;
    version?: string;
    contact?: { name?: string; email?: string; url?: string };
    license?: { name?: string; url?: string };
}

interface OpenApiServer {
    url: string;
    description?: string;
}

interface OpenApiParameter {
    name: string;
    in: "query" | "header" | "path" | "cookie";
    description?: string;
    required?: boolean;
    schema?: OpenApiSchema;
    example?: unknown;
}

interface OpenApiSchema {
    type?: string;
    format?: string;
    description?: string;
    properties?: Record<string, OpenApiSchema>;
    items?: OpenApiSchema;
    required?: string[];
    enum?: unknown[];
    example?: unknown;
    $ref?: string;
}

interface OpenApiRequestBody {
    description?: string;
    required?: boolean;
    content?: Record<string, { schema?: OpenApiSchema; example?: unknown }>;
}

interface OpenApiResponse {
    description?: string;
    content?: Record<string, { schema?: OpenApiSchema; example?: unknown }>;
}

interface OpenApiOperation {
    summary?: string;
    description?: string;
    operationId?: string;
    tags?: string[];
    parameters?: OpenApiParameter[];
    requestBody?: OpenApiRequestBody;
    responses?: Record<string, OpenApiResponse>;
    deprecated?: boolean;
    security?: Record<string, string[]>[];
}

interface OpenApiPathItem {
    summary?: string;
    description?: string;
    get?: OpenApiOperation;
    post?: OpenApiOperation;
    put?: OpenApiOperation;
    delete?: OpenApiOperation;
    patch?: OpenApiOperation;
    options?: OpenApiOperation;
    head?: OpenApiOperation;
    trace?: OpenApiOperation;
    parameters?: OpenApiParameter[];
}

interface OpenApiSpec {
    openapi?: string;
    swagger?: string;
    info?: OpenApiInfo;
    servers?: OpenApiServer[];
    paths?: Record<string, OpenApiPathItem>;
    components?: {
        schemas?: Record<string, OpenApiSchema>;
        securitySchemes?: Record<string, unknown>;
    };
    definitions?: Record<string, OpenApiSchema>; // Swagger 2.x
    tags?: { name: string; description?: string }[];
}

/**
 * Converte uma spec OpenAPI em texto formatado para documentação
 *
 * @param spec - Spec OpenAPI como objeto
 * @returns Texto formatado em Markdown
 */
export function openApiToMarkdown(spec: unknown): string {
    if (!isOpenApiSpec(spec)) {
        return "";
    }

    const apiSpec = spec as OpenApiSpec;
    const sections: string[] = [];

    // Informações gerais
    sections.push(formatInfo(apiSpec));

    // Servers
    if (apiSpec.servers?.length) {
        sections.push(formatServers(apiSpec.servers));
    }

    // Tags (descrições)
    if (apiSpec.tags?.length) {
        sections.push(formatTags(apiSpec.tags));
    }

    // Endpoints
    if (apiSpec.paths) {
        sections.push(formatPaths(apiSpec.paths, apiSpec));
    }

    // Schemas/Definitions
    const schemas = apiSpec.components?.schemas || apiSpec.definitions;
    if (schemas) {
        sections.push(formatSchemas(schemas));
    }

    return sections.filter(Boolean).join("\n\n---\n\n");
}

/**
 * Verifica se o objeto é uma spec OpenAPI válida
 */
function isOpenApiSpec(obj: unknown): boolean {
    if (typeof obj !== "object" || obj === null) {
        return false;
    }

    const spec = obj as Record<string, unknown>;
    return !!(spec.openapi || spec.swagger || spec.paths || spec.info);
}

/**
 * Formata informações gerais da API
 */
function formatInfo(spec: OpenApiSpec): string {
    const info = spec.info;
    if (!info) {
        return "";
    }

    const parts: string[] = [];

    // Título e versão
    const version = spec.openapi || spec.swagger || "";
    const title = info.title || "API Documentation";
    parts.push(`# ${title}`);

    if (info.version) {
        parts.push(`**Versão:** ${info.version}`);
    }

    if (version) {
        parts.push(`**OpenAPI:** ${version}`);
    }

    // Descrição
    if (info.description) {
        parts.push(`\n${info.description}`);
    }

    // Contato
    if (info.contact) {
        const contact = info.contact;
        const contactParts: string[] = [];
        if (contact.name) contactParts.push(contact.name);
        if (contact.email) contactParts.push(`<${contact.email}>`);
        if (contact.url) contactParts.push(`[${contact.url}](${contact.url})`);
        if (contactParts.length) {
            parts.push(`**Contato:** ${contactParts.join(" - ")}`);
        }
    }

    // Licença
    if (info.license) {
        const license = info.license.url ? `[${info.license.name}](${info.license.url})` : info.license.name;
        parts.push(`**Licença:** ${license}`);
    }

    return parts.join("\n");
}

/**
 * Formata lista de servidores
 */
function formatServers(servers: OpenApiServer[]): string {
    const parts: string[] = ["## Servidores"];

    for (const server of servers) {
        const desc = server.description ? ` - ${server.description}` : "";
        parts.push(`- \`${server.url}\`${desc}`);
    }

    return parts.join("\n");
}

/**
 * Formata tags com descrições
 */
function formatTags(tags: { name: string; description?: string }[]): string {
    const parts: string[] = ["## Categorias"];

    for (const tag of tags) {
        if (tag.description) {
            parts.push(`- **${tag.name}**: ${tag.description}`);
        } else {
            parts.push(`- **${tag.name}**`);
        }
    }

    return parts.join("\n");
}

/**
 * Formata todos os endpoints
 */
function formatPaths(paths: Record<string, OpenApiPathItem>, spec: OpenApiSpec): string {
    const parts: string[] = ["## Endpoints"];

    // Agrupa por tag se possível
    const byTag: Record<string, string[]> = {};
    const untagged: string[] = [];

    for (const [path, pathItem] of Object.entries(paths)) {
        const methods: (keyof OpenApiPathItem)[] = ["get", "post", "put", "delete", "patch", "options", "head"];

        for (const method of methods) {
            const operation = pathItem[method] as OpenApiOperation | undefined;
            if (!operation) continue;

            const formatted = formatOperation(method.toUpperCase(), path, operation, pathItem.parameters, spec);

            if (operation.tags?.length) {
                for (const tag of operation.tags) {
                    byTag[tag] = byTag[tag] || [];
                    byTag[tag].push(formatted);
                }
            } else {
                untagged.push(formatted);
            }
        }
    }

    // Adiciona endpoints por tag
    for (const [tag, endpoints] of Object.entries(byTag)) {
        parts.push(`\n### ${tag}\n`);
        parts.push(...endpoints);
    }

    // Adiciona endpoints sem tag
    if (untagged.length) {
        if (Object.keys(byTag).length > 0) {
            parts.push("\n### Outros\n");
        }
        parts.push(...untagged);
    }

    return parts.join("\n");
}

/**
 * Formata uma operação (endpoint + método)
 */
function formatOperation(
    method: string,
    path: string,
    operation: OpenApiOperation,
    pathParams?: OpenApiParameter[],
    _spec?: OpenApiSpec,
): string {
    const parts: string[] = [];

    // Header do endpoint
    const deprecated = operation.deprecated ? " ~~DEPRECATED~~" : "";
    parts.push(`\n#### \`${method} ${path}\`${deprecated}`);

    // Summary e descrição
    if (operation.summary) {
        parts.push(`**${operation.summary}**`);
    }
    if (operation.description) {
        parts.push(operation.description);
    }

    // Operation ID
    if (operation.operationId) {
        parts.push(`*Operation ID:* \`${operation.operationId}\``);
    }

    // Parâmetros (combina path params com operation params)
    const allParams = [...(pathParams || []), ...(operation.parameters || [])];
    if (allParams.length) {
        parts.push("\n**Parâmetros:**");
        for (const param of allParams) {
            const required = param.required ? " *(obrigatório)*" : "";
            const type = param.schema?.type ? ` \`${param.schema.type}\`` : "";
            const desc = param.description ? ` - ${param.description}` : "";
            parts.push(`- \`${param.name}\` (${param.in})${type}${required}${desc}`);
        }
    }

    // Request Body
    if (operation.requestBody) {
        parts.push("\n**Request Body:**");
        if (operation.requestBody.description) {
            parts.push(operation.requestBody.description);
        }
        if (operation.requestBody.content) {
            for (const [contentType, content] of Object.entries(operation.requestBody.content)) {
                parts.push(`- Content-Type: \`${contentType}\``);
                if (content.schema) {
                    parts.push(formatSchemaInline(content.schema, 1));
                }
            }
        }
    }

    // Respostas
    if (operation.responses) {
        parts.push("\n**Respostas:**");
        for (const [code, response] of Object.entries(operation.responses)) {
            const desc = response.description ? ` - ${response.description}` : "";
            parts.push(`- \`${code}\`${desc}`);
        }
    }

    return parts.join("\n");
}

/**
 * Formata schemas/definitions
 */
function formatSchemas(schemas: Record<string, OpenApiSchema>): string {
    const parts: string[] = ["## Modelos de Dados"];

    for (const [name, schema] of Object.entries(schemas)) {
        parts.push(`\n### ${name}`);

        if (schema.description) {
            parts.push(schema.description);
        }

        if (schema.type) {
            parts.push(`**Tipo:** \`${schema.type}\``);
        }

        if (schema.properties) {
            parts.push("\n**Propriedades:**");
            const required = new Set(schema.required || []);

            for (const [propName, propSchema] of Object.entries(schema.properties)) {
                const isRequired = required.has(propName) ? " *(obrigatório)*" : "";
                const type = propSchema.type ? ` \`${propSchema.type}\`` : "";
                const desc = propSchema.description ? ` - ${propSchema.description}` : "";
                parts.push(`- \`${propName}\`${type}${isRequired}${desc}`);
            }
        }

        if (schema.enum) {
            parts.push(`**Valores possíveis:** ${schema.enum.map((v) => `\`${v}\``).join(", ")}`);
        }
    }

    return parts.join("\n");
}

/**
 * Formata um schema inline (para request/response bodies)
 */
function formatSchemaInline(schema: OpenApiSchema, indent: number): string {
    const prefix = "  ".repeat(indent);
    const parts: string[] = [];

    if (schema.$ref) {
        const refName = schema.$ref.split("/").pop();
        parts.push(`${prefix}Schema: \`${refName}\``);
        return parts.join("\n");
    }

    if (schema.type === "object" && schema.properties) {
        for (const [name, prop] of Object.entries(schema.properties)) {
            const type = prop.type ? ` (${prop.type})` : "";
            parts.push(`${prefix}- \`${name}\`${type}`);
        }
    } else if (schema.type === "array" && schema.items) {
        const itemType = schema.items.type || schema.items.$ref?.split("/").pop() || "any";
        parts.push(`${prefix}Array de \`${itemType}\``);
    } else if (schema.type) {
        parts.push(`${prefix}Tipo: \`${schema.type}\``);
    }

    return parts.join("\n");
}

/**
 * Extrai apenas os endpoints e suas descrições (versão compacta)
 */
export function extractEndpointsSummary(spec: unknown): string {
    if (!isOpenApiSpec(spec)) {
        return "";
    }

    const apiSpec = spec as OpenApiSpec;
    const parts: string[] = [];

    if (apiSpec.info?.title) {
        parts.push(`# ${apiSpec.info.title}`);
    }

    if (!apiSpec.paths) {
        return parts.join("\n");
    }

    parts.push("\n## Endpoints Disponíveis\n");

    for (const [path, pathItem] of Object.entries(apiSpec.paths)) {
        const methods: (keyof OpenApiPathItem)[] = ["get", "post", "put", "delete", "patch"];

        for (const method of methods) {
            const operation = pathItem[method] as OpenApiOperation | undefined;
            if (!operation) continue;

            const summary = operation.summary || operation.description?.slice(0, 100) || "";
            parts.push(`- **${method.toUpperCase()}** \`${path}\` - ${summary}`);
        }
    }

    return parts.join("\n");
}
