import {Dict} from "@/types";
import {MessageElem} from "@/message/element";
import {Bot} from "@/bot";
export type DwClientMessage={
    conversationId:string
    conversationType:"1"|"2"
    chatbotCorpId:string
    senderNick:string
    isAdmin:boolean
    senderStaffId?:string
    senderId?:string
    msgtype:string
    content?:Dict
    createAt:number
    text?:{content:string}
}
function parseFromText(text:string):MessageElem[]{
    const result:MessageElem[]=[]
    const matchReg=/\[!]+]/
    while (text.length){
        const [match]=matchReg.exec(text)||[]
        if(!match) break;
        const matchIdx=text.indexOf(match)
        if(matchIdx>0) result.push({type:'text',text:text.slice(0,matchIdx)})
        text=text.slice(matchIdx)
        result.push({
            type:'face',
            id:match.slice(1,-1)
        })
    }
    if(text.length){
        result.push({
            type:'text',
            text
        })
    }
    return result
}
async function parseFromRichText(this:Bot,list:Dict[]):Promise<MessageElem[]>{
    const result:MessageElem[]=[]
    for(const item of list){
        switch (item.type){
            case 'picture':
                const imageInfo=await this.downloadFile(item.downloadCode)
                result.push({
                    type:'image',
                    url:imageInfo.downloadUrl
                })
                break;
            default:
                result.push(...parseFromText(item.text))
        }
    }
    return result
}
export async function parserMessage(bot:Bot,payload:DwClientMessage):Promise<MessageElem[]>{
    switch (payload.msgtype){
        case 'text':
            return parseFromText(payload.text!.content)
        case 'picture':
            const imageInfo=await bot.downloadFile(payload.content!.downloadCode)
            return [{
                type:'image',
                url:imageInfo.downloadUrl
            }]
        case 'richText':
            return await parseFromRichText.apply(bot,[payload.content!.richText])
        case 'file':
            const fileInfo=await bot.downloadFile(payload.content!.downloadCode)
            return [{
                type:'file',
                name:payload.content!.fileName,
                url:fileInfo.downloadUrl,
            }]
        default:
            return []
    }
}
