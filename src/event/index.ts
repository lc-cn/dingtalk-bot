export * from './message'
import {GroupMessageEvent,PrivateMessageEvent} from "@";

export interface EventMap{
    'message'(e:GroupMessageEvent|PrivateMessageEvent):void
    'message.group'(e:GroupMessageEvent):void
    'message.private'(e:PrivateMessageEvent):void
}
