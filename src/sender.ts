import {Bot} from "@/bot";
import {Dict} from "@/types";
import {ElementType, getConverter, MessageElem, Sendable} from "@/message/element";

export class Sender{
    constructor(private bot:Bot,private readonly url:string,private target:Dict) {
    }
    private async sendElem<T extends ElementType>(item:MessageElem<T>):Promise<string>{
        const converter=getConverter(item)
        if(!converter) throw new Error(`un support elem:${item.type}`)
        const [msgKey,msgParam]=await converter(item,this.bot)
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
        console.debug(`send to ${JSON.stringify(this.target)}: ${JSON.stringify(item)}`)
        return data.processQueryKey
    }
    async sendMsg(message:Sendable){
        const result:string[]=[]
        if(!Array.isArray(message)) message=[message]
        // const repeatable=message.filter(item=>{
        //     return typeof item==='string'||['face','at','text'].includes(item.type)
        // })
        // const singleItem=message.filter(item=>!repeatable.includes(item))

        for (let item of message){
            if(typeof item==='string') item={type:'text',text:item}
            result.push(await this.sendElem(item))
        }
        return result
    }
}
