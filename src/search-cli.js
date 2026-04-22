#!/usr/bin/env node

const { Command } = require('commander');
const axios = require('axios');
const dayjs = require('dayjs');
const relativeTime = require('dayjs/plugin/relativeTime');
dayjs.extend(relativeTime);

function addMtimeReadable(data) {
  if (data && Array.isArray(data.results)) {
    data.results.forEach(res => {
      if (typeof res.mtime === 'number') {
        res.mtime_readable = dayjs(res.mtime * 1000).fromNow();
      }
    });
  }
  return data;
}

const DEFAULT_LIMIT = 3;
const DEFAULT_MARGIN = 20;
const DEFAULT_LENGTH = 200;

const program = new Command();

const defaultEndpoint = process.env.LOCAL_SEARCH_CLI_ENDPOINT
  ? process.env.LOCAL_SEARCH_CLI_ENDPOINT
  : 'http://localhost:8000';

program
  .name('search-cli')
  .description('Local search CLI\n\nHint: You can use the PATH_PREFIX environment variable to prioritize returned paths for a specific directory.\nExample: PATH_PREFIX=/disk-1 search-cli search "foo"')
  .version('1.0.0')
  .option('-e, --endpoint <endpoint>', 'Base URL of the search engine API', defaultEndpoint);


program
  .command('keyword-search [query]')
  .description('Perform fulltext search against local document with query keywords, based on Tantivy. Omitting the query performs a tag-only search.')
  .option('-t, --tags <tags...>', 'Filter by tags')
  .option('--mtime-gte <timestamp>', 'Filter by modified time greater than or equal to', (val) => parseInt(val, 10))
  .option('--mtime-lte <timestamp>', 'Filter by modified time less than or equal to', (val) => parseInt(val, 10))
  .option('-l, --limit <limit>', 'Limit results', (val) => parseInt(val, 10), DEFAULT_LIMIT)
  .option('-s, --snippet-length <length>', 'Snippet length', (val) => parseInt(val, 10), DEFAULT_LENGTH)
  .action(async (query, options) => {
    const { endpoint } = program.opts();
    try {
      const payload = {
        query: query || "",
        tags: options.tags || null,
        limit: options.limit,
        snippet_length: options.snippetLength
      };
      if (options.mtimeGte !== undefined) payload.mtime_gte = options.mtimeGte;
      if (options.mtimeLte !== undefined) payload.mtime_lte = options.mtimeLte;
      if (process.env.PATH_PREFIX) payload.path_prefix = process.env.PATH_PREFIX;

      const response = await axios.post(`${endpoint}/api/v1/search/fts`, payload);
      console.log(JSON.stringify(addMtimeReadable(response.data), null, 2));
    } catch (error) {
      console.error('Error:', error.response ? error.response.data : (error.message || error.code || 'Unknown error'));
      process.exit(1);
    }
  });

program
  .command('semantic-search <query>')
  .description('Search local document chunks by semantics, the underlying system is based on pg_vector.')
  .option('-t, --tags <tags...>', 'Filter by tags')
  .option('--mtime-gte <timestamp>', 'Filter by modified time greater than or equal to', (val) => parseInt(val, 10))
  .option('--mtime-lte <timestamp>', 'Filter by modified time less than or equal to', (val) => parseInt(val, 10))
  .option('-l, --limit <limit>', 'Limit results', (val) => parseInt(val, 10), DEFAULT_LIMIT)
  .option('-s, --snippet-margin <margin>', 'Snippet margin', (val) => parseInt(val, 10), DEFAULT_MARGIN)
  .action(async (query, options) => {
    const { endpoint } = program.opts();
    try {
      const payload = {
        query,
        tags: options.tags || null,
        limit: options.limit,
        snippet_margin: options.snippetMargin
      };
      if (options.mtimeGte !== undefined) payload.mtime_gte = options.mtimeGte;
      if (options.mtimeLte !== undefined) payload.mtime_lte = options.mtimeLte;
      if (process.env.PATH_PREFIX) payload.path_prefix = process.env.PATH_PREFIX;

      const response = await axios.post(`${endpoint}/api/v1/search/vec`, payload);
      console.log(JSON.stringify(addMtimeReadable(response.data), null, 2));
    } catch (error) {
      console.error('Error:', error.response ? error.response.data : (error.message || error.code || 'Unknown error'));
      process.exit(1);
    }
  });

program
  .command('search [query]')
  .description('Perform hybrid search against local document with Reciprocal Rank Fusion. Omitting the query performs a tag-only search using the keyword-search only.')
  .option('-t, --tags <tags...>', 'Filter by tags')
  .option('--mtime-gte <timestamp>', 'Filter by modified time greater than or equal to', (val) => parseInt(val, 10))
  .option('--mtime-lte <timestamp>', 'Filter by modified time less than or equal to', (val) => parseInt(val, 10))
  .option('-l, --limit <limit>', 'Limit results', (val) => parseInt(val, 10), DEFAULT_LIMIT)
  .option('-s, --snippet-margin <margin>', 'Snippet margin', (val) => parseInt(val, 10), DEFAULT_MARGIN)
  .option('-L, --snippet-length <length>', 'Snippet length', (val) => parseInt(val, 10), DEFAULT_LENGTH)
  .action(async (query, options) => {
    const { endpoint } = program.opts();
    try {
      const payload = {
        query: query || "",
        tags: options.tags || null,
        limit: options.limit,
        snippet_margin: options.snippetMargin,
        snippet_length: options.snippetLength
      };
      if (options.mtimeGte !== undefined) payload.mtime_gte = options.mtimeGte;
      if (options.mtimeLte !== undefined) payload.mtime_lte = options.mtimeLte;
      if (process.env.PATH_PREFIX) payload.path_prefix = process.env.PATH_PREFIX;

      const response = await axios.post(`${endpoint}/api/v1/search/hybrid`, payload);
      console.log(JSON.stringify(addMtimeReadable(response.data), null, 2));
    } catch (error) {
      console.error('Error:', error.response ? error.response.data : (error.message || error.code || 'Unknown error'));
      process.exit(1);
    }
  });

program
  .command('index')
  .description('Trigger full re-indexing for the local document search engine.')
  .action(async () => {
    const { endpoint } = program.opts();
    try {
      const response = await axios.post(`${endpoint}/api/v1/index_all`);
      console.log(JSON.stringify(addMtimeReadable(response.data), null, 2));
    } catch (error) {
      console.error('Error:', error.response ? error.response.data : (error.message || error.code || 'Unknown error'));
      process.exit(1);
    }
  });

const tags = program.command('tags').description('Tag management');

tags
  .command('lookup <paths...>')
  .description('Lookup tags for one or more file paths')
  .action(async (paths) => {
    const { endpoint } = program.opts();
    try {
      const response = await axios.post(`${endpoint}/api/v1/tags/lookup`, { paths });
      console.log(JSON.stringify(addMtimeReadable(response.data), null, 2));
    } catch (error) {
      console.error('Error:', error.response ? error.response.data : (error.message || error.code || 'Unknown error'));
      process.exit(1);
    }
  });

tags
  .command('update <path> [path_tags...]')
  .description('Update tags for a specific file path')
  .option('-f, --force', 'Force tag update even if the path does not exist')
  .action(async (path, path_tags, options) => {
    const { endpoint } = program.opts();
    try {
      const response = await axios.post(`${endpoint}/api/v1/tags/update`, {
        path,
        path_tags: path_tags || [],
        force: !!options.force
      });
      console.log(JSON.stringify(addMtimeReadable(response.data), null, 2));
    } catch (error) {
      console.error('Error:', error.response ? error.response.data : (error.message || error.code || 'Unknown error'));
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Check service status')
  .action(async () => {
    const { endpoint } = program.opts();
    try {
      const response = await axios.get(`${endpoint}/api/v1/status`);
      console.log(JSON.stringify(addMtimeReadable(response.data), null, 2));
    } catch (error) {
      console.error('Error:', error.response ? error.response.data : (error.message || error.code || 'Unknown error'));
      process.exit(1);
    }
  });

program.parse(process.argv);
