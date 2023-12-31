import {createHash} from "crypto";
import * as path from "path";
import * as os from 'os'
import * as fs from "fs";

export const toObject = <T = any>(data: any) => {
  if (Buffer.isBuffer(data)) return JSON.parse(data.toString()) as T;
  if (typeof data === 'object') return data as T;
  if (typeof data === 'string') return JSON.parse(data) as T;
  // return String(data);
};
export function saveFile(sourceType:'base64',fileMime:string,fileData:string):string
export function saveFile(sourceType:'buffer',fileName:string,fileData:Buffer):string
export function saveFile(sourceType:string,fileMime:string,fileData:string|Buffer):string{
  const hash = createHash('md5')
  hash.update(fileData)
  let fileName:string = fileMime
  if(sourceType==='base64') {
    fileName = `${hash.digest('hex')}.${fileMime.split('/')[1]}`
    fileData=Buffer.from(fileData as string,'base64')
  }
  const filePath = path.resolve(os.tmpdir(),fileName)
  fs.writeFileSync(filePath,fileData)
  return filePath
}
export function md5(data:string|Buffer){
  const encoding=Buffer.isBuffer(data)?'hex':'utf8'
  if(Buffer.isBuffer(data)) data=data.toString('hex')
  return createHash('md5')
      .update(data,encoding)
      .digest('hex')
}
