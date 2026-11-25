import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {refundEntitlement,expectedCash} from '../server/production-domain';
import {encryptBackup,decryptBackup} from '../server/backups';
test('partial returns preserve every paisa across discounted/taxed invoice lines',()=>{const lines=[{id:'a',quantity:3,total_paisa:1000},{id:'b',quantity:2,total_paisa:1001}];let refunded=0;for(const line of lines)for(let n=0;n<line.quantity;n++)refunded+=refundEntitlement(lines,line.id,2099,2001,n,1);assert.equal(refunded,2099);assert.throws(()=>refundEntitlement(lines,'a',2099,2001,2,2));assert.throws(()=>refundEntitlement(lines,'missing',2099,2001,0,1))});
test('drawer formula separates cash collection, change, refunds and paid-outs',()=>assert.equal(expectedCash(10000,45000,3000,2500,1000),54500));
test('encrypted backups round trip; wrong key, tampering and truncation are rejected',()=>{const key=randomBytes(32),payload=Buffer.from('private database fixture');const encrypted=encryptBackup(payload,key);assert.equal(encrypted.includes(payload),false);assert.deepEqual(decryptBackup(encrypted,key),payload);assert.throws(()=>decryptBackup(encrypted,randomBytes(32)));const tampered=Buffer.from(encrypted);tampered[tampered.length-1]^=1;assert.throws(()=>decryptBackup(tampered,key));assert.throws(()=>decryptBackup(encrypted.subarray(0,25),key))});
