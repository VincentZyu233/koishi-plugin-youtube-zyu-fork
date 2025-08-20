import { Context } from 'koishi';
import { } from 'koishi-plugin-puppeteer';
import { Buffer } from 'buffer';

export interface YoutubeVideoPayload {
    coverThumlnail: ArrayBuffer;
    coverMime: string;
    titleText: string;
    channelText: string;
    publishTimeText: string;
    descriptionText: string;
    tagText: string;
    viewCountText: string;
}

const getTemplateStr = async (payload: YoutubeVideoPayload): Promise<string> => {
    // 将 ArrayBuffer 转换为 Base64 字符串
    const coverBase64 = Buffer.from(payload.coverThumlnail).toString('base64');
    const coverDataUrl = `data:${payload.coverMime};base64,${coverBase64}`;

    return `
    <html>
    <head>
        <style>
            @font-face {
                font-family: 'YouTube Sans';
                /* 这里可以放置 YouTube 风格字体的链接，但为了简化，我们先用系统字体 */
            }

            body {
                margin: 0;
                padding: 0;
                font-family: 'Roboto', 'Arial', sans-serif;
                background-color: #000;
                display: flex; /* Use flexbox for centering */
                justify-content: center; /* Center horizontally */
                align-items: center; /* Center vertically */
            }
            
            .background-container {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 1;
            }

            .background-cover {
                width: 100%;
                height: 100%;
                object-fit: cover;
                filter: blur(25px) brightness(0.5);
                transform: scale(1.2);
            }

            .main-container {
                position: relative;
                z-index: 2;
                box-sizing: border-box;
                display: flex;
                justify-content: center;
                padding: 16px; /* Adjusted padding to create a small gap around the card */
            }

            .container {
                width: 90%; /* Use percentage for responsiveness */
                max-width: 500px; /* Set a max-width to prevent it from getting too wide */
                border-radius: 16px;
                overflow: hidden;
                
                /* Frosted glass effect */
                background-color: rgba(40, 40, 40, 0.7);
                backdrop-filter: blur(20px) saturate(150%);
                -webkit-backdrop-filter: blur(20px) saturate(150%);
                
                border: 1px solid rgba(255, 255, 255, 0.12);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);

                display: flex;
                flex-direction: column;
            }

            .cover-container {
                position: relative;
                width: 100%;
                padding-bottom: 56.25%; /* 16:9 ratio */
            }

            .cover {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                object-fit: cover;
            }

            .content {
                padding: 16px; /* Reduced padding */
                display: flex;
                flex-direction: column;
                gap: 8px; /* Reduced gap */
            }

            .title {
                font-size: 24px; /* Adjusted font size */
                font-weight: 700;
                line-height: 1.3;
                color: #ffffff;
                text-shadow: 0 2px 4px rgba(0,0,0,0.6);
                margin-bottom: 4px;
                letter-spacing: -0.5px;
            }

            .metadata {
                display: flex;
                flex-direction: column;
                gap: 6px;
                margin-bottom: 8px;
                padding: 12px 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }

            .channel {
                font-size: 16px; /* Adjusted font size */
                font-weight: 600;
                color: #f0f0f0;
                text-shadow: 0 1px 2px rgba(0,0,0,0.4);
            }

            .stats-row {
                display: flex;
                align-items: center;
                gap: 12px; /* Reduced gap */
                flex-wrap: wrap;
            }

            .publish-time {
                font-size: 13px; /* Adjusted font size */
                color: #cccccc;
                font-weight: 400;
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .publish-time::before {
                content: "📅";
                font-size: 11px; /* Adjusted icon size */
            }

            .view-count {
                font-size: 14px; /* Adjusted font size */
                color: #00bcd4;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 4px;
                background: rgba(0, 188, 212, 0.1);
                padding: 3px 6px; /* Reduced padding */
                border-radius: 6px; /* Reduced border-radius */
                border: 1px solid rgba(0, 188, 212, 0.3);
            }

            .view-count::before {
                content: "▶️";
                font-size: 12px; /* Adjusted icon size */
            }

            .description {
                font-size: 14px; /* Adjusted font size */
                line-height: 1.5;
                color: #e0e0e0;
                margin-top: 6px;
                white-space: pre-wrap;
                background: rgba(255, 255, 255, 0.05);
                padding: 10px; /* Reduced padding */
                border-radius: 8px;
                border-left: 3px solid rgba(255, 255, 255, 0.2);
            }

            .tags {
                font-size: 12px; /* Adjusted font size */
                color: #64b5f6;
                font-weight: 500;
                margin-top: 6px;
                padding: 6px 10px; /* Reduced padding */
                background: rgba(100, 181, 246, 0.1);
                border-radius: 8px;
                border: 1px solid rgba(100, 181, 246, 0.2);
            }
        </style>
    </head>
    <body>
        <div class="background-container">
            <img class="background-cover" src="${coverDataUrl}" alt="Video Background">
        </div>
        <div class="main-container">
            <div class="container">
                <div class="cover-container">
                    <img class="cover" src="${coverDataUrl}" alt="Video Cover">
                </div>
                <div class="content">
                    <div class="title">${payload.titleText}</div>
                    <div class="metadata">
                        <div class="channel">${payload.channelText}</div>
                        <div class="stats-row">
                            <div class="publish-time">${payload.publishTimeText}</div>
                            <div class="view-count">${payload.viewCountText} views</div>
                        </div>
                    </div>
                    <div class="description">${payload.descriptionText}</div>
                    <div class="tags">${payload.tagText}</div>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
};

export async function renderYoutubeVideoImage(
    ctx: Context,
    payload: YoutubeVideoPayload
) {
    if (!ctx.puppeteer) {
        ctx.logger.error("Puppeteer service is not available.");
        return null;
    }

    try {
        const page = await ctx.puppeteer.page();
        const html = await getTemplateStr(payload);
        
        await page.setContent(html, {
            waitUntil: ['domcontentloaded']
        });

        // 调整视图以适应内容
        const mainContainer = await page.$('.main-container');
        const boundingBox = await mainContainer.boundingBox();
        if (boundingBox) {
            await page.setViewport({ width: Math.ceil(boundingBox.width), height: Math.ceil(boundingBox.height) });
        }

        const screenshot = await page.screenshot({
            type: 'png',
            encoding: 'base64',
            fullPage: false // Change to false to capture only the viewport
        });

        await page.close();

        return screenshot;
    } catch (error) {
        ctx.logger.error('Error rendering YouTube video image:', error);
        return null;
    }
}