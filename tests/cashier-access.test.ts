import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cashierShortcut} from '../src/cashier-access';

const context={page:'pos',modal:'',busy:false,blocked:false,canSell:true,cartSize:1,hasReceipt:false};
const key=(value:string,changes:Partial<Parameters<typeof cashierShortcut>[0]>={})=>({key:value,altKey:false,ctrlKey:false,metaKey:false,shiftKey:false,repeat:false,isComposing:false,defaultPrevented:false,...changes});
test('cashier shortcuts match the SRS and preserve OS/modifier, composition and blocked-workspace behavior',()=>{
 for(const [input,action] of [['F2','search'],['F4','quantity'],['F6','customer'],['F8','discount'],['F9','payment']] as const)assert.equal(cashierShortcut(key(input),context),action);
 for(const flag of ['altKey','ctrlKey','metaKey','shiftKey','repeat','isComposing','defaultPrevented'] as const)assert.equal(cashierShortcut(key('F4',{[flag]:true}),context),null);
 for(const blocked of [{page:'inventory'},{modal:'payment'},{busy:true},{blocked:true},{canSell:false}])for(const value of ['F2','F4','F6','F8','F9'])assert.equal(cashierShortcut(key(value),{...context,...blocked}),null);
 assert.equal(cashierShortcut(key('F4'),{...context,cartSize:0}),null);assert.equal(cashierShortcut(key('F9'),{...context,cartSize:0}),null);assert.equal(cashierShortcut(key('F6'),{...context,cartSize:0}),'customer');
 assert.equal(cashierShortcut(key('Escape'),context),null);assert.equal(cashierShortcut(key('Enter'),context),null);
});
test('receipt print shortcut uses only an open saved receipt and suppresses native printing while its operation is busy',()=>{
 for(const modifier of [{ctrlKey:true},{metaKey:true}]){
  assert.equal(cashierShortcut(key('p',modifier),context),null);
  const receipt={...context,page:'sales',modal:'receipt',hasReceipt:true,canSell:false};
  assert.equal(cashierShortcut(key('P',modifier),receipt),'print');assert.equal(cashierShortcut(key('p',modifier),{...receipt,busy:true}),'wait-print');
  assert.equal(cashierShortcut(key('p',modifier),{...receipt,hasReceipt:false}),null);assert.equal(cashierShortcut(key('p',{...modifier,altKey:true}),receipt),null);
 }
});

test('audited cashier text/status and focus palette reaches the documented contrast targets',()=>{
 // Relative luminance calculation for the actual foreground/background CSS tokens.
 const css=readFileSync('src/styles.css','utf8');
 const luminance=(hex:string)=>{const rgb=hex.match(/[a-f0-9]{2}/gi)!.map(value=>parseInt(value,16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722};
 const ratio=(a:string,b:string)=>{const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);return(values[0]+.05)/(values[1]+.05)};
 for(const [foreground,background] of [['526b77','ffffff'],['425967','fbfcfd'],['247251','e9f5ee'],['8b6112','fff4db'],['ad3434','fdecec'],['ffffff','087e72']]){
  assert.ok(css.includes('#'+foreground)||(foreground==='ffffff'&&/color:white\b/.test(css)));assert.ok(ratio(foreground,background)>=4.5,`${foreground} on ${background}`);
 }
 assert.ok(css.includes('outline:3px solid #155e75'));assert.ok(ratio('155e75','ffffff')>=3);
});
