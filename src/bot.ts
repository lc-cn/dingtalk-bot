import {EventEmitter} from 'events'
import FormData from 'form-data'
import * as fs from 'fs'
import {WebSocket} from 'ws';
import axios,{AxiosInstance} from 'axios'
import {SessionManager} from '@/sessionManager';
import {Sendable} from '@/message/element';
import * as path from "path";
import {Sender} from "@/sender";
import {Dict} from "@/types";
import {md5} from "@/utils";

export class Bot extends EventEmitter {
    request: AxiosInstance
    ws?: WebSocket
    sessionManager: SessionManager

    constructor(public options: Bot.Options) {
        super();
        this.options.data_dir=this.options.data_dir||path.resolve(process.cwd(),'data')
        if(!fs.existsSync(this.options.data_dir)) fs.mkdirSync(this.options.data_dir)
        this.request = axios.create({
            baseURL: 'https://api.dingtalk.com',
        })
        this.sessionManager = new SessionManager(this)
        this.request.interceptors.request.use((config) => {
            config.headers.set('Authorization', `Bot ${this.sessionManager.access_token}`)
            config.headers.set('x-acs-dingtalk-access-token',this.sessionManager.access_token)
            return config
        })
    }

    private async saveToLocal(file: string) {
        const response = await this.request.get(file, {
            responseType: 'stream'
        })
        const [fileType]=String(response.headers["Content-Type"]||response.headers["content-type"]||file).split('/').reverse()
        const fileInfo=`${Math.random().toString(36)}.${fileType}`
        const saveTo = path.resolve(this.options.data_dir, fileInfo)
        response.data.pipe(fs.createWriteStream(saveTo))
        return new Promise<string>((resolve,reject)=>{
            response.data.on('end', () => {
                resolve(saveTo)
            })
            response.data.on('error', () => {
                reject()
            })
        })
    }
    async downloadFile(downloadCode:string):Promise<{ downloadUrl:string }>{
        const {data}= await this.request.post('/v1.0/robot/messageFiles/download',{
            downloadCode,
            robotCode:this.options.clientId
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
    async uploadMedia(file: string,mediaType:'image'|'video'|'voice'|'file') {
        if (file.startsWith('http')) file = await this.saveToLocal(file)
        const formData = new FormData()
        const [type] = file.split('.').reverse()
        const headers = formData.getHeaders()
        const fileData = fs.createReadStream(file)
        formData.append('media', fileData)
        formData.append('type', mediaType)
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
                resolve({
                    ...response.data,
                    type
                })
            })
        })
    }
    sendPrivateMsg(userId:string,message:Sendable){
        return new Sender(this,'/v1.0/robot/oToMessages/batchSend',{userIds:[userId]}).sendMsg(message)
    }
    sendGroupMsg(openConversationId: string, message: Sendable) {
        return new Sender(this,'/v1.0/robot/groupMessages/send',{openConversationId}).
        sendMsg(message)
    }

    start() {
        this.sessionManager.start()
    }

    stop() {
        // this.sessionManager.stop()
    }
}

export namespace Bot {
    export interface Options {
        clientId: string
        clientSecret: string
        data_dir?:string
        reconnect_interval?: number
        max_reconnect_count?: number
        heartbeat_interval?: number
        request_timeout?: number
        sandbox?: boolean
    }
    export type MediaInfo={
        media_id:string
        type:string
    }
    export interface Token {
        access_token: string
        expires_in: number
    }
}
