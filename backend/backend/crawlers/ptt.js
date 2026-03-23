import fetch from "node-fetch";
import * as cheerio from "cheerio";

const BASE_URL = "https://www.ptt.cc";

/**
 * 爬 PTT 看板文章列表
 * @param {string} board 看板名稱（如 Gossiping / Tech_Job）
 * @param {number} limit 幾篇
 */
export async function crawlPTTBoard(board = "Gossiping", limit = 3) {
  const res = await fetch(`${BASE_URL}/bbs/${board}/index.html`, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Cookie: "over18=1", // 18 歲認證
    },
  });

  if (!res.ok) throw new Error("Failed to fetch PTT board");

  const html = await res.text();
  const $ = cheerio.load(html);

  const articles = [];

  $(".r-ent").each((_, el) => {
    if (articles.length >= limit) return;

    const title = $(el).find(".title a").text().trim();
    const link = $(el).find(".title a").attr("href");

    if (title && link) {
      articles.push({
        title,
        url: BASE_URL + link,
      });
    }
  });

  return articles;
}

/**
 * 爬單篇 PTT 文章
 * @param {string} url 文章完整網址
 */
export async function crawlPTTArticle(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Cookie: "over18=1",
    },
  });

  if (!res.ok) throw new Error("Failed to fetch article");

  const html = await res.text();
  const $ = cheerio.load(html);

  // 先抓推文，避免被移除後抓不到
  const pushes = [];
  $(".push").each((_, el) => {
    const tag = $(el).find(".push-tag").text().trim();
    const user = $(el).find(".push-userid").text().trim();
    const text = $(el).find(".push-content").text().replace(/^:\s*/, "").trim();
    pushes.push(`${tag} ${user}: ${text}`);
  });

  // 移除不需要的元素
  $(".push").remove();
  $(".article-metaline").remove();
  $(".article-metaline-right").remove();

  // 取得主要文章內容
  const content = $("#main-content").text().replace(/\s+/g, " ").trim();

  return {
    content,
    pushes: pushes.join(" "),
  };
}
