# MarkFlowy website

The site uses Next.js Pages Router and Contentlayer2. Public English and Chinese documents live in `docs/en` and `docs/zh` at the repository root.

## Public content and search

Every public Markdown document requires `seoTitle` and `description` in YAML front matter. Keep the existing filename-based `title` for navigation translations. `updatedAt` is optional: set an ISO calendar date when the content actually changes, rather than stamping every deployment with today's date.

The same Contentlayer collection supplies HTML pages, `/sitemap.xml`, `/llms.txt`, and the `.md` versions of documentation pages. Only configured English/Chinese documents enter this collection. Language alternates point only to existing translations. English uses unprefixed paths, Chinese uses `/zh`, and all canonical URLs use `https://www.markflowy.cc`.

Examples:

- `/docs/intro` and `/docs/intro.md`
- `/zh/docs/Extension/UseCopilotWithOllama` and `/zh/docs/Extension/UseCopilotWithOllama.md`
- `/docs/Performance/large-markdown-files` and `/docs/Performance/large-markdown-files.md`

Markdown responses are served through a server-side page rewrite, with the HTML URL in an HTTP canonical link. This follows the same response pattern as the sitemap and avoids localized API routing restrictions. Invalid documents return 404; methods other than GET and HEAD return 405. Sitemap entries contain only public HTML destinations. Auth, settings, and workspace screens have a `noindex` directive; their authorization remains the responsibility of the application.

`robots.txt` allows public crawling. Training preferences are independent of search access and should be reviewed together with CDN rules. An allowed user-agent string from a local test does not prove that requests from the provider's actual crawler network are accepted. See [OpenAI crawler controls](https://developers.openai.com/api/docs/bots).

## Local validation

Run `yarn workspace @markflowy/web dev` to refresh Contentlayer types/data while developing. The repository tracks generated Contentlayer files; regenerate them with the tool rather than editing them. Alternatively run `yarn exec contentlayer2 dev` from this directory for content generation without starting Next.js.

From the repository root:

```sh
yarn workspace @markflowy/web build:types
yarn workspace @markflowy/web test
yarn translate:check
```

`build:types` runs `tsc --noEmit`; it does not build the website. The GEO tests exercise the real generated corpus and detect stale bodies/metadata, invalid language links, incorrect sitemap entries, and missing table rendering. Use the repository's ESLint 8 runner on the TypeScript files changed by the task, without `--fix`.

With the development server running, `yarn workspace @markflowy/web test:geo:http` checks actual HTML metadata, all Markdown links advertised by `llms.txt`, HEAD/405/404 behavior, and indexing controls. Set `GEO_BASE_URL` when using a port other than 3100. These checks caught the need to run Markdown rewrites in `beforeFiles`, before the static documentation catch-all.

README changes belong in `README.src.md`; regenerate all three language outputs with NRG 1.1 and run its drift check. Keep performance observations qualified and reference their source; the new performance page does not establish a new benchmark.

## Deployment and measurement

After the normal website deployment:

1. Fetch the production HTML, Markdown, sitemap, and robots endpoints. Check status, content type, page-specific metadata, language alternates, and the text returned without JavaScript.
2. Check the actual CDN response for robots rules and any crawl challenges. CDN-managed content can differ from the repository file.
3. Verify the domain in Google Search Console and Bing Webmaster Tools, inspect the key URLs, and submit `https://www.markflowy.cc/sitemap.xml`. These account actions are not performed by this code change.
4. Save answers to the fixed questions below before deployment, then repeat after two and four weeks. Use a new conversation, the same product/search mode, language, and region; repeat each question twice on each selected platform.

| ID | Group | Question |
| --- | --- | --- |
| B1 | Brand | What is MarkFlowy, and which operating systems does it support? |
| B2 | Brand | Does MarkFlowy require cloud AI, or can it use a local model? |
| B3 | Brand | MarkFlowy 的大文档性能有什么公开测试依据？ |
| B4 | Brand | MarkFlowy 的桌面版和在线 Playground 有什么区别？ |
| S1 | Scenario | Which Markdown editors should I evaluate for large technical documents? |
| S2 | Scenario | Which desktop Markdown editors work with local Ollama models? |
| S3 | Scenario | I keep Markdown files in local folders. Which editors offer optional AI assistance? |
| S4 | Scenario | How can I summarize a Markdown document with a local AI model? |
| S5 | Scenario | 有哪些支持源码和可视化编辑的跨平台 Markdown 编辑器？ |
| S6 | Scenario | 我想用本地模型辅助 Markdown 写作，可以考虑哪些工具？ |
| C1 | Comparison | How should I compare Markdown editors for large-file performance? |
| C2 | Comparison | What should I compare when choosing a Markdown editor with local AI versus cloud AI? |

Record date, platform, model/product mode, prompt ID, response, citation URLs, brand mention, and factual errors. Separate branded from non-branded questions and official citations from third-party citations. Check OS support, AI configuration/request destination, desktop/Web boundaries, and the limits of performance claims. Track AI-referred visits and download/trial clicks where existing analytics permits; clicks do not establish installation or a GitHub star.

No citation uplift is assumed. Bing AI Performance covers supported Microsoft and partner surfaces, not all AI systems. `llms.txt` is a convenience for compatible agents; [Google states it is not a ranking input](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide). IndexNow can be added to the deployment workflow later; receipt of a URL is not proof of indexing.
