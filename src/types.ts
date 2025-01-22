export interface TavilyBaseResponse {
	query: string;
	processingTime?: number;
	cost?: number;
}

export interface TavilySearchResponse {
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

export type TimeRange =
	| 'day'
	| 'week'
	| 'month'
	| 'year'
	| 'd'
	| 'w'
	| 'm'
	| 'y';

export interface TavilySearchParams {
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

export interface TavilyContextParams {
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

export interface TavilyQnAParams {
	query: string;
	search_depth?: 'basic' | 'advanced';
	topic?: 'general' | 'news';
	days?: number;
	time_range?: TimeRange;
	max_results?: number;
	include_domains?: string[];
	exclude_domains?: string[];
}
