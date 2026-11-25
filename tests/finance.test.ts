import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateEntries} from '../server/finance';
test('journals require whole-paisa balanced entries and reject double-sided or zero lines',()=>{assert.equal(validateEntries([{account_code:'1000',debit_paisa:12000,credit_paisa:0},{account_code:'3000',debit_paisa:0,credit_paisa:12000}]),12000);assert.throws(()=>validateEntries([{account_code:'1000',debit_paisa:10,credit_paisa:0},{account_code:'3000',debit_paisa:0,credit_paisa:9}]));assert.throws(()=>validateEntries([{account_code:'1000',debit_paisa:1,credit_paisa:1},{account_code:'3000',debit_paisa:0,credit_paisa:0}]));assert.throws(()=>validateEntries([{account_code:'1000',debit_paisa:0.5,credit_paisa:0},{account_code:'3000',debit_paisa:0,credit_paisa:0.5}]))});
