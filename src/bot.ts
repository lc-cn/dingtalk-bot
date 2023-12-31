import {EventEmitter} from 'events'
import FormData from 'form-data'
import * as fs from 'fs'
import {WebSocket} from 'ws';
import {getLogger, Logger} from "log4js";
import axios, {AxiosInstance} from 'axios'
import {SessionManager} from '@/sessionManager';
import {Sendable} from '@/message/element';
import * as path from "path";
import {Sender} from "@/sender";
import {Dict, LogLevel} from "@/types";
import {saveFile} from "@/utils";
import {EventMap} from "@/event";

export class Bot extends EventEmitter {
    request: AxiosInstance
    ws?: WebSocket
    sessionManager: SessionManager
    logger:Logger
    constructor(public options: Bot.Options) {
        super();
        this.logger=getLogger(`[node-dd-bot:${this.options.clientId}]`)
        this.logger.level=options.log_level||'info'
        this.options.data_dir = this.options.data_dir || path.resolve(process.cwd(), 'data')
        if (!fs.existsSync(this.options.data_dir)) fs.mkdirSync(this.options.data_dir)
        this.request = axios.create({
            baseURL: 'https://api.dingtalk.com',
        })
        this.sessionManager = new SessionManager(this)
        this.request.interceptors.request.use((config) => {
            config.headers.set('x-acs-dingtalk-access-token', this.sessionManager.access_token)
            return config
        })
    }

    async downloadFile(downloadCode: string): Promise<{ downloadUrl: string }> {
        const {data} = await this.request.post('/v1.0/robot/messageFiles/download', {
            downloadCode,
            robotCode: this.options.clientId
        })
        return data
    }

    em(event: string, payload: Dict) {
        const eventNames = event.split('.')
        const [post_type, detail_type, ...sub_type] = eventNames
        Object.assign(payload, {
            post_type,
            [`${post_type}_type`]: detail_type,
            sub_type: sub_type.join('.'),
            ...payload
        })
        let prefix = ''
        while (eventNames.length) {
            let fullEventName = `${prefix}.${eventNames.shift()}`
            if (fullEventName.startsWith('.')) fullEventName = fullEventName.slice(1)
            this.emit(fullEventName, payload)
            prefix = fullEventName
        }
    }
    async uploadMedia(buf:Buffer,fileName:string,mediaType:'image' | 'video' | 'voice' | 'file'):Promise<Bot.MediaInfo>
    async uploadMedia(file: string, mediaType: 'image' | 'video' | 'voice' | 'file'):Promise<Bot.MediaInfo>
    async uploadMedia(file:string|Buffer,...args:['image' | 'video' | 'voice' | 'file']|[string,'image' | 'video' | 'voice' | 'file']){
        const formData = new FormData()
        const base64Matches:RegExpMatchArray|null=typeof file==="string"?file.match(/^data:(\S+);base64,(.+)/):null
        if(base64Matches) file=saveFile('base64',base64Matches[1],base64Matches[2])
        if(Buffer.isBuffer(file)) file=saveFile('buffer',args.shift(),file)
        const headers = formData.getHeaders()
        const fileData = file.startsWith('http') ?
            (await this.request.get(file, {responseType: 'stream'})).data :
            fs.createReadStream(file)

        formData.append('media', fileData)
        formData.append('type', args[0])
        return new Promise<Bot.MediaInfo>((resolve, reject) => {
            formData.getLength(async (e, l) => {
                if (e) return reject(e)
                headers['content-length'] = l
                const response = await this.request.post(
                    'https://oapi.dingtalk.com/media/upload',
                    formData,
                    {
                        params: {
                            access_token: this.sessionManager.access_token,
                        },
                        headers: {
                            "Content-Type": 'multipart/form-data'
                        }
                    })
                if(base64Matches) fs.unlinkSync(file)
                resolve(response.data)
            })
        })
    }

    sendPrivateMsg(userId: string, message: Sendable) {
        return new Sender(this, '/v1.0/robot/oToMessages/batchSend', {userIds: [userId]}).sendMsg(message)
    }
    async recallPrivateMsg(user_id:string,message_id:string):Promise<boolean> {
        const {data:{successResult=[]}={}}=await this.request.post('/v1.0/robot/otoMessages/batchRecall',{
            openConversationId:user_id,
            robotCode:this.options.clientId,
            processQueryKeys:[message_id]
        })
        return successResult.includes(message_id)
    }

    sendGroupMsg(group_id: string, message: Sendable) {
        return new Sender(this, '/v1.0/robot/groupMessages/send', {
            openConversationId:group_id
        }).sendMsg(message)
    }
    async recallGroupMsg(group_id:string,message_id:string):Promise<boolean> {
        const {data:{successResult=[]}={}}=await this.request.post('/v1.0/robot/groupMessages/recall',{
            openConversationId:group_id,
            robotCode:this.options.clientId,
            processQueryKeys:[message_id]
        })
        return successResult.includes(message_id)
    }

    async start() {
        await this.sessionManager.start()
    }

    async stop() {
        await this.sessionManager.stop()
    }
}
/** 事件接口 */
export interface Bot extends EventEmitter {
    on<T extends keyof EventMap>(event: T, listener: EventMap[T]): this;

    on<S extends string|symbol>(
        event: S & Exclude<S, keyof EventMap>,
        listener: (...args:any[])=>any,
    ): this;

    once<T extends keyof EventMap>(event: T, listener: EventMap[T]): this;

    once<S extends string|symbol>(
        event: S & Exclude<S, keyof EventMap>,
        listener: (...args:any[])=>any,
    ): this;
    addListener<T extends keyof EventMap>(event: T, listener: EventMap[T]): this;

    addListener<S extends string|symbol>(
        event: S & Exclude<S, keyof EventMap>,
        listener: (...args:any[])=>any,
    ): this;
    emit<T extends keyof EventMap>(event: T, ...args:Parameters<EventMap[T]>): boolean;

    emit<S extends string|symbol>(
        event: S & Exclude<S, keyof EventMap>,
        ...args:any[]
    ): boolean;
    off<T extends keyof EventMap>(event: T, listener: EventMap[T]): this;

    off<S extends string|symbol>(
        event: S & Exclude<S, keyof EventMap>,
        listener: (...args:any[])=>any,
    ): this;
}
export namespace Bot {
    export interface Options {
        clientId: string
        clientSecret: string
        log_level?:LogLevel
        data_dir?: string
        reconnect_interval?: number
        max_reconnect_count?: number
        heartbeat_interval?: number
        request_timeout?: number
        sandbox?: boolean
    }

    export type MediaInfo = {
        media_id: string
        type: string
    }

    export interface Token {
        access_token: string
        expires_in: number
    }
}
