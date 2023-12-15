import {createHash} from "crypto";

export const toObject = <T = any>(data: any) => {
  if (Buffer.isBuffer(data)) return JSON.parse(data.toString()) as T;
  if (typeof data === 'object') return data as T;
  if (typeof data === 'string') return JSON.parse(data) as T;
  // return String(data);
};
export function md5(data:string|Buffer){
  const encoding=Buffer.isBuffer(data)?'hex':'utf8'
  if(Buffer.isBuffer(data)) data=data.toString('hex')
  return createHash('md5')
      .update(data,encoding)
      .digest('hex')
}
