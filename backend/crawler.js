import fetch from "node-fetch";
import  * as cheerio from "cheerio";

/**
 * 通用文章 / 新聞爬蟲
 * @param {string} url
 */
export async function crawlArticle(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
    },
    timeout: 10000,
  });

  if (!res.ok) {
    throw new Error("Failed to fetch URL");
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  $("script, style, nav, footer, header, aside").remove();

  let text = "";

  $("article p, main p, p").each((_, el) => {
    const content = $(el).text().trim();
    if (content.length > 30) {
      text += content + " ";
    }
  });

  text = text.replace(/\s+/g, " ").trim();

  if (!text) {
    throw new Error("No content extracted");
  }

  return text.slice(0, 8000);
}
