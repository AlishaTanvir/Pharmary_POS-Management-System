import {BusinessError,integer} from './domain';
// Allocate whole-paisa invoice net amounts across lines with cumulative rounding.
// The telescoping difference guarantees every full-invoice return sums exactly to net payable.
export function refundEntitlement(lines:{id:string;total_paisa:number|string;quantity:number}[],lineId:string,net:number,subtotal:number,already:number,quantity:number){
 const sorted=[...lines].sort((a,b)=>a.id.localeCompare(b.id));const line=sorted.find(l=>l.id===lineId);if(!line||already+quantity>line.quantity)throw new BusinessError('Return quantity exceeds the remaining quantity sold.',409);integer(quantity,'Return quantity',1);if(!subtotal)return 0;
 const before=sorted.slice(0,sorted.indexOf(line)).reduce((sum,l)=>sum+BigInt(l.total_paisa),0n);const divide=(v:bigint,d:bigint)=>(v+d/2n)/d;const lineNet=divide((before+BigInt(line.total_paisa))*BigInt(net),BigInt(subtotal))-divide(before*BigInt(net),BigInt(subtotal));
 const cumulative=(q:number)=>divide(lineNet*BigInt(q),BigInt(line.quantity));return Number(cumulative(already+quantity)-cumulative(already));
}
export function expectedCash(opening:number,sales:number,collections:number,refunds:number,paidOut:number){for(const value of [opening,sales,collections,refunds,paidOut])integer(value,'Cash component');const result=opening+sales+collections-refunds-paidOut;if(!Number.isSafeInteger(result))throw new BusinessError('Cash total exceeds supported precision.');return result}
