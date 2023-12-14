# dingtalk-bot
- 钉钉机器人开发SDK
## install
```shell
npm i dingtalk-bot
```
## usage
```javascript
const {Bot}=require('dingtalk-bot')
const bot=new Bot({
    clientId:'',
    clientSecret:''
})
bot.on('message.group',(e)=>{
	e.reply('hello world')
})
bot.on('message.private',(e)=>{
	e.reply('hi world')
})
bot.sendPrivateMsg('user_id',[
	'你好呀',
	{
		type:'image',
        url:'https://foo.bar/img.jpg'
    }
])

bot.sendGroupMsg('converationId',[
	'你好呀',
	{
		type:'image',
		url:'https://foo.bar/img.jpg'
	}
])
bot.start()
```
