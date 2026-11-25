import {parseCsv} from '../src/csv';
import {BusinessError} from './domain';
export function isBankDay(v:string){return /^\d{4}-\d{2}-\d{2}$/.test(v)&&v.slice(0,4)!=='0000'&&!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;}
export function bankNumber(value:unknown){const n=Number(value);if(!Number.isSafeInteger(n)||Math.abs(n)>100000000000000)throw new BusinessError('Bank balance exceeds the supported whole-paisa range.');return n;}
export function bankPaisa(value:string){if(!/^-?\d+(\.\d{1,2})?$/.test(value))throw new BusinessError('Use signed decimal PKR amounts with at most two decimal places.');const negative=value.startsWith('-'),parts=value.replace(/^-/,'').split('.'),n=BigInt(parts[0])*100n+BigInt((parts[1]||'').padEnd(2,'0'));return bankNumber(Number(negative?-n:n));}
export function statementCsv(text:string,from:string,to:string){
 if(text.length>500000)throw new BusinessError('Statement CSV is limited to 500,000 characters.');
 let rows:string[][];try{rows=parseCsv(text.replace(/^\uFEFF/,''));}catch{throw new BusinessError('Malformed statement CSV. Check quotes and line endings.');}
 if(!rows.length||rows[0].map(v=>v.trim()).join(',')!=='date,reference,description,amount_pkr')throw new BusinessError('Use the exact CSV header date,reference,description,amount_pkr.');
 if(rows.length>1001)throw new BusinessError('Import at most 1,000 statement lines.');
 return rows.slice(1).map((row,index)=>{if(row.length!==4)throw new BusinessError(`CSV row ${index+2}: expected four columns.`);const [date,reference,description,amount]=row.map(v=>v.trim());if(!isBankDay(date)||date<from||date>to)throw new BusinessError(`CSV row ${index+2}: date must be within the statement period.`);if(!reference||reference.length>150||!description||description.length>300)throw new BusinessError(`CSV row ${index+2}: reference and description are required (150/300 characters).`);const amount_paisa=bankPaisa(amount);if(!amount_paisa||Math.abs(amount_paisa)>100000000000)throw new BusinessError(`CSV row ${index+2}: use a nonzero amount up to 100,000,000,000 paisa.`);return{line_no:index+1,transaction_date:date,reference,description,amount_paisa};});
}
export function canonicalBankJson(value:unknown):string{if(value instanceof Date)return JSON.stringify(value.toISOString());if(Array.isArray(value))return'['+value.map(canonicalBankJson).join(',')+']';if(value&&typeof value==='object')return'{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b,'en')).map(([key,v])=>JSON.stringify(key)+':'+canonicalBankJson(v)).join(',')+'}';return JSON.stringify(value);}
