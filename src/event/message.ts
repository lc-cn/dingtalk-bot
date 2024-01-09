import {MessageElem, Sendable, TextElem} from "@/message/element";
import {DwClientMessage, parserMessage} from "@/message/parser";
import {Bot} from "@/bot";

type SenderInfo = {
    user_id: string
    user_name: string
}

export interface MessageEvent {
    sender: SenderInfo
    message_type: 'group' | 'private'

    recall(): Promise<boolean>

    reply(message: Sendable): Promise<string>
}

export class Message {
    message: MessageElem[] = []
    raw_message: string = ''
    message_type: 'group' | 'private'
    time: number
    constructor(public message_id: string, payload: DwClientMessage) {
        this.message_type = payload.conversationType === '1' ? 'private' : 'group'
        this.time = payload.createAt
    }

    static async fromEvent(this: Bot, messageId: string, payload: DwClientMessage) {
        const result = payload.conversationType === '1' ?
            new PrivateMessageEvent(this, messageId, payload) :
            new GroupMessageEvent(this, messageId, payload)
        await result.parse(this,payload)
        return result
    }

    private async parse(bot: Bot,payload:DwClientMessage) {
        this.message = await parserMessage(bot, payload)
        this.raw_message = Message.toRaw(this.message)
    }

    static toRaw(message: MessageElem[]) {
        return message.map(item => {
            if (item.type === 'text') return (item as TextElem).text
            const {type, ...data} = item
            return `{${type}:${Object.entries(data).map(([key, value]) => `${key}=${value}`)}`
        }).join('')
    }
}

export class PrivateMessageEvent extends Message implements MessageEvent{
    sender:SenderInfo
    user_id:string
    user_name:string
    constructor(private bot: Bot, message_id: string, payload: DwClientMessage) {
        super(message_id, payload);
        this.message_type = 'private'
        this.sender = {
            user_id: payload.senderStaffId! || payload.senderId!,
            user_name: payload.senderNick
        }
        this.user_id = this.sender.user_id
        this.user_name=this.sender.user_name
    };

    recall() {
        return this.bot.recallPrivateMsg(this.sender.user_id, this.message_id)
    }

    reply(message: Sendable) {
        return this.bot.sendPrivateMsg(this.sender.user_id, message)
    }
}

export class GroupMessageEvent extends Message implements MessageEvent{
    group_id: string
    user_id:string
    user_name:string
    sender:SenderInfo
    constructor(private bot: Bot, message_id: string, payload: DwClientMessage) {
        super(message_id, payload);
        this.message_type = 'group'
        this.sender = {
            user_id: payload.senderStaffId! || payload.senderId!,
            user_name: payload.senderNick
        }
        this.group_id = payload.conversationId
        this.user_id = this.sender.user_id
        this.user_name=this.sender.user_name
    };

    recall() {
        return this.bot.recallGroupMsg(this.group_id, this.message_id)
    }

    reply(message: Sendable): Promise<string> {
        return this.bot.sendGroupMsg(this.group_id, message)
    }
}
