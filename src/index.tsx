import { Context, h, z } from 'koishi'
import { platform } from 'os'

export const name = 'youtube'

export interface Config {
  // constText: string,
  apiKey: string,
  enableDebugOutput: boolean,
  enableQQWhitelist: boolean,
  QQwhilelist: Array<string>,
}

export const Config: z<Config> = z.object({
  // constText: z.string().disabled().description("nihao"),
  apiKey: z.string().required().description('请填写你的youtube api key'),
  enableDebugOutput: z.boolean().description('是否启用调试输出'),
  enableQQWhitelist: z.boolean().description('是否启用QQ白名单(QQ平台只有指定用户发的才会响应)'),
  QQwhilelist: z.array(
    z.string().required().description('白名单用户QQ号')
  )
})

const apiEndpointPrefix = 'https://www.googleapis.com/youtube/v3/videos'

export function apply(ctx: Context, config: Config) {
  const logger = ctx.logger('youtube')

  function MediaFormat() {
    // http://www.youtube.com/embed/m5yCOSHeYn4
    const ytRegEx = /(?:https?:\/\/)?(?:i\.|www\.|img\.)?(?:youtu\.be\/|youtube\.com\/|ytimg\.com\/)(?:shorts\/|embed\/|v\/|vi\/|vi_webp\/|watch\?v=|watch\?.+&v=)([\w-]{11})/
    // http://vimeo.com/3116167, https://player.vimeo.com/video/50489180, http://vimeo.com/channels/3116167, http://vimeo.com/channels/staffpicks/113544877
    const vmRegEx = /https?:\/\/(?:vimeo\.com\/|player\.vimeo\.com\/)(?:video\/|(?:channels\/staffpicks\/|channels\/)|)((\w|-){7,9})/
    // http://open.spotify.com/track/06TYfe9lyGQA6lfqo5szIi, https://embed.spotify.com/?uri=spotify:track:78z8O6X1dESVSwUPAAPdme
    const spRegEx = /https?:\/\/(?:embed\.|open\.)(?:spotify\.com\/)(?:track\/|\?uri=spotify:track:)((\w|-){22})/
    // https://soundcloud.com/aviciiofficial/avicii-you-make-me-diplo-remix, https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/29395900&amp;color=ff5500&amp;auto_play=false&amp;hide_related=false&amp;show_comments=true&amp;show_user=true&amp;show_reposts=false
    const scRegEx = /https?:\/\/(?:w\.|www\.|)(?:soundcloud\.com\/)(?:(?:player\/\?url=https\%3A\/\/api.soundcloud.com\/tracks\/)|)(((\w|-)[^A-z]{7})|([A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*(?!\/sets(?:\/|$))(?:\/[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*){1,2}))/

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
      },
      // returns only the ID
      getVimeoID: function (src) {
        return getIDfromRegEx(src, vmRegEx)
      },
      // returns main link
      getVimeoUrl: function (ID) {
        return 'http://vimeo.com/' + ID
      },
      // returns only the ID
      getSpotifyID: function (src) {
        return getIDfromRegEx(src, spRegEx)
      },
      // returns main link
      getSpotifyUrl: function (ID) {
        return 'http://open.spotify.com/track/' + ID
      },
      // returns only the ID
      getSoundcloudID: function (src) {
        return getIDfromRegEx(src, scRegEx)
      },
      // returns main link
      // NOTE: this one really sucks since soundcloud doesnt have good API without js library
      getSoundcloudUrl: function (ID) {
        return 'https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/' + ID // only way to link to the track currently
      },
    }
  }

  async function fetchDataFromAPI(id: string) {
    return await ctx.http.get(`${apiEndpointPrefix}?id=${id}&key=${config.apiKey}&part=snippet,contentDetails,statistics,status`)
  };

  ctx.middleware(async (session, next) => {
    const isYoutube = session.content.includes('youtube.com') || session.content.includes('https://youtu.be')
    if (!isYoutube) return next()

    const foo = config.QQwhilelist.join(', ')
    if ( config.enableDebugOutput ){
      session.send(
        `[debug] youtube link detected!!\n` +
        `session.userId: ${session.userId}\n` +
        `session.platform: ${session.platform}\n` +
        `config.QQwhilelist: ${foo}\n` 
      )
    }
    

    if (config.enableQQWhitelist) {
      if (config.QQwhilelist.includes(session.userId)) {
        session.send('好好好，你是youtube插件QQ白名单用户')
      } else {
        session.send('不可以！你不是youtube插件QQ白名单用户')
        return next()
      }
    }

    let id
    if (session.content.includes('https://youtu.be')) {
      id = session.content.match(/youtu\.be\/([\w-]{11})/)[1]
    } else {
      id = MediaFormat().getYoutubeID(session.content)
    }
    if (!id) {
      logger.warn('unable to perceive youtube id from' + session.content)
      return next()
    }
    logger.info('perceived youtube id ' + id)
    const result = await fetchDataFromAPI(id)
    const snippet = result.items[0].snippet
    const {
      title,
      description,
      channelTitle,
      thumbnails,
      publishedAt,
      tags,
    } = snippet
    const thumbnailUrl = thumbnails.maxres ? thumbnails.maxres.url : thumbnails.high.url
    const mime = 'image/' + thumbnailUrl.slice(thumbnailUrl.lastIndexOf('.') + 1)
    const thumbnail = await ctx.http.get<ArrayBuffer>(thumbnailUrl, {
      responseType: 'arraybuffer',
    })
    // let tagString = '无'
    // if (tags) {
    //   tagString = tags.length > 1 ? tags.join(', ') : tags[0]
    // }
    return <>
      {h.image(thumbnail, mime)}
      {/* <p>session.platform: {session.platform}</p>
      <p>session.userId: {session.userId}</p> */}
      <p>标题：{title}</p> {/* TODO: 时长 */}
      <p>频道：{channelTitle}</p>
      <p>发布时间：{publishedAt}</p>
      <p>标签：{description}</p>
    </>
  })
}
