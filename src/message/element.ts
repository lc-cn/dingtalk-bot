import {Bot} from '@/bot';

export interface ElementMap {
    at:{
        user_id:string|'all'
    }|{
        phone:string
    }
    face:{
        id:string
    }
    text: {
        text: string
    }
    markdown: {
        title?: string
        content: string
    }
    image: {
        url: string
    }
    link: {
        text: string
        title: string
        thumb?: string
        href: string
    }
    action: {
        title: string
        text: string
        buttons: ButtonElem[]
    }
    button: {
        title: string
        url: string
    }
    audio: {
        url: string
        duration: number
    }
    video: {
        thumb: string
        url: string
        duration: number
        width?: number
        height?: number
    }
    file: {
        name?: string
        type?: string
        url: string
    }
    confirm: {
        title: string
        text: string
        yesText: string
        yesUrl: string
        noText: string
        noUrl: string
    }
}

export type ElementType = keyof ElementMap
export type MessageElem<T extends ElementType = ElementType> = {
    type: T
} & ElementMap[T]
export type ButtonElem = MessageElem<'button'>
export type ATElem = MessageElem<'at'>
export type TextElem = MessageElem<'text'>
export type FaceElem = MessageElem<'face'>
export type MdElem = MessageElem<'markdown'>
export type ImageElem = MessageElem<'image'>
export type LinkElem = MessageElem<'link'>
export type ActionElem = MessageElem<'action'>
export type FileElem = MessageElem<'file'>
export type AudioElem = MessageElem<'audio'>
export type VideoElem = MessageElem<'video'>
export type ConfirmElem = MessageElem<'confirm'>
export type Sendable =
    string
    | TextElem
    | ATElem
    | FaceElem
    | MdElem
    | ImageElem
    | LinkElem
    | ActionElem
    | FileElem
    | AudioElem
    | VideoElem
    | ConfirmElem
    | (string | MessageElem)[]
export type MessagePayload = {
    content?: string
    title?: string
    text?: string
    photoURL?: string
    picUrl?: string
    messageUrl?: string
    singleTitle?: string
    singleUrl?: string
    actionTitle1?: string
    actionURL1?: string
    actionTitle2?: string
    actionURL2?: string
    actionTitle3?: string
    actionURL3?: string
    actionTitle4?: string
    actionURL4?: string
    actionTitle5?: string
    actionURL5?: string
    buttonTitle1?: string
    buttonURL1?: string
    buttonTitle2?: string
    buttonURL2?: string
    mediaId?: string
    duration?: string
    fineName?: string
    fileType?: string
    videoMediaId?: string
    videoType?: string
    picMediaId?: string
}
type ConvertResult = [string, MessagePayload]
type OriginConverter<T extends MessageElem = MessageElem> = (element: T, bot: Bot) => ConvertResult | Promise<ConvertResult>
export const originTypeConverterMap: Map<string, OriginConverter> = new Map<string, OriginConverter>()
export function getConverter<T extends MessageElem>(elem:T):OriginConverter<T>|undefined{
    return originTypeConverterMap.get(elem.type)
}
export function registerConverter<T extends ElementType, E extends MessageElem<T> = MessageElem<T>>(type: T, convertor: OriginConverter<E>) {
    if (Array.isArray(type)) {
        for (const t of type) {
            originTypeConverterMap.set(t, convertor as unknown as OriginConverter)
        }
        return
    }
    originTypeConverterMap.set(type, convertor as unknown as OriginConverter)
}

registerConverter('text', (elem) => {
    return ['sampleText', {content: elem.text}]
})
registerConverter('image', async (elem, bot) => {
    const imageMedia = await bot.uploadMedia(elem.url,'image')
    return [
        'sampleImageMsg',
        {
            photoURL: imageMedia.media_id
        }
    ]
})
registerConverter('markdown', (elem) => {
    return [
        'sampleMarkdown',
        {
            title: elem.title,
            text: elem.content
        }
    ]
})

registerConverter('link', (elem, bot) => (['sampleLink',{
    title: elem.title,
    text: elem.text,
    picUrl: elem.thumb,
    messageUrl: elem.href
}]))
registerConverter('action', (elem) => {
    const result: MessagePayload = {
        title: elem.title,
        text: elem.text,
    }
    for (const button of elem.buttons || []) {
        const titleKey: keyof MessagePayload = `actionTitle${elem.buttons.indexOf(button) + 1}` as keyof MessagePayload
        const urlKey: keyof MessagePayload = `actionURL${elem.buttons.indexOf(button) + 1}` as keyof MessagePayload
        result[titleKey] = button.title
        result[urlKey] = button.url
    }
    return [`sampleActionCard${elem.buttons?.length||''}`,result]
})
registerConverter('audio', async (elem, bot) => {
    const media = await bot.uploadMedia(elem.url,'voice')
    return ['sampleAudio',{
        mediaId: media.media_id,
        duration: elem.duration + ''
    }]
})
registerConverter('confirm', (elem, bot) => {
    return ['sampleActionCard6',{
        title: elem.title,
        text: elem.text,
        buttonTitle1: elem.yesText,
        buttonURL1: elem.yesUrl,
        buttonTitle2: elem.noText,
        buttonURL2: elem.noUrl
    }]
})
registerConverter('video', async (elem, bot) => {
    const videoMedia = await bot.uploadMedia(elem.url,'video')
    const thumbMedia = await bot.uploadMedia(elem.thumb,'image')
    return ['sampleVideo',{
        videoMediaId: videoMedia.media_id,
        duration: elem.duration + '',
        videoType: 'mp4',
        width: elem.width,
        height: elem.height,
        picMediaId: thumbMedia.media_id
    }]
})
registerConverter('file', async (elem, bot) => {
    const fileMedia = await bot.uploadMedia(elem.url,'file')
    return ['sampleFile',{
        mediaId: fileMedia.media_id,
        fineName: elem.name,
        fileType: fileMedia.type
    }]
})

