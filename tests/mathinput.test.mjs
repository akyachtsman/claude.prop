import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evalMath, commitNumericInput } from '../js/mathinput.js';

test('plain numbers pass through', () => {
  assert.deepEqual(evalMath('4'), { ok: true, value: 4 });
  assert.deepEqual(evalMath('1300000'), { ok: true, value: 1300000 });
  assert.deepEqual(evalMath('9.5'), { ok: true, value: 9.5 });
  assert.deepEqual(evalMath('.5'), { ok: true, value: 0.5 });
  assert.deepEqual(evalMath('-3'), { ok: true, value: -3 });
});

test('blank is empty', () => {
  assert.deepEqual(evalMath(''), { empty: true });
  assert.deepEqual(evalMath('   '), { empty: true });
});

test('arithmetic evaluates with precedence', () => {
  assert.equal(evalMath('2+2').value, 4);
  assert.equal(evalMath('1300000/2').value, 650000);
  assert.equal(evalMath('2+3*4').value, 14);          // precedence
  assert.equal(evalMath('(2+3)*4').value, 20);        // parentheses
  assert.equal(evalMath('10-2-3').value, 5);          // left assoc
  assert.equal(evalMath('100 * 1.2 / 100').value, 1.2);
  assert.equal(evalMath('-2 * -3').value, 6);         // unary
});

test('float noise is snapped', () => {
  assert.equal(evalMath('0.1+0.2').value, 0.3);
});

test('invalid / unsafe input is rejected', () => {
  assert.deepEqual(evalMath('2+'), { ok: false });
  assert.deepEqual(evalMath('(2+3'), { ok: false });
  assert.deepEqual(evalMath('2)*3'), { ok: false });
  assert.deepEqual(evalMath('abc'), { ok: false });
  assert.deepEqual(evalMath('alert(1)'), { ok: false });   // no arbitrary JS
  assert.deepEqual(evalMath('1e3'), { ok: false });        // exponent chars not in alphabet
});

test('division by zero is rejected (not Infinity)', () => {
  assert.deepEqual(evalMath('5/0'), { ok: false });
});

test('commitNumericInput maps to {value, display}', () => {
  assert.deepEqual(commitNumericInput('2+2'), { value: 4, display: '4' });
  assert.deepEqual(commitNumericInput(''), { value: 0, display: '' });
  assert.deepEqual(commitNumericInput('650000'), { value: 650000, display: '650000' });
  // unparseable falls back to a lenient read, then 0 — never NaN
  assert.deepEqual(commitNumericInput('12abc'), { value: 12, display: '12' });
  assert.deepEqual(commitNumericInput('!!'), { value: 0, display: '' });
});
