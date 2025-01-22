# mcp-tavily-search

A Model Context Protocol (MCP) server for integrating Tavily's search
API with LLMs. This server provides intelligent web search
capabilities optimized for high-quality, factual results, including
context generation for RAG applications and direct question answering.

<a href="https://glama.ai/mcp/servers/1jcttrux58"><img width="380" height="200" src="https://glama.ai/mcp/servers/1jcttrux58/badge" alt="Tavily Search Server MCP server" /></a>

## Features

- 🔍 Advanced web search capabilities through Tavily API
- 🤖 AI-generated summaries of search results
- 🎯 Domain filtering for higher quality results
- 📊 Configurable search depth and parameters
- 🧠 Context generation for RAG applications
- ❓ Direct question answering capabilities
- 💾 Response caching with TTL support
- 📝 Multiple response formats (text, JSON, markdown)
- 🔄 Structured result formatting optimized for LLMs
- 🏗️ Built on the Model Context Protocol

## Configuration

This server requires configuration through your MCP client. Here are
examples for different environments:

### Cline Configuration

Add this to your Cline MCP settings:

```json
{
	"mcpServers": {
		"mcp-tavily-search": {
			"command": "npx",
			"args": ["-y", "mcp-tavily-search"],
			"env": {
				"TAVILY_API_KEY": "your-tavily-api-key"
			}
		}
	}
}
```

### Claude Desktop with WSL Configuration

For WSL environments, add this to your Claude Desktop configuration:

```json
{
	"mcpServers": {
		"mcp-tavily-search": {
			"command": "wsl.exe",
			"args": [
				"bash",
				"-c",
				"source ~/.nvm/nvm.sh && TAVILY_API_KEY=your-tavily-api-key /home/username/.nvm/versions/node/v20.12.1/bin/npx mcp-tavily-search"
			]
		}
	}
}
```

### Environment Variables

The server requires the following environment variable:

- `TAVILY_API_KEY`: Your Tavily API key (required)

## API

The server implements three MCP tools with configurable parameters:

### tavily_search

Search the web using Tavily Search API, optimized for high-quality,
factual results.

Parameters:

- `query` (string, required): Search query
- `search_depth` (string, optional): "basic" (faster) or "advanced"
  (more thorough). Defaults to "basic"
- `topic` (string, optional): "general" or "news". Defaults to
  "general"
- `days` (number, optional): Number of days back to search (news topic
  only). Defaults to 3
- `time_range` (string, optional): Time range for results ('day',
  'week', 'month', 'year' or 'd', 'w', 'm', 'y')
- `max_results` (number, optional): Maximum number of results.
  Defaults to 5
- `include_answer` (boolean, optional): Include AI-generated summary.
  Defaults to true
- `include_images` (boolean, optional): Include related images.
  Defaults to false
- `include_image_descriptions` (boolean, optional): Include image
  descriptions. Defaults to false
- `include_raw_content` (boolean, optional): Include raw HTML content.
  Defaults to false
- `include_domains` (string[], optional): List of trusted domains to
  include
- `exclude_domains` (string[], optional): List of domains to exclude
- `response_format` (string, optional): 'text', 'json', or 'markdown'.
  Defaults to 'text'
- `cache_ttl` (number, optional): Cache time-to-live in seconds.
  Defaults to 3600
- `force_refresh` (boolean, optional): Force fresh results ignoring
  cache. Defaults to false

### tavily_get_search_context

Generate context for RAG applications using Tavily search.

Parameters:

- `query` (string, required): Search query for context generation
- `max_tokens` (number, optional): Maximum length of generated
  context. Defaults to 2000
- `search_depth` (string, optional): "basic" or "advanced". Defaults
  to "advanced"
- `topic` (string, optional): "general" or "news". Defaults to
  "general"
- Other parameters same as tavily_search

### tavily_qna_search

Get direct answers to questions using Tavily search.

Parameters:

- `query` (string, required): Question to be answered
- `include_sources` (boolean, optional): Include source citations.
  Defaults to true
- `search_depth` (string, optional): "basic" or "advanced". Defaults
  to "advanced"
- `topic` (string, optional): "general" or "news". Defaults to
  "general"
- Other parameters same as tavily_search

Default included domains:

- arxiv.org
- scholar.google.com
- science.gov
- wikipedia.org
- github.com
- stackoverflow.com
- developer.mozilla.org

Default excluded domains:

- facebook.com
- twitter.com
- instagram.com
- tiktok.com

## Development

### Setup

1. Clone the repository
2. Install dependencies:

```bash
pnpm install
```

3. Build the project:

```bash
pnpm build
```

4. Run in development mode:

```bash
pnpm dev
```

### Publishing

The project uses changesets for version management. To publish:

1. Create a changeset:

```bash
pnpm changeset
```

2. Version the package:

```bash
pnpm changeset version
```

3. Publish to npm:

```bash
pnpm release
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built on the
  [Model Context Protocol](https://github.com/modelcontextprotocol)
- Powered by [Tavily Search API](https://tavily.com)
