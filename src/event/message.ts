import {MessageElem, Sendable, TextElem} from "@/message/element";
import {DwClientMessage, parserMessage} from "@/message/parser";
import {Bot} from "@/bot";
type SenderInfo={
    user_id:string
    user_name:string
}
export interface MessageEvent{
    sender:SenderInfo
}
export class MessageEvent{
    message:MessageElem[]=[]
    raw_message:string=''
    message_id:string
    message_type:'group'|'private'
    time:number
    constructor(private bot:Bot,private payload:DwClientMessage) {
        this.message_type=payload.conversationType==='1'?'private':'group'
        this.message_id=payload.conversationId
        this.time=payload.createAt
        this.sender={
            user_id:payload.senderStaffId!||payload.senderId!,
            user_name:payload.senderNick
        }
    }
    static async from(this:Bot,payload:DwClientMessage){
        const result=new MessageEvent(this,payload)
        await result.parse()
        return result
    }
    private async parse(){
        this.message=await parserMessage(this.bot,this.payload)
        this.raw_message=MessageEvent.toRaw(this.message)
    }
    static toRaw(message:MessageElem[]){
        return message.map(item=>{
            if(item.type==='text') return (item as TextElem).text
            const {type,...data}=item
            return `{${type}:${Object.entries(data).map(([key,value])=>`${key}=${value}`)}`
        }).join('')
    }
    reply(message:Sendable){
        return this.message_type==='group'?
            this.bot.sendGroupMsg(this.message_id,message):
            this.bot.sendPrivateMsg(this.sender.user_id,message)
    }
}
