import fs from "fs";
import path from "path";
import { glob } from "glob";
import matter from "gray-matter";

// Define audience categories with their keywords
const audienceKeywords = {
  developers: {
    keywords: [
      "sdk",
      "api",
      "developer",
      "development",
      "code",
      "program",
      "framework",
      "tool",
      "build",
      "technical",
      "protocol",
      "infrastructure",
      "architecture",
      "proof-of-history",
      "turbine",
      "tower-bft",
      "pipelining",
      "state-machine",
      "scaffold",
      "tutorial",
      "integration",
      "client",
      "runtime",
      "token-extensions",
      "mobile-stack",
      "solana-pay",
      "state-compression",
      "compressed-nft",
      "smart-contract",
      "dapp",
      "web3",
      "blockchain-node",
      "testnet",
      "devnet",
      "solana-mobile-stack",
      "seed-vault",
      "wallet-adapter",
      "attestation-service",
    ],
    tags: [
      "developer",
      "product",
      "core-technical-innovations",
      "solana-mobile",
    ],
    weight: 1.0,
  },
  finance: {
    keywords: [
      "defi",
      "payment",
      "finance",
      "stablecoin",
      "usdc",
      "usdt",
      "pyusd",
      "tether",
      "trading",
      "exchange",
      "liquidity",
      "lending",
      "borrowing",
      "yield",
      "stake",
      "staking",
      "token",
      "sol",
      "price",
      "market",
      "institutional",
      "bank",
      "paypal",
      "visa",
      "mastercard",
      "solana-pay",
      "transaction",
      "settlement",
      "cross-border",
      "merchant",
      "commerce",
      "rwa",
      "real-world-asset",
      "treasury",
      "fund",
      "investment",
      "autonomous",
      "shopify",
      "boba-guys",
      "libre",
    ],
    tags: ["defi", "solutions", "solana-pay", "payments", "stable-coin"],
    weight: 1.0,
  },
  upgrades: {
    keywords: [
      "validator",
      "upgrade",
      "version",
      "v1.",
      "mainnet",
      "testnet",
      "network-upgrade",
      "performance",
      "quic",
      "qos",
      "fee-market",
      "consensus",
      "voting",
      "delegation",
      "nakamoto-coefficient",
      "decentralization",
      "node",
      "client",
      "firedancer",
      "jito",
      "validator-health",
      "uptime",
      "outage",
      "network-performance",
      "health-report",
      "stake-pool",
      "data-center",
      "geography",
      "asn",
      "autonomous-system",
      "sig",
      "tinydancer",
      "anza",
    ],
    tags: ["validator-health-reports", "reports", "announcements"],
    weight: 1.0,
  },
  community: {
    keywords: [
      "hackathon",
      "winner",
      "grizzlython",
      "hyperdrive",
      "ignition",
      "riptide",
      "radar",
      "renaissance",
      "summer-camp",
      "hacker-house",
      "breakpoint",
      "event",
      "conference",
      "community",
      "ecosystem",
      "announcement",
      "foundation",
      "grant",
      "transparency",
      "report",
      "year-in-review",
      "newsletter",
      "gaming",
      "nft",
      "art",
      "artist",
      "creator",
      "art-basel",
      "energy",
      "carbon",
      "sustainability",
      "solstice",
      "playgg",
      "game",
      "mobile",
      "saga",
      "memoir",
      "value",
      "culture",
      "interview",
    ],
    tags: ["hackathon", "events", "gaming", "artists", "memo"],
    weight: 0.8, // Lower weight as it's the fallback
  },
};

// Minimum score threshold for assigning an audience
const SCORE_THRESHOLD = 3;

interface Post {
  path: string;
  data: any;
  content: string;
}

function analyzePost(post: Post): string[] {
  const { data, content } = post;
  const text = `${data.title || ""} ${data.description || ""} ${
    data.slug || ""
  } ${content}`.toLowerCase();
  const tags = (data.tags || []).map((tag: any) => {
    if (typeof tag === "string") return tag;
    if (tag.tag) return path.basename(tag.tag, ".mdx");
    return "";
  });

  const scores: Record<string, number> = {};

  // Calculate scores for each audience
  for (const [audience, config] of Object.entries(audienceKeywords)) {
    let score = 0;

    // Check keywords in content
    for (const keyword of config.keywords) {
      const regex = new RegExp(`\\b${keyword.replace("-", "[-\\s]?")}`, "gi");
      const matches = text.match(regex);
      if (matches) {
        score += matches.length * config.weight;
      }
    }

    // Check tags (higher weight)
    for (const tag of config.tags) {
      if (tags.some((t: string) => t.toLowerCase().includes(tag))) {
        score += 10 * config.weight;
      }
    }

    scores[audience] = score;
  }

  // Determine which audiences to assign
  const audiences: string[] = [];
  const sortedAudiences = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .filter(([name]) => name !== "community"); // Handle community separately

  // Assign top scoring audience(s) if they meet threshold
  for (const [audience, score] of sortedAudiences) {
    if (score >= SCORE_THRESHOLD) {
      audiences.push(audience);
      // Only assign multiple audiences if the second one has at least 60% of top score
      if (audiences.length === 1 && sortedAudiences.length > 1) {
        const secondScore = sortedAudiences[1][1];
        if (secondScore < score * 0.6) {
          break;
        }
      } else if (audiences.length >= 2) {
        break;
      }
    }
  }

  // Fallback to community if no audience met threshold
  if (audiences.length === 0) {
    audiences.push("community");
  }

  return audiences;
}

function updatePostAudiences(post: Post, audiences: string[]): boolean {
  try {
    const { data, content } = post;

    // Update audiences array with correct format
    data.audiences = audiences.map((a) => ({
      audience: `content/audiences/${a}.mdx`,
    }));

    // Reconstruct the file
    const newContent = matter.stringify(content, data);

    // Write back to file
    fs.writeFileSync(post.path, newContent, "utf-8");

    return true;
  } catch (error) {
    console.error(`Error updating ${post.path}:`, error);
    return false;
  }
}

async function main() {
  // Check which workspace we're targeting
  const workspaceRoot = process.cwd().includes("tina-news")
    ? process.cwd()
    : "/Users/karambit/Sites/tina-news";

  const postsDir = path.join(workspaceRoot, "content/posts");

  // Check if directory exists
  if (!fs.existsSync(postsDir)) {
    console.error(`Posts directory not found: ${postsDir}`);
    console.log(`Current working directory: ${process.cwd()}`);
    return;
  }

  const postFiles = await glob("*.mdx", { cwd: postsDir });

  console.log(`Posts directory: ${postsDir}`);
  console.log(`Found ${postFiles.length} posts to categorize\n`);

  let updated = 0;
  let failed = 0;
  const stats: Record<string, number> = {
    developers: 0,
    finance: 0,
    upgrades: 0,
    community: 0,
  };

  for (const file of postFiles) {
    const filePath = path.join(postsDir, file);

    try {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const { data, content } = matter(fileContent);

      const post: Post = {
        path: filePath,
        data,
        content,
      };

      const audiences = analyzePost(post);
      const success = updatePostAudiences(post, audiences);

      if (success) {
        updated++;
        audiences.forEach((a) => stats[a]++);
        console.log(`✓ ${file}: ${audiences.join(", ")}`);
      } else {
        failed++;
        console.log(`✗ ${file}: Failed to update`);
      }
    } catch (error) {
      failed++;
      console.error(`✗ ${file}: ${error}`);
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`\nCategorization complete!`);
  console.log(`Updated: ${updated}`);
  console.log(`Failed: ${failed}`);
  console.log("\nAudience distribution:");
  Object.entries(stats).forEach(([audience, count]) => {
    console.log(`  ${audience}: ${count} posts`);
  });
}

main().catch(console.error);
