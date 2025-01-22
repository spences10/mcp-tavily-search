#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	CallToolRequestSchema,
	ErrorCode,
	ListToolsRequestSchema,
	McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(
	readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
);
const { name, version } = pkg;

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
if (!TAVILY_API_KEY) {
	throw new Error('TAVILY_API_KEY environment variable is required');
}

// Tool Definitions
interface TavilyToolConfig {
	name: string;
	description: string;
	inputSchema: object;
}

const TAVILY_TOOLS: TavilyToolConfig[] = [
	{
		name: 'tavily_search',
		description:
			'Search the web using Tavily Search API, optimized for high-quality, factual results',
		inputSchema: {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					description: 'Search query',
				},
				search_depth: {
					type: 'string',
					description:
						'The depth of the search ("basic" for faster results, "advanced" for more thorough search)',
					enum: ['basic', 'advanced'],
					default: 'basic',
				},
				include_answer: {
					type: 'boolean',
					description:
						'Include an AI-generated answer based on search results',
					default: true,
				},
				include_domains: {
					type: 'array',
					items: { type: 'string' },
					description: 'List of trusted domains to include in search',
					default: [],
				},
				exclude_domains: {
					type: 'array',
					items: { type: 'string' },
					description: 'List of domains to exclude from search',
					default: [],
				},
				response_format: {
					type: 'string',
					enum: ['text', 'json', 'markdown'],
					description: 'Format of the search results',
					default: 'text',
				},
				max_results: {
					type: 'number',
					description: 'Maximum number of results to return',
					default: 10,
				},
				min_score: {
					type: 'number',
					description: 'Minimum relevancy score for results (0-1)',
					default: 0.0,
				},
				cache_ttl: {
					type: 'number',
					description: 'Cache time-to-live in seconds',
					default: 3600,
				},
				force_refresh: {
					type: 'boolean',
					description: 'Force fresh results ignoring cache',
					default: false,
				},
			},
			required: ['query'],
		},
	},
	{
		name: 'tavily_get_search_context',
		description:
			'Generate context for RAG applications using Tavily search',
		inputSchema: {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					description: 'Search query for context generation',
				},
				max_tokens: {
					type: 'number',
					description: 'Maximum length of generated context',
					default: 2000,
				},
				response_format: {
					type: 'string',
					enum: ['text', 'json'],
					description: 'Format of the context response',
					default: 'text',
				},
			},
			required: ['query'],
		},
	},
	{
		name: 'tavily_qna_search',
		description:
			'Get direct answers to questions using Tavily search',
		inputSchema: {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					description: 'Question to be answered',
				},
				include_sources: {
					type: 'boolean',
					description: 'Include source citations in the answer',
					default: true,
				},
				response_format: {
					type: 'string',
					enum: ['text', 'json'],
					description: 'Format of the answer response',
					default: 'text',
				},
			},
			required: ['query'],
		},
	},
];

// Response Types
interface TavilyBaseResponse {
	query: string;
	processingTime?: number;
	cost?: number;
}

interface TavilySearchResponse {
    query: string;
    answer?: string;
    response_time: number;
    images?: Array<string | { url: string; description: string }>;
    results: Array<{
        title: string;
        url: string;
        content: string;
        raw_content?: string;
        score: number;
        published_date?: string;
    }>;
}

type TimeRange = 'day' | 'week' | 'month' | 'year' | 'd' | 'w' | 'm' | 'y';

interface TavilySearchParams {
    query: string;
    search_depth?: 'basic' | 'advanced';
    topic?: 'general' | 'news';
    days?: number;
    time_range?: TimeRange;
    max_results?: number;
    include_images?: boolean;
    include_image_descriptions?: boolean;
    include_answer?: boolean;
    include_raw_content?: boolean;
    include_domains?: string[];
    exclude_domains?: string[];
}

interface TavilyContextParams {
    query: string;
    max_tokens?: number;
    search_depth?: 'basic' | 'advanced';
    topic?: 'general' | 'news';
    days?: number;
    time_range?: TimeRange;
    max_results?: number;
    include_domains?: string[];
    exclude_domains?: string[];
}

interface TavilyQnAParams {
    query: string;
    search_depth?: 'basic' | 'advanced';
    topic?: 'general' | 'news';
    days?: number;
    time_range?: TimeRange;
    max_results?: number;
    include_domains?: string[];
    exclude_domains?: string[];
}

// Error Handling
class TavilyError extends Error {
	constructor(
		message: string,
		public code: string,
		public details?: unknown,
	) {
		super(message);
		this.name = 'TavilyError';
	}
}

const error_handler = {
	format_error(error: unknown): string {
		if (error instanceof TavilyError) {
			return `Tavily API Error (${error.code}): ${error.message}`;
		}
		return `Error: ${
			error instanceof Error ? error.message : String(error)
		}`;
	},

	get_error_code(error: unknown): string {
		if (error instanceof TavilyError) {
			return error.code;
		}
		return 'UNKNOWN_ERROR';
	},

	get_error_details(error: unknown): unknown {
		if (error instanceof TavilyError) {
			return error.details;
		}
		return null;
	},
};

// Response Formatters
const response_formatters = {
	text(data: TavilySearchResponse): string {
		let output = `Search Results for "${data.query}":\n\n`;
		if (data.answer) {
			output += `Summary: ${data.answer}\n\nDetailed Sources:\n`;
		}
		return (
			output +
			data.results
				.map((result, i) => {
					let source = `${i + 1}. ${result.title}\n`;
					source += `   URL: ${result.url}\n`;
					if (result.published_date) {
						source += `   Published: ${result.published_date}\n`;
					}
					source += `   Content: ${result.content}\n`;
					return source;
				})
				.join('\n')
		);
	},

	json(data: TavilySearchResponse): string {
		return JSON.stringify(data, null, 2);
	},

	markdown(data: TavilySearchResponse): string {
		let output = `# Search Results: ${data.query}\n\n`;
		if (data.answer) {
			output += `## Summary\n${data.answer}\n\n## Sources\n`;
		}
		return (
			output +
			data.results
				.map((result) => {
					let source = `### ${result.title}\n`;
					source += `- URL: [${result.url}](${result.url})\n`;
					if (result.published_date) {
						source += `- Published: ${result.published_date}\n`;
					}
					source += `\n${result.content}\n`;
					return source;
				})
				.join('\n---\n')
		);
	},
};

// Cache Implementation
interface CacheEntry<T> {
	data: T;
	timestamp: number;
	ttl: number;
}

class TavilyCache {
	private cache: Map<string, CacheEntry<unknown>> = new Map();

	set<T>(key: string, data: T, ttl: number): void {
		this.cache.set(key, {
			data,
			timestamp: Date.now(),
			ttl,
		});
	}

	get<T>(key: string): T | null {
		const entry = this.cache.get(key) as CacheEntry<T>;
		if (!entry) return null;

		if (Date.now() - entry.timestamp > entry.ttl * 1000) {
			this.cache.delete(key);
			return null;
		}

		return entry.data;
	}

	clear(): void {
		this.cache.clear();
	}
}

class TavilySearchServer {
	private server: Server;
	private cache: TavilyCache;

	// Default trusted domains for high-quality results
	private default_include_domains = [
		'arxiv.org',
		'scholar.google.com',
		'science.gov',
		'wikipedia.org',
		'github.com',
		'stackoverflow.com',
		'developer.mozilla.org',
	];

	// Default domains to exclude for better result quality
	private default_exclude_domains = [
		'facebook.com',
		'twitter.com',
		'instagram.com',
		'tiktok.com',
	];

	constructor() {
		this.server = new Server(
			{ name, version },
			{
				capabilities: {
					tools: {
						tavily_search: true,
						tavily_get_search_context: true,
						tavily_qna_search: true,
					},
					caching: true,
					formatting: ['text', 'json', 'markdown'],
				},
			},
		);

		this.cache = new TavilyCache();
		this.setup_tool_handlers();
	}

	private setup_tool_handlers() {
		this.server.setRequestHandler(
			ListToolsRequestSchema,
			async () => ({
				tools: TAVILY_TOOLS,
			}),
		);

		this.server.setRequestHandler(
			CallToolRequestSchema,
			async (request) => {
				const tool = TAVILY_TOOLS.find(
					(t) => t.name === request.params.name,
				);
				if (!tool) {
					throw new McpError(
						ErrorCode.MethodNotFound,
						`Unknown tool: ${request.params.name}`,
					);
				}

				try {
					switch (request.params.name) {
						case 'tavily_search': {
							const rawArgs = request.params.arguments as Record<string, unknown>;
							if (!rawArgs?.query || typeof rawArgs.query !== 'string') {
								throw new McpError(
									ErrorCode.InvalidParams,
									'Query parameter is required and must be a string'
								);
							}
							const args: TavilySearchParams = {
								query: rawArgs.query,
								search_depth: rawArgs.search_depth as 'basic' | 'advanced',
								topic: rawArgs.topic as 'general' | 'news',
								days: rawArgs.days as number,
								time_range: rawArgs.time_range as TimeRange,
								max_results: rawArgs.max_results as number,
								include_images: rawArgs.include_images as boolean,
								include_image_descriptions: rawArgs.include_image_descriptions as boolean,
								include_answer: rawArgs.include_answer as boolean,
								include_raw_content: rawArgs.include_raw_content as boolean,
								include_domains: rawArgs.include_domains as string[],
								exclude_domains: rawArgs.exclude_domains as string[],
							};
							return await this.handle_search(args);
						}
						case 'tavily_get_search_context': {
							const rawArgs = request.params.arguments as Record<string, unknown>;
							if (!rawArgs?.query || typeof rawArgs.query !== 'string') {
								throw new McpError(
									ErrorCode.InvalidParams,
									'Query parameter is required and must be a string'
								);
							}
							const args: TavilyContextParams = {
								query: rawArgs.query,
								max_tokens: rawArgs.max_tokens as number,
								search_depth: rawArgs.search_depth as 'basic' | 'advanced',
								topic: rawArgs.topic as 'general' | 'news',
								days: rawArgs.days as number,
								time_range: rawArgs.time_range as TimeRange,
								max_results: rawArgs.max_results as number,
								include_domains: rawArgs.include_domains as string[],
								exclude_domains: rawArgs.exclude_domains as string[],
							};
							return await this.handle_context(args);
						}
						case 'tavily_qna_search': {
							const rawArgs = request.params.arguments as Record<string, unknown>;
							if (!rawArgs?.query || typeof rawArgs.query !== 'string') {
								throw new McpError(
									ErrorCode.InvalidParams,
									'Query parameter is required and must be a string'
								);
							}
							const args: TavilyQnAParams = {
								query: rawArgs.query,
								search_depth: rawArgs.search_depth as 'basic' | 'advanced',
								topic: rawArgs.topic as 'general' | 'news',
								days: rawArgs.days as number,
								time_range: rawArgs.time_range as TimeRange,
								max_results: rawArgs.max_results as number,
								include_domains: rawArgs.include_domains as string[],
								exclude_domains: rawArgs.exclude_domains as string[],
							};
							return await this.handle_qna(args);
						}
						default:
							throw new McpError(
								ErrorCode.MethodNotFound,
								`Unimplemented tool: ${request.params.name}`,
							);
					}
				} catch (error) {
					return {
						content: [
							{
								type: 'text',
								text: error_handler.format_error(error),
							},
						],
						isError: true,
					};
				}
			},
		);
	}

    private async handle_search(args: TavilySearchParams) {
        const {
            query,
            search_depth = 'basic',
            topic = 'general',
            days,
            time_range,
            max_results = 5,
            include_images = false,
            include_image_descriptions = false,
            include_answer = false,
            include_raw_content = false,
            include_domains = this.default_include_domains,
            exclude_domains = this.default_exclude_domains,
        } = args;

        // Check cache if enabled
        const cache_key = JSON.stringify({
            query,
            search_depth,
            topic,
            include_answer,
            include_images,
            include_raw_content,
        });

        const cached_data = this.cache.get<TavilySearchResponse>(cache_key);
        if (cached_data) {
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(cached_data, null, 2),
                    },
                ],
            };
        }

        const start_time = Date.now();

        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${TAVILY_API_KEY}`,
            },
            body: JSON.stringify({
                query,
                search_depth,
                topic,
                days,
                time_range,
                max_results,
                include_images,
                include_image_descriptions,
                include_answer,
                include_raw_content,
                include_domains,
                exclude_domains,
            }),
        });

        if (!response.ok) {
            throw new TavilyError(
                `API request failed: ${response.statusText}`,
                'API_ERROR',
                { status: response.status },
            );
        }

        const data = await response.json();
        const response_time = (Date.now() - start_time) / 1000;

        const search_response: TavilySearchResponse = {
            ...data,
            response_time,
        };

        // Cache the results
        this.cache.set(cache_key, search_response, 3600);

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(search_response, null, 2),
                },
            ],
        };
	}

    private async handle_context(args: TavilyContextParams) {
        const {
            query,
            max_tokens = 2000,
            search_depth = 'advanced',
            topic = 'general',
            days,
            time_range,
            max_results = 5,
            include_domains = this.default_include_domains,
            exclude_domains = this.default_exclude_domains,
        } = args;

        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${TAVILY_API_KEY}`,
            },
            body: JSON.stringify({
                query,
                search_depth,
                topic,
                days,
                time_range,
                max_results,
                include_domains,
                exclude_domains,
                max_tokens,
                include_answer: false,
            }),
        });

        if (!response.ok) {
            throw new TavilyError(
                `API request failed: ${response.statusText}`,
                'API_ERROR',
                { status: response.status },
            );
        }

        const data = await response.json();
        const context = data.results
            .map((result: any) => result.content)
            .join('\n\n')
            .slice(0, max_tokens);

        return {
            content: [
                {
                    type: 'text',
                    text: context,
                },
            ],
        };
	}

    private async handle_qna(args: TavilyQnAParams) {
        const {
            query,
            search_depth = 'advanced',
            topic = 'general',
            days,
            time_range,
            max_results = 5,
            include_domains = this.default_include_domains,
            exclude_domains = this.default_exclude_domains,
        } = args;

        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${TAVILY_API_KEY}`,
            },
            body: JSON.stringify({
                query,
                search_depth,
                topic,
                days,
                time_range,
                max_results,
                include_domains,
                exclude_domains,
                include_answer: true,
            }),
        });

        if (!response.ok) {
            throw new TavilyError(
                `API request failed: ${response.statusText}`,
                'API_ERROR',
                { status: response.status },
            );
        }

        const data = await response.json();

        return {
            content: [
                {
                    type: 'text',
                    text: data.answer || 'No answer found.',
                },
            ],
        };
	}

	async run() {
		const transport = new StdioServerTransport();
		await this.server.connect(transport);
		console.error('Tavily Search MCP server running on stdio');
	}
}

const server = new TavilySearchServer();
server.run().catch(console.error);
