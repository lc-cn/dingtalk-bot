import {EventEmitter} from "events";
import {WebSocket} from 'ws'
import {Bot} from "@/bot";
import {Message} from "@/event";

export interface DwClientDownStream{
  specVersion: string;
  type: string;
  appId?:string
  messageId?:string
  headers: {
    appId: string;
    connectionId: string;
    contentType: string;
    messageId: string;
    time: string;
    topic: string;
    eventType?: string;
    eventBornTime?: string;
    eventId?: string;
    eventCorpId?: string;
    eventUnifiedAppId?: string;
  };
  data: string;
}
export class SessionManager extends EventEmitter {
  connected:boolean=false
  isAlive=true
  stopEd?:boolean
  reconnect_count=0
  reconnecting:boolean=false
  private heartbeat_timer?:NodeJS.Timer
  access_token:string=''
  wsUrl?:string
  constructor(private bot: Bot) {
    super();
  }
  heartbeat(downStream:DwClientDownStream){
    this.bot.ws?.send(JSON.stringify({
      code:200,
      headers:downStream.headers,
      message:'OK',
      data:downStream.data
    }))
  }
  onSystem(downStream:DwClientDownStream){
    switch (downStream.headers.topic){
      case 'REGISTERED':
        this.connected=true
        this.reconnecting=false
        break;
      case 'disconnect':
        this.connected=false
        break;
      case 'KEEPALIVE':
        this.isAlive=true
      case 'ping':
        this.heartbeat(downStream)
    }
  }
  handleEvent(message:DwClientDownStream){
    this.bot.ws?.send(JSON.stringify({
      code:200,
      headers:{
        contentType:'application/json',
        messageId:message.headers.messageId
      },
      message:'OK',
      data:JSON.stringify(null)
    }))
  }
  async handleCallback(message:DwClientDownStream){
    const payload=JSON.parse(message.data)
    const messageEvent=await Message.fromEvent.bind(this.bot)(message.messageId!,payload)
    if(messageEvent.message_type==="group"){
      this.bot.logger.info(`recv: [Group(${messageEvent.message_id}),Member(${messageEvent.sender.user_id})] ${messageEvent.raw_message}`)
    }else{
      this.bot.logger.info(`recv: [Private(${messageEvent.sender.user_id})] ${messageEvent.raw_message}`)
    }
    this.bot.em(`message.${messageEvent.message_type}`,messageEvent)
  }
  private handleWsMsg(data:string){
    const msg:DwClientDownStream=JSON.parse(data) as DwClientDownStream
    switch (msg.type){
      case 'SYSTEM':
        this.onSystem(msg)
        break;
      case 'EVENT':
        this.handleEvent(msg)
        break
      case 'CALLBACK':
        this.handleCallback(msg)
    }
  }
  async getAccessToken(): Promise<Bot.Token> {
    let {clientId, clientSecret} = this.bot.options;
    const getToken = () => {
      return new Promise<Bot.Token>((resolve, reject) => {
        this.bot.request.get("https://oapi.dingtalk.com/gettoken", {
          params:{
            appkey:clientId,
            appsecret:clientSecret
          }
        }).then((res) => {
          if (res.status === 200 && res.data && typeof res.data === "object") {
            resolve(res.data as Bot.Token);
          } else {
            reject(res);
          }
        });
      });
    };
    const getNext = async (next_time: number) => {
      return new Promise<Bot.Token>(resolve => {
        setTimeout(async () => {
          const token = await getToken();
          this.access_token = token.access_token;
          getNext(token.expires_in - 1).catch(() => getNext(0));
          resolve(token);
        }, next_time * 1000);
      });
    };
    return getNext(0);
  }

  async getWsUrl() {
    return new Promise<void>((resolve) => {
      this.bot.request({
        url:"/v1.0/gateway/connections/open",
        method:'POST',
        data:{
          clientId:this.bot.options.clientId,
          clientSecret:this.bot.options.clientSecret,
          ua:'',
          subscriptions:[
            {
              type:'EVENT',
              topic:'*'
            },{
              type:'CALLBACK',
              topic: '/v1.0/im/bot/messages/get'
            },
            {
              type: 'CALLBACK',
              topic: '/v1.0/graph/api/invoke'
            }
          ]
        },
        responseType:'json',
        headers:{
          Accept:'application/json'
        }
      }).then(res => {
        if (!res.data) throw new Error("获取ws连接信息异常");
        const {endpoint,ticket}=res.data
        if (!endpoint ||! ticket) throw new Error("获取ws连接信息异常");
        this.wsUrl = `${endpoint}?ticket=${ticket}`;
        resolve();
      });
    });
  }


  async start() {
    await this.getAccessToken();
    await this.getWsUrl();
    return new Promise<void>(resolve =>{
      this.bot.once('system.online',resolve)
      this.connect();
    })
  }
  async stop(){
    this.stopEd=true
    this.bot.ws?.close()
  }

  connect() {
    this.bot.ws = new WebSocket(this.wsUrl!, {
      rejectUnauthorized:true
    });
    this.bot.ws.on('open',(data)=>{
      this.isAlive=true
      this.connected=true
      this.reconnect_count=0;
      this.bot.emit('system.online')
      this.bot.logger.info(`online success`)
      this.heartbeat_timer=setInterval(()=>{
        this.isAlive=false;
        this.bot.ws?.ping('',true)
      },this.bot.options.heartbeat_interval||3000)
    })
    this.bot.ws.on('pong',(data)=>{
      this.isAlive=true
    })
    this.bot.ws.on('message',(data)=>{
      this.handleWsMsg(data.toString())
    })
    this.bot.ws.on('close',(code)=>{
      this.connected=false
      if(this.stopEd) return;
      if(this.reconnect_count>=(this.bot.options.max_reconnect_count||10)) return
      this.reconnecting=true
      setTimeout(()=>{
        this.reconnect_count++
        this.connect()
      },this.bot.options.reconnect_interval||3000)
    })
    this.bot.ws.on('error',(e)=>{
      this.bot.logger.error(e)
    })
  }


  // 发送websocket
  sendWs(msg: unknown) {
    // 先将消息转为字符串
    this.bot.ws!.send(typeof msg === "string" ? msg : JSON.stringify(msg));
  }

}
