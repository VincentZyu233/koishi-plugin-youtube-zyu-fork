import axios from 'axios';
import { Context } from 'koishi';
import { Config, REQUEST_LIB, PROXY_PROTOCOL } from './index';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';

const apiEndpointPrefix = 'https://www.googleapis.com/youtube/v3/videos';

// 媒体格式解析工具
function MediaFormat() {
  // http://www.youtube.com/embed/m5yCOSHeYn4
  const ytRegEx = /(?:https?:\/\/)?(?:i\.|www\.|img\.)?(?:youtu\.be\/|youtube\.com\/|ytimg\.com\/)(?:shorts\/|embed\/|v\/|vi\/|vi_webp\/|watch\?v=|watch\?.+&v=)([\w-]{11})/

  function getIDfromRegEx(src, regEx) {
    const [, id] = src.match(regEx) ?? []
    return id
  }

  return {
    // returns only the ID
    getYoutubeID: function (src) {
      return getIDfromRegEx(src, ytRegEx)
    },
    // returns main link
    getYoutubeUrl: function (ID) {
      return 'https://www.youtube.com/watch?v=' + ID
    }
  }
}

// 简易 HTML 实体解码（主要处理 &amp; 等常见场景）
function decodeHtmlEntities(input: string): string {
  if (!input) return input
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

// 规范化原始输入，解决平台转义后的 URL 问题
function normalizeInputUrl(raw: string): string {
  if (!raw) return raw
  let s = raw.trim()
  // 某些平台会把 & 转义为 &amp;，导致正则无法匹配 watch?xxx&v= 场景
  s = decodeHtmlEntities(s)
  // 去掉可能的尖括号包裹
  s = s.replace(/[<>]/g, '')
  return s
}

// 从 URL 中提取 YouTube 视频 ID
export function extractYoutubeId(url: string): string | null {
  const src = normalizeInputUrl(url)
  let id
  if (src.includes('https://youtu.be')) {
    const match = src.match(/youtu\.be\/([\w-]{11})/)
    id = match ? match[1] : null
  } else {
    id = MediaFormat().getYoutubeID(src)
  }
  return id
}

// 从 YouTube API 获取视频数据
export async function fetchVideoDataFromAPI(ctx: Context, config: Config, id: string) {
  const url = `${apiEndpointPrefix}?id=${id}&key=${config.youtubeApiKey}&part=snippet,contentDetails,statistics,status`;

  const headers = { 'User-Agent': config.userAgent };
  let proxyAgent;

  if (config.requestLib === REQUEST_LIB.AXIOS) {
    const proxyUrl = `${config.proxyIp}:${config.proxyPort}`;
    switch (config.proxyProtocol) {
      case PROXY_PROTOCOL.HTTP:
      case PROXY_PROTOCOL.HTTPS:
        proxyAgent = new HttpsProxyAgent(`${config.proxyProtocol}://${proxyUrl}`);
        break;
      case PROXY_PROTOCOL.SOCKS4:
      case PROXY_PROTOCOL.SOCKS5:
      case PROXY_PROTOCOL.SOCKS5H:
        proxyAgent = new SocksProxyAgent(`${config.proxyProtocol}://${proxyUrl}`);
        break;
    }
  }

  try {
    if (config.requestLib === REQUEST_LIB.CTX_HTTP) {
      if (!ctx.http) {
        throw new Error('Koishi http service is not available.');
      }
      return await ctx.http.get(url);
    } else if (config.requestLib === REQUEST_LIB.AXIOS) {
      const response = await axios.get(url, { headers, httpsAgent: proxyAgent });
      return response.data;
    }
  } catch (error) {
    ctx.logger.error(`Failed to fetch data from YouTube API for id: ${id}`);
    throw error;
  }
}

// 下载缩略图
export async function downloadThumbnail(ctx: Context, config: Config, thumbnailUrl: string): Promise<ArrayBuffer> {
  const headers = { 'User-Agent': config.userAgent };
  let proxyAgent;

  if (config.requestLib === REQUEST_LIB.AXIOS) {
    const proxyUrl = `${config.proxyIp}:${config.proxyPort}`;
    switch (config.proxyProtocol) {
      case PROXY_PROTOCOL.HTTP:
      case PROXY_PROTOCOL.HTTPS:
        proxyAgent = new HttpsProxyAgent(`${config.proxyProtocol}://${proxyUrl}`);
        break;
      case PROXY_PROTOCOL.SOCKS4:
      case PROXY_PROTOCOL.SOCKS5:
      case PROXY_PROTOCOL.SOCKS5H:
        proxyAgent = new SocksProxyAgent(`${config.proxyProtocol}://${proxyUrl}`);
        break;
    }
  }

  try {
    if (config.requestLib === REQUEST_LIB.CTX_HTTP) {
      return await ctx.http.get<ArrayBuffer>(thumbnailUrl, {
        responseType: 'arraybuffer',
      });
    } else if (config.requestLib === REQUEST_LIB.AXIOS) {
      const response = await axios.get(thumbnailUrl, {
        responseType: 'arraybuffer',
        httpsAgent: proxyAgent,
        headers
      });
      return response.data;
    }
  } catch (error) {
    ctx.logger.error(`Failed to download thumbnail from: ${thumbnailUrl}`);
    throw error;
  }
}

// 解析 YouTube 视频信息并返回 payload
export async function parseYoutubeVideo(ctx: Context, config: Config, url: string) {
  const id = extractYoutubeId(url);
  if (!id) {
    throw new Error('Invalid YouTube URL or unable to extract video ID');
  }

  const result = await fetchVideoDataFromAPI(ctx, config, id);
  if (!result || !result.items || result.items.length === 0) {
    throw new Error(`Could not fetch video data for id: ${id}`);
  }

  const snippet = result.items[0].snippet;
  const statistics = result.items[0].statistics;
  const {
    title,
    description,
    channelTitle,
    thumbnails,
    publishedAt,
    tags,
  } = snippet;

  // 获取播放量，如果不存在则显示为 "未知"
  const viewCount = statistics?.viewCount ? parseInt(statistics.viewCount).toLocaleString() : '未知';

  const thumbnailUrl = thumbnails.maxres ? thumbnails.maxres.url : thumbnails.high.url;
  const mime = 'image/' + thumbnailUrl.slice(thumbnailUrl.lastIndexOf('.') + 1);
  const thumbnail = await downloadThumbnail(ctx, config, thumbnailUrl);

  let tagString = '[NO TAGS]';
  if (tags) {
    tagString = tags.length > 1 ? tags.join(', ') : tags[0];
  }

  let descriptionText = description;
  if (config.hideDescription) {
    descriptionText = '[DESCRIPTION HAS BEEN HIDDEN.]';
  } else if (description && description.length > config.maxDescriptionLength) {
    descriptionText = description.slice(0, config.maxDescriptionLength);
    descriptionText += `...(${description.length - config.maxDescriptionLength}CHARACTERS HAS BEEN OMITEED.)`;
  }

  return {
    coverThumlnail: thumbnail,
    coverMime: mime,
    titleText: title,
    channelText: channelTitle,
    publishTimeText: publishedAt,
    descriptionText: descriptionText,
    tagText: tagString,
    viewCountText: viewCount
  };
}