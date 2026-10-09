// WeClinicalCRO News Fetcher
// Fetches Google News RSS feeds for AI in Clinical Trials & Regulatory AI Updates
// Outputs news.json to the repository root

const { XMLParser } = require('fast-xml-parser');
const fs = require('fs');
const path = require('path');

const FEEDS = [
  {
    label: 'AI in Clinical Trials',
    url: 'https://news.google.com/rss/search?q=AI+clinical+trials&hl=en-US&gl=US&ceid=US:en'
  },
  {
    label: 'Regulatory AI Updates',
    url: 'https://news.google.com/rss/search?q=AI+pharmaceutical+regulatory&hl=en-US&gl=US&ceid=US:en'
  }
];

const MAX_ARTICLES = 6;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_'
});

async function fetchFeed(feed) {
  const res = await fetch(feed.url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; WeClinicalCRO-NewsBot/1.0)'
    }
  });
  if (!res.ok) throw new Error(`Feed failed: ${feed.url} (${res.status})`);
  const xml = await res.text();
  const parsed = parser.parse(xml);

  let items = parsed?.rss?.channel?.item || [];
  if (!Array.isArray(items)) items = [items];

  return items.map(item => {
    const rawTitle = item.title || '';
    // Google appends " - Source Name" to the title; strip it
    const title = rawTitle.replace(/\s+-\s+[^-]+$/, '').trim();

    let source = 'Unknown';
    if (item.source) {
      source = typeof item.source === 'object' ? (item.source['#text'] || 'Unknown') : item.source;
    }

    return {
      title,
      link: item.link || '#',
      publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : null,
      source,
      category: feed.label
    };
  });
}

async function main() {
  try {
    const all = [];
    for (const feed of FEEDS) {
      const items = await fetchFeed(feed);
      all.push(...items);
    }

    // Sort newest first
    all.sort((a, b) => {
      if (!a.publishedAt) return 1;
      if (!b.publishedAt) return -1;
      return new Date(b.publishedAt) - new Date(a.publishedAt);
    });

    // Deduplicate by title
    const seen = new Set();
    const unique = all.filter(a => {
      const key = a.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const trimmed = unique.slice(0, MAX_ARTICLES);

    const output = {
      updatedAt: new Date().toISOString(),
      articles: trimmed
    };

    const outPath = path.join(__dirname, '..', 'news.json');
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
    console.log(`✓ Wrote ${trimmed.length} articles to ${outPath}`);
  } catch (err) {
    console.error('✗ Error:', err.message);
    process.exit(1);
  }
}

main();
