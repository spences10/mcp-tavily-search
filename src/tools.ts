export interface TavilyToolConfig {
	name: string;
	description: string;
	inputSchema: object;
}

export const TAVILY_TOOLS: TavilyToolConfig[] = [
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
