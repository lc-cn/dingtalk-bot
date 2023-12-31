import {Bot} from "@/bot";
import {Dict} from "@/types";
import {ElementType, getConverter, MessageElem, Sendable} from "@/message/element";
export class Sender{
    private payload:Dict={}
    constructor(private bot:Bot,private readonly url:string,private target:Dict) {
    }
    private async sendElem<T extends ElementType>(item:MessageElem<T>,isLast:boolean):Promise<string>{
        const converter=getConverter(item)
        if(!converter) throw new Error(`un support elem:${item.type}`)
        const [msgKey,msgParam,brief]=await converter(item,this.bot)
        const {data}=await this.bot.request.post(this.url,{
            ...this.target,
            robotCode:this.bot.options.clientId,
            msgKey,
            msgParam:JSON.stringify(msgParam)
        },{
            headers:{
                'x-acs-dingtalk-access-token':this.bot.sessionManager.access_token
            }
        })
        if(this.target.userIds){
            this.bot.logger.info(`send: [Private(${this.target.userIds.join(',')})] ${brief}`)
        }else{
            this.bot.logger.info(`send: [Group(${this.target.openConversationId})] ${brief}`)
        }
        return data.processQueryKey
    }
    async sendMsg(message:Sendable){
        const result:string[]=[]
        let i=0;
        if(!Array.isArray(message)) message=[message]
        for (let item of message){
            i++
            if(typeof item==='string') item={type:'text',text:item}
            result.push(await this.sendElem(item,i===message.length))
        }
        return JSON.stringify(result)
    }
}
