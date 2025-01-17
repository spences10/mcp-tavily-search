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

interface TavilySearchResponse {
	results: Array<{
		title: string;
		url: string;
		content: string;
		score: number;
		published_date?: string;
	}>;
	query: string;
	answer?: string;
}

class TavilySearchServer {
	private server: Server;
	// Default trusted domains for high-quality results
	private defaultIncludeDomains = [
		'arxiv.org',
		'scholar.google.com',
		'science.gov',
		'wikipedia.org',
		'github.com',
		'stackoverflow.com',
		'developer.mozilla.org',
	];

	// Default domains to exclude for better result quality
	private defaultExcludeDomains = [
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
					tools: {},
				},
			},
		);

		this.setupToolHandlers();
	}

	private setupToolHandlers() {
		this.server.setRequestHandler(
			ListToolsRequestSchema,
			async () => ({
				tools: [
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
									description:
										'List of trusted domains to include in search. Defaults to academic and technical sources if not specified.',
									default: [],
								},
								exclude_domains: {
									type: 'array',
									items: { type: 'string' },
									description:
										'List of domains to exclude from search. Defaults to social media and potentially unreliable sources if not specified.',
									default: [],
								},
							},
							required: ['query'],
						},
					},
				],
			}),
		);

		this.server.setRequestHandler(
			CallToolRequestSchema,
			async (request) => {
				if (request.params.name !== 'tavily_search') {
					throw new McpError(
						ErrorCode.MethodNotFound,
						`Unknown tool: ${request.params.name}`,
					);
				}

				const {
					query,
					search_depth = 'basic',
					include_answer = true,
					include_domains = this.defaultIncludeDomains,
					exclude_domains = this.defaultExcludeDomains,
				} = request.params.arguments as {
					query: string;
					search_depth?: 'basic' | 'advanced';
					include_answer?: boolean;
					include_domains?: string[];
					exclude_domains?: string[];
				};

				try {
					const response = await fetch(
						'https://api.tavily.com/search',
						{
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
								Authorization: `Bearer ${TAVILY_API_KEY}`,
							},
							body: JSON.stringify({
								query,
								search_depth,
								include_answer,
								include_domains,
								exclude_domains,
							}),
						},
					);

					if (!response.ok) {
						throw new Error(
							`Tavily API error: ${response.statusText}`,
						);
					}

					const data: TavilySearchResponse = await response.json();

					// Format response for optimal LLM consumption
					return {
						content: [
							{
								type: 'text',
								text: this.formatSearchResults(data),
							},
						],
					};
				} catch (error) {
					return {
						content: [
							{
								type: 'text',
								text: `Error performing search: ${
									error instanceof Error
										? error.message
										: String(error)
								}`,
							},
						],
						isError: true,
					};
				}
			},
		);
	}

	private formatSearchResults(data: TavilySearchResponse): string {
		let formattedText = `Search Results for "${data.query}":\n\n`;

		// Include AI answer if available
		if (data.answer) {
			formattedText += `Summary: ${data.answer}\n\nDetailed Sources:\n`;
		}

		// Format individual results
		formattedText += data.results
			.map((result, i) => {
				let source = `${i + 1}. ${result.title}\n   URL: ${
					result.url
				}\n`;
				if (result.published_date) {
					source += `   Published: ${result.published_date}\n`;
				}
				source += `   Content: ${result.content}\n`;
				return source;
			})
			.join('\n');

		return formattedText;
	}

	async run() {
		const transport = new StdioServerTransport();
		await this.server.connect(transport);
		console.error('Tavily Search MCP server running on stdio');
	}
}

const server = new TavilySearchServer();
server.run().catch(console.error);
