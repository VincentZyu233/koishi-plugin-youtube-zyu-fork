

import { Context } from 'koishi';
import fastify, { FastifyInstance } from 'fastify';
import { renderYoutubeVideoImage, YoutubeVideoPayload } from './render';
import { parseYoutubeVideo } from './parse';
import { Config } from './index';

// The payload from the request will be slightly different,
// as JSON can't handle ArrayBuffer directly.
// We'll expect the thumbnail as a base64 string.
interface RestYoutubeVideoPayload {
    coverThumlnail: string; // base64 string
    coverMime: string;
    titleText: string;
    channelText: string;
    publishTimeText: string;
    descriptionText: string;
    tagText: string;
    viewCountText: string;
}

export function startRestService(ctx: Context, config: Config) {
    if (!config.enableRestfulService) {
        ctx.logger.info('RESTful service is disabled.');
        return;
    }

    if (!ctx.puppeteer) {
        ctx.logger.warn('Puppeteer service is not available, RESTful service will not start.');
        return;
    }

    const server: FastifyInstance = fastify({ logger: true });

    // 原有的 /render 端点 - 直接渲染提供的 payload
    server.post('/render', async (request, reply) => {
        try {
            const payload = request.body as RestYoutubeVideoPayload;

            // Convert base64 thumbnail back to ArrayBuffer for the render function
            const thumbnailBuffer = Buffer.from(payload.coverThumlnail, 'base64');

            const renderPayload: YoutubeVideoPayload = {
                ...payload,
                coverThumlnail: thumbnailBuffer.buffer.slice(thumbnailBuffer.byteOffset, thumbnailBuffer.byteOffset + thumbnailBuffer.byteLength),
            };

            const imageBase64 = await renderYoutubeVideoImage(ctx, renderPayload);

            if (imageBase64) {
                reply.code(200).send({ imageBase64 });
            } else {
                reply.code(500).send({ error: 'Failed to render image.' });
            }
        } catch (error) {
            ctx.logger.error('Error in /render endpoint:', error);
            reply.code(500).send({ error: 'Internal server error.' });
        }
    });

    // 新增 /parse 端点 - 解析 YouTube URL 并返回 payload 信息
    server.post('/parse', async (request, reply) => {
        try {
            const { url } = request.body as { url: string };
            
            if (!url) {
                reply.code(400).send({ error: 'URL is required' });
                return;
            }

            const payload = await parseYoutubeVideo(ctx, config, url);
            
            // Convert ArrayBuffer to base64 for JSON response
            const coverBase64 = Buffer.from(payload.coverThumlnail).toString('base64');
            
            const responsePayload = {
                ...payload,
                coverThumlnail: coverBase64
            };

            reply.code(200).send(responsePayload);
        } catch (error) {
            ctx.logger.error('Error in /parse endpoint:', error);
            reply.code(500).send({ error: error.message || 'Failed to parse YouTube video' });
        }
    });

    // 新增 /render-from-url 端点 - 从 YouTube URL 直接渲染图片
    server.post('/render-from-url', async (request, reply) => {
        try {
            const { url } = request.body as { url: string };
            
            if (!url) {
                reply.code(400).send({ error: 'URL is required' });
                return;
            }

            // 解析视频信息
            const payload = await parseYoutubeVideo(ctx, config, url);
            
            // 直接渲染图片
            const imageBase64 = await renderYoutubeVideoImage(ctx, payload);

            if (imageBase64) {
                reply.code(200).send({ imageBase64 });
            } else {
                reply.code(500).send({ error: 'Failed to render image.' });
            }
        } catch (error) {
            ctx.logger.error('Error in /render-from-url endpoint:', error);
            reply.code(500).send({ error: error.message || 'Failed to render YouTube video' });
        }
    });

    server.listen({
        host: config.restServiceBindIp,
        port: config.restServiceBindPort,
    }, (err, address) => {
        if (err) {
            ctx.logger.error('Error starting RESTful service:', err);
            throw err;
        }
        ctx.logger.info(`RESTful service listening on ${address}`);
    });

    ctx.on('dispose', () => {
        server.close();
    });
}
