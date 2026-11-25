import {test} from 'node:test';
import assert from 'node:assert/strict';
import {currencyInput,monetaryPolicy} from '../server/currency-policy';
test('accepted PKR-only policy preserves omitted legacy settings and rejects currency relabeling',()=>{assert.equal(currencyInput.parse(undefined),'PKR');assert.equal(currencyInput.parse('PKR'),'PKR');for(const value of ['USD','EUR','pkr','',null,100])assert.equal(currencyInput.safeParse(value).success,false);assert.equal(monetaryPolicy.currency,'PKR');assert.equal(monetaryPolicy.currency_switching_supported,false);assert.equal(monetaryPolicy.fx_supported,false)});
